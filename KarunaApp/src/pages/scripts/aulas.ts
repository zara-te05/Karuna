// En tu archivo de entrada (ej. aulas.ts)
import { initTransitions } from "./transitions";
import { convertFileSrc } from '@tauri-apps/api/core';
import { verificarSesionOLogin } from "../../BD/sesion";
import { obtenerSalones, type Salon } from "../../BD/salones";
import { obtenerEstadisticasSalon, obtenerTendenciaPorSalones, type EstadisticasSalon, type TendenciaPorSalonSerie } from "../../BD/reportes";


function cargarFotoGuardada() {
    const rutaGuardada = localStorage.getItem('foto_perfil');
    if (!rutaGuardada) return;

    const fotoPerfil = document.getElementById('imagen-perfil') as HTMLImageElement | null;
    if (!fotoPerfil) return;

    const src = convertFileSrc(rutaGuardada);
    fotoPerfil.src = src;
}


async function cargarDatosPerfil() {
    try {
        const sesion = verificarSesionOLogin();
        const nombreDocente = document.getElementById('nombre_docente');

        if (!nombreDocente) {
            console.error("No se encontró el elemento #nombre_docente en el HTML");
            return;
        }

        nombreDocente.textContent = `Prof. ${sesion.nombre} ${sesion.apellido}`;
    } catch (error) {
        console.error("Error en el flujo de carga:", error);
    }
}

function setText(id: string, text: string) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
}

function formatPercent(value: number | null, digits = 1) {
    return value != null ? `${value.toFixed(digits)}%` : "—";
}

let chartTrend: any = null;
let chartDetail: any = null;

function destroyChart(c: any) { try { c?.destroy(); } catch (_) { } }
function createCanvas(containerId: string, canvasId: string) {
    const container = document.getElementById(containerId);
    if (!container) return null;
    container.innerHTML = `<canvas id="${canvasId}" class="h-full w-full"></canvas>`;
    return document.getElementById(canvasId) as HTMLCanvasElement | null;
}

const TREND_COLORS = ['#312E81', '#2D6A4F', '#F97316', '#6366F1', '#14B8A6', '#EC4899'];

function buildTrendLegend(items: { label: string; color: string; dashed?: boolean }[]) {
    const legend = document.getElementById('trend-chart-legend');
    if (!legend) return;
    legend.innerHTML = items.map(item => `
        <div class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold"
             style="border-color:${item.color}22; background:${item.color}10; color:${item.color}">
            ${item.dashed
              ? `<span style="display:inline-flex;gap:2px;align-items:center">
                   <span style="width:8px;height:2px;border-top:2px dashed ${item.color};display:inline-block"></span>
                   <span style="width:8px;height:2px;border-top:2px dashed ${item.color};display:inline-block"></span>
                 </span>`
              : `<span style="width:10px;height:10px;border-radius:50%;background:${item.color};display:inline-block"></span>`
            }
            ${item.label}
        </div>`).join('');
}

function buildTrendLabels(series: TendenciaPorSalonSerie[]) {
    return Array.from(new Set(series.flatMap(serie => serie.puntos.map((p) => p.titulo))));
}

function computeOverallAverageSeries(series: TendenciaPorSalonSerie[]) {
    const labels = buildTrendLabels(series);
    const values = labels.map((label) => {
        const points = series
            .map((serie) => serie.puntos.find((p) => p.titulo === label)?.promedio)
            .filter((value): value is number => value != null);
        return points.length > 0 ? Math.round((points.reduce((sum, value) => sum + value, 0) / points.length) * 10) / 10 : null;
    });
    return {
        label: 'Promedio global',
        color: '#D4AF37',
        data: values,
        labels,
        hint: 'Todos los salones',
    };
}

function computeSalonAverages(series: TendenciaPorSalonSerie[]) {
    return series.map((serie) => {
        const points = serie.puntos.map((p) => p.promedio).filter((value): value is number => value != null);
        const average = points.length > 0 ? points.reduce((sum, value) => sum + value, 0) / points.length : 0;
        return { serie, average };
    });
}

// Build hex → rgba helper
function hexAlpha(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function gradeBgColor(val: number): string {
    if (val >= 80) return '#22c55e';   // green-500
    if (val >= 60) return '#D4AF37';   // gold
    return '#f87171';                  // red-400
}

/** Gráfica principal: barras horizontales Promedio vs Asistencia por salón */
function renderComparativaChart(salones: Salon[], estadisticas: EstadisticasSalon[]) {
    destroyChart(chartTrend);
    if (!salones.length) return;

    const canvas = createCanvas('trend-chart-graphic', 'trend-chart-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dark = document.documentElement.classList.contains('dark');
    const tc   = dark ? 'rgba(232,232,240,0.65)' : '#475569';
    const gc   = dark ? 'rgba(255,255,255,0.05)'  : 'rgba(30,27,75,0.06)';

    const labels = salones.map(s => s.nombre.length > 22 ? s.nombre.slice(0, 20) + '…' : s.nombre);
    const proms  = estadisticas.map(e => e.promedioCalificaciones ?? 0);
    const asist  = estadisticas.map(e => e.promedioAsistencia    ?? 0);

    const promColors = proms.map(v => hexAlpha(gradeBgColor(v), 0.85));
    const asistColor = hexAlpha('#60a5fa', 0.7); // blue-400 for attendance

    chartTrend = new (window as any).Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Promedio (%)',
                    data: proms,
                    backgroundColor: promColors,
                    borderColor:     proms.map(v => gradeBgColor(v)),
                    borderWidth: 1.5,
                    borderRadius: 6,
                    borderSkipped: false,
                    barPercentage: 0.5,
                },
                {
                    label: 'Asistencia (%)',
                    data: asist,
                    backgroundColor: asistColor,
                    borderColor:     '#3b82f6',
                    borderWidth: 1.5,
                    borderRadius: 6,
                    borderSkipped: false,
                    barPercentage: 0.5,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y' as const,
            animation: { duration: 700, easing: 'easeOutQuart' as const },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom' as const,
                    labels: { color: tc, font: { size: 11 }, usePointStyle: true, pointStyleWidth: 10 },
                },
                tooltip: {
                    mode: 'index' as const,
                    callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.parsed.x?.toFixed(1) ?? 0}%` },
                },
            },
            scales: {
                x: {
                    min: 0, max: 100,
                    grid: { color: gc },
                    ticks: { color: tc, callback: (v: any) => `${v}%` },
                },
                y: {
                    grid: { display: false },
                    ticks: { color: tc, font: { size: 11 } },
                },
            },
        },
    });

    // Legend pills
    const legend = document.getElementById('trend-chart-legend');
    if (legend) {
        if (!salones.length) { legend.innerHTML = ''; return; }
        legend.innerHTML = salones.map((s, i) => {
            const p = estadisticas[i].promedioCalificaciones;
            const color = gradeBgColor(p ?? 0);
            return `<div style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:9999px;background:${hexAlpha(color,0.12)};color:${color};font-size:11px;font-weight:700;">
                <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block"></span>
                ${s.nombre} · ${p != null ? p.toFixed(1) + '%' : '—'}
            </div>`;
        }).join('');
    }
}

function renderDetailChart(series: TendenciaPorSalonSerie[]) {
    const canvas = createCanvas('detail-modal-graphic', 'detail-modal-chart-canvas');
    if (!canvas) return;

    destroyChart(chartDetail);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dark  = document.documentElement.classList.contains('dark');
    const tc    = dark ? 'rgba(232,232,240,0.6)' : '#475569';
    const gc    = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';

    // Build unified X labels (all assignment titles across all salons)
    const allLabels = Array.from(new Set(series.flatMap(s => s.puntos.map(p => p.titulo))));

    // Build datasets: one per salon (colored area) + overall dashed average
    const datasets: any[] = [];

    series.forEach((serie, index) => {
        if (!serie.puntos.length) return;
        const pointMap = new Map(serie.puntos.map(p => [p.titulo, p.promedio]));
        const color = TREND_COLORS[index % TREND_COLORS.length];
        datasets.push({
            label: serie.salon_nombre,
            data: allLabels.map(lbl => pointMap.get(lbl) ?? null),
            borderColor: color,
            backgroundColor: hexAlpha(color, 0.14),
            pointBackgroundColor: color,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            tension: 0.45,
            fill: 'origin',
            borderWidth: 2.5,
            spanGaps: true,
        });
    });

    // Overall average line (gold dashed)
    const overallData = allLabels.map(lbl => {
        const pts = series.map(s => s.puntos.find(p => p.titulo === lbl)?.promedio)
            .filter((v): v is number => v != null);
        return pts.length ? Math.round((pts.reduce((a, b) => a + b, 0) / pts.length) * 10) / 10 : null;
    });
    datasets.push({
        label: 'Promedio global',
        data: overallData,
        borderColor: '#D4AF37',
        backgroundColor: 'transparent',
        pointBackgroundColor: '#D4AF37',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
        tension: 0.45,
        fill: false,
        borderWidth: 3,
        borderDash: [6, 4],
        spanGaps: true,
    });

    chartDetail = new (window as any).Chart(ctx, {
        type: 'line',
        data: { labels: allLabels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index' as const, intersect: false },
            animation: { duration: 800, easing: 'easeOutQuart' as const },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom' as const,
                    labels: { color: tc, font: { size: 11 }, usePointStyle: true, pointStyleWidth: 10 },
                },
                tooltip: {
                    callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1) ?? '—'}%` },
                },
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: tc, font: { size: 11 } } },
                y: { min: 0, max: 100, grid: { color: gc }, ticks: { color: tc, callback: (v: any) => `${v}%` } },
            },
        },
    });
}

function showDetailModal() {
    const modal = document.getElementById('detail-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    chartDetail?.resize();
}

(window as any).showDetailModal = showDetailModal;

function buildSalonRow(salon: Salon, stats: EstadisticasSalon) {
    const entregaPercent = stats.tasaEntrega ?? 0;
    const entregadas = stats.totalAsignaciones > 0
        ? Math.round((entregaPercent / 100) * stats.totalAsignaciones)
        : 0;
    const fillWidth = Math.min(100, Math.max(0, entregaPercent));
    const barColor = entregaPercent >= 80 ? "bg-teal-muted" : entregaPercent >= 50 ? "bg-primary" : "bg-red-500";
    const ratioLabel = stats.totalAsignaciones > 0 ? `${entregadas}/${stats.totalAsignaciones}` : "0/0";

    return `
        <tr class="hover:bg-indigo-deep/[0.02] transition-colors">
            <td class="px-5 py-3">
                <p class="font-bold text-indigo-deep text-xs leading-tight">${salon.nombre}</p>
                <p class="text-[10px] text-indigo-deep/40">${salon.materia}</p>
            </td>
            <td class="px-3 py-3 text-center font-bold text-indigo-deep text-sm font-serif-elegant">
                ${formatPercent(stats.promedioCalificaciones)}</td>
            <td class="px-3 py-3 text-center font-bold text-indigo-deep text-sm font-serif-elegant">
                ${formatPercent(stats.promedioAsistencia)}</td>
            <td class="px-3 py-3 text-center">
                <span class="text-xs font-bold ${entregaPercent >= 75 ? 'text-teal-muted' : 'text-indigo-deep/60'}">${ratioLabel}</span>
                <div class="w-full bg-indigo-deep/5 rounded-full h-1 mt-1">
                    <div class="${barColor} h-1 rounded-full" style="width:${fillWidth}%"></div>
                </div>
            </td>
            <td class="px-3 py-3 text-center font-bold text-indigo-deep text-sm font-serif-elegant">
                ${stats.totalAsignaciones}</td>
        </tr>`;
}

async function cargarResumenAulas() {
    const sesion = verificarSesionOLogin();
    const salones = await obtenerSalones(sesion.docente_id);
    const estadisticas = await Promise.all(salones.map((salon) => obtenerEstadisticasSalon(salon.id)));

    const totalSalones      = salones.length;
    const totalAlumnos      = estadisticas.reduce((sum, item) => sum + item.totalAlumnos, 0);
    const totalAsignaciones = estadisticas.reduce((sum, item) => sum + item.totalAsignaciones, 0);
    const totalEntregadas   = estadisticas.reduce((sum, item) =>
        sum + Math.round(((item.tasaEntrega ?? 0) / 100) * item.totalAsignaciones), 0);

    const weightedGradesSum = estadisticas.reduce((sum, item) =>
        sum + ((item.promedioCalificaciones ?? 0) * item.totalAlumnos), 0);
    const gradeCount = estadisticas.reduce((sum, item) =>
        sum + (item.promedioCalificaciones != null ? item.totalAlumnos : 0), 0);
    const promedioGeneral = gradeCount > 0 ? Math.round((weightedGradesSum / gradeCount) * 10) / 10 : null;

    const weightedAttendanceSum = estadisticas.reduce((sum, item) =>
        sum + ((item.promedioAsistencia ?? 0) * item.totalAlumnos), 0);
    const attendanceCount = estadisticas.reduce((sum, item) =>
        sum + (item.promedioAsistencia != null ? item.totalAlumnos : 0), 0);
    const promedioAsistencia = attendanceCount > 0 ? Math.round((weightedAttendanceSum / attendanceCount) * 10) / 10 : null;
    const tasaEntrega = totalAsignaciones > 0
        ? Math.round((totalEntregadas / totalAsignaciones) * 1000) / 10
        : null;

    setText('total-salones-count',  String(totalSalones));
    setText('total-alumnos-count',  String(totalAlumnos));
    setText('alumnos-context',      `en ${totalSalones} aula${totalSalones === 1 ? '' : 's'}`);
    setText('promedio-general',     formatPercent(promedioGeneral));
    setText('promedio-context',     'Promedio global por aula');
    setText('tasa-entregas',        formatPercent(tasaEntrega));
    setText('asistencia-general',   formatPercent(promedioAsistencia));

    // ── Comparative bar chart (always rendered with stats) ──
    renderComparativaChart(salones, estadisticas);

    // ── Detail modal trend lines (only if we have time-series data) ──
    const tendenciaSeries = await obtenerTendenciaPorSalones(sesion.docente_id);
    if (tendenciaSeries.length > 0 && tendenciaSeries.some((serie) => serie.puntos.length > 0)) {
        renderDetailChart(tendenciaSeries);
    } else {
        const detailContainer = document.getElementById('detail-modal-graphic');
        if (detailContainer) {
            detailContainer.innerHTML = '<div class="h-full w-full flex items-center justify-center text-indigo-deep/50 text-sm">Carga la primera asignación para ver la tendencia.</div>';
        }
    }

    const body = document.getElementById('salon-summary-body');
    if (!body) return;

    if (salones.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="5" class="px-5 py-8 text-center text-sm text-indigo-deep/50">No hay aulas registradas.</td>
            </tr>`;
        return;
    }

    body.innerHTML = salones.map((salon, index) => buildSalonRow(salon, estadisticas[index])).join('');
}

// Ejecución segura
document.addEventListener("DOMContentLoaded", async () => {
    initTransitions();
    cargarFotoGuardada();
    await cargarDatosPerfil();
    await cargarResumenAulas();
});