const formulario = document.querySelector("#loginForm")
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

formulario.addEventListener("submit", ValidacionesLogin);

function ValidacionesLogin(e){
    e.preventDefault();

    const data = new FormData(formulario);
    let email = data.get("login-correo");
    let password = data.get("login-password");

    if(!email || !password){
        console.log("Faltan elementos al ingresar");
        return;
    }

    if(!emailRegex.test(email)){
        console.log("Email inválido");
        return;
    }

    email = email.trim();
    password = password.trim();

    console.log(email, password)
    enviarLogin(email, password);
    
}

function enviarLogin(email, password) {
    fetch('/api/login/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken(),
        },
        body: JSON.stringify({ email, password })
    })
    .then(response => {
       
        if (!response.ok) {
            throw new Error('Error HTTP: ' + response.status);
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("La respuesta NO es JSON");
        }

        return response.json();
    })
    .then(data => {
        console.log('Login correcto', data);
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function getCSRFToken() {
    return document.querySelector('[name=csrfmiddlewaretoken]').value;
}

