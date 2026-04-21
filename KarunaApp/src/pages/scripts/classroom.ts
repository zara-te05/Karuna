import { invoke }  from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

import {
    obtenerConfigClassroom,
    guardarCredencialesClassroom,
    guardarTokenClassroom,
    eliminarTokenClassroom,
    listarCursosClassroom,
    buscarSalonPorNombre,
    buscarSalonPorCourseId,
    limpiarDatosSalon,
    importarCursoClassroom,
    type ClassroomConfig,
    type ImportLog,
} from "../../BD/classroom";

import { verificarSesionOLogin } from "../../BD/sesion";

// ─── Session helper ────────────────────────────────────────────────────────────
import Database from "@tauri-apps/plugin-sql";

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const panelNoConectado  = document.getElementById("panel-no-conectado")!;
const panelEsperando    = document.getElementById("panel-esperando")!;
const panelConectado    = document.getElementById("panel-conectado")!;
const panelError        = document.getElementById("panel-error")!;
const headerStatus      = document.getElementById("header-status")!;
const headerFoto        = document.getElementById("header-foto") as HTMLImageElement;
const headerEmail       = document.getElementById("header-email")!;
const sectionCourses    = document.getElementById("section-courses")!;
const sectionLog        = document.getElementById("section-import-log")!;
const coursesGrid       = document.getElementById("courses-grid")!;
const coursesLoading    = document.getElementById("courses-loading")!;
const coursesEmpty      = document.getElementById("courses-empty")!;
const logEntries        = document.getElementById("log-entries")!;
const logProgressBar    = document.getElementById("log-progress-bar")!;
const logProgressText   = document.getElementById("log-progress-text")!;
const logSummary        = document.getElementById("log-summary")!;
const logSummaryText    = document.getElementById("log-summary-text")!;
const modalConflicto    = document.getElementById("modal-conflicto")!;
const conflictoDesc     = document.getElementById("conflicto-desc")!;
const panelCreds        = document.getElementById("panel-creds")!;

// ─── State ────────────────────────────────────────────────────────────────────
let currentConfig: ClassroomConfig | null = null;
let cursos: any[]    = [];
let selectedIds      = new Set<string>();
let oauthPort: number | null = null;
let conflictoResolve: ((v: "unir" | "reemplazar" | "copiar" | "omitir") => void) | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function show(el: HTMLElement)   { el.classList.remove("hidden"); }
function hide(el: HTMLElement)   { el.classList.add("hidden"); }
function showFlex(el: HTMLElement) { el.classList.remove("hidden"); el.classList.add("flex"); }

function setEstado(estado: "desconectado" | "esperando" | "conectado" | "error", msg = "") {
    hide(panelNoConectado);
    hide(panelEsperando);
    hide(panelConectado);
    hide(panelError);
    if (estado === "desconectado")  show(panelNoConectado);
    if (estado === "esperando")     show(panelEsperando);
    if (estado === "conectado")     show(panelConectado);
    if (estado === "error") {
        show(panelError);
        document.getElementById("error-msg")!.textContent = msg;
    }
}

function appendLog(log: ImportLog) {
    const color = log.tipo === "ok"    ? "text-green-700"
                : log.tipo === "warn"  ? "text-amber-600"
                : log.tipo === "error" ? "text-red-600"
                : "text-indigo-deep/70";
    const icon  = log.tipo === "ok"    ? "✔"
                : log.tipo === "warn"  ? "⚠"
                : log.tipo === "error" ? "✖"
                : "·";
    const div = document.createElement("div");
    div.className = `log-entry ${color}`;
    div.textContent = `${icon} ${log.mensaje}`;
    logEntries.appendChild(div);
    logEntries.scrollTop = logEntries.scrollHeight;
}

function setProgress(current: number, total: number) {
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    logProgressBar.style.width = `${pct}%`;
    logProgressText.textContent = `${current} / ${total}`;
}

// ─── Conflict resolution modal ────────────────────────────────────────────────
function pedirDecisionConflicto(nombre: string): Promise<"unir" | "reemplazar" | "copiar" | "omitir"> {
    return new Promise(resolve => {
        conflictoDesc.textContent =
            `Ya existe un salón llamado "${nombre}" en tu cuenta de Karuna. ¿Qué deseas hacer?`;
        show(modalConflicto);
        conflictoResolve = resolve;
    });
}

function cerrarModalConflicto(decision: "unir" | "reemplazar" | "copiar" | "omitir") {
    hide(modalConflicto);
    if (conflictoResolve) {
        conflictoResolve(decision);
        conflictoResolve = null;
    }
}

document.getElementById("btn-conflicto-unir")!.addEventListener("click", ()       => cerrarModalConflicto("unir"));
document.getElementById("btn-conflicto-reemplazar")!.addEventListener("click", () => cerrarModalConflicto("reemplazar"));
document.getElementById("btn-conflicto-copiar")!.addEventListener("click", ()     => cerrarModalConflicto("copiar"));
document.getElementById("btn-conflicto-omitir")!.addEventListener("click", ()      => cerrarModalConflicto("omitir"));

// ─── Credentials panel ───────────────────────────────────────────────────────
document.getElementById("btn-toggle-creds")!.addEventListener("click", () => {
    panelCreds.classList.toggle("hidden");
});

document.getElementById("lnk-console")!.addEventListener("click", async (e) => {
    e.preventDefault();
    await open("https://console.cloud.google.com/apis/credentials");
});

document.getElementById("btn-guardar-creds")!.addEventListener("click", async () => {
    const clientId     = (document.getElementById("input-client-id")     as HTMLInputElement).value.trim();
    const clientSecret = (document.getElementById("input-client-secret") as HTMLInputElement).value.trim();
    const apiKey       = (document.getElementById("input-api-key")       as HTMLInputElement).value.trim();

    if (!clientId || !clientSecret) {
        alert("Client ID y Client Secret son obligatorios.");
        return;
    }

    await guardarCredencialesClassroom(clientId, clientSecret, apiKey);
    currentConfig = await obtenerConfigClassroom();

    const msgCreds = document.getElementById("msg-creds")!;
    show(msgCreds);
    setTimeout(() => hide(msgCreds), 3000);
});

// ─── OAuth flow ────────────────────────────────────────────────────────────────
async function iniciarOAuth() {
    currentConfig = await obtenerConfigClassroom();

    if (!currentConfig.client_id || !currentConfig.client_secret) {
        // Show creds panel
        panelCreds.classList.remove("hidden");
        (document.getElementById("input-api-key") as HTMLInputElement).value
            = currentConfig.api_key ?? (import.meta.env.VITE_CLASSROOM_API_KEY || "");
        alert("Ingresa primero el Client ID y Client Secret en la sección de configuración de credenciales.");
        return;
    }

    setEstado("esperando");

    try {
        // 1. Get a free local port from Rust
        oauthPort = await invoke<number>("obtener_puerto_libre");

        // 2. Build OAuth URL
        const SCOPES = [
            "https://www.googleapis.com/auth/classroom.courses.readonly",
            "https://www.googleapis.com/auth/classroom.rosters.readonly",
            "https://www.googleapis.com/auth/classroom.coursework.students.readonly",
            "https://www.googleapis.com/auth/classroom.student-submissions.students.readonly",
            "openid", "email", "profile",
        ].join(" ");

        const params = new URLSearchParams({
            client_id:    currentConfig.client_id,
            redirect_uri: `http://localhost:${oauthPort}`,
            response_type: "code",
            scope:        SCOPES,
            access_type:  "offline",
            prompt:       "consent",
        });

        const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

        // 3. Open browser AND start the callback server simultaneously
        await Promise.all([
            openUrl(oauthUrl),
            (async () => {
                // 4. Wait for the auth code from Rust
                const code = await invoke<string>("esperar_codigo_oauth", { port: oauthPort });

                // 5. Exchange code for tokens
                const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({
                        code,
                        client_id:     currentConfig!.client_id,
                        client_secret: currentConfig!.client_secret,
                        redirect_uri:  `http://localhost:${oauthPort}`,
                        grant_type:    "authorization_code",
                    }),
                });

                if (!tokenRes.ok) {
                    const errBody = await tokenRes.text();
                    throw new Error(`Error al obtener tokens: ${errBody}`);
                }

                const tokens = await tokenRes.json();

                // 6. Get user info
                const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                    headers: { Authorization: `Bearer ${tokens.access_token}` },
                });
                const user = await userRes.json();

                // 7. Store tokens
                await guardarTokenClassroom(
                    tokens.access_token,
                    tokens.refresh_token ?? null,
                    Date.now() + (tokens.expires_in * 1000),
                    user.email ?? "",
                    user.name  ?? user.email ?? "",
                    user.picture ?? "",
                );

                // 8. Update UI
                currentConfig = await obtenerConfigClassroom();
                mostrarEstadoConectado();
                await cargarCursos();
            })(),
        ]);

    } catch (err: any) {
        setEstado("error", err?.message ?? String(err));
    }
}

function mostrarEstadoConectado() {
    if (!currentConfig) return;
    setEstado("conectado");

    const foto    = document.getElementById("foto-perfil")   as HTMLImageElement;
    const nombre  = document.getElementById("nombre-cuenta")!;
    const email   = document.getElementById("email-cuenta")!;

    if (currentConfig.foto_url) { foto.src = currentConfig.foto_url; show(foto); }
    nombre.textContent  = currentConfig.nombre_cuenta ?? "";
    email.textContent   = currentConfig.email ?? "";

    // Header badge
    if (currentConfig.foto_url) headerFoto.src = currentConfig.foto_url;
    headerEmail.textContent = currentConfig.email ?? "";
    showFlex(headerStatus);

    show(sectionCourses);
}

// ─── Courses list ──────────────────────────────────────────────────────────────
async function cargarCursos() {
    coursesGrid.innerHTML = "";
    hide(coursesEmpty);
    show(coursesLoading);

    try {
        cursos = await listarCursosClassroom();
        hide(coursesLoading);

        if (!cursos.length) {
            show(coursesEmpty);
            return;
        }

        selectedIds = new Set(cursos.map((c: any) => c.id));
        renderCourses();
    } catch (err: any) {
        hide(coursesLoading);
        setEstado("error", err?.message ?? String(err));
    }
}

function renderCourses() {
    coursesGrid.innerHTML = "";
    cursos.forEach((course: any) => {
        const isSelected = selectedIds.has(course.id);
        const card = document.createElement("div");
        card.className = "course-card bg-white rounded-xl border border-forest/10 p-5 cursor-pointer select-none transition-all " +
                         (isSelected ? "ring-2 ring-primary shadow-md" : "hover:shadow-md");
        card.dataset.courseId = course.id;
        card.innerHTML = `
            <div class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center" style="background:${course.descriptionHeading ? '#4285F420' : '#34A85320'}">
                            <span class="material-symbols-outlined text-base" style="color:${course.descriptionHeading ? '#4285F4' : '#34A853'}">class</span>
                        </div>
                        <h4 class="font-bold text-indigo-deep text-sm leading-tight truncate">${course.name}</h4>
                    </div>
                    ${course.section ? `<p class="text-xs text-indigo-deep/50 mb-1">${course.section}</p>` : ""}
                    ${course.room    ? `<p class="text-xs text-indigo-deep/40">Aula: ${course.room}</p>` : ""}
                </div>
                <div class="flex-shrink-0">
                    <div class="w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary' : 'border-indigo-deep/30'}">
                        ${isSelected ? '<span class="material-symbols-outlined text-xs text-white" style="font-size:12px">check</span>' : ""}
                    </div>
                </div>
            </div>`;

        card.addEventListener("click", () => {
            if (selectedIds.has(course.id)) {
                selectedIds.delete(course.id);
            } else {
                selectedIds.add(course.id);
            }
            renderCourses();
        });

        coursesGrid.appendChild(card);
    });
}

// ─── Import pipeline ──────────────────────────────────────────────────────────
async function importarSeleccionados() {
    const toImport = cursos.filter((c: any) => selectedIds.has(c.id));
    if (!toImport.length) { alert("Selecciona al menos un curso."); return; }

    const sesion = verificarSesionOLogin();
    const docente_id = sesion.docente_id;

    logEntries.innerHTML = "";
    hide(logSummary);
    logProgressBar.style.width = "0%";
    logProgressText.textContent = `0 / ${toImport.length}`;
    show(sectionLog);
    sectionLog.scrollIntoView({ behavior: "smooth" });

    let totalAlumnos = 0, totalTareas = 0, totalCals = 0;

    for (let i = 0; i < toImport.length; i++) {
        const course = toImport[i];
        setProgress(i, toImport.length);
        appendLog({ tipo: "info", mensaje: `━ Procesando: ${course.name}` });

        // Check for existing import by courseId
        const existingByCourse = await buscarSalonPorCourseId(course.id);
        if (existingByCourse != null) {
            appendLog({ tipo: "info", mensaje: `  Sincronizando actualizaciones para curso importado (ID ${existingByCourse})…` });
            // Remove 'limpiarDatosSalon' to perform non-destructive sync (merge)
            const result = await importarCursoClassroom(course, existingByCourse, docente_id);
            result.logs.forEach(appendLog);
            totalAlumnos += result.alumnos;
            totalTareas  += result.tareas;
            totalCals    += result.calificaciones;
            continue;
        }

        // Check for name conflict
        const existingByName = await buscarSalonPorNombre(course.name, docente_id);
        let salonId: number | null = null;
        let nameOverride: string | undefined;

        if (existingByName != null) {
            const decision = await pedirDecisionConflicto(course.name);
            if (decision === "omitir") {
                appendLog({ tipo: "warn", mensaje: `  Omitido: "${course.name}"` });
                continue;
            }
            if (decision === "unir") {
                appendLog({ tipo: "info", mensaje: `  Uniendo datos con el salón existente "${course.name}"…` });
                salonId = existingByName;
            } else if (decision === "reemplazar") {
                appendLog({ tipo: "warn", mensaje: `  Reemplazando datos de "${course.name}"…` });
                await limpiarDatosSalon(existingByName);
                salonId = existingByName;
            } else {
                // copy
                nameOverride = `${course.name} (Classroom)`;
                appendLog({ tipo: "info", mensaje: `  Creando copia como "${nameOverride}"` });
            }
        }

        try {
            const result = await importarCursoClassroom(course, salonId, docente_id, nameOverride);
            result.logs.forEach(appendLog);
            totalAlumnos += result.alumnos;
            totalTareas  += result.tareas;
            totalCals    += result.calificaciones;
        } catch (err: any) {
            appendLog({ tipo: "error", mensaje: `  Error importando "${course.name}": ${err?.message ?? err}` });
        }
    }

    setProgress(toImport.length, toImport.length);
    show(logSummary);
    logSummaryText.textContent =
        `${toImport.length} curso(s) · ${totalAlumnos} alumno(s) · ${totalTareas} tarea(s) · ${totalCals} calificación(es)`;
}

// ─── Wire up events ───────────────────────────────────────────────────────────
document.getElementById("btn-conectar")!.addEventListener("click", iniciarOAuth);
document.getElementById("btn-retry")!.addEventListener("click",    iniciarOAuth);

document.getElementById("btn-cancelar-oauth")!.addEventListener("click", () => {
    oauthPort = null;
    setEstado("desconectado");
});

document.getElementById("btn-desvincular")!.addEventListener("click", async () => {
    if (!confirm("¿Desvincular tu cuenta de Google? Los salones importados se conservan en Karuna.")) return;
    await eliminarTokenClassroom();
    currentConfig = await obtenerConfigClassroom();
    hide(headerStatus);
    hide(sectionCourses);
    hide(sectionLog);
    setEstado("desconectado");
});

document.getElementById("btn-recargar-cursos")!.addEventListener("click", cargarCursos);

document.getElementById("btn-importar-todos")!.addEventListener("click", importarSeleccionados);

document.getElementById("btn-close-log")!.addEventListener("click", () => {
    hide(sectionLog);
});

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
    // Validate session on page load
    verificarSesionOLogin();

    try {
        currentConfig = await obtenerConfigClassroom();

        // Pre-fill API key if known
        if (currentConfig.api_key) {
            (document.getElementById("input-api-key") as HTMLInputElement).value = currentConfig.api_key;
        } else {
            // Pre-fill the user's provided API key as default
            (document.getElementById("input-api-key") as HTMLInputElement).value
                = import.meta.env.VITE_CLASSROOM_API_KEY || "";
        }
        if (currentConfig.client_id)     (document.getElementById("input-client-id")     as HTMLInputElement).value = currentConfig.client_id;
        if (currentConfig.client_secret) (document.getElementById("input-client-secret") as HTMLInputElement).value = currentConfig.client_secret;

        if (currentConfig.access_token && currentConfig.email) {
            mostrarEstadoConectado();
            await cargarCursos();
        } else {
            setEstado("desconectado");
        }
    } catch (err: any) {
        setEstado("error", err?.message ?? String(err));
    } finally {
        const overlay = document.getElementById("page-overlay");
        if (overlay) {
            overlay.style.opacity = "0";
            overlay.style.transition = "opacity 0.3s";
            setTimeout(() => overlay.remove(), 300);
        }
    }
}

document.addEventListener("DOMContentLoaded", init);
