import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

async function getDatabase(): Promise<Database> {
    if (db) return db;
    db = await Database.load("sqlite:karuna.db");

    await db.execute(`
        CREATE TABLE IF NOT EXISTS CRITERIO_EVALUACION (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            salon_id    INTEGER NOT NULL,
            nombre      TEXT    NOT NULL,
            porcentaje  REAL    NOT NULL DEFAULT 0,
            FOREIGN KEY (salon_id) REFERENCES SALON(id) ON DELETE CASCADE
        )
    `);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS CONFIG_AULA (
            salon_id               INTEGER PRIMARY KEY,
            calificacion_minima    REAL    NOT NULL DEFAULT 60,
            num_parciales          INTEGER NOT NULL DEFAULT 3,
            FOREIGN KEY (salon_id) REFERENCES SALON(id) ON DELETE CASCADE
        )
    `);

    // ── Migraciones: columnas añadidas después de la versión inicial ────────
    try { await db.execute(`ALTER TABLE CONFIG_AULA ADD COLUMN num_parciales INTEGER NOT NULL DEFAULT 3`); }
    catch (_) { /* ya existe */ }

    // La columna calificacion_minima usaba escala 0-10, ahora escalamos a 0-100.
    // No há migración de datos (el docente deberá reconfigurar si tenía algo guardado).

    return db;
}

export interface CriterioEvaluacion {
    id?: number;
    salon_id: number;
    nombre: string;
    porcentaje: number;
}

export interface ConfigAula {
    salon_id: number;
    calificacion_minima: number;
    num_parciales: number;
}

// ─── Obtener criterios de un salón ────────────────────────────────────────
export async function obtenerCriteriosSalon(salon_id: number): Promise<CriterioEvaluacion[]> {
    try {
        const database = await getDatabase();
        return await database.select<CriterioEvaluacion[]>(
            `SELECT * FROM CRITERIO_EVALUACION WHERE salon_id = ? ORDER BY id ASC`,
            [salon_id]
        );
    } catch (error) {
        console.error('Error al obtener criterios:', error);
        return [];
    }
}

// ─── Guardar criterios (reemplaza todos los del salón) ────────────────────
export async function guardarCriteriosSalon(
    salon_id: number,
    criterios: { nombre: string; porcentaje: number }[]
) {
    try {
        const database = await getDatabase();
        await database.execute(`DELETE FROM CRITERIO_EVALUACION WHERE salon_id = ?`, [salon_id]);
        for (const c of criterios) {
            await database.execute(
                `INSERT INTO CRITERIO_EVALUACION (salon_id, nombre, porcentaje) VALUES (?, ?, ?)`,
                [salon_id, c.nombre, c.porcentaje]
            );
        }
        return { success: true };
    } catch (error) {
        console.error('Error al guardar criterios:', error);
        return { success: false, error };
    }
}

// ─── Obtener configuración del aula ──────────────────────────────────────
export async function obtenerConfigAula(salon_id: number): Promise<ConfigAula | null> {
    try {
        const database = await getDatabase();
        const rows = await database.select<ConfigAula[]>(
            `SELECT * FROM CONFIG_AULA WHERE salon_id = ?`,
            [salon_id]
        );
        return rows[0] ?? null;
    } catch (error) {
        console.error('Error al obtener config del aula:', error);
        return null;
    }
}

// ─── Guardar configuración del aula ──────────────────────────────────────
export async function guardarConfigAula(
    salon_id: number,
    calificacion_minima: number,
    num_parciales: number
) {
    try {
        const database = await getDatabase();
        await database.execute(
            `INSERT INTO CONFIG_AULA (salon_id, calificacion_minima, num_parciales)
             VALUES (?, ?, ?)
             ON CONFLICT(salon_id) DO UPDATE SET
                 calificacion_minima = excluded.calificacion_minima,
                 num_parciales       = excluded.num_parciales`,
            [salon_id, calificacion_minima, num_parciales]
        );
        return { success: true };
    } catch (error) {
        console.error('Error al guardar config del aula:', error);
        return { success: false, error };
    }
}
