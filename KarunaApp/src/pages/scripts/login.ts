import { registrarUsuario, loginDocente } from "../../BD/docentes";
import { initTransitions, navegarA } from "./transitions";
import {
    guardarSesion,
    redirigirSiSesionActiva,
} from "../../BD/sesion";

// ─── Utilidad: leer la duración elegida en los radio buttons ──────────────
function leerDiasDuracion(): number {
    const radio = document.querySelector<HTMLInputElement>(
        'input[name="duracionSesion"]:checked'
    );
    if (!radio) return 1;
    const texto = radio.closest('label')?.querySelector('span')?.textContent ?? '';
    if (texto.includes('30')) return 30;
    if (texto.includes('7'))  return 7;
    return 1;
}

// ─── Init ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    initTransitions();

    // Si ya hay una sesión válida, redirigir directamente a la app
    redirigirSiSesionActiva();

    // ── Formulario de Inicio de Sesión ─────────────────────────────────
    const loginForm = document.querySelector<HTMLFormElement>('#formularioInicio form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const correo     = (document.getElementById('correo')     as HTMLInputElement).value.trim();
            const contrasena = (document.getElementById('contrasena') as HTMLInputElement).value;
            const recordar   = (document.getElementById('recordar')   as HTMLInputElement).checked;
            const dias       = leerDiasDuracion();

            const resultado = await loginDocente(correo, contrasena);

            if (resultado.success && resultado.docente) {
                // Guardar sesión con la duración elegida por el usuario
                guardarSesion(
                    {
                        docente_id: resultado.docente.id,
                        nombre:     resultado.docente.nombre,
                        apellido:   resultado.docente.apellido,
                        email:      resultado.docente.email,
                    },
                    recordar,
                    dias
                );

                const msg = recordar
                    ? `Bienvenido ${resultado.docente.nombre} — sesión guardada por ${dias} día${dias > 1 ? 's' : ''}.`
                    : `Bienvenido ${resultado.docente.nombre}.`;
                alert(msg);

                navegarA('/aulas.html');
            } else {
                alert(resultado.error ?? 'Error al iniciar sesión.');
            }
        });
    }

    // ── Formulario de Registro ─────────────────────────────────────────
    const registerForm = document.querySelector<HTMLFormElement>('#formularioRegistro form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

            const nombre             = (document.getElementById('nombre')             as HTMLInputElement).value.trim();
            const apellido           = (document.getElementById('apellido')           as HTMLInputElement).value.trim();
            const correoRegistro     = (document.getElementById('correoRegistro')     as HTMLInputElement).value.trim();
            const contrasenaRegistro = (document.getElementById('contrasenaRegistro') as HTMLInputElement).value;
            const confirmarContrasena= (document.getElementById('confirmarContrasena')as HTMLInputElement).value;
            const institucion        = (document.getElementById('institucion')        as HTMLInputElement).value.trim();
            const recordarRegistro   = (document.getElementById('recordarRegistro')   as HTMLInputElement).checked;

            if (contrasenaRegistro !== confirmarContrasena) {
                alert('Las contraseñas no coinciden.');
                return;
            }
            if (!regex.test(correoRegistro)) {
                alert('Correo inválido.');
                return;
            }

            const resultado = await registrarUsuario(
                correoRegistro,
                confirmarContrasena,
                nombre,
                apellido,
                institucion || undefined
            );

            if (resultado.success) {
                alert('Perfil creado exitosamente.');

                // Si marcó "mantener sesión", hacer login automático
                if (recordarRegistro) {
                    const loginRes = await loginDocente(correoRegistro, confirmarContrasena);
                    if (loginRes.success && loginRes.docente) {
                        guardarSesion(
                            {
                                docente_id: loginRes.docente.id,
                                nombre:     loginRes.docente.nombre,
                                apellido:   loginRes.docente.apellido,
                                email:      loginRes.docente.email,
                            },
                            true,
                            7  // 7 días por defecto al registrarse
                        );
                        navegarA('/aulas.html');
                        return;
                    }
                }

                // Si no, volver a la pestaña de inicio de sesión
                (document.getElementById('pestanaInicio') as HTMLButtonElement).click();
            } else {
                alert(resultado.error ?? 'No se pudo crear la cuenta.');
            }
        });
    }
});
