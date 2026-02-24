import { invoke } from "@tauri-apps/api/core";
import { registrarUsuario, loginDocente } from "../BD/tablas";
import { initTransitions, navegarA } from "../transitions";

// Inicializar el DOM
document.addEventListener('DOMContentLoaded', async(e) => {
    initTransitions();
    
    // Manejar Login
    const loginForm = document.querySelector('#formularioInicio') as HTMLFormElement;
        if(loginForm){
            console.log('Formulario encontrado');
            
            loginForm.addEventListener('submit', async (e) => {
                console.log('Submit event triggered');
                e.preventDefault();
                console.log('Default prevented');

                const correo = (document.getElementById('correo') as HTMLInputElement).value;
                const contrasena = (document.getElementById('contrasena') as HTMLInputElement).value;
                
                console.log('Correo:', correo);
                console.log('Contraseña:', '***');

                const resultado = await loginDocente(correo, contrasena);
                
                console.log('Resultado completo:', resultado);
                console.log('Success?:', resultado.success);

                if(resultado.success){
                
                    localStorage.setItem('usuario', JSON.stringify(resultado.docente));
                    console.log('Usuario guardado en localStorage');
                    
                    alert(`Bienvenido ${resultado.docente?.nombre}`);
                    console.log('Alert mostrado');
                    
                    // CORRECCIÓN: La ruta debe ser relativa al servidor de Vite
                // Como Vite tiene root en 'src/pages', simplemente usa el nombre del archivo
                    const rutaDestino = '/aulas.html';  // O './aulas.html'
                    console.log('Intentando redirigir a:', rutaDestino);
                    
                    navegarA('/aulas.html')
                    
                    console.log('ESTA LÍNEA NO DEBERÍA VERSE');
                }
                else{
                    console.log('ENTRÓ AL ELSE (success es false)');
                    console.log('Error:', resultado.error);
                    alert(resultado.error);
                }
            });
        }
        else{
            console.log('Formulario NO encontrado');
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





