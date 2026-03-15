// ─── sesion.ts ─────────────────────────────────────────────────────────────
// Módulo de gestión de sesión con expiración configurable.
// Usamos localStorage para que la sesión persista entre reinicios de la app.
// La clave 'karuna_sesion' almacena un objeto JSON con:
//   { docente_id, nombre, apellido, email, expira_en }
//
// Si 'expira_en' es null → sesión de "solo esta sesión" (sessionStorage-like
// pero implementada en localStorage para poder leerla en todas las páginas).

const CLAVE_SESION = 'karuna_sesion';

export interface SesionData {
    docente_id: number;
    nombre: string;
    apellido: string;
    email: string;
    expira_en: number | null; // timestamp (ms) o null = sin expiración fija
}

// ─── Guardar sesión ────────────────────────────────────────────────────────
/**
 * @param datos       Datos del docente autenticado.
 * @param recordar    Si true, se aplica la duración elegida; si false, la
 *                    sesión solo dura mientras el usuario no cierre sesión
 *                    manualmente (pero sigue guardada entre reinicios).
 * @param diasDuracion Días de vigencia cuando recordar=true (1, 7 o 30).
 */
export function guardarSesion(
    datos: Omit<SesionData, 'expira_en'>,
    recordar: boolean,
    diasDuracion: number = 1
): void {
    const expira_en = recordar
        ? Date.now() + diasDuracion * 24 * 60 * 60 * 1000
        : null;

    const sesion: SesionData = { ...datos, expira_en };
    localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));

    // Guardar también el docente_id en sessionStorage para compatibilidad
    // con el resto del código que lo lee de ahí.
    sessionStorage.setItem('docente_id', String(datos.docente_id));
}

// ─── Obtener sesión vigente ────────────────────────────────────────────────
/**
 * Retorna los datos de sesión si existe y no ha expirado.
 * Si la sesión expiró, la elimina y retorna null.
 */
export function obtenerSesion(): SesionData | null {
    const raw = localStorage.getItem(CLAVE_SESION);
    if (!raw) return null;

    try {
        const sesion: SesionData = JSON.parse(raw);

        // Verificar expiración
        if (sesion.expira_en !== null && Date.now() > sesion.expira_en) {
            cerrarSesion();
            return null;
        }

        // Re-sincronizar docente_id en sessionStorage por si se abrió tab nueva
        sessionStorage.setItem('docente_id', String(sesion.docente_id));

        return sesion;
    } catch {
        cerrarSesion();
        return null;
    }
}

// ─── Cerrar sesión ────────────────────────────────────────────────────────
export function cerrarSesion(): void {
    localStorage.removeItem(CLAVE_SESION);
    sessionStorage.removeItem('docente_id');
}

// ─── Verificar y redirigir ────────────────────────────────────────────────
/**
 * Llama esto en páginas protegidas (aulas, lobby, etc.).
 * Si no hay sesión válida, redirige al login.
 */
export function verificarSesionOLogin(): SesionData {
    const sesion = obtenerSesion();
    if (!sesion) {
        window.location.replace('/index.html');
        // El cast evita que TypeScript se queje de retorno unreachable
        throw new Error('Sesión inválida, redirigiendo al login...');
    }
    return sesion;
}

/**
 * Llama esto en la página de login.
 * Si ya hay sesión válida, redirige directamente a aulas.
 */
export function redirigirSiSesionActiva(): void {
    const sesion = obtenerSesion();
    if (sesion) {
        window.location.replace('/aulas.html');
    }
}
