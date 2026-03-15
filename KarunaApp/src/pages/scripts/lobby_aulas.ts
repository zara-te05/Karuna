import { initTransitions } from "./transitions";
import { obtenerDocentePorID } from "../../BD/docentes";
import { obtenerSalones, eliminarSalon, type Salon } from '../../BD/salones';
import { convertFileSrc } from '@tauri-apps/api/core';
import { verificarSesionOLogin } from '../../BD/sesion';

// ─── Cargar foto de perfil guardada en localStorage ───────────────────────
function cargarFotoGuardada() {
    const rutaGuardada = localStorage.getItem('foto_perfil');
    if (rutaGuardada) {
        const fotoPerfil = document.getElementById('imagen-perfil') as HTMLImageElement | null;
        if (fotoPerfil) fotoPerfil.src = convertFileSrc(rutaGuardada);
    }
}

// ─── Inicializar datos del docente en el header ────────────────────────────
async function inicializarLobby() {
    // Verificar sesión — redirige al login si no es válida
    const sesion = verificarSesionOLogin();

    initTransitions();

    cargarFotoGuardada();

    const docente = await obtenerDocentePorID(sesion.docente_id);
    const nombreDocente = document.getElementById('nombre_docente');
    if (nombreDocente && docente) {
        nombreDocente.textContent = `Prof. ${docente.nombre} ${docente.apellido}`;
    }
}

// ─── Generar HTML de una card ─────────────────────────────────────────────
function crearCardHTML(salon: Salon): string {
    return `
        <div class="group bg-white dark:bg-slate-800/30 rounded-xl shadow-sm hover:shadow-xl
                    transition-all duration-300 flex flex-col overflow-hidden
                    border border-slate-100 dark:border-primary/10"
             data-id="${salon.id}">

            <div class="h-32 w-full relative overflow-hidden"
                 style="background: linear-gradient(135deg, ${salon.color_from}, ${salon.color_to})">
                <div class="absolute bottom-4 left-6">
                    <span class="px-3 py-1 bg-white/90 dark:bg-indigo-deep/90 backdrop-blur
                                 rounded-full text-[10px] font-bold uppercase tracking-wider
                                 text-indigo-900 dark:text-primary">
                        ${salon.seccion}
                    </span>
                </div>
            </div>

            <div class="p-6">
                <h3 class="text-2xl font-serif text-slate-900 dark:text-white mb-1
                           group-hover:text-primary transition-colors">
                    ${salon.nombre}
                </h3>
                <p class="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-1">
                    <span class="material-symbols-outlined text-sm">menu_book</span>
                    ${salon.materia}
                </p>
                <p class="text-slate-400 dark:text-slate-500 text-xs flex items-center gap-1 mb-6">
                    <span class="material-symbols-outlined text-xs">calendar_today</span>
                    Semestre Otoño 2024
                </p>

                <div class="grid grid-cols-2 gap-4 mb-6">
                    <div class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <p class="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Estudiantes</p>
                        <p class="text-lg font-bold text-slate-700 dark:text-slate-200">${salon.estudiantes}</p>
                    </div>
                    <div class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <p class="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Asistencia</p>
                        <p class="text-lg font-bold text-slate-700 dark:text-slate-200">${Math.round(salon.asistencia)}%</p>
                    </div>
                </div>

                <div class="flex gap-2">
                    <button class="flex-1 py-3 rounded-xl border border-primary/30 text-indigo-900
                                   dark:text-primary font-bold text-sm hover:bg-primary
                                   hover:text-indigo-deep transition-all btn-abrir"
                            data-id="${salon.id}">
                        Ver Salón
                    </button>
                    <button class="px-3 py-3 rounded-xl border border-red-200 dark:border-red-900/30
                                   text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all btn-eliminar"
                            data-id="${salon.id}"
                            data-nombre="${salon.nombre}">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ─── Renderizar grid ──────────────────────────────────────────────────────
function renderizarSalones(salones: Salon[]) {
    // Selector robusto: busca el grid dentro del main
    const grid = document.querySelector<HTMLDivElement>('main .grid');
    if (!grid) {
        console.error('No se encontró el contenedor .grid en el lobby.');
        return;
    }

    // Eliminar todas las cards dinámicas previas (tienen data-id)
    grid.querySelectorAll('[data-id]').forEach(el => el.remove());

    if (salones.length === 0) {
        // Si no hay salones, mostrar mensaje vacío (antes del placeholder Add New)
        const existing = grid.querySelector('[data-empty]');
        if (!existing) {
            const empty = document.createElement('div');
            empty.setAttribute('data-empty', 'true');
            empty.className = 'col-span-full text-center py-20 text-slate-400 dark:text-slate-600';
            empty.innerHTML = `
                <span class="material-symbols-outlined text-6xl block mb-4">school</span>
                <p class="font-serif text-xl">Aún no tienes salones</p>
                <p class="text-sm mt-2">Crea tu primer salón con el botón de arriba.</p>
            `;
            grid.prepend(empty);
        }
        return;
    }

    // Limpiar mensaje vacío si existía
    grid.querySelector('[data-empty]')?.remove();

    // Insertar las cards al inicio del grid (antes del placeholder "Nuevo Salón")
    const placeholder = grid.querySelector('[data-placeholder]');
    salones.forEach(salon => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = crearCardHTML(salon).trim();
        const card = wrapper.firstElementChild!;
        grid.insertBefore(card, placeholder);
    });

    // Event listeners
    grid.querySelectorAll<HTMLButtonElement>('.btn-abrir').forEach(btn => {
        btn.addEventListener('click', () => {
            window.location.href = `aula.html?id=${btn.dataset.id}`;
        });
    });

    grid.querySelectorAll<HTMLButtonElement>('.btn-eliminar').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = parseInt(btn.dataset.id!);
            const nombre = btn.dataset.nombre!;
            if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;

            const resultado = await eliminarSalon(id);
            if (resultado.success) {
                await cargarSalones();
            } else {
                alert('No se pudo eliminar el salón.');
            }
        });
    });
}

// ─── Cargar salones desde BD ──────────────────────────────────────────────
async function cargarSalones() {
    const sesion = verificarSesionOLogin();
    const salones = await obtenerSalones(sesion.docente_id);
    renderizarSalones(salones);
}

// ─── Init único ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await inicializarLobby();
    await cargarSalones();
});
