import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { initTransitions } from "./transitions";
import { verificarSesionOLogin } from "../../BD/sesion";
import { obtenerSalones, type Salon } from "../../BD/salones";
import Database from "@tauri-apps/plugin-sql";
import {
    obtenerEstadisticasSalon,
    obtenerRankingAlumnos,
    obtenerTendenciaSalon,
    obtenerDatosMLSalon,
    obtenerCalificacionesAlumno,
    obtenerKpisAlumno,
    type TendenciaPunto,
    type AlumnoRanking,
} from "../../BD/reportes";

// ─── Shared state (set in DOMContentLoaded) ───────────────────────────────────
let docenteId = 0;
let salones: Salon[] = [];

// ─── DB helper ────────────────────────────────────────────────────────────────
let _db: Database | null = null;
async function getDB(): Promise<Database> {
    if (_db) return _db;
    _db = await Database.load("sqlite:karuna.db");
    return _db;
}

// ─── Chart helpers ────────────────────────────────────────────────────────────
let chartTendenciaAula: any  = null;
let chartAsistenciaAula: any = null;
let chartTendenciaAlumno: any = null;
let chartRadarAlumno: any    = null;

function destroyChart(c: any) { try { c?.destroy(); } catch (_) {} }
function isDark()       { return document.documentElement.classList.contains("dark"); }
function textColor()    { return isDark() ? "#c9d1d9" : "#475569"; }
function gridColor()    { return isDark() ? "rgba(255,255,255,0.06)" : "rgba(30,27,75,0.06)"; }
const PRIMARY = "#D4AF37";

// ─── Tab switching ────────────────────────────────────────────────────────────
const TABS = [
    { btn: "btn-tab-aula",   panel: "panel-aula" },
    { btn: "btn-tab-alumno", panel: "panel-alumno" },
    { btn: "btn-tab-ml",     panel: "panel-ml" },
];

function activateTab(idx: number) {
    TABS.forEach((t, i) => {
        document.getElementById(t.btn)?.classList.toggle("tab-active", i === idx);
        document.getElementById(t.panel)?.classList.toggle("hidden", i !== idx);
    });
}

// ─── Populate selectors ───────────────────────────────────────────────────────
async function populateSalonSelectors() {
    salones = await obtenerSalones(docenteId);
    const opts  = salones.map(s => `<option value="${s.id}">${s.nombre} — ${s.materia}</option>`).join("");
    const empty = `<option value="">— Seleccionar salón —</option>`;
    ["select-salon-aula", "select-salon-alumno", "select-salon-ml"].forEach(id => {
        const el = document.getElementById(id) as HTMLSelectElement | null;
        if (el) el.innerHTML = empty + opts;
    });
}

// ─── PANEL AULA ───────────────────────────────────────────────────────────────
async function loadAulaStats(salonId: number) {
    const [stats, tendencia, ranking] = await Promise.all([
        obtenerEstadisticasSalon(salonId),
        obtenerTendenciaSalon(salonId),
        obtenerRankingAlumnos(salonId),
    ]);

    const db = await getDB();
    const configRows = await db.select<{ calificacion_minima: number }[]>(
        `SELECT calificacion_minima FROM CONFIG_AULA WHERE salon_id = ?`, [salonId]
    ).catch(() => [] as { calificacion_minima: number }[]);
    const calMin = configRows[0]?.calificacion_minima ?? 60;

    // KPI grid
    document.getElementById("kpi-aula-grid")!.innerHTML = `
        <div class="kpi-card">
            <div class="size-9 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-3">
                <span class="material-symbols-outlined text-lg">calculate</span>
            </div>
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Promedio General</p>
            <p class="text-3xl font-black text-indigo-deep dark:text-white mt-1">${stats.promedioCalificaciones ?? "—"}</p>
        </div>
        <div class="kpi-card">
            <div class="size-9 bg-indigo-deep/10 rounded-xl flex items-center justify-center text-indigo-deep dark:text-white mb-3">
                <span class="material-symbols-outlined text-lg">event_available</span>
            </div>
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asistencia Media</p>
            <p class="text-3xl font-black text-indigo-deep dark:text-white mt-1">${stats.promedioAsistencia != null ? stats.promedioAsistencia + "%" : "—%"}</p>
        </div>
        <div class="kpi-card">
            <div class="size-9 bg-green-100 rounded-xl flex items-center justify-center text-green-600 dark:text-green-400 mb-3">
                <span class="material-symbols-outlined text-lg">assignment_turned_in</span>
            </div>
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tasa de Entrega</p>
            <p class="text-3xl font-black text-indigo-deep dark:text-white mt-1">${stats.tasaEntrega != null ? stats.tasaEntrega + "%" : "—"}</p>
        </div>
        <div class="kpi-card">
            <div class="size-9 ${stats.alumnosEnRiesgo > 0 ? "bg-red-100" : "bg-green-100"} rounded-xl flex items-center justify-center ${stats.alumnosEnRiesgo > 0 ? "text-red-500" : "text-green-500"} mb-3">
                <span class="material-symbols-outlined text-lg">${stats.alumnosEnRiesgo > 0 ? "warning" : "verified"}</span>
            </div>
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">En Riesgo (&lt;${calMin})</p>
            <p class="text-3xl font-black ${stats.alumnosEnRiesgo > 0 ? "text-red-500" : "text-green-500"} mt-1">${stats.alumnosEnRiesgo}</p>
        </div>`;

    // Show charts row
    document.getElementById("charts-aula-row")!.style.cssText =
        "display:grid;grid-template-columns:3fr 2fr;gap:1.5rem;";

    // Tendencia line chart
    destroyChart(chartTendenciaAula);
    const tCtx = (document.getElementById("chart-tendencia-aula") as HTMLCanvasElement).getContext("2d")!;
    chartTendenciaAula = new (window as any).Chart(tCtx, {
        type: "line",
        data: {
            labels: tendencia.map((t: TendenciaPunto) =>
                t.label.length > 20 ? t.label.slice(0, 18) + "…" : t.label),
            datasets: [{ label: "Promedio",
                data: tendencia.map((t: TendenciaPunto) => t.promedio),
                borderColor: PRIMARY, backgroundColor: "rgba(212,175,55,0.12)",
                borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: PRIMARY,
                tension: 0.4, fill: true, spanGaps: true }],
        },
        options: { responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: gridColor() }, ticks: { color: textColor(), font: { size: 10 } } },
                y: { min: 0, max: 100, grid: { color: gridColor() }, ticks: { color: textColor() } },
            },
        },
    });

    // Asistencia doughnut
    destroyChart(chartAsistenciaAula);
    const asistPct = stats.promedioAsistencia ?? 0;
    const aCtx = (document.getElementById("chart-asistencia-aula") as HTMLCanvasElement).getContext("2d")!;
    chartAsistenciaAula = new (window as any).Chart(aCtx, {
        type: "doughnut",
        data: {
            labels: ["Presentes", "Ausentes"],
            datasets: [{ data: [asistPct, Math.max(0, 100 - asistPct)],
                backgroundColor: [PRIMARY, "#e2e8f0"], borderWidth: 0 }],
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: "72%",
            plugins: {
                legend: { position: "bottom" as const, labels: { color: textColor(), font: { size: 11 } } },
                tooltip: { callbacks: { label: (ctx: any) => ` ${ctx.parsed.toFixed(1)}%` } },
            },
        },
    });

    // Ranking table
    document.getElementById("ranking-aula-section")!.style.display = "block";
    document.getElementById("ranking-count")!.textContent = `${ranking.length} alumnos`;
    const tbody = document.getElementById("tbody-ranking")!;
    if (ranking.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-slate-400 text-sm">Sin alumnos en este salón.</td></tr>`;
        return;
    }
    tbody.innerHTML = ranking.map((a: AlumnoRanking, idx: number) => {
        const prom    = a.promedio   != null ? Number(a.promedio).toFixed(1)   : "—";
        const asist   = a.asistencia != null ? Number(a.asistencia).toFixed(1) + "%" : "—";
        const enRiesgo = a.promedio  != null && a.promedio < calMin;
        const badge   = idx === 0 ? "rank-1" : idx === 1 ? "rank-2" : idx === 2 ? "rank-3" : "rank-other";
        return `
        <tr class="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors cursor-pointer"
            onclick="location.href='detalle_alumno.html?id=${a.id}&salon_id=${salonId}'">
            <td class="px-6 py-3"><div class="rank-badge ${badge}">${idx + 1}</div></td>
            <td class="px-6 py-3">
                <div class="flex items-center gap-3">
                    <div class="size-8 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center font-bold text-xs text-indigo-deep dark:text-primary">
                        ${a.nombre[0]}${a.apellido[0]}
                    </div>
                    <div>
                        <p class="font-semibold text-sm text-slate-900 dark:text-white">${a.nombre} ${a.apellido}</p>
                        <p class="text-xs text-slate-400 font-mono">${a.id_control}</p>
                    </div>
                </div>
            </td>
            <td class="px-6 py-3 text-center font-black text-sm ${enRiesgo ? "text-red-500" : "text-green-600 dark:text-green-400"}">${prom}</td>
            <td class="px-6 py-3 text-center text-sm font-medium text-slate-600 dark:text-slate-300">${asist}</td>
            <td class="px-6 py-3 text-center">
                <span class="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                    enRiesgo ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                             : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}">
                    <span class="material-symbols-outlined text-sm">${enRiesgo ? "warning" : "check_circle"}</span>
                    ${enRiesgo ? "En riesgo" : "Regular"}
                </span>
            </td>
        </tr>`;
    }).join("");
}

// ─── PANEL ALUMNO ─────────────────────────────────────────────────────────────
async function loadAlumnoList(salonId: number) {
    const alumnoSel = document.getElementById("select-alumno") as HTMLSelectElement;
    alumnoSel.disabled = !salonId;
    alumnoSel.innerHTML = `<option value="">— Seleccionar alumno —</option>`;
    document.getElementById("alumno-content")?.classList.add("hidden");
    document.getElementById("alumno-placeholder")?.classList.remove("hidden");
    if (!salonId) return;

    const db = await getDB();
    const alumnos = await db.select<{ id: number; nombre: string; apellido: string }[]>(
        `SELECT id, nombre, apellido FROM ESTUDIANTE WHERE salon_id = ? ORDER BY apellido, nombre`, [salonId]
    );
    alumnoSel.innerHTML = `<option value="">— Seleccionar alumno —</option>` +
        alumnos.map(a => `<option value="${a.id}">${a.apellido}, ${a.nombre}</option>`).join("");
}

async function loadAlumnoStats(salonId: number, alumnoId: number) {
    document.getElementById("alumno-placeholder")?.classList.add("hidden");
    document.getElementById("alumno-content")?.classList.remove("hidden");

    const [kpis, calificaciones] = await Promise.all([
        obtenerKpisAlumno(salonId, alumnoId),
        obtenerCalificacionesAlumno(salonId, alumnoId),
    ]);

    document.getElementById("alum-kpi-promedio")!.textContent   = kpis.promedio   != null ? String(kpis.promedio)   : "—";
    document.getElementById("alum-kpi-asistencia")!.textContent = kpis.asistencia != null ? kpis.asistencia + "%" : "—%";
    document.getElementById("alum-kpi-entregas")!.textContent   = `${kpis.entregadas}/${kpis.totalAsig}`;

    // Tendencia line
    destroyChart(chartTendenciaAlumno);
    const ctx1 = (document.getElementById("chart-tendencia-alumno") as HTMLCanvasElement).getContext("2d")!;
    chartTendenciaAlumno = new (window as any).Chart(ctx1, {
        type: "line",
        data: {
            labels: calificaciones.map(c => c.titulo.length > 15 ? c.titulo.slice(0, 13) + "…" : c.titulo),
            datasets: [{ label: "Calificación",
                data: calificaciones.map(c => c.calificacion),
                borderColor: PRIMARY, backgroundColor: "rgba(212,175,55,0.12)",
                borderWidth: 2.5, pointRadius: 5, pointBackgroundColor: PRIMARY,
                tension: 0.4, fill: true, spanGaps: false }],
        },
        options: { responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: gridColor() }, ticks: { color: textColor(), font: { size: 9 } } },
                y: { min: 0, max: 100, grid: { color: gridColor() }, ticks: { color: textColor() } },
            },
        },
    });

    // Radar
    const exam  = calificaciones.filter(c => c.tipo === "examen" && c.calificacion != null);
    const tarea = calificaciones.filter(c => c.tipo === "tarea"  && c.calificacion != null);
    const pExam  = exam.length  > 0 ? exam.reduce((s, c)  => s + c.calificacion!, 0) / exam.length  : 0;
    const pTarea = tarea.length > 0 ? tarea.reduce((s, c) => s + c.calificacion!, 0) / tarea.length : 0;

    destroyChart(chartRadarAlumno);
    const ctx2 = (document.getElementById("chart-radar-alumno") as HTMLCanvasElement).getContext("2d")!;
    chartRadarAlumno = new (window as any).Chart(ctx2, {
        type: "radar",
        data: {
            labels: ["Exámenes", "Tareas", "Asistencia", "Entregas", "Promedio"],
            datasets: [{ label: "Alumno",
                data: [pExam, pTarea, kpis.asistencia ?? 0,
                       kpis.totalAsig > 0 ? (kpis.entregadas / kpis.totalAsig) * 100 : 0,
                       kpis.promedio ?? 0],
                borderColor: PRIMARY, backgroundColor: "rgba(212,175,55,0.15)",
                pointBackgroundColor: PRIMARY, borderWidth: 2 }],
        },
        options: { responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { r: { min: 0, max: 100, ticks: { display: false },
                grid: { color: gridColor() }, pointLabels: { color: textColor(), font: { size: 10 } } } },
        },
    });

    // Tabla calificaciones
    document.getElementById("tbody-alumno-cals")!.innerHTML = calificaciones.map(c => {
        const cal   = c.calificacion != null ? Number(c.calificacion).toFixed(1) : "—";
        const color = c.calificacion == null ? "text-slate-400"
                    : c.calificacion >= 70 ? "text-green-600 dark:text-green-400" : "text-red-500";
        const badge = c.tipo === "examen"
            ? `<span class="text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-0.5 rounded-full uppercase">Examen</span>`
            : `<span class="text-[10px] font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-0.5 rounded-full uppercase">Tarea</span>`;
        return `<tr class="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
            <td class="px-6 py-3 text-sm font-medium text-slate-700 dark:text-slate-200">${c.titulo}</td>
            <td class="px-6 py-3 text-center">${badge}</td>
            <td class="px-6 py-3 text-center font-black text-sm ${color}">${cal}</td>
        </tr>`;
    }).join("");
}

// ─── PANEL ML ─────────────────────────────────────────────────────────────────
let currentMLBtn: HTMLElement | null = null;

function setMLState(state: "empty" | "loading" | "result" | "error") {
    const ids = { empty: "ml-empty-state", loading: "ml-loading-state", result: "ml-result-state", error: "ml-error-state" };
    (Object.entries(ids) as [string, string][]).forEach(([key, id]) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (id === "ml-loading-state") el.style.display = key === state ? "flex" : "none";
        else el.classList.toggle("hidden", key !== state);
    });
}

async function runMLAnalysis(btn: HTMLElement) {
    const salonSel = document.getElementById("select-salon-ml") as HTMLSelectElement;
    const salonId  = Number(salonSel?.value ?? 0);
    if (!salonId) { alert("Selecciona un salón primero."); return; }

    const script      = btn.dataset.script!;
    const tipo        = btn.dataset.tipo!;
    const salonNombre = salonSel.options[salonSel.selectedIndex].text;
    const modelNombre = btn.querySelector("p")?.textContent ?? script;

    if (currentMLBtn) currentMLBtn.classList.remove("active");
    btn.classList.add("active");
    currentMLBtn = btn;

    setMLState("loading");
    (document.getElementById("ml-loading-text") as HTMLElement).textContent = `Ejecutando ${modelNombre}…`;

    try {
        const datosML = await obtenerDatosMLSalon(salonId);
        if (datosML.length < 2) {
            setMLState("error");
            (document.getElementById("ml-error-text") as HTMLElement).textContent =
                `Necesita al menos 2 alumnos con calificaciones. Actualmente: ${datosML.length}.`;
            return;
        }

        const payload: Record<string, any> = {
            alumnos: datosML.map(d => ({ cal_final: d.cal_final, prom_tareas: d.prom_tareas, prom_asist: d.prom_asist })),
            nombre_grupo: salonNombre, umbral: 70,
        };
        if (tipo === "clustering") { payload.k = 3; payload.eps = 0.8; payload.min_samples = 3; }

        const raw: string = await invoke("ejecutar_ml", {
            scriptPath: `src/ml/${script}`,
            datosJson:  JSON.stringify(payload),
        });

        const result  = JSON.parse(raw);
        const imagen  = result.imagen  as string;
        const resumen = result.resumen as Record<string, any>;

        (document.getElementById("ml-result-image") as HTMLImageElement).src = `data:image/png;base64,${imagen}`;
        document.getElementById("ml-result-title")!.textContent    = resumen.algoritmo ?? modelNombre;
        document.getElementById("ml-result-subtitle")!.textContent = `${salonNombre} · ${datosML.length} alumnos`;
        document.getElementById("ml-summary-cards")!.innerHTML     = buildMLCards(resumen, tipo);
        renderMLCharts(resumen, tipo);
        setMLState("result");

    } catch (err: any) {
        setMLState("error");
        document.getElementById("ml-error-text")!.textContent = String(err);
    }
}

function buildMLCards(r: Record<string, any>, tipo: string): string {
    const card = (icon: string, label: string, value: string, color = "text-indigo-deep dark:text-white") =>
        `<div class="bg-slate-50 dark:bg-white/5 rounded-xl p-4 flex items-center gap-3">
            <span class="material-symbols-outlined text-primary">${icon}</span>
            <div><p class="text-[10px] text-slate-400 uppercase font-black tracking-widest">${label}</p>
            <p class="font-black text-lg ${color}">${value}</p></div></div>`;

    if (tipo === "clasificacion") {
        const acc = r.accuracy != null ? (Number(r.accuracy) * 100).toFixed(1) + "%" : "—";
        return card("people", "Total", String(r.n_alumnos))
             + card("check_circle", "Aprueban", String(r.n_aprueba), "text-green-600 dark:text-green-400")
             + card("cancel",       "Reprueban", String(r.n_reprueba), "text-red-500")
             + card("precision_manufacturing", "Accuracy", acc, "text-primary");
    }
    if (tipo === "clustering") {
        const p = r.perfiles ?? {};
        return card("groups", "Total", String(r.n_alumnos))
             + card("trending_up",   "Alto",  String(p.alto  ?? 0), "text-green-600 dark:text-green-400")
             + card("remove",        "Medio", String(p.medio ?? 0), "text-blue-500")
             + card("trending_down", "Bajo",  String(p.bajo  ?? 0), "text-red-500");
    }
    if (tipo === "supervivencia") {
        const ev = r.eventos ?? {};
        const rep = ev.reprobacion?.tasa_evento != null ? (ev.reprobacion.tasa_evento * 100).toFixed(1) + "%" : "—";
        const des = ev.desercion?.tasa_evento   != null ? (ev.desercion.tasa_evento   * 100).toFixed(1) + "%" : "—";
        return card("people", "Total", String(r.n_alumnos))
             + card("school",  "Riesgo Reprobación", rep, "text-red-500")
             + card("logout",  "Riesgo Deserción",   des, "text-orange-500");
    }
    return card("bar_chart", "Alumnos", String(r.n_alumnos));
}

// ─── ML Native Charts ─────────────────────────────────────────────────────────
let mlChart1: any = null;
let mlChart2: any = null;
let mlChart3: any = null;

function destroyMLCharts() {
    try { mlChart1?.destroy(); } catch(_){}
    try { mlChart2?.destroy(); } catch(_){}
    try { mlChart3?.destroy(); } catch(_){}
    mlChart1 = mlChart2 = mlChart3 = null;
}

function renderMLCharts(resumen: Record<string, any>, tipo: string) {
    destroyMLCharts();
    const area = document.getElementById("ml-charts-area")!;
    area.innerHTML = "";

    const Chart = (window as any).Chart;
    const primary = "#D4AF37";
    const green   = "#4ade80";
    const red     = "#f87171";
    const blue    = "#60a5fa";
    const gray    = "#9ca3af";

    const darkBg  = isDark() ? "#1a1a2e" : "#ffffff";
    const darkTxt = textColor();
    const darkGrid= gridColor();

    if (tipo === "clasificacion") {
        const nAp  = resumen.n_aprueba  ?? 0;
        const nRep = resumen.n_reprueba ?? 0;
        const imp  = resumen.importancias ?? resumen.coeficientes ?? null;
        const probs= (resumen.probabilidades ?? []) as number[];

        area.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5 p-6">
            <!-- Donut aprueba/reprueba -->
            <div class="bg-slate-50 dark:bg-white/5 rounded-2xl p-5 flex flex-col items-center">
                <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Distribución</p>
                <div style="height:180px;width:180px;"><canvas id="ml-c1"></canvas></div>
                <div class="flex gap-4 mt-3 text-xs">
                    <span class="flex items-center gap-1"><span style="background:${green};width:10px;height:10px;border-radius:50%;display:inline-block;"></span>Aprueba <strong>${nAp}</strong></span>
                    <span class="flex items-center gap-1"><span style="background:${red};width:10px;height:10px;border-radius:50%;display:inline-block;"></span>Reprueba <strong>${nRep}</strong></span>
                </div>
            </div>
            <!-- Importancia / Coeficientes -->
            <div class="bg-slate-50 dark:bg-white/5 rounded-2xl p-5">
                <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">${imp && 'cal_final' in imp && !('prom_tareas' in Object.keys(imp)) ? 'Importancia de Variables' : 'Variables del Modelo'}</p>
                <div style="height:180px;"><canvas id="ml-c2"></canvas></div>
            </div>
            <!-- Distribución de probabilidades -->
            <div class="bg-slate-50 dark:bg-white/5 rounded-2xl p-5">
                <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Probabilidad de Aprobar</p>
                <div style="height:180px;"><canvas id="ml-c3"></canvas></div>
            </div>
        </div>`;

        // C1: Donut
        const c1 = (document.getElementById("ml-c1") as HTMLCanvasElement).getContext("2d")!;
        mlChart1 = new Chart(c1, {
            type: "doughnut",
            data: { labels: ["Aprueba","Reprueba"], datasets: [{ data: [nAp, nRep], backgroundColor:[green,red], borderWidth:0 }] },
            options: { responsive:true, maintainAspectRatio:false, cutout:"70%",
                plugins:{ legend:{display:false}, tooltip:{callbacks:{label:(ctx:any)=>`${ctx.label}: ${ctx.parsed}`}} } }
        });

        // C2: Barras de importancias/coeficientes
        if (imp) {
            const keys   = ["cal_final","prom_tareas","prom_asist"];
            const labels2 = ["Cal. Final","Prom. Tareas","Asistencia"];
            const vals   = keys.map(k => Math.abs(Number(imp[k] ?? 0)));
            const colors2= vals.map(v => v > 0.4 ? primary : v > 0.2 ? blue : gray);
            const c2 = (document.getElementById("ml-c2") as HTMLCanvasElement).getContext("2d")!;
            mlChart2 = new Chart(c2, {
                type:"bar",
                data:{ labels:labels2, datasets:[{ data:vals, backgroundColor:colors2, borderRadius:6, borderSkipped:false }] },
                options:{ responsive:true, maintainAspectRatio:false, indexAxis:"y" as const,
                    plugins:{ legend:{display:false} },
                    scales:{ x:{grid:{color:darkGrid},ticks:{color:darkTxt},max:1},
                             y:{grid:{color:darkGrid},ticks:{color:darkTxt}} } }
            });
        }

        // C3: Histograma de probabilidades
        if (probs.length > 0) {
            const buckets = Array(10).fill(0);
            probs.forEach(p => { const b = Math.min(9, Math.floor(p * 10)); buckets[b]++; });
            const bLabels = ["0-10%","10-20%","20-30%","30-40%","40-50%","50-60%","60-70%","70-80%","80-90%","90-100%"];
            const bColors = buckets.map((_,i) => i < 4 ? red : i < 6 ? primary : green);
            const c3 = (document.getElementById("ml-c3") as HTMLCanvasElement).getContext("2d")!;
            mlChart3 = new Chart(c3, {
                type:"bar",
                data:{ labels:bLabels, datasets:[{ data:buckets, backgroundColor:bColors, borderRadius:4, borderSkipped:false }] },
                options:{ responsive:true, maintainAspectRatio:false,
                    plugins:{ legend:{display:false} },
                    scales:{ x:{grid:{color:darkGrid},ticks:{color:darkTxt,font:{size:9},maxRotation:45}},
                             y:{grid:{color:darkGrid},ticks:{color:darkTxt},stepSize:1} } }
            });
        }

    } else if (tipo === "clustering") {
        const p        = resumen.perfiles ?? {};
        const calSorted= (resumen.cal_sorted ?? []) as {cal:number; perfil:string}[];
        const sil      = resumen.silhouette;

        const perfilColor: Record<string,string> = { alto:green, medio:blue, bajo:red, atipico:gray };
        const perfilLabel: Record<string,string> = { alto:"Alto rendimiento", medio:"Medio rendimiento", bajo:"Bajo rendimiento", atipico:"Atípico" };

        area.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5 p-6">
            <!-- Barras perfiles -->
            <div class="bg-slate-50 dark:bg-white/5 rounded-2xl p-5">
                <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Perfiles de Rendimiento</p>
                <div style="height:180px;"><canvas id="ml-c1"></canvas></div>
            </div>
            <!-- Calificaciones ordenadas por perfil -->
            <div class="bg-slate-50 dark:bg-white/5 rounded-2xl p-5 md:col-span-2">
                <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Calificación por Alumno (ordenado)</p>
                <div style="height:180px;"><canvas id="ml-c2"></canvas></div>
            </div>
            ${sil != null ? `
            <!-- Silhouette -->
            <div class="bg-slate-50 dark:bg-white/5 rounded-2xl p-5 md:col-span-3">
                <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Silhouette Score (calidad de agrupamiento)</p>
                <div class="flex items-center gap-4 mt-3">
                    <div class="flex-1 bg-slate-200 dark:bg-white/10 rounded-full h-4 overflow-hidden">
                        <div style="width:${(sil*100).toFixed(1)}%;background:${sil>=0.5?green:sil>=0.3?primary:red};height:100%;border-radius:9999px;transition:width 1s ease"></div>
                    </div>
                    <span class="font-black text-xl" style="color:${sil>=0.5?green:sil>=0.3?primary:red}">${sil.toFixed(3)}</span>
                    <span class="text-xs text-slate-400">${sil>=0.5?"Buena separación":sil>=0.3?"Aceptable":"Baja cohesión"}</span>
                </div>
            </div>` : ""}
        </div>`;

        // C1: Donut perfiles
        const pKeys   = ["alto","medio","bajo","atipico"].filter(k => (p[k]??0) > 0);
        const pVals   = pKeys.map(k => p[k] ?? 0);
        const pColors = pKeys.map(k => perfilColor[k]);
        const pLabels = pKeys.map(k => perfilLabel[k]);
        const c1 = (document.getElementById("ml-c1") as HTMLCanvasElement).getContext("2d")!;
        mlChart1 = new Chart(c1, {
            type:"bar",
            data:{ labels:pLabels, datasets:[{ data:pVals, backgroundColor:pColors, borderRadius:8, borderSkipped:false }] },
            options:{ responsive:true, maintainAspectRatio:false,
                plugins:{ legend:{display:false} },
                scales:{ x:{grid:{color:darkGrid},ticks:{color:darkTxt,font:{size:10}}},
                         y:{grid:{color:darkGrid},ticks:{color:darkTxt},stepSize:1} } }
        });

        // C2: Cal sorted
        if (calSorted.length > 0) {
            const calVals   = calSorted.map(d => d.cal);
            const calColors = calSorted.map(d => perfilColor[d.perfil] ?? gray);
            const c2 = (document.getElementById("ml-c2") as HTMLCanvasElement).getContext("2d")!;
            mlChart2 = new Chart(c2, {
                type:"bar",
                data:{ labels: calSorted.map((_,i)=>String(i+1)),
                       datasets:[{ data:calVals, backgroundColor:calColors, borderRadius:3, borderSkipped:false }] },
                options:{ responsive:true, maintainAspectRatio:false,
                    plugins:{ legend:{display:false}, tooltip:{callbacks:{label:(ctx:any)=>`Cal: ${ctx.parsed.y}`}} },
                    scales:{ x:{grid:{display:false},ticks:{display:false}},
                             y:{min:0,max:100,grid:{color:darkGrid},ticks:{color:darkTxt}} } }
            });
        }

    } else if (tipo === "supervivencia") {
        const ev = resumen.eventos ?? {};
        const repTasa = ev.reprobacion?.tasa_evento ?? 0;
        const desTasa = ev.desercion?.tasa_evento ?? 0;

        area.innerHTML = `
        <div class="grid grid-cols-2 gap-5 p-6">
            <div class="bg-slate-50 dark:bg-white/5 rounded-2xl p-5">
                <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Riesgo Reprobación</p>
                <div style="height:160px;"><canvas id="ml-c1"></canvas></div>
            </div>
            <div class="bg-slate-50 dark:bg-white/5 rounded-2xl p-5">
                <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Riesgo Deserción</p>
                <div style="height:160px;"><canvas id="ml-c2"></canvas></div>
            </div>
        </div>`;

        const makeRisk = (id: string, tasa: number, label: string, color: string) => {
            const ctx = (document.getElementById(id) as HTMLCanvasElement).getContext("2d")!;
            return new Chart(ctx, {
                type:"doughnut",
                data:{ labels:[label,"Sin riesgo"], datasets:[{ data:[+(tasa*100).toFixed(1), +(100-tasa*100).toFixed(1)], backgroundColor:[color,isDark()?"#2a2a4a":"#e2e8f0"], borderWidth:0 }] },
                options:{ responsive:true, maintainAspectRatio:false, cutout:"70%",
                    plugins:{ legend:{display:false},
                        tooltip:{callbacks:{label:(ctx:any)=>`${ctx.label}: ${ctx.parsed.toFixed(1)}%`}} } }
            });
        };
        mlChart1 = makeRisk("ml-c1", repTasa, "En riesgo", red);
        mlChart2 = makeRisk("ml-c2", desTasa, "En riesgo", "#f97316");
    }
}


// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Session check — same as lobby_aulas.ts
    const sesion = verificarSesionOLogin();
    docenteId    = sesion.docente_id;

    // 2. Header
    const nombreEl = document.getElementById("nombre_docente");
    if (nombreEl) nombreEl.textContent = `${sesion.nombre} ${sesion.apellido}`;
    const fotoPath = localStorage.getItem("foto_perfil");
    const fotoEl   = document.getElementById("imagen-perfil") as HTMLImageElement | null;
    if (fotoEl && fotoPath) fotoEl.src = convertFileSrc(fotoPath);

    // 3. Transitions & theme
    initTransitions();

    const htmlEl = document.documentElement;
    const saved  = localStorage.getItem("theme");
    if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
        htmlEl.classList.add("dark"); htmlEl.classList.remove("light");
    }
    document.getElementById("theme-toggle")?.addEventListener("click", () => {
        htmlEl.classList.toggle("dark"); htmlEl.classList.toggle("light");
        localStorage.setItem("theme", htmlEl.classList.contains("dark") ? "dark" : "light");
    });

    // 4. Remove splash overlay
    const overlay = document.getElementById("page-overlay");
    if (overlay) {
        overlay.style.transition = "opacity 0.4s ease";
        overlay.style.opacity    = "0";
        setTimeout(() => overlay.remove(), 400);
    }

    // 5. Load salon selectors
    await populateSalonSelectors();

    // 6. Wire tab buttons
    TABS.forEach((t, idx) => {
        document.getElementById(t.btn)?.addEventListener("click", () => activateTab(idx));
    });
    activateTab(0);

    // 7. Wire aula selector
    document.getElementById("select-salon-aula")?.addEventListener("change", async (e) => {
        const id = Number((e.target as HTMLSelectElement).value);
        if (!id) return;
        document.getElementById("kpi-aula-grid")!.innerHTML =
            `<div class="kpi-card col-span-full text-center py-6 text-slate-400">Cargando…</div>`;
        await loadAulaStats(id);
    });

    // 8. Wire alumno selectors
    document.getElementById("select-salon-alumno")?.addEventListener("change", async (e) => {
        await loadAlumnoList(Number((e.target as HTMLSelectElement).value));
    });
    document.getElementById("select-alumno")?.addEventListener("change", async (e) => {
        const alumnoId = Number((e.target as HTMLSelectElement).value);
        const salonId  = Number((document.getElementById("select-salon-alumno") as HTMLSelectElement).value);
        if (alumnoId && salonId) await loadAlumnoStats(salonId, alumnoId);
    });

    // 9. Wire ML buttons
    document.querySelectorAll(".ml-btn").forEach(btn => {
        btn.addEventListener("click", () => runMLAnalysis(btn as HTMLElement));
    });

    // 10. Fullscreen modal
    document.getElementById("btn-fullscreen-ml")?.addEventListener("click", () => {
        const img = (document.getElementById("ml-result-image") as HTMLImageElement).src;
        (document.getElementById("modal-fullscreen-img") as HTMLImageElement).src = img;
        document.getElementById("modal-fullscreen")?.classList.remove("hidden");
    });
    document.getElementById("btn-close-fullscreen")?.addEventListener("click", () => {
        document.getElementById("modal-fullscreen")?.classList.add("hidden");
    });
    document.getElementById("ml-result-image")?.addEventListener("click", () => {
        document.getElementById("btn-fullscreen-ml")?.click();
    });
});
