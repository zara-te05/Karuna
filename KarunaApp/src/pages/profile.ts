import { invoke } from "@tauri-apps/api/core";
import { actualizarDocente } from "../BD/tablas";
import { obtenerDocentePorID } from "../BD/tablas";
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';

async function cargarDatosPerfil(){
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

function cargarFotoGuardada() {
    const rutaGuardada = localStorage.getItem('foto_perfil');
    if (rutaGuardada) {
        const foto = document.getElementById('profile-photo') as HTMLImageElement;
        foto.src = convertFileSrc(rutaGuardada);
    }
}


document.addEventListener('DOMContentLoaded', async(e) => {

    const nombre = (document.getElementById("input-nombre") as HTMLInputElement);
    const apellido = (document.getElementById("input-apellido") as HTMLInputElement);
    const puesto = (document.getElementById("input-puesto") as HTMLInputElement);
    const genero = (document.getElementById("select-genero") as HTMLInputElement);
    
    const button_save = (document.getElementById("btn-save") as HTMLButtonElement);

    const button_photo = (document.getElementById("cambio_foto") as HTMLButtonElement);

    // Cargar foto guardada al iniciar
    cargarFotoGuardada();

    button_save.addEventListener("click", async () => {
        if (nombre.value.trim() === "" || apellido.value.trim() === "") {
            console.warn("Nombre o apellido vacíos");
            return;
        }
        try {
            await actualizarDocente(nombre.value, apellido.value, 1);
            alert("Cambio realizado exitosamente");
        } catch (error) {
            console.error("Error al actualizar:", error);
        }
    });

    button_photo.addEventListener("click", async () => {
        const archivo = await open({
            multiple: false,
            filters: [{ name: 'Imagen', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
        });

        if (!archivo) return;

        // Guardar la ruta en localStorage
        localStorage.setItem('foto_perfil', archivo as string);

        // Mostrar la foto
        const foto = document.getElementById('profile-photo') as HTMLImageElement;
        foto.src = convertFileSrc(archivo as string);
    });

    setTimeout(cargarDatosPerfil);
})