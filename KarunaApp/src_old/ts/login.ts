import { invoke } from "@tauri-apps/api/core";
import { registrarUsuario, loginDocente } from "../BD/tablas";

// Inicializar el DOM
document.addEventListener('DOMContentLoaded', async(e) => {
    
    // Manejar Login
    const loginForm = document.querySelector('#formularioInicio') as HTMLFormElement;
    if(loginForm){
        loginForm.addEventListener('submit', async (e) => {

            e.preventDefault();

            const correo = (document.getElementById('correo') as HTMLInputElement).value;
            const contrasena = (document.getElementById('contrasena') as HTMLInputElement).value;

            const resultado = await loginDocente(correo, contrasena);

            if(resultado.success){
                alert(`Bienvenido ${resultado.docente?.nombre}`);
                // AQUI SIGUE EL OTRO HTML
                // window.location.href = '/d'
            }
            else{
                alert(resultado.error);
            }

        });
    }

    //Manejar Registro
    const registerForm = document.querySelector('#formularioRegistro') as HTMLFormElement;
    if(registerForm){
        registerForm.addEventListener('submit', async (e) =>{

            const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

            const nombre = (document.getElementById('nombre') as HTMLInputElement).value;
            const apellido = (document.getElementById('apellido') as HTMLInputElement).value;
            const correoRegistro = (document.getElementById('correoRegistro') as HTMLInputElement).value;
            const contrasenaRegistro = (document.getElementById('contrasenaRegistro') as HTMLInputElement).value;
            const confirmarContrasena = (document.getElementById('confirmarContrasena') as HTMLInputElement).value;
            const institucion = (document.getElementById("institucion") as HTMLInputElement).value;

            if(contrasenaRegistro !== confirmarContrasena){
                alert('Las contraseñas no coinciden');
                return;
            }
            if(!regex.test(correoRegistro)){
                alert('Correo invalido');
                return;
            }

            const resultado = await registrarUsuario(correoRegistro, confirmarContrasena, nombre, apellido, institucion);
            
            if(resultado){
                alert(`Perfil creado exitosamente`);
                // HTML SIGUIENTE
                (document.getElementById('pestanaInicio') as HTMLButtonElement).click();
            }
        });
    }
})





