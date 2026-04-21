import { obtenerEstudiantePorId, guardarParticipacionExtra } from '../../BD/estudiantes';
import { obtenerSalonPorId } from '../../BD/salones';
import { obtenerCalificacionesEstudiante } from '../../BD/asignaciones';
import { calcularAsistenciaEstudiante, obtenerAsistenciaEstudiante } from '../../BD/asistencia';
import { obtenerConfigAula, obtenerCriteriosSalon } from '../../BD/criterios';

let currentSalonId: number | null = null;
let currentEstudianteId: number | null = null;
let chartTendencia: any = null;
let chartAsistencia: any = null;

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    currentSalonId = parseInt(params.get('salon_id') || '');
    currentEstudianteId = parseInt(params.get('estudiante_id') || '');

    if (isNaN(currentSalonId) || isNaN(currentEstudianteId)) {
        alert('Faltan parámetros de URL');
        window.location.href = 'lobby_aulas.html';
        return;
    }

    // Wiring Back Link
    const backLink = document.getElementById('back-link') as HTMLAnchorElement;
    if (backLink) {
        backLink.href = `manejo_aulas.html?id=${currentSalonId}`;
    }

    await cargarDatos();
    inicializarInteracciones();
});

async function cargarDatos() {
    if (!currentSalonId || !currentEstudianteId) return;

    const estudiante = await obtenerEstudiantePorId(currentEstudianteId);
    const salon = await obtenerSalonPorId(currentSalonId);
    if (!estudiante) return;

    // Header & Info
    document.getElementById('alumno-nombre-header')!.textContent = `${estudiante.nombre} ${estudiante.apellido}`;
    document.getElementById('alumno-salon-header')!.textContent = salon ? salon.nombre : 'Salón';
    document.getElementById('alumno-nombre-card')!.textContent = `${estudiante.nombre} ${estudiante.apellido}`;
    document.getElementById('alumno-control-card')!.textContent = estudiante.id_control;
    const ini = `${estudiante.nombre[0]}${estudiante.apellido[0]}`.toUpperCase();
    document.getElementById('alumno-avatar')!.textContent = ini;

    // Load Metrics
    const asignaciones = await obtenerCalificacionesEstudiante(currentSalonId, currentEstudianteId);
    const calmin = (await obtenerConfigAula(currentSalonId))?.calificacion_minima ?? 60;

    // Tareas & Parciales Splitting
    const examenes = asignaciones.filter(a => a.tipo === 'examen');
    const tareas = asignaciones.filter(a => a.tipo === 'tarea');

    // Render Tareas Tab
    const tbodyTareas = document.getElementById('tbody-tareas')!;
    if (tareas.length === 0) {
        tbodyTareas.innerHTML = '<tr><td colspan="3" class="px-6 py-8 text-center text-slate-400 text-sm">Sin tareas registradas.</td></tr>';
    } else {
        tbodyTareas.innerHTML = tareas.map(t => {
            const calif = t.calificacion != null ? t.calificacion : '—';
            const status = t.calificacion != null
                ? (t.calificacion >= calmin
                    ? `<span class="px-2 py-1 rounded border border-green-200 bg-green-50 text-green-600 text-[10px] font-black uppercase">Aprobado</span>`
                    : `<span class="px-2 py-1 rounded border border-red-200 bg-red-50 text-red-600 text-[10px] font-black uppercase">Reprobado</span>`)
                : `<span class="px-2 py-1 rounded border border-slate-200 dark:border-white/10 text-slate-400 text-[10px] font-black uppercase">Pendiente</span>`;

            return `<tr class="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all">
                <td class="px-6 py-3 text-sm font-semibold text-slate-700 dark:text-white truncate max-w-[200px]">${t.titulo}</td>
                <td class="px-6 py-3 text-center text-sm font-black text-indigo-deep dark:text-primary">${calif}</td>
                <td class="px-6 py-3 text-center">${status}</td>
            </tr>`;
        }).join('');
    }

    // Render Parciales Grid
    const gridParciales = document.getElementById('parciales-grid')!;
    if (examenes.length === 0) {
        gridParciales.innerHTML = '<div class="col-span-full text-center text-slate-400 text-sm py-4">Sin parciales registrados.</div>';
    } else {
        gridParciales.innerHTML = examenes.map(e => {
            const isApproved = e.calificacion != null && e.calificacion >= calmin;
            const bgClass = e.calificacion == null
                ? 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-slate-700'
                : (isApproved
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30');
            const textClass = e.calificacion == null
                ? 'text-slate-400'
                : (isApproved ? 'text-primary' : 'text-red-500');

            return `
            <div class="rounded-xl border ${bgClass} p-4 flex flex-col justify-center items-center text-center">
                <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">${e.titulo}</p>
                <p class="text-3xl font-black ${textClass}">${e.calificacion != null ? e.calificacion : '—'}</p>
            </div>
            `;
        }).join('');
    }

    // Calculate Promedio General (Simple average of all graded for now, weighted can be added later)
    const graded = asignaciones.filter(a => a.calificacion != null);
    let avg = 0;
    if (graded.length > 0) {
        avg = graded.reduce((sum, a) => sum + a.calificacion!, 0) / graded.length;
        document.getElementById('kpi-promedio')!.textContent = avg.toFixed(1);
    } else {
        document.getElementById('kpi-promedio')!.textContent = '—';
    }

    // Update Top Badge
    const badge = document.getElementById('badge-status')!;
    if (graded.length > 0) {
        if (avg >= calmin) {
            badge.className = 'mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-green-500/20 text-green-300';
            badge.innerHTML = `<span class="material-symbols-outlined text-base">check_circle</span><span>Aprobando</span>`;
        } else {
            badge.className = 'mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-red-500/20 text-red-300';
            badge.innerHTML = `<span class="material-symbols-outlined text-base">warning</span><span>En Riesgo</span>`;
        }
    }

    // Asistencia
    const astPct = await calcularAsistenciaEstudiante(currentSalonId, currentEstudianteId);
    document.getElementById('kpi-asistencia')!.textContent = `${astPct}%`;
    const asisRegistros = await obtenerAsistenciaEstudiante(currentSalonId, currentEstudianteId);

    // Update Attendance List
    const asisList = document.getElementById('lista-asistencia-reciente')!;
    if (asisRegistros.length === 0) {
        asisList.innerHTML = '<p class="text-xs text-slate-400 text-center py-2">Sin registros.</p>';
    } else {
        // Show last 5
        asisList.innerHTML = [...asisRegistros].reverse().slice(0, 5).map(r => {
            const icon = r.presente ? 'check_circle' : 'cancel';
            const color = r.presente ? 'text-primary' : 'text-red-400';
            return `
            <div class="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                <span class="text-xs font-bold text-slate-500 dark:text-slate-400">${r.fecha}</span>
                <div class="flex items-center gap-1 ${color}">
                    <span class="material-symbols-outlined text-sm">${icon}</span>
                    <span class="text-[10px] font-black uppercase">${r.presente ? 'Presente' : 'Ausente'}</span>
                </div>
            </div>
            `;
        }).join('');
    }

    // Update Attendance Chart
    const presentesCount = asisRegistros.filter(r => r.presente).length;
    const ausentesCount = asisRegistros.length - presentesCount;
    document.getElementById('legend-presentes')!.textContent = `${presentesCount} presentes`;
    document.getElementById('legend-ausentes')!.textContent = `${ausentesCount} ausentes`;
    renderAsistenciaChart(presentesCount, ausentesCount);

    // Participacion Extra
    (document.getElementById('input-participacion') as HTMLInputElement).value = String(estudiante.participacion_extra);

    // Render Trend Chart
    renderTendenciaChart(asignaciones);
}

function renderAsistenciaChart(presentes: number, ausentes: number) {
    if (chartAsistencia) chartAsistencia.destroy();
    if (presentes === 0 && ausentes === 0) return; // avoid rendering empty chart

    const ctx = (document.getElementById('chart-asistencia') as HTMLCanvasElement).getContext('2d');
    chartAsistencia = new (window as any).Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Presentes', 'Ausentes'],
            datasets: [{
                data: [presentes, ausentes],
                backgroundColor: ['#D4AF37', '#f87171'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: (ctx: any) => ` ${ctx.label}: ${ctx.raw}` }
                }
            }
        }
    });
}

function renderTendenciaChart(asignaciones: any[]) {
    if (chartTendencia) chartTendencia.destroy();

    const graded = asignaciones.filter(a => a.calificacion != null);
    if (graded.length === 0) return;

    const labels = graded.map(a => a.titulo.length > 15 ? a.titulo.substring(0, 15) + '...' : a.titulo);
    const data = graded.map(a => a.calificacion);

    const isDark = document.documentElement.classList.contains('dark');
    const colorLine = '#D4AF37';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const textColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';

    const ctx = (document.getElementById('chart-tendencia') as HTMLCanvasElement).getContext('2d');

    chartTendencia = new (window as any).Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Calificación',
                data,
                borderColor: colorLine,
                backgroundColor: 'rgba(212, 175, 55, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                pointBackgroundColor: colorLine,
                pointBorderColor: isDark ? '#1a1a2e' : '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100, // assuming 0-100 scale mainly
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { family: 'Inter', weight: 'bold' } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { family: 'Inter' } }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function inicializarInteracciones() {
    document.getElementById('btn-guardar-participacion')?.addEventListener('click', async () => {
        if (!currentEstudianteId) return;
        const val = parseFloat((document.getElementById('input-participacion') as HTMLInputElement).value) || 0;
        await guardarParticipacionExtra(currentEstudianteId, val);

        // Show lightweight success indicator (since we dont have robust toast here easily loaded without duplicating code)
        const btn = document.getElementById('btn-guardar-participacion')!;
        const originalIcon = btn.innerHTML;
        btn.innerHTML = '<span class="material-symbols-outlined text-sm">check</span>';
        btn.classList.add('bg-green-500/20', 'text-green-500');
        setTimeout(() => {
            btn.innerHTML = originalIcon;
            btn.classList.remove('bg-green-500/20', 'text-green-500');
        }, 2000);
    });
}
