import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

// Aqui reutilizamos initDatabase

async function getDatabase(): Promise<Database> {

    if (db) {
        return db;
    }
    db = await Database.load("sqlite:karuna.db");

    await db.execute(`
        
            CREATE TABLE IF NOT EXISTS SALON (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            docente_id  INTEGER NOT NULL,
            nombre      TEXT    NOT NULL,
            materia     TEXT    NOT NULL,
            seccion     TEXT    NOT NULL,
            color_from  TEXT    NOT NULL DEFAULT '#1E1B4B',
            color_to    TEXT    NOT NULL DEFAULT '#D4AF37',
            estudiantes INTEGER NOT NULL DEFAULT 0,
            asistencia  REAL    NOT NULL DEFAULT 0.0,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (docente_id) REFERENCES DOCENTE(id)
        )
    `);

    return db;
}

export interface Salon {

    id: number;
    docente_id: number;
    nombre: string;
    materia: string;
    seccion: string;
    color_from: string;
    color_to: string;
    estudiantes: number;
    asistencia: number;

}

export async function crearSalon(
    docente_id: number,
    nombre: string,
    materia: string,
    seccion: string,
    color_from: string,
    color_to: string
) {
    try {
        const database = await getDatabase();

        await database.execute(
            `INSERT INTO SALON (docente_id, nombre, materia, seccion, color_from, color_to)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [docente_id, nombre, materia, seccion, color_from, color_to]
        );

        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false, error };
    }
}

// ─── Obtener salones de un docente ────────────────────────────────────────
export async function obtenerSalones(docente_id: number) {
    try {
        const database = await getDatabase();

        const salones = await database.select<Salon[]>(
            `SELECT * FROM SALON WHERE docente_id = ? ORDER BY created_at DESC`,
            [docente_id]
        );

        return salones;
    } catch (error) {
        console.error('Error al obtener salones:', error);
        return [];
    }
}

// ─── Eliminar salón ───────────────────────────────────────────────────────

export async function eliminarSalon(id: number) {
    try {
        const database = await getDatabase();

        await database.execute(
            `DELETE FROM SALON WHERE id = ?`,
            [id]
        );

        return { success: true };
    } catch (error) {
        console.error('Error al eliminar salón:', error);
        return { success: false, error };
    }
}

// ─── Obtener salón por ID ─────────────────────────────────────────────────
export async function obtenerSalonPorId(id: number): Promise<Salon | null> {
    try {
        const database = await getDatabase();
        const rows = await database.select<Salon[]>(
            `SELECT * FROM SALON WHERE id = ?`,
            [id]
        );
        return rows[0] ?? null;
    } catch (error) {
        console.error('Error al obtener salón por ID:', error);
        return null;
    }
}
