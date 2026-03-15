import { initTransitions } from "./transitions";
import { obtenerDocentePorID } from "../../BD/docentes";
import { crearSalon } from "../../BD/salones";
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { verificarSesionOLogin } from '../../BD/sesion';



// ─── Estado local del selector de color ───────────────────────────────────
// Aqui se guardan los colores del gradiente

let colorSeleccionado = {
    from: '#1E1B4B',
    to: '#D4AF37',

}

// ─── Leer el gradiente seleccionado desde los botones de tema ─────────────
// Los botones fijos tienen un gradient predefinido;
// los botones de paleta usan los colores del color picker.
function leerColorActivo(): { from: string; to: string } {
    return colorSeleccionado;
}


// ─── Escuchar cambios en el color picker para actualizar el estado ────────
function inicializarColorPicker() {
    const colorFrom = document.getElementById('color-from') as HTMLInputElement | null;
    const colorTo = document.getElementById('color-to') as HTMLInputElement | null;

    if (!colorFrom || !colorTo) return;

    // Cuando el usuario aplica la paleta (botón "Aplicar"), el panel ya
    // actualiza el preview visual. Aquí solo sincronizamos el estado TS.
    document.getElementById('apply-palette-btn')?.addEventListener('click', () => {
        colorSeleccionado.from = colorFrom.value;
        colorSeleccionado.to = colorTo.value;
    });
}

// Deben coincidir con los gradientes en el HTML
const TEMAS_PREDEFINIDOS: Record<number, { from: string; to: string }> = {
    0: { from: '#1E1B4B', to: '#283593' },   // Indigo profundo
    1: { from: '#f4c32f', to: '#fb923c' },   // Dorado → naranja
    2: { from: '#0d9488', to: '#1e1b4b' },   // Teal → índigo
    3: { from: '#fb7185', to: '#1e1b4b' },   // Rosa → índigo
};

function inicializarSelectorTema() {
    document.querySelectorAll<HTMLButtonElement>('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index ?? '-1');
            const isPalette = btn.dataset.isPalette === 'true';

            if (!isPalette && TEMAS_PREDEFINIDOS[index]) {
                // Tema fijo: actualizar estado con los colores predefinidos
                colorSeleccionado = { ...TEMAS_PREDEFINIDOS[index] };
            }
            // Si es paleta, el estado se actualiza al presionar "Aplicar"
        });
    });
}

// ─── Submit del formulario ────────────────────────────────────────────────
async function manejarSubmit(e: SubmitEvent) {
    e.preventDefault();

    const form = e.target as HTMLFormElement;
    const inputs = form.querySelectorAll<HTMLInputElement>('input[type="text"]');

    // Los inputs en orden son: materia, nombre del salón, sección
    const materia = inputs[0]?.value.trim();
    const nombre = inputs[1]?.value.trim();
    const seccion = inputs[2]?.value.trim();

    // Validación básica
    if (!materia || !nombre || !seccion) {
        alert('Por favor completa todos los campos.');
        return;
    }

    const { from: colorFrom, to: colorTo } = leerColorActivo();


    // Obtener el ID del docente desde la sesión activa
    const sesion = verificarSesionOLogin();
    const docente_id = sesion.docente_id;

    try {
        const resultado = await crearSalon(
            docente_id,
            nombre,
            materia,
            seccion,
            colorFrom,
            colorTo
        );

        if (!resultado.success) {
            throw new Error('La BD retornó un error al insertar el salón.');
        }

        console.log('Salón creado correctamente.');

        // Redirigir al lobby para ver el nuevo salón
        window.location.href = 'lobby_aulas.html';

    } catch (error) {
        console.error('Error al crear salón:', error);
        alert(`No se pudo crear el salón: ${error}`);
    }
}



function cargarFotoGuardada() {
    const rutaGuardada = localStorage.getItem('foto_perfil');
    if (rutaGuardada) {
        const fotoPerfil = document.getElementById('foto-perfil') as HTMLImageElement;

        const src = convertFileSrc(rutaGuardada);

        if (fotoPerfil) fotoPerfil.src = src;  // ← Esto faltaba
    }
}

async function cargarDatosPerfil() {
    try {
        // 1. Obtener el elemento (Usa el ID exacto que pusiste en el HTML)
        const nombreDocente = document.getElementById('nombre_docente');

        if (!nombreDocente) {
            console.error("No se encontró el elemento #nombre_docente en el HTML");
            return;
        }

        // 2. Consultar la BD (ID 1 es el supuesto)
        const docente = await obtenerDocentePorID(1);

        // 3. Validar si el docente existe
        if (docente) {
            nombreDocente.textContent = `Prof. ${docente.nombre} ${docente.apellido}`;
            console.log("DOM actualizado con:", docente.nombre);
        }
        else {
            console.warn("La base de datos respondió, pero el ID 1 no existe.");
            nombreDocente.textContent = "Docente no encontrado";
        }
    }
    catch (error) {
        console.error("Error en el flujo de carga:", error);
    }
}

document.addEventListener("DOMContentLoaded", async (e) => {

    cargarFotoGuardada();
    setTimeout(cargarDatosPerfil, 100);

    inicializarColorPicker();
    inicializarSelectorTema();

    const form = document.querySelector<HTMLFormElement>('form');
    form?.addEventListener('submit', manejarSubmit);

})