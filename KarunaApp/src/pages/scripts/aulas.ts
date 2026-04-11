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

function buildTrendDatasets(series: TendenciaPorSalonSerie[]) {
    const labels = buildTrendLabels(series);
    const overall = computeOverallAverageSeries(series);
    const datasets: any[] = [];

    // ── Salon wave datasets (area, drawn first so overall sits on top) ──
    series.forEach((serie, index) => {
        if (!serie.puntos.length) return;
        const pointMap = new Map(serie.puntos.map((p) => [p.titulo, p.promedio]));
        const color = TREND_COLORS[index % TREND_COLORS.length];
        datasets.push({
            label: serie.salon_nombre,
            data: labels.map((lbl) => pointMap.get(lbl) ?? null),
            borderColor: color,
            backgroundColor: hexAlpha(color, 0.18),
            pointBackgroundColor: color,
            pointBorderColor: '#fff',
            pointBorderWidth: 1.5,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.5,          // high tension = wave shape
            fill: 'origin',        // fill down to zero = area wave
            borderWidth: 2,
            spanGaps: true,
            order: index + 1,      // lower = drawn on top; salons behind
        });
    });

    // ── Overall average: dashed gold line, no fill, always on top ──
    datasets.push({
        label: 'Promedio global',
        data: overall.data,
        borderColor: '#D4AF37',
        backgroundColor: 'transparent',
        pointBackgroundColor: '#D4AF37',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.5,
        fill: false,
        borderWidth: 3,
        borderDash: [6, 4],
        spanGaps: true,
        order: 0,                  // drawn on top of all salons
    });

    return datasets;
}

function waveChartOptions(isDarkMode: boolean) {
    const tc = isDarkMode ? 'rgba(232,232,240,0.6)' : '#475569';
    const gc = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(30,27,75,0.06)';
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index' as const, intersect: false },
        animation: { duration: 900, easing: 'easeOutQuart' as const },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: isDarkMode ? 'rgba(26,26,46,0.95)' : 'rgba(255,255,255,0.97)',
                borderColor: 'rgba(212,175,55,0.3)',
                borderWidth: 1,
                titleColor: isDarkMode ? '#e8e8f0' : '#1E1B4B',
                bodyColor: isDarkMode ? 'rgba(232,232,240,0.75)' : '#475569',
                padding: 12,
                callbacks: {
                    label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(1) + '%' : '—'}`,
                },
            },
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: tc, font: { size: 10 }, maxRotation: 30 },
            },
            y: {
                min: 0,
                max: 100,
                grid: { color: gc },
                ticks: { color: tc, callback: (v: any) => `${v}%`, font: { size: 10 } },
            },
        },
    };
}

function renderTrendChart(series: TendenciaPorSalonSerie[]) {
    const canvas = createCanvas('trend-chart-graphic', 'trend-chart-canvas');
    if (!canvas) return;

    destroyChart(chartTrend);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const labels = buildTrendLabels(series);
    const datasets = buildTrendDatasets(series);
    const dark = document.documentElement.classList.contains('dark');

    chartTrend = new (window as any).Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: waveChartOptions(dark),
    });

    // Legend: salons first, then the global dashed line
    const items: { label: string; color: string; dashed?: boolean }[] = [];
    series.forEach((serie, index) => {
        items.push({ label: serie.salon_nombre, color: TREND_COLORS[index % TREND_COLORS.length] });
    });
    items.push({ label: 'Promedio global', color: '#D4AF37', dashed: true });
    buildTrendLegend(items);
}

function renderDetailChart(series: TendenciaPorSalonSerie[]) {
    const canvas = createCanvas('detail-modal-graphic', 'detail-modal-chart-canvas');
    if (!canvas) return;

    destroyChart(chartDetail);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const labels = buildTrendLabels(series);
    const datasets = buildTrendDatasets(series).map((dataset: any) => ({
        ...dataset,
        // Keep fills but increase point size for the larger modal chart
        pointRadius: dataset.order === 0 ? 6 : 5,
        pointHoverRadius: dataset.order === 0 ? 8 : 7,
        borderWidth: dataset.order === 0 ? 3.5 : 2.5,
    }));
    const dark = document.documentElement.classList.contains('dark');

    chartDetail = new (window as any).Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            ...waveChartOptions(dark),
            scales: {
                x: { grid: { display: false }, ticks: { color: dark ? 'rgba(232,232,240,0.6)' : '#475569', font: { size: 11 } } },
                y: { min: 0, max: 100, grid: { color: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)' }, ticks: { color: dark ? 'rgba(232,232,240,0.6)' : '#475569', callback: (v: any) => `${v}%` } },
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

    const totalSalones = salones.length;
    const totalAlumnos = estadisticas.reduce((sum, item) => sum + item.totalAlumnos, 0);
    const totalAsignaciones = estadisticas.reduce((sum, item) => sum + item.totalAsignaciones, 0);
    const totalEntregadas = estadisticas.reduce((sum, item) =>
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

    setText('total-salones-count', String(totalSalones));
    setText('total-alumnos-count', String(totalAlumnos));
    setText('alumnos-context', `en ${totalSalones} aula${totalSalones === 1 ? '' : 's'}`);
    setText('promedio-general', formatPercent(promedioGeneral));
    setText('promedio-context', 'Promedio global por aula');
    setText('tasa-entregas', formatPercent(tasaEntrega));
    setText('asistencia-general', formatPercent(promedioAsistencia));

    const tendenciaSeries = await obtenerTendenciaPorSalones(sesion.docente_id);
    if (tendenciaSeries.length > 0 && tendenciaSeries.some((serie) => serie.puntos.length > 0)) {
        renderTrendChart(tendenciaSeries);
        renderDetailChart(tendenciaSeries);
    } else {
        const trendContainer = document.getElementById('trend-chart-graphic');
        if (trendContainer) {
            trendContainer.innerHTML = '<div class="h-full w-full flex items-center justify-center text-indigo-deep/50 text-sm">No hay datos de tendencia disponibles.</div>';
        }
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