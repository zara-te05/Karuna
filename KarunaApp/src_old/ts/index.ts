import { invoke } from "@tauri-apps/api/core";

const correo = document.getElementById('correo') as HTMLInputElement;
const contrasena = document.getElementById('contrasena') as HTMLInputElement;

function IniciarSesion (correo: string, contrasena: string): void{

    if(!correo.trim){
        alert('El campo correo esta vacio')
    }

    if(!contrasena.trim){
        alert('El campo del correo esta vacio')
    }

    

}