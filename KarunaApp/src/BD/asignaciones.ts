import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

async function getDatabase(): Promise<Database> {
    if (db) return db;
    db = await Database.load("sqlite:karuna.db");

    // Crear CRITERIO_EVALUACION primero (FK dependency)
    await db.execute(`
        CREATE TABLE IF NOT EXISTS CRITERIO_EVALUACION (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            salon_id    INTEGER NOT NULL,
            nombre      TEXT    NOT NULL,
            porcentaje  REAL    NOT NULL DEFAULT 0
        )
    `);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS ASIGNACION (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            salon_id        INTEGER NOT NULL,
            criterio_id     INTEGER,
            tipo            TEXT    NOT NULL DEFAULT 'tarea',
            titulo          TEXT    NOT NULL,
            fecha_entrega   TEXT,
            created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (salon_id)    REFERENCES SALON(id)               ON DELETE CASCADE,
            FOREIGN KEY (criterio_id) REFERENCES CRITERIO_EVALUACION(id) ON DELETE SET NULL
        )
    `);

    // ── Migración: tabla existente puede no tener la columna tipo ──────────
    try {
        await db.execute(`ALTER TABLE ASIGNACION ADD COLUMN tipo TEXT NOT NULL DEFAULT 'tarea'`);
    } catch (_) { /* ya existe — ignorar */ }

    await db.execute(`
        CREATE TABLE IF NOT EXISTS CALIFICACION (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            asignacion_id   INTEGER NOT NULL,
            estudiante_id   INTEGER NOT NULL,
            calificacion    REAL,
            UNIQUE (asignacion_id, estudiante_id),
            FOREIGN KEY (asignacion_id) REFERENCES ASIGNACION(id) ON DELETE CASCADE,
            FOREIGN KEY (estudiante_id) REFERENCES ESTUDIANTE(id) ON DELETE CASCADE
        )
    `);

    return db;
}

export type TipoAsignacion = 'examen' | 'tarea';

export interface Asignacion {
    id: number;
    salon_id: number;
    criterio_id: number | null;
    tipo: TipoAsignacion;
    titulo: string;
    fecha_entrega: string | null;
}

export interface Calificacion {
    id: number;
    asignacion_id: number;
    estudiante_id: number;
    calificacion: number | null;
}

// ─── Crear asignación ─────────────────────────────────────────────────────
export async function crearAsignacion(
    salon_id: number,
    titulo: string,
    tipo: TipoAsignacion,
    criterio_id: number | null,
    fecha_entrega: string | null
) {
    try {
        const database = await getDatabase();
        const result = await database.execute(
            `INSERT INTO ASIGNACION (salon_id, titulo, tipo, criterio_id, fecha_entrega)
             VALUES (?, ?, ?, ?, ?)`,
            [salon_id, titulo, tipo, criterio_id, fecha_entrega]
        );
        // Pre-crear filas vacías de calificación para cada alumno del salón
        await database.execute(`
            INSERT OR IGNORE INTO CALIFICACION (asignacion_id, estudiante_id)
            SELECT ${result.lastInsertId}, id FROM ESTUDIANTE WHERE salon_id = ?
        `, [salon_id]);
        return { success: true, id: result.lastInsertId };
    } catch (error) {
        console.error('Error al crear asignación:', error);
        return { success: false, error };
    }
}

// ─── Obtener asignaciones filtradas por tipo ──────────────────────────────
export async function obtenerAsignacionesSalon(
    salon_id: number,
    tipo?: TipoAsignacion
): Promise<Asignacion[]> {
    try {
        const database = await getDatabase();
        if (tipo) {
            return await database.select<Asignacion[]>(
                `SELECT * FROM ASIGNACION WHERE salon_id = ? AND tipo = ? ORDER BY created_at ASC`,
                [salon_id, tipo]
            );
        }
        return await database.select<Asignacion[]>(
            `SELECT * FROM ASIGNACION WHERE salon_id = ? ORDER BY created_at ASC`,
            [salon_id]
        );
    } catch (error) {
        console.error('Error al obtener asignaciones:', error);
        return [];
    }
}

// ─── Sincronizar exámenes parciales según el número configurado ───────────
// Crea columnas nuevas si faltan; no elimina las que ya tienen datos.
export async function sincronizarParciales(salon_id: number, num_parciales: number) {
    try {
        const existentes = await obtenerAsignacionesSalon(salon_id, 'examen');
        for (let i = existentes.length + 1; i <= num_parciales; i++) {
            await crearAsignacion(salon_id, `Parcial ${i}`, 'examen', null, null);
        }
        return { success: true };
    } catch (error) {
        console.error('Error al sincronizar parciales:', error);
        return { success: false, error };
    }
}

// ─── Obtener calificaciones de una asignación ─────────────────────────────
export async function obtenerCalificacionesAsignacion(asignacion_id: number) {
    try {
        const database = await getDatabase();
        return await database.select<(Calificacion & { nombre: string; apellido: string })[]>(
            `SELECT c.*, e.nombre, e.apellido
             FROM CALIFICACION c
             JOIN ESTUDIANTE e ON c.estudiante_id = e.id
             WHERE c.asignacion_id = ?
             ORDER BY e.apellido ASC`,
            [asignacion_id]
        );
    } catch (error) {
        console.error('Error al obtener calificaciones:', error);
        return [];
    }
}

// ─── Guardar calificación ─────────────────────────────────────────────────
export async function guardarCalificacion(
    asignacion_id: number,
    estudiante_id: number,
    calificacion: number
) {
    try {
        const database = await getDatabase();
        await database.execute(
            `INSERT INTO CALIFICACION (asignacion_id, estudiante_id, calificacion)
             VALUES (?, ?, ?)
             ON CONFLICT(asignacion_id, estudiante_id) DO UPDATE SET calificacion = excluded.calificacion`,
            [asignacion_id, estudiante_id, calificacion]
        );
        return { success: true };
    } catch (error) {
        console.error('Error al guardar calificación:', error);
        return { success: false, error };
    }
}

// ─── Obtener todas las calificaciones de un salón (mapa est->asig->cal) ──
export async function obtenerCalificacionesSalon(salon_id: number) {
    try {
        const database = await getDatabase();
        const rows = await database.select<{ asignacion_id: number; estudiante_id: number; calificacion: number | null }[]>(
            `SELECT c.asignacion_id, c.estudiante_id, c.calificacion
             FROM CALIFICACION c
             JOIN ASIGNACION a ON c.asignacion_id = a.id
             WHERE a.salon_id = ?`,
            [salon_id]
        );
        const mapa: Record<number, Record<number, number | null>> = {};
        rows.forEach(r => {
            if (!mapa[r.estudiante_id]) mapa[r.estudiante_id] = {};
            mapa[r.estudiante_id][r.asignacion_id] = r.calificacion;
        });
        return mapa;
    } catch (error) {
        console.error('Error al obtener calificaciones del salón:', error);
        return {};
    }
}
// ─── Obtener todas las calificaciones de un estudiante ────────────────────
// Devuelve las asignaciones del salón enriquecidas con la calificación del alumno
export async function obtenerCalificacionesEstudiante(
    salon_id: number,
    estudiante_id: number
): Promise<(Asignacion & { calificacion: number | null })[]> {
    try {
        const database = await getDatabase();
        return await database.select<(Asignacion & { calificacion: number | null })[]>(
            `SELECT a.*, c.calificacion
             FROM ASIGNACION a
             LEFT JOIN CALIFICACION c
                ON c.asignacion_id = a.id AND c.estudiante_id = ?
             WHERE a.salon_id = ?
             ORDER BY a.tipo ASC, a.created_at ASC`,
            [estudiante_id, salon_id]
        );
    } catch (error) {
        console.error('Error al obtener calificaciones del estudiante:', error);
        return [];
    }
}
