import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

async function getDatabase(): Promise<Database> {
    if (db) return db;
    db = await Database.load("sqlite:karuna.db");

    await db.execute(`
        CREATE TABLE IF NOT EXISTS ESTUDIANTE (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            salon_id            INTEGER NOT NULL,
            nombre              TEXT    NOT NULL,
            apellido            TEXT    NOT NULL,
            id_control          TEXT    NOT NULL,
            participacion_extra REAL    NOT NULL DEFAULT 0,
            created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (salon_id) REFERENCES SALON(id) ON DELETE CASCADE
        )
    `);

    // Migración: columna añadida en versión posterior
    try { await db.execute(`ALTER TABLE ESTUDIANTE ADD COLUMN participacion_extra REAL NOT NULL DEFAULT 0`); }
    catch (_) { /* ya existe */ }

    return db;
}

export interface Estudiante {
    id: number;
    salon_id: number;
    nombre: string;
    apellido: string;
    id_control: string;
}

// ─── Crear estudiante ─────────────────────────────────────────────────────
export async function crearEstudiante(
    salon_id: number,
    nombre: string,
    apellido: string,
    id_control: string
) {
    try {
        const database = await getDatabase();
        await database.execute(
            `INSERT INTO ESTUDIANTE (salon_id, nombre, apellido, id_control)
             VALUES (?, ?, ?, ?)`,
            [salon_id, nombre, apellido, id_control]
        );
        // Actualizar contador de estudiantes en SALON
        await database.execute(
            `UPDATE SALON SET estudiantes = (
                SELECT COUNT(*) FROM ESTUDIANTE WHERE salon_id = ?
             ) WHERE id = ?`,
            [salon_id, salon_id]
        );
        return { success: true };
    } catch (error) {
        console.error('Error al crear estudiante:', error);
        return { success: false, error };
    }
}

// ─── Obtener estudiantes de un salón ─────────────────────────────────────
export async function obtenerEstudiantesSalon(salon_id: number) {
    try {
        const database = await getDatabase();
        const estudiantes = await database.select<Estudiante[]>(
            `SELECT * FROM ESTUDIANTE WHERE salon_id = ? ORDER BY apellido ASC`,
            [salon_id]
        );
        return estudiantes;
    } catch (error) {
        console.error('Error al obtener estudiantes:', error);
        return [];
    }
}

// ─── Editar estudiante ────────────────────────────────────────────────────
export async function editarEstudiante(
    id: number,
    nombre: string,
    apellido: string,
    id_control: string
) {
    try {
        const database = await getDatabase();
        await database.execute(
            `UPDATE ESTUDIANTE SET nombre = ?, apellido = ?, id_control = ? WHERE id = ?`,
            [nombre, apellido, id_control, id]
        );
        return { success: true };
    } catch (error) {
        console.error('Error al editar estudiante:', error);
        return { success: false, error };
    }
}

// ─── Eliminar estudiante ──────────────────────────────────────────────────
export async function eliminarEstudiante(id: number, salon_id: number) {
    try {
        const database = await getDatabase();
        await database.execute(`DELETE FROM ESTUDIANTE WHERE id = ?`, [id]);
        // Actualizar contador
        await database.execute(
            `UPDATE SALON SET estudiantes = (
                SELECT COUNT(*) FROM ESTUDIANTE WHERE salon_id = ?
             ) WHERE id = ?`,
            [salon_id, salon_id]
        );
        return { success: true };
    } catch (error) {
        console.error('Error al eliminar estudiante:', error);
        return { success: false, error };
    }
}

// ─── Obtener un estudiante por ID ─────────────────────────────────────────
export async function obtenerEstudiantePorId(id: number): Promise<Estudiante | null> {
    try {
        const database = await getDatabase();
        const rows = await database.select<Estudiante[]>(
            `SELECT * FROM ESTUDIANTE WHERE id = ?`, [id]
        );
        return rows[0] ?? null;
    } catch (error) {
        console.error('Error al obtener estudiante:', error);
        return null;
    }
}

// ─── Guardar participación extra ──────────────────────────────────────────
export async function guardarParticipacionExtra(id: number, valor: number) {
    try {
        const database = await getDatabase();
        await database.execute(
            `UPDATE ESTUDIANTE SET participacion_extra = ? WHERE id = ?`,
            [valor, id]
        );
        return { success: true };
    } catch (error) {
        console.error('Error al guardar participación extra:', error);
        return { success: false, error };
    }
}
