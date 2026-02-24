// En tu archivo de entrada (ej. aulas.ts)
import { initTransitions } from "../transitions";
import { obtenerDocentePorID } from "../BD/tablas";

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
        } else {
            console.warn("La base de datos respondió, pero el ID 1 no existe.");
            nombreDocente.textContent = "Docente no encontrado";
        }
    } catch (error) {
        console.error("Error en el flujo de carga:", error);
    }
}

// Ejecución segura
document.addEventListener("DOMContentLoaded", () => {
    initTransitions();
    // Un pequeño delay opcional si notas que falla por milisegundos
    setTimeout(cargarDatosPerfil, 100); 
});