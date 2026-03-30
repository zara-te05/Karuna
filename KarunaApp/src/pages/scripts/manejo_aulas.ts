import { initTransitions } from "./transitions";
import { convertFileSrc } from '@tauri-apps/api/core';
import { obtenerDocentePorID } from '../../BD/docentes';
import { obtenerSalonPorId, type Salon } from '../../BD/salones';
import {
    crearEstudiante, obtenerEstudiantesSalon, editarEstudiante, eliminarEstudiante,
    type Estudiante
} from '../../BD/estudiantes';
import {
    obtenerCriteriosSalon, guardarCriteriosSalon,
    obtenerConfigAula, guardarConfigAula,
} from '../../BD/criterios';
import {
    guardarConfigAsistencia, obtenerConfigAsistencia,
    registrarAsistencia, obtenerAsistenciaFecha
} from '../../BD/asistencia';
import {
    crearAsignacion, obtenerAsignacionesSalon, guardarCalificacion,
    obtenerCalificacionesSalon, sincronizarParciales,
    editarAsignacion, eliminarAsignacion, type TipoAsignacion
} from '../../BD/asignaciones';

// ─── Estado ───────────────────────────────────────────────────────────────
let currentSalonId: number | null = null;

// ─── Foto de perfil ───────────────────────────────────────────────────────
function cargarFotoGuardada() {
    const ruta = localStorage.getItem('foto_perfil');
    if (ruta) {
        const img = document.getElementById('imagen-perfil') as HTMLImageElement;
        if (img) img.src = convertFileSrc(ruta);
    }
}

async function cargarDatosPerfil() {
    try {
        const docente = await obtenerDocentePorID(1);
        if (docente) {
            const el = document.getElementById('nombre_docente');
            if (el) el.textContent = `Prof. ${docente.nombre} ${docente.apellido}`;
        }
    } catch (e) { console.error(e); }
}

// ─── Cargar nombre/datos del salón ────────────────────────────────────────
async function cargarDatosSalon(salon_id: number) {
    const salon = await obtenerSalonPorId(salon_id);
    if (!salon) return;
    const elNombre = document.getElementById('salon-nombre');
    const elMateria = document.getElementById('salon-materia');
    if (elNombre) elNombre.textContent = salon.nombre;
    if (elMateria) elMateria.textContent = `${salon.materia} — Sección ${salon.seccion}`;
    document.title = `Karuna — ${salon.nombre}`;
}

// ─── TABS ─────────────────────────────────────────────────────────────────
function inicializarTabs() {
    const tabs: { btn: string; panel: string }[] = [
        { btn: 'btn-tab-alumnos', panel: 'panel-alumnos' },
        { btn: 'btn-tab-calificaciones', panel: 'panel-calificaciones' },
        { btn: 'btn-tab-asistencia', panel: 'panel-asistencia' },
        { btn: 'btn-tab-configuracion', panel: 'panel-configuracion' },
    ];

    function activar(index: number) {
        tabs.forEach(({ btn, panel }, i) => {
            const b = document.getElementById(btn);
            const p = document.getElementById(panel);
            if (i === index) {
                b?.classList.add('tab-active');
                b?.classList.remove('text-slate-500');
                p?.classList.remove('hidden');
            } else {
                b?.classList.remove('tab-active');
                b?.classList.add('text-slate-500');
                p?.classList.add('hidden');
            }
        });
    }

    tabs.forEach(({ btn }, i) => {
        document.getElementById(btn)?.addEventListener('click', async () => {
            activar(i);
            if (!currentSalonId) return;
            if (i === 1) await cargarAsignaciones(currentSalonId);
            if (i === 2) await cargarPaseLista(currentSalonId);
            if (i === 3) await cargarConfiguracion(currentSalonId);
        });
    });
}

// ─── PANEL ALUMNOS ────────────────────────────────────────────────────────
async function cargarEstudiantes(salon_id: number) {
    const tbody = document.getElementById('tbody-alumnos')!;
    const contador = document.getElementById('contador-alumnos')!;
    const lista = await obtenerEstudiantesSalon(salon_id);

    contador.textContent = `${lista.length} alumno${lista.length !== 1 ? 's' : ''}`;

    if (lista.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="3" class="px-6 py-10 text-center text-slate-400 text-sm">
                <span class="material-symbols-outlined text-4xl block mb-2 text-slate-300">person_search</span>
                No hay alumnos registrados aún.
            </td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(est => {
        const ini = `${est.nombre[0]}${est.apellido[0]}`.toUpperCase();
        return `
        <tr class="group hover:bg-slate-50/70 dark:hover:bg-white/5 transition-all" data-id="${est.id}">
            <td class="px-6 py-3">
                <a href="detalle_alumno.html?salon_id=${salon_id}&estudiante_id=${est.id}" class="flex items-center gap-3 cursor-pointer p-1 -m-1 rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-white/5">
                    <div class="size-9 bg-indigo-deep dark:bg-primary/80 text-white dark:text-indigo-deep
                                rounded-xl flex items-center justify-center font-bold text-sm
                                group-hover:scale-105 transition-transform">${ini}</div>
                    <span class="text-sm font-semibold text-slate-700 dark:text-white group-hover:text-primary transition-colors">${est.nombre} ${est.apellido}</span>
                </a>
            </td>
            <td class="px-6 py-3">
                <code class="text-xs font-mono text-indigo-deep dark:text-primary bg-indigo-deep/5 dark:bg-primary/10 px-2 py-1 rounded-lg">${est.id_control}</code>
            </td>
            <td class="px-6 py-3 text-right">
                <div class="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button title="Editar" class="btn-editar-est size-8 flex items-center justify-center rounded-lg
                        bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white hover:bg-primary hover:text-indigo-deep transition-colors"
                        data-id="${est.id}" data-nombre="${est.nombre}" data-apellido="${est.apellido}" data-control="${est.id_control}">
                        <span class="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button title="Eliminar" class="btn-eliminar-est size-8 flex items-center justify-center rounded-lg
                        bg-red-50 dark:bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                        data-id="${est.id}">
                        <span class="material-symbols-outlined text-lg">delete</span>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');

    // Listeners de editar y eliminar
    tabla_addEventListener(salon_id);
}

function tabla_addEventListener(salon_id: number) {
    document.querySelectorAll<HTMLButtonElement>('.btn-eliminar-est').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = parseInt(btn.dataset.id!);
            if (!confirm('¿Eliminar al alumno? Esta acción no se puede deshacer.')) return;
            await eliminarEstudiante(id, salon_id);
            await cargarEstudiantes(salon_id);
        });
    });
    document.querySelectorAll<HTMLButtonElement>('.btn-editar-est').forEach(btn => {
        btn.addEventListener('click', () => {
            abrirModalEdicion({
                id: parseInt(btn.dataset.id!),
                salon_id,
                nombre: btn.dataset.nombre!,
                apellido: btn.dataset.apellido!,
                id_control: btn.dataset.control!,
            });
        });
    });
}

function abrirModalEdicion(est: Estudiante) {
    const modal = document.getElementById('modal-editar-alumno')!;
    (document.getElementById('edit-nombre') as HTMLInputElement).value = est.nombre;
    (document.getElementById('edit-apellido') as HTMLInputElement).value = est.apellido;
    (document.getElementById('edit-control') as HTMLInputElement).value = est.id_control;
    modal.dataset.editId = String(est.id);
    modal.classList.replace('hidden', 'flex');
}

function cerrarModalEdicion() {
    document.getElementById('modal-editar-alumno')!.classList.replace('flex', 'hidden');
}

function inicializarFormRegistro(salon_id: number) {
    const form = document.getElementById('form-registro-alumno') as HTMLFormElement;
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = (document.getElementById('input-nombre') as HTMLInputElement).value.trim();
        const apellido = (document.getElementById('input-apellido') as HTMLInputElement).value.trim();
        const control = (document.getElementById('input-control') as HTMLInputElement).value.trim();
        if (!nombre || !apellido || !control) return;
        await crearEstudiante(salon_id, nombre, apellido, control);
        form.reset();
        await cargarEstudiantes(salon_id);
    });

    document.getElementById('btn-guardar-edicion')?.addEventListener('click', async () => {
        const modal = document.getElementById('modal-editar-alumno')!;
        const id = parseInt(modal.dataset.editId!);
        const nombre = (document.getElementById('edit-nombre') as HTMLInputElement).value.trim();
        const apellido = (document.getElementById('edit-apellido') as HTMLInputElement).value.trim();
        const control = (document.getElementById('edit-control') as HTMLInputElement).value.trim();
        if (!nombre || !apellido || !control) { mostrarToast('Completa todos los campos.', 'error'); return; }
        await editarEstudiante(id, nombre, apellido, control);
        cerrarModalEdicion();
        await cargarEstudiantes(salon_id);
        mostrarToast('¡Alumno actualizado!');
    });
    document.getElementById('btn-cancelar-edicion')?.addEventListener('click', cerrarModalEdicion);
    // Cerrar modal al click fuera
    document.getElementById('modal-editar-alumno')?.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).id === 'modal-editar-alumno') cerrarModalEdicion();
    });
}


// ─── PANEL CALIFICACIONES ─────────────────────────────────────────────────

function celdaEstudiante(salon_id: number, id: number, nombre: string, apellido: string): string {
    const ini = `${nombre[0]}${apellido[0]}`.toUpperCase();
    return `<td class="px-5 py-3 sticky left-0 bg-white dark:bg-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] z-10">
        <a href="detalle_alumno.html?salon_id=${salon_id}&estudiante_id=${id}" class="flex items-center gap-2 min-w-[160px] group cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 p-1 -m-1 rounded-lg transition-colors">
            <div class="size-8 bg-indigo-deep dark:bg-primary/80 text-white dark:text-indigo-deep rounded-lg
                        flex items-center justify-center text-xs font-bold flex-shrink-0 group-hover:scale-105 transition-transform">${ini}</div>
            <span class="text-sm font-medium dark:text-white truncate group-hover:text-primary transition-colors">${nombre} ${apellido}</span>
        </a>
    </td>`;
}

async function renderSeccion(
    tipo: TipoAsignacion,
    theadId: string,
    tbodyId: string,
    salon_id: number
) {
    const thead = document.getElementById(theadId)!.querySelector('tr')!;
    const tbody = document.getElementById(tbodyId)!;
    const asigs = await obtenerAsignacionesSalon(salon_id, tipo);
    const alumnos = await obtenerEstudiantesSalon(salon_id);
    const mapaCalif = await obtenerCalificacionesSalon(salon_id);

    const stickyTh = `px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky left-0 bg-slate-50 dark:bg-slate-800 z-10 min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]`;
    const normalTh = `px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center min-w-[120px]`;

    thead.innerHTML = `<th class="${stickyTh}">Estudiante</th>`;
    asigs.forEach(a => {
        const titleSafe = a.titulo.replace(/'/g, "\\'");
        thead.innerHTML += `<th class="${normalTh} cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors group/th"
                            onclick="window.__abrirModalEditarAsignacion(${a.id}, '${titleSafe}')">
            <div class="flex items-center justify-center gap-1 group-hover/th:text-primary transition-colors">
                ${a.titulo}
                <span class="material-symbols-outlined text-[10px] opacity-0 group-hover/th:opacity-100 transition-opacity">edit</span>
            </div>
        </th>`;
    });
    thead.innerHTML += `<th class="px-5 py-3 text-[10px] font-black text-primary uppercase tracking-widest text-center min-w-[100px]">Promedio</th>`;

    if (alumnos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${asigs.length + 2}" class="px-6 py-8 text-center text-slate-400 text-sm">
            <span class="material-symbols-outlined text-3xl block mb-1 text-slate-300">group</span>
            Agrega alumnos en la pestaña Alumnos primero.</td></tr>`;
        return;
    }
    if (asigs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" class="px-6 py-8 text-center text-slate-400 text-sm">
            <span class="material-symbols-outlined text-3xl block mb-1 text-slate-300">${tipo === 'examen' ? 'quiz' : 'assignment'}</span>
            Agrega ${tipo === 'examen' ? 'un examen' : 'una tarea'} con el botón de arriba.</td></tr>`;
        return;
    }

    tbody.innerHTML = alumnos.map(est => {
        const celdas = asigs.map(a => {
            const v = mapaCalif[est.id]?.[a.id];
            const val = v != null ? String(v) : '';
            return `<td class="px-3 py-3 text-center">
                <input type="number" min="0" max="100" step="1" value="${val}" placeholder="—"
                    class="w-20 px-2 py-1.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700
                           rounded-lg text-sm text-center focus:ring-2 focus:ring-primary dark:text-white font-bold"
                    data-asig="${a.id}" data-est="${est.id}" onchange="window.__saveCalif(this)" />
            </td>`;
        }).join('');

        const vals = asigs
            .map(a => mapaCalif[est.id]?.[a.id])
            .filter((v): v is number => v != null);
        const prom = vals.length > 0
            ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1)
            : '—';
        const promCls = vals.length > 0 && parseFloat(prom) < 60 ? 'text-red-500' : 'text-primary';

        return `<tr class="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all">
            ${celdaEstudiante(salon_id, est.id, est.nombre, est.apellido)}
            ${celdas}
            <td class="px-5 py-3 text-center">
                <span class="text-sm font-black ${promCls}">${prom}</span>
            </td>
        </tr>`;
    }).join('');
}

async function cargarAsignaciones(salon_id: number) {
    await renderSeccion('examen', 'thead-examenes', 'tbody-examenes', salon_id);
    await renderSeccion('tarea', 'thead-tareas', 'tbody-tareas', salon_id);
}

function inicializarFormAsignacion(salon_id: number) {
    async function agregarItem(tipo: TipoAsignacion, msg: string) {
        if (tipo === 'examen') {
            const configAula = await obtenerConfigAula(salon_id);
            const numPermitidos = configAula?.num_parciales || 3;
            const asigsExamen = await obtenerAsignacionesSalon(salon_id, 'examen');
            if (asigsExamen.length >= numPermitidos) {
                mostrarToast(`No puedes crear más de ${numPermitidos} parciales según la configuración.`, 'error');
                return;
            }
        }
        const titulo = prompt(msg);
        if (!titulo?.trim()) return;
        const res = await crearAsignacion(salon_id, titulo.trim(), tipo, null, null);
        if (!res.success) { mostrarToast('Error al crear actividad.', 'error'); return; }
        await cargarAsignaciones(salon_id);
    }

    document.getElementById('btn-nuevo-examen')
        ?.addEventListener('click', () => agregarItem('examen', 'Nombre del examen parcial (ej. Parcial 1):'));
    document.getElementById('btn-nueva-tarea')
        ?.addEventListener('click', () => agregarItem('tarea', 'Nombre de la tarea o actividad:'));

    // Asignación (Edición/Eliminación) modal control
    let currentAsigIdEdit: number | null = null;
    (window as any).__abrirModalEditarAsignacion = (id: number, titulo: string) => {
        currentAsigIdEdit = id;
        const modal = document.getElementById('modal-editar-asignacion')!;
        (document.getElementById('edit-titulo-asignacion') as HTMLInputElement).value = titulo;
        modal.classList.replace('hidden', 'flex');
    };

    const cerrarModalAsig = () => {
        document.getElementById('modal-editar-asignacion')!.classList.replace('flex', 'hidden');
        currentAsigIdEdit = null;
    };

    document.getElementById('btn-cancelar-edit-asignacion')?.addEventListener('click', cerrarModalAsig);
    document.getElementById('modal-editar-asignacion')?.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).id === 'modal-editar-asignacion') cerrarModalAsig();
    });

    document.getElementById('btn-guardar-edit-asignacion')?.addEventListener('click', async () => {
        if (!currentAsigIdEdit) return;
        const nTitle = (document.getElementById('edit-titulo-asignacion') as HTMLInputElement).value.trim();
        if (!nTitle) { mostrarToast('El título es requerido.', 'error'); return; }
        await editarAsignacion(currentAsigIdEdit, nTitle);
        cerrarModalAsig();
        await cargarAsignaciones(salon_id);
        mostrarToast('Actividad actualizada.');
    });

    document.getElementById('btn-eliminar-asignacion')?.addEventListener('click', async () => {
        if (!currentAsigIdEdit) return;
        if (!confirm('¿Seguro que deseas eliminar esta actividad y todas sus calificaciones?')) return;
        await eliminarAsignacion(currentAsigIdEdit);
        cerrarModalAsig();
        await cargarAsignaciones(salon_id);
        mostrarToast('Actividad eliminada.');
    });

    (window as any).__saveCalif = async (input: HTMLInputElement) => {
        const asigId = parseInt(input.dataset.asig!);
        const estId = parseInt(input.dataset.est!);
        const val = parseFloat(input.value);
        if (!isNaN(asigId) && !isNaN(estId) && !isNaN(val)) {
            await guardarCalificacion(asigId, estId, val);
            // Recalcular promedio de fila en tiempo real
            const fila = input.closest('tr')!;
            const inputs = fila.querySelectorAll<HTMLInputElement>('input[type="number"]');
            const vals = Array.from(inputs).map(i => parseFloat(i.value)).filter(v => !isNaN(v));
            const prom = vals.length > 0 ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : '—';
            const span = fila.querySelector<HTMLSpanElement>('td:last-child span');
            if (span) {
                span.textContent = prom;
                span.className = `text-sm font-black ${vals.length > 0 && parseFloat(prom) < 60 ? 'text-red-500' : 'text-primary'}`;
            }
        }
    };
}



// ─── PANEL ASISTENCIA ─────────────────────────────────────────────────────
async function cargarPaseLista(salon_id: number) {
    const fechaInput = document.getElementById('fecha-asistencia') as HTMLInputElement;
    if (!fechaInput.value) {
        // Set today
        const hoy = new Date().toISOString().split('T')[0];
        fechaInput.value = hoy;
    }

    const fecha = fechaInput.value;
    const alumnos = await obtenerEstudiantesSalon(salon_id);
    const registros = await obtenerAsistenciaFecha(salon_id, fecha);
    const mapa: Record<number, boolean> = {};
    registros.forEach(r => { mapa[r.estudiante_id] = !!r.presente; });

    const contenedor = document.getElementById('lista-asistencia')!;

    if (alumnos.length === 0) {
        contenedor.innerHTML = `<p class="text-sm text-slate-400 text-center py-8">
            <span class="material-symbols-outlined text-4xl block mb-2 text-slate-300">group</span>
            Agrega alumnos primero.
        </p>`;
        return;
    }

    contenedor.innerHTML = alumnos.map(est => {
        const ini = `${est.nombre[0]}${est.apellido[0]}`.toUpperCase();
        const presente = mapa[est.id] === true;
        const ausente = mapa[est.id] === false;
        return `
        <div class="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all" data-est-id="${est.id}">
            <div class="flex items-center gap-3">
                <div class="size-9 bg-indigo-deep dark:bg-primary/80 text-white dark:text-indigo-deep rounded-xl flex items-center justify-center font-bold text-sm">${ini}</div>
                <span class="text-sm font-medium dark:text-white">${est.nombre} ${est.apellido}</span>
            </div>
            <div class="flex gap-2">
                <button title="Presente" class="attend-toggle ${presente ? 'presente' : ''} size-9 rounded-xl border border-slate-200 dark:border-white/20 flex items-center justify-center text-slate-400 hover:border-primary hover:text-primary transition-all"
                    data-type="presente" data-est="${est.id}">
                    <span class="material-symbols-outlined text-lg">check_circle</span>
                </button>
                <button title="Ausente" class="attend-toggle ${ausente ? 'ausente' : ''} size-9 rounded-xl border border-slate-200 dark:border-white/20 flex items-center justify-center text-slate-400 hover:border-red-400 hover:text-red-400 transition-all"
                    data-type="ausente" data-est="${est.id}">
                    <span class="material-symbols-outlined text-lg">cancel</span>
                </button>
            </div>
        </div>`;
    }).join('');

    // Listeners de asistencia
    document.querySelectorAll<HTMLButtonElement>('.attend-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const estId = parseInt(btn.dataset.est!);
            const tipo = btn.dataset.type as 'presente' | 'ausente';
            const fila = contenedor.querySelector(`[data-est-id="${estId}"]`)!;
            fila.querySelectorAll('.attend-toggle').forEach(b => {
                b.classList.remove('presente', 'ausente');
            });
            btn.classList.add(tipo);
        });
    });

    // Reload when date changes
    fechaInput.onchange = () => cargarPaseLista(salon_id);
}

function inicializarBtnGuardarLista(salon_id: number) {
    document.getElementById('btn-guardar-lista')?.addEventListener('click', async () => {
        const fecha = (document.getElementById('fecha-asistencia') as HTMLInputElement).value;
        if (!fecha) { mostrarToast('Selecciona una fecha.', 'error'); return; }

        const filas = document.querySelectorAll<HTMLElement>('#lista-asistencia [data-est-id]');
        for (const fila of filas) {
            const estId = parseInt(fila.dataset.estId!);
            const presente = fila.querySelector<HTMLButtonElement>('[data-type="presente"]')?.classList.contains('presente') ?? false;
            const ausente = fila.querySelector<HTMLButtonElement>('[data-type="ausente"]')?.classList.contains('ausente') ?? false;
            if (presente || ausente) {
                await registrarAsistencia(salon_id, estId, fecha, presente);
            }
        }
        mostrarToast('¡Asistencia guardada!');
    });
}

// ─── PANEL CONFIGURACIÓN ─────────────────────────────────────────────────
async function cargarConfiguracion(salon_id: number) {
    // Criterios
    const criterios = await obtenerCriteriosSalon(salon_id);
    const container = document.getElementById('criterios-container')!;
    container.innerHTML = '';
    const lista = criterios.length > 0
        ? criterios
        : [{ nombre: 'Exámenes', porcentaje: 40 }, { nombre: 'Tareas', porcentaje: 30 }, { nombre: 'Participación', porcentaje: 30 }];
    lista.forEach(c => {
        container.insertAdjacentHTML('beforeend', buildCriterioRow(c.nombre, c.porcentaje));
    });
    activarListenersCriterios();

    // Config aula: calificación mínima + num_parciales
    const config = await obtenerConfigAula(salon_id);
    if (config) {
        (document.getElementById('input-calmin') as HTMLInputElement).value = String(config.calificacion_minima);
        (document.getElementById('input-num-parciales') as HTMLInputElement).value = String(config.num_parciales);
    }

    // Config asistencia (días)
    const configAsist = await obtenerConfigAsistencia(salon_id);
    if (configAsist) {
        const dias: string[] = JSON.parse(configAsist.dias_semana || '[]');
        document.querySelectorAll<HTMLButtonElement>('.dia-btn').forEach(btn => {
            if (dias.includes(btn.dataset.dia ?? '')) btn.classList.add('activo');
        });
        (document.getElementById('input-min-asistencia') as HTMLInputElement).value = String(configAsist.minimo_porcentaje);
    }
}

function buildCriterioRow(nombre = '', porcentaje = 0): string {
    return `
    <div class="criterio-row">
        <input type="text" value="${nombre}" placeholder="Ej. Examen"
            class="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary dark:text-white transition-all"/>
        <div class="flex items-center gap-1.5 flex-shrink-0">
            <input type="number" value="${porcentaje}" min="0" max="100"
                class="criterio-pct w-20 px-3 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-center focus:ring-2 focus:ring-primary dark:text-white font-black"/>
            <span class="text-sm font-bold text-slate-400">%</span>
        </div>
        <button type="button" class="btn-del-criterio flex-shrink-0 size-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors">
            <span class="material-symbols-outlined text-lg">delete</span>
        </button>
    </div>`;
}

function actualizarTotal() {
    const total = Array.from(document.querySelectorAll<HTMLInputElement>('.criterio-pct'))
        .reduce((sum, inp) => sum + (parseFloat(inp.value) || 0), 0);
    const span = document.getElementById('total-porcentaje')!;
    span.textContent = `${Math.round(total)}%`;
    if (Math.round(total) === 100) {
        span.className = 'text-xl font-black text-green-500';
    } else {
        span.className = 'text-xl font-black text-red-500';
    }
}

function activarListenersCriterios() {
    document.querySelectorAll<HTMLButtonElement>('.btn-del-criterio').forEach(btn => {
        btn.addEventListener('click', () => { btn.closest('.criterio-row')?.remove(); actualizarTotal(); });
    });
    document.querySelectorAll<HTMLInputElement>('.criterio-pct').forEach(inp => {
        inp.addEventListener('input', actualizarTotal);
    });
    actualizarTotal();
}

function inicializarConfiguracionInteracciones(salon_id: number) {
    // Toggle días de asistencia
    document.querySelectorAll<HTMLButtonElement>('.dia-btn').forEach(btn => {
        btn.addEventListener('click', () => btn.classList.toggle('activo'));
    });

    // +/- botones para número de parciales
    const parcInput = () => document.getElementById('input-num-parciales') as HTMLInputElement;
    document.getElementById('btn-inc-parciales')?.addEventListener('click', () => {
        const el = parcInput();
        const v = Math.min(10, parseInt(el.value || '3') + 1);
        el.value = String(v);
    });
    document.getElementById('btn-dec-parciales')?.addEventListener('click', () => {
        const el = parcInput();
        const v = Math.max(1, parseInt(el.value || '3') - 1);
        el.value = String(v);
    });

    // Agregar criterio
    document.getElementById('btn-agregar-criterio')?.addEventListener('click', () => {
        document.getElementById('criterios-container')!.insertAdjacentHTML('beforeend', buildCriterioRow());
        activarListenersCriterios();
    });

    // Guardar criterios
    document.getElementById('btn-guardar-criterios')?.addEventListener('click', async () => {
        if (!currentSalonId) return;
        const rows = document.querySelectorAll('.criterio-row');
        const criterios = Array.from(rows).map(row => ({
            nombre: (row.querySelector('input[type="text"]') as HTMLInputElement).value.trim(),
            porcentaje: parseFloat((row.querySelector('.criterio-pct') as HTMLInputElement).value) || 0,
        })).filter(c => c.nombre);

        const total = criterios.reduce((a, c) => a + c.porcentaje, 0);
        if (Math.round(total) !== 100) {
            mostrarToast(`La suma es ${Math.round(total)}%, debe ser 100%.`, 'error');
            return;
        }
        const res = await guardarCriteriosSalon(currentSalonId, criterios);
        if (res.success) mostrarToast('¡Criterios guardados!');
    });

    // Guardar calificación mínima + número de parciales juntos
    document.getElementById('btn-guardar-calmin')?.addEventListener('click', async () => {
        if (!currentSalonId) return;
        const calmin = parseFloat((document.getElementById('input-calmin') as HTMLInputElement).value);
        if (isNaN(calmin) || calmin < 0 || calmin > 100) {
            mostrarToast('La calificación mínima debe estar entre 0 y 100.', 'error');
            return;
        }
        const numParciales = Math.max(1, Math.min(10,
            parseInt((document.getElementById('input-num-parciales') as HTMLInputElement).value) || 3
        ));
        const res = await guardarConfigAula(currentSalonId, calmin, numParciales);
        if (!res.success) { mostrarToast('Error al guardar configuración.', 'error'); return; }
        // Crear automáticamente los parciales que falten
        await sincronizarParciales(currentSalonId, numParciales);
        mostrarToast(`¡Configuración guardada! ${numParciales} parciales configurados.`);
    });

    // Guardar config asistencia
    document.getElementById('btn-guardar-asistencia')?.addEventListener('click', async () => {
        if (!currentSalonId) return;
        const dias = Array.from(document.querySelectorAll<HTMLButtonElement>('.dia-btn.activo'))
            .map(b => b.dataset.dia ?? '').filter(Boolean);
        const minPct = parseFloat((document.getElementById('input-min-asistencia') as HTMLInputElement).value);
        if (isNaN(minPct)) { mostrarToast('Porcentaje inválido.', 'error'); return; }
        const res = await guardarConfigAsistencia(currentSalonId, dias, minPct);
        if (res.success) mostrarToast('¡Configuración de asistencia guardada!');
    });
}

// ─── Toast notification ───────────────────────────────────────────────────
function mostrarToast(texto: string, tipo: 'success' | 'error' = 'success') {
    const t = document.createElement('div');
    const bg = tipo === 'success' ? 'bg-indigo-deep dark:bg-primary' : 'bg-red-500';
    const tx = tipo === 'success' ? 'text-white dark:text-indigo-deep' : 'text-white';
    const ic = tipo === 'success' ? 'check_circle' : 'error';
    t.className = `fixed bottom-6 right-6 z-[100] ${bg} ${tx} font-bold text-sm px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 opacity-0 translate-y-4`;
    t.style.transition = 'all 0.3s ease';
    t.innerHTML = `<span class="material-symbols-outlined text-base">${ic}</span> ${texto}`;
    document.body.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
    setTimeout(() => {
        t.style.opacity = '0'; t.style.transform = 'translateY(1rem)';
        setTimeout(() => t.remove(), 350);
    }, 2800);
}

// ─── Init ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    initTransitions();
    cargarFotoGuardada();
    setTimeout(cargarDatosPerfil, 100);

    // Obtener ID de la URL
    const params = new URLSearchParams(window.location.search);
    const idStr = params.get('id');
    if (idStr) {
        currentSalonId = parseInt(idStr, 10);
        await cargarDatosSalon(currentSalonId);
    }

    inicializarTabs();

    if (currentSalonId) {
        inicializarFormRegistro(currentSalonId);
        inicializarFormAsignacion(currentSalonId);
        inicializarBtnGuardarLista(currentSalonId);
        inicializarConfiguracionInteracciones(currentSalonId);

        // Cargar datos iniciales del tab Alumnos
        await cargarEstudiantes(currentSalonId);

        // Poner fecha de hoy en el pase de lista
        const hoy = new Date().toISOString().split('T')[0];
        (document.getElementById('fecha-asistencia') as HTMLInputElement).value = hoy;
    }
});
