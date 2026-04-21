import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

async function getDatabase(): Promise<Database> {
    if (db) return db;
    db = await Database.load("sqlite:karuna.db");

    // Config & token table (one row, id=1)
    await db.execute(`
        CREATE TABLE IF NOT EXISTS CLASSROOM_CONFIG (
            id              INTEGER PRIMARY KEY DEFAULT 1,
            client_id       TEXT,
            client_secret   TEXT,
            api_key         TEXT,
            access_token    TEXT,
            refresh_token   TEXT,
            expires_at      INTEGER,
            email           TEXT,
            nombre_cuenta   TEXT,
            foto_url        TEXT
        )
    `);

    // Track which salon came from which Classroom course
    await db.execute(`
        CREATE TABLE IF NOT EXISTS CLASSROOM_SALON (
            salon_id            INTEGER PRIMARY KEY,
            classroom_course_id TEXT NOT NULL UNIQUE,
            imported_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (salon_id) REFERENCES SALON(id) ON DELETE CASCADE
        )
    `);

    // Map Google userId → local estudiante id
    await db.execute(`
        CREATE TABLE IF NOT EXISTS CLASSROOM_ESTUDIANTE (
            estudiante_id   INTEGER PRIMARY KEY,
            google_user_id  TEXT NOT NULL,
            FOREIGN KEY (estudiante_id) REFERENCES ESTUDIANTE(id) ON DELETE CASCADE
        )
    `);

    // Map Classroom courseWork id → local asignacion id
    await db.execute(`
        CREATE TABLE IF NOT EXISTS CLASSROOM_ASIGNACION (
            asignacion_id       INTEGER PRIMARY KEY,
            classroom_cw_id     TEXT NOT NULL UNIQUE,
            FOREIGN KEY (asignacion_id) REFERENCES ASIGNACION(id) ON DELETE CASCADE
        )
    `);

    return db;
}

// ─── Config / Credentials ─────────────────────────────────────────────────────

export interface ClassroomConfig {
    client_id:     string;
    client_secret: string;
    api_key:       string;
    access_token:  string | null;
    refresh_token: string | null;
    expires_at:    number | null;
    email:         string | null;
    nombre_cuenta: string | null;
    foto_url:      string | null;
}

export async function obtenerConfigClassroom(): Promise<ClassroomConfig> {
    try {
        const database = await getDatabase();
        const rows = await database.select<ClassroomConfig[]>(
            `SELECT client_id, client_secret, api_key, access_token, refresh_token,
                    expires_at, email, nombre_cuenta, foto_url
             FROM CLASSROOM_CONFIG WHERE id = 1`
        );
        return rows[0] ?? {
            client_id: '', client_secret: '', api_key: '',
            access_token: null, refresh_token: null, expires_at: null,
            email: null, nombre_cuenta: null, foto_url: null,
        };
    } catch {
        return {
            client_id: '', client_secret: '', api_key: '',
            access_token: null, refresh_token: null, expires_at: null,
            email: null, nombre_cuenta: null, foto_url: null,
        };
    }
}

export async function guardarCredencialesClassroom(
    client_id: string,
    client_secret: string,
    api_key: string
) {
    const database = await getDatabase();
    await database.execute(
        `INSERT INTO CLASSROOM_CONFIG (id, client_id, client_secret, api_key)
         VALUES (1, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            client_id     = excluded.client_id,
            client_secret = excluded.client_secret,
            api_key       = excluded.api_key`,
        [client_id, client_secret, api_key]
    );
}

export async function guardarTokenClassroom(
    access_token: string,
    refresh_token: string | null,
    expires_at: number,
    email: string,
    nombre_cuenta: string,
    foto_url: string
) {
    const database = await getDatabase();
    await database.execute(
        `INSERT INTO CLASSROOM_CONFIG
            (id, access_token, refresh_token, expires_at, email, nombre_cuenta, foto_url)
         VALUES (1, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            access_token  = excluded.access_token,
            refresh_token = COALESCE(excluded.refresh_token, refresh_token),
            expires_at    = excluded.expires_at,
            email         = excluded.email,
            nombre_cuenta = excluded.nombre_cuenta,
            foto_url      = excluded.foto_url`,
        [access_token, refresh_token, expires_at, email, nombre_cuenta, foto_url]
    );
}

export async function eliminarTokenClassroom() {
    const database = await getDatabase();
    await database.execute(
        `UPDATE CLASSROOM_CONFIG SET
            access_token=NULL, refresh_token=NULL, expires_at=NULL,
            email=NULL, nombre_cuenta=NULL, foto_url=NULL
         WHERE id=1`
    );
}

// ─── Token helpers ────────────────────────────────────────────────────────────

/** Returns a valid access_token, refreshing if expired. Throws on failure. */
export async function obtenerTokenValido(): Promise<string> {
    const cfg = await obtenerConfigClassroom();
    if (!cfg.access_token) throw new Error("No hay sesión de Classroom. Conecta tu cuenta primero.");

    const isExpired = cfg.expires_at != null && Date.now() >= cfg.expires_at - 60_000;

    if (!isExpired) return cfg.access_token!;

    // Refresh
    if (!cfg.refresh_token) throw new Error("Token expirado y no hay refresh_token. Reconecta tu cuenta.");
    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id:     cfg.client_id,
            client_secret: cfg.client_secret,
            refresh_token: cfg.refresh_token,
            grant_type:    "refresh_token",
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Error al refrescar token: ${err}`);
    }

    const data = await res.json();
    const newExpiry = Date.now() + (data.expires_in * 1000);
    await guardarTokenClassroom(
        data.access_token,
        cfg.refresh_token,
        newExpiry,
        cfg.email!,
        cfg.nombre_cuenta!,
        cfg.foto_url!
    );

    return data.access_token as string;
}

// ─── Classroom API wrappers (all read-only GET) ───────────────────────────────

async function gcGet(url: string): Promise<any> {
    const token = await obtenerTokenValido();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Classroom API error (${res.status}): ${body.slice(0, 200)}`);
    }
    return res.json();
}

export async function listarCursosClassroom() {
    const data = await gcGet(
        "https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&pageSize=50"
    );
    return (data.courses ?? []) as any[];
}

async function listarEstudiantesCurso(courseId: string): Promise<any[]> {
    let students: any[] = [];
    let pageToken = "";
    do {
        const url = `https://classroom.googleapis.com/v1/courses/${courseId}/students?pageSize=200${pageToken ? "&pageToken=" + pageToken : ""}`;
        const data = await gcGet(url);
        students = students.concat(data.students ?? []);
        pageToken = data.nextPageToken ?? "";
    } while (pageToken);
    return students;
}

async function listarTareasCurso(courseId: string): Promise<any[]> {
    let works: any[] = [];
    let pageToken = "";
    do {
        const url = `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork?pageSize=100${pageToken ? "&pageToken=" + pageToken : ""}`;
        const data = await gcGet(url);
        works = works.concat(data.courseWork ?? []);
        pageToken = data.nextPageToken ?? "";
    } while (pageToken);
    return works;
}

async function listarSubmissions(courseId: string, cwId: string): Promise<any[]> {
    let subs: any[] = [];
    let pageToken = "";
    do {
        const url = `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork/${cwId}/studentSubmissions?pageSize=200${pageToken ? "&pageToken=" + pageToken : ""}`;
        const data = await gcGet(url);
        subs = subs.concat(data.studentSubmissions ?? []);
        pageToken = data.nextPageToken ?? "";
    } while (pageToken);
    return subs;
}

// ─── Import pipeline ──────────────────────────────────────────────────────────

export interface ImportLog {
    tipo:    "info" | "ok" | "warn" | "error";
    mensaje: string;
}

export interface ImportResult {
    salonId:    number;
    alumnos:    number;
    tareas:     number;
    calificaciones: number;
    logs:       ImportLog[];
}

/** Verifica si ya existe un salón con ese nombre. */
export async function buscarSalonPorNombre(nombre: string, docente_id: number): Promise<number | null> {
    const database = await getDatabase();
    const rows = await database.select<{ id: number }[]>(
        `SELECT id FROM SALON WHERE nombre = ? AND docente_id = ?`,
        [nombre, docente_id]
    );
    return rows[0]?.id ?? null;
}

/** Verifica si el courseId ya fue importado antes → devuelve salon_id o null. */
export async function buscarSalonPorCourseId(courseId: string): Promise<number | null> {
    const database = await getDatabase();
    const rows = await database.select<{ salon_id: number }[]>(
        `SELECT salon_id FROM CLASSROOM_SALON WHERE classroom_course_id = ?`,
        [courseId]
    );
    return rows[0]?.salon_id ?? null;
}

/** Elimina todos los datos de un salón (conserva el salón en sí). */
export async function limpiarDatosSalon(salonId: number) {
    const database = await getDatabase();
    
    // Eliminación manual de tablas pivote (SQLite puede tener foreign_keys apagado)
    await database.execute(
        `DELETE FROM CLASSROOM_ESTUDIANTE WHERE estudiante_id IN (SELECT id FROM ESTUDIANTE WHERE salon_id = ?)`, [salonId]
    );
    await database.execute(
        `DELETE FROM CLASSROOM_ASIGNACION WHERE asignacion_id IN (SELECT id FROM ASIGNACION WHERE salon_id = ?)`, [salonId]
    );
    
    // CASCADE deletes handle related records
    await database.execute(`DELETE FROM ASIGNACION WHERE salon_id = ?`, [salonId]);
    await database.execute(`DELETE FROM ESTUDIANTE  WHERE salon_id = ?`, [salonId]);
    await database.execute(`DELETE FROM REGISTRO_ASISTENCIA WHERE salon_id = ?`, [salonId]);
    await database.execute(`UPDATE SALON SET estudiantes=0, asistencia=0.0 WHERE id=?`, [salonId]);
}

/** Importa un curso de Google Classroom completo a la BD local.
 *  @param course       Objeto de curso de Google Classroom
 *  @param salonId      ID del salón local ya existente o null para crear nuevo
 *  @param docente_id
 *  @param salonNombreOverride  Nombre a usar (puede diferir del course.name en modo "copy")
 *
 *  Optimizado para evitar freeze de UI:
 *  - Pre-fetch único de alumnos/tareas ya importados (evita N+1 queries)
 *  - Batch INSERT con múltiples VALUES rows en lugar de un INSERT por fila
 *  - BEGIN/COMMIT por bloque para reducir fsync de SQLite de O(n) a O(1)
 */
export async function importarCursoClassroom(
    course: any,
    salonId: number | null,
    docente_id: number,
    salonNombreOverride?: string,
): Promise<ImportResult> {
    const logs: ImportLog[] = [];
    const database = await getDatabase();
    let alumnosCount = 0;
    let tareasCount  = 0;
    let calsCount    = 0;

    const courseName = salonNombreOverride ?? course.name;

    // 1. Crear o reutilizar salón
    if (salonId == null) {
        const colFrom = "#4285F4";
        const colTo   = "#34A853";
        const result = await database.execute(
            `INSERT INTO SALON (docente_id, nombre, materia, seccion, color_from, color_to)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [docente_id, courseName, course.section ?? "Google Classroom",
             course.section ?? "", colFrom, colTo]
        );
        salonId = result.lastInsertId as number;
        logs.push({ tipo: "info", mensaje: `Salón creado: "${courseName}" (ID ${salonId})` });
    } else {
        logs.push({ tipo: "info", mensaje: `Reutilizando salón ID ${salonId}` });
    }

    // Register Classroom linkage
    await database.execute(
        `INSERT OR REPLACE INTO CLASSROOM_SALON (salon_id, classroom_course_id)
         VALUES (?, ?)`,
        [salonId, course.id]
    );

    // ─── 2. Import students (batch) ───────────────────────────────────────────
    logs.push({ tipo: "info", mensaje: "Importando alumnos…" });
    const students = await listarEstudiantesCurso(course.id);

    // Pre-fetch: all google_user_ids already mapped in this salon in a single query
    const existingStudentRows = await database.select<{ estudiante_id: number; google_user_id: string }[]>(
        `SELECT ce.estudiante_id, ce.google_user_id
         FROM CLASSROOM_ESTUDIANTE ce
         JOIN ESTUDIANTE e ON ce.estudiante_id = e.id
         WHERE e.salon_id = ?`,
        [salonId]
    );
    const mappedGoogleIds = new Map<string, number>(
        existingStudentRows.map(r => [r.google_user_id, r.estudiante_id])
    );

    // Pre-fetch: all local students in this salon (email/name matching)
    const localStudents = await database.select<{ id: number; id_control: string; nombre: string; apellido: string }[]>(
        `SELECT id, id_control, nombre, apellido FROM ESTUDIANTE WHERE salon_id = ?`,
        [salonId]
    );
    const localByEmail = new Map(localStudents.map(s => [s.id_control, s.id]));
    const localByName  = new Map(localStudents.map(s => [`${s.nombre}|${s.apellido}`, s.id]));

    // Map: googleUserId → local estudiante_id
    const userIdMap = new Map<string, number>();

    // Collect new students to insert
    const newStudents: { gid: string; fname: string; lname: string; email: string }[] = [];

    for (const st of students) {
        const gid   = st.userId as string;
        const fname = st.profile?.name?.givenName  ?? "";
        const lname = st.profile?.name?.familyName ?? st.profile?.name?.fullName?.split(" ").slice(1).join(" ") ?? "";
        const email = st.profile?.emailAddress ?? gid;

        // Already mapped?
        if (mappedGoogleIds.has(gid)) {
            userIdMap.set(gid, mappedGoogleIds.get(gid)!);
            alumnosCount++;
            continue;
        }

        // Local match by email or nombre+apellido?
        const existId = localByEmail.get(email)
            ?? localByName.get(`${fname || "Sin nombre"}|${lname || ""}`);

        if (existId != null) {
            userIdMap.set(gid, existId);
            await database.execute(
                `INSERT OR IGNORE INTO CLASSROOM_ESTUDIANTE (estudiante_id, google_user_id) VALUES (?, ?)`,
                [existId, gid]
            );
            alumnosCount++;
        } else {
            newStudents.push({ gid, fname, lname, email });
        }
    }

    // Batch-insert new students (chunks of 50 rows per INSERT)
    if (newStudents.length > 0) {
        await database.execute("BEGIN");
        try {
            const CHUNK = 50;
            for (let i = 0; i < newStudents.length; i += CHUNK) {
                const chunk = newStudents.slice(i, i + CHUNK);
                const placeholders = chunk.map(() => "(?, ?, ?, ?)").join(",");
                const values: any[] = [];
                chunk.forEach(s => values.push(salonId, s.fname || "Sin nombre", s.lname || "", s.email));
                const res = await database.execute(
                    `INSERT INTO ESTUDIANTE (salon_id, nombre, apellido, id_control) VALUES ${placeholders}`,
                    values
                );
                // SQLite guarantees lastInsertId = last row; IDs are contiguous for bulk inserts
                const lastId  = res.lastInsertId as number;
                const firstId = lastId - chunk.length + 1;
                chunk.forEach((s, idx) => userIdMap.set(s.gid, firstId + idx));
                alumnosCount += chunk.length;
            }

            // Batch-link CLASSROOM_ESTUDIANTE for newly inserted students
            const newEntries = newStudents
                .map(s => ({ gid: s.gid, estId: userIdMap.get(s.gid)! }))
                .filter(e => e.estId != null);

            for (let i = 0; i < newEntries.length; i += 50) {
                const chunk = newEntries.slice(i, i + 50);
                const placeholders = chunk.map(() => "(?, ?)").join(",");
                const values: any[] = [];
                chunk.forEach(e => values.push(e.estId, e.gid));
                await database.execute(
                    `INSERT OR IGNORE INTO CLASSROOM_ESTUDIANTE (estudiante_id, google_user_id) VALUES ${placeholders}`,
                    values
                );
            }

            await database.execute("COMMIT");
        } catch (err) {
            await database.execute("ROLLBACK");
            throw err;
        }
    }

    // Update salon student count
    await database.execute(
        `UPDATE SALON SET estudiantes = (SELECT COUNT(*) FROM ESTUDIANTE WHERE salon_id = ?)
         WHERE id = ?`,
        [salonId, salonId]
    );

    logs.push({ tipo: "ok", mensaje: `${alumnosCount} alumno(s) importado(s)` });

    // ─── 3. Import courseWork (batch) ─────────────────────────────────────────
    logs.push({ tipo: "info", mensaje: "Importando tareas y exámenes…" });
    const works = await listarTareasCurso(course.id);

    // Pre-fetch: all Classroom cw IDs already mapped for this salon
    const existingCwRows = await database.select<{ asignacion_id: number; classroom_cw_id: string }[]>(
        `SELECT ca.asignacion_id, ca.classroom_cw_id
         FROM CLASSROOM_ASIGNACION ca
         JOIN ASIGNACION a ON ca.asignacion_id = a.id
         WHERE a.salon_id = ?`,
        [salonId]
    );
    const mappedCwIds = new Map<string, number>(
        existingCwRows.map(r => [r.classroom_cw_id, r.asignacion_id])
    );

    // Pre-fetch: local assignments by title
    const localAsigs = await database.select<{ id: number; titulo: string }[]>(
        `SELECT id, titulo FROM ASIGNACION WHERE salon_id = ?`,
        [salonId]
    );
    const localAsigByTitle = new Map(localAsigs.map(a => [a.titulo, a.id]));

    // Map: classroomCwId → local asignacion_id
    const cwIdMap = new Map<string, number>();

    const newWorks: { cw: any; titulo: string; tipo: string; dueDate: string | null }[] = [];

    for (const cw of works) {
        if (mappedCwIds.has(cw.id)) {
            cwIdMap.set(cw.id, mappedCwIds.get(cw.id)!);
            tareasCount++;
            continue;
        }

        const tipo: "tarea" | "examen" =
            (cw.courseWorkType === "SHORT_ANSWER_QUESTION" || cw.courseWorkType === "MULTIPLE_CHOICE_QUESTION")
                ? "examen" : "tarea";

        const dueDate = cw.dueDate
            ? `${cw.dueDate.year}-${String(cw.dueDate.month).padStart(2, "0")}-${String(cw.dueDate.day).padStart(2, "0")}`
            : null;

        const titulo = cw.title ?? "Sin título";

        if (localAsigByTitle.has(titulo)) {
            // Match by title — link without re-inserting
            const asigId = localAsigByTitle.get(titulo)!;
            cwIdMap.set(cw.id, asigId);
            await database.execute(
                `INSERT OR IGNORE INTO CLASSROOM_ASIGNACION (asignacion_id, classroom_cw_id) VALUES (?, ?)`,
                [asigId, cw.id]
            );
            tareasCount++;
        } else {
            newWorks.push({ cw, titulo, tipo, dueDate });
        }
    }

    // Batch-insert new courseWork
    if (newWorks.length > 0) {
        await database.execute("BEGIN");
        try {
            const CHUNK = 50;
            for (let i = 0; i < newWorks.length; i += CHUNK) {
                const chunk = newWorks.slice(i, i + CHUNK);
                const placeholders = chunk.map(() => "(?, ?, ?, ?)").join(",");
                const values: any[] = [];
                chunk.forEach(w => values.push(salonId, w.titulo, w.tipo, w.dueDate));
                const res = await database.execute(
                    `INSERT INTO ASIGNACION (salon_id, titulo, tipo, fecha_entrega) VALUES ${placeholders}`,
                    values
                );
                const lastId  = res.lastInsertId as number;
                const firstId = lastId - chunk.length + 1;
                chunk.forEach((w, idx) => cwIdMap.set(w.cw.id, firstId + idx));
                tareasCount += chunk.length;
            }

            // Batch-link CLASSROOM_ASIGNACION
            const newCwLinks = newWorks.map(w => ({ cwId: w.cw.id, asigId: cwIdMap.get(w.cw.id)! }));
            for (let i = 0; i < newCwLinks.length; i += 50) {
                const chunk = newCwLinks.slice(i, i + 50);
                const placeholders = chunk.map(() => "(?, ?)").join(",");
                const values: any[] = [];
                chunk.forEach(e => values.push(e.asigId, e.cwId));
                await database.execute(
                    `INSERT OR IGNORE INTO CLASSROOM_ASIGNACION (asignacion_id, classroom_cw_id) VALUES ${placeholders}`,
                    values
                );
            }

            // Pre-create empty grade rows for each new assignment × all students (single SELECT per assignment)
            for (const w of newWorks) {
                const asigId = cwIdMap.get(w.cw.id);
                if (!asigId) continue;
                await database.execute(
                    `INSERT OR IGNORE INTO CALIFICACION (asignacion_id, estudiante_id)
                     SELECT ?, id FROM ESTUDIANTE WHERE salon_id = ?`,
                    [asigId, salonId]
                );
            }

            await database.execute("COMMIT");
        } catch (err) {
            await database.execute("ROLLBACK");
            throw err;
        }
    }

    logs.push({ tipo: "ok", mensaje: `${tareasCount} tarea(s)/examen(es) importado(s)` });

    // ─── 4. Import grades (batch upsert) ─────────────────────────────────────
    logs.push({ tipo: "info", mensaje: "Importando calificaciones…" });

    // Collect ALL grade rows first (fetch is async/network, not DB), then batch upsert
    const gradeRows: { asigId: number; estId: number; cal: number }[] = [];

    for (const cw of works) {
        const asigId = cwIdMap.get(cw.id);
        if (!asigId) continue;

        const maxPts = Number(cw.maxPoints ?? 100) || 100;
        const subs   = await listarSubmissions(course.id, cw.id);

        for (const sub of subs) {
            const grade = sub.assignedGrade ?? sub.draftGrade;
            if (grade == null) continue;
            const estId = userIdMap.get(sub.userId as string);
            if (!estId) continue;
            const normalized = Math.min(100, Math.round((Number(grade) / maxPts) * 1000) / 10);
            gradeRows.push({ asigId, estId, cal: normalized });
        }
    }

    // Batch upsert grades (chunks of 100 rows)
    if (gradeRows.length > 0) {
        await database.execute("BEGIN");
        try {
            const CHUNK = 100;
            for (let i = 0; i < gradeRows.length; i += CHUNK) {
                const chunk = gradeRows.slice(i, i + CHUNK);
                const placeholders = chunk.map(() => "(?, ?, ?)").join(",");
                const values: any[] = [];
                chunk.forEach(r => values.push(r.asigId, r.estId, r.cal));
                await database.execute(
                    `INSERT INTO CALIFICACION (asignacion_id, estudiante_id, calificacion)
                     VALUES ${placeholders}
                     ON CONFLICT(asignacion_id, estudiante_id) DO UPDATE SET calificacion = excluded.calificacion`,
                    values
                );
                calsCount += chunk.length;
            }
            await database.execute("COMMIT");
        } catch (err) {
            await database.execute("ROLLBACK");
            throw err;
        }
    }

    logs.push({ tipo: "ok", mensaje: `${calsCount} calificación(es) importada(s)` });
    logs.push({ tipo: "ok", mensaje: `✅ Importación completada` });

    return { salonId, alumnos: alumnosCount, tareas: tareasCount, calificaciones: calsCount, logs };
}
