const registro = document.querySelector("#signupForm")
const emailRegex2 = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

registro.addEventListener("submit",validacionesRegistro);

function validacionesRegistro(e){
    e.preventDefault();

    const data = new FormData(registro);
    let nombre = data.get("registro-nombre");
    let email = data.get("registro-correo");
    let password = data.get("registro-contrasena");
    let password_confirmacion = data.get("registro-confirmacion-contrasena")
    let institucion = data.get("registro-institucion");
    let nivel_educativo = data.get("registro-nivel-educativo");

    email = email.trim();
    password = password.trim();
    password_confirmacion = password_confirmacion.trim();

    if(!email || !password || !nombre || !institucion || !nivel_educativo){
        console.log("Falta elementos a ingresar")
        return;
    }

    if(!emailRegex2.test(email)){
        console.log("Email invalido")
        return;
    }

    if(password != password_confirmacion){
        console.log("Las contrasenas no coinciden")
        return;
    }

    enviarRegistro(nombre, email, password, password_confirmacion, institucion, nivel_educativo);
}

function enviarRegistro(nombre, email, password, password_confirmacion, institucion, nivel_educativo){

    fetch('/api/register/',{
        method:"POST",
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        body: JSON.stringify({nombre, email, password, password_confirmacion, institucion,nivel_educativo})
    })
    .then(response => {
        
        if(!response.ok){
            throw new Error('Error HTTP: ' + response.status);
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("La respuesta NO es JSON");
        }

        return response.json();
    })
    .then(data => {
        console.log('Registro exitoso', data);
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function getCSRFToken() {
    return document.querySelector('[name=csrfmiddlewaretoken]').value;
}