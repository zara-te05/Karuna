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

const TREND_COLORS = ['#D4AF37', '#312E81', '#2D6A4F', '#F97316', '#6366F1', '#14B8A6'];

function buildTrendLegend(items: { label: string; color: string; hint?: string }[]) {
    const legend = document.getElementById('trend-chart-legend');
    if (!legend) return;
    legend.innerHTML = items.map(item => `
        <div class="inline-flex items-center gap-2 rounded-full border border-indigo-deep/10 bg-indigo-deep/5 px-3 py-2 text-[11px] font-semibold text-indigo-deep">
            <span class="inline-block w-2.5 h-2.5 rounded-full" style="background:${item.color}"></span>
            ${item.label}${item.hint ? ` · ${item.hint}` : ''}
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

function buildTrendDatasets(series: TendenciaPorSalonSerie[]) {
    const labels = buildTrendLabels(series);
    const overall = computeOverallAverageSeries(series);
    const datasets: any[] = [];

    datasets.push({
        label: overall.label,
        data: overall.data,
        borderColor: overall.color,
        backgroundColor: 'rgba(212,175,55,0.2)',
        pointBackgroundColor: overall.color,
        pointBorderColor: '#fff',
        pointRadius: 5,
        tension: 0.35,
        fill: false,
        borderWidth: 3.5,
        spanGaps: true,
    });

    series.forEach((serie, index) => {
        if (!serie.puntos.length) return;
        const pointMap = new Map(serie.puntos.map((p) => [p.titulo, p.promedio]));
        const color = TREND_COLORS[(index + 1) % TREND_COLORS.length];
        datasets.push({
            label: serie.salon_nombre,
            data: labels.map((label) => pointMap.get(label) ?? null),
            borderColor: color,
            backgroundColor: `${color}22`,
            pointBorderColor: '#fff',
            pointBackgroundColor: color,
            pointRadius: 4,
            tension: 0.35,
            fill: false,
            borderWidth: 2.5,
            spanGaps: true,
        });
    });

    return datasets;
}

function renderTrendChart(series: TendenciaPorSalonSerie[]) {
    const canvas = createCanvas('trend-chart-graphic', 'trend-chart-canvas');
    if (!canvas) return;

    destroyChart(chartTrend);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const labels = buildTrendLabels(series);
    const datasets = buildTrendDatasets(series);
    chartTrend = new (window as any).Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets,
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 800, easing: 'easeOutQuart' },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx: any) => `${ctx.parsed.y?.toFixed(1) ?? 0}%` } },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#475569', font: { size: 10 } },
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(30,27,75,0.08)' },
                    ticks: { color: '#475569', callback: (value: any) => `${value}%` },
                },
            },
        },
    });

    const items = [{ label: 'Promedio global', color: '#D4AF37', hint: 'Todas las aulas' }];
    series.forEach((serie, index) => {
        const color = TREND_COLORS[(index + 1) % TREND_COLORS.length];
        items.push({ label: serie.salon_nombre, color, hint: `Grupo ${index + 1}` });
    });
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
        borderWidth: 3,
        pointRadius: 5,
        fill: false,
    }));

    chartDetail = new (window as any).Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets,
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 900, easing: 'easeOutQuart' },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx: any) => `${ctx.parsed.y?.toFixed(1) ?? 0}%` } },
            },
            scales: {
                x: {
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: { color: '#475569', font: { size: 11 } },
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(0,0,0,0.08)' },
                    ticks: { color: '#475569', callback: (value: any) => `${value}%` },
                },
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