import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

async function getDatabase(): Promise<Database> {
    if (db) return db;
    db = await Database.load("sqlite:karuna.db");

    // Configuración de asistencia del salón
    await db.execute(`
        CREATE TABLE IF NOT EXISTS CONFIG_ASISTENCIA (
            salon_id            INTEGER PRIMARY KEY,
            dias_semana         TEXT    NOT NULL DEFAULT '[]',
            minimo_porcentaje   REAL    NOT NULL DEFAULT 80,
            FOREIGN KEY (salon_id) REFERENCES SALON(id) ON DELETE CASCADE
        )
    `);

    // Registro diario de asistencia por estudiante
    await db.execute(`
        CREATE TABLE IF NOT EXISTS REGISTRO_ASISTENCIA (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            salon_id        INTEGER NOT NULL,
            estudiante_id   INTEGER NOT NULL,
            fecha           TEXT    NOT NULL,
            presente        INTEGER NOT NULL DEFAULT 0,
            UNIQUE (salon_id, estudiante_id, fecha),
            FOREIGN KEY (salon_id)       REFERENCES SALON(id)      ON DELETE CASCADE,
            FOREIGN KEY (estudiante_id)  REFERENCES ESTUDIANTE(id) ON DELETE CASCADE
        )
    `);

    return db;
}

export interface ConfigAsistencia {
    salon_id: number;
    dias_semana: string; // JSON array: e.g. ["Lun","Mié","Vie"]
    minimo_porcentaje: number;
}

export interface RegistroAsistencia {
    id: number;
    salon_id: number;
    estudiante_id: number;
    fecha: string;      // ISO date: "YYYY-MM-DD"
    presente: number;   // 0 = Ausente, 1 = Presente
}

// ─── Guardar configuración de asistencia ─────────────────────────────────
export async function guardarConfigAsistencia(
    salon_id: number,
    dias_semana: string[],
    minimo_porcentaje: number
) {
    try {
        const database = await getDatabase();
        await database.execute(
            `INSERT INTO CONFIG_ASISTENCIA (salon_id, dias_semana, minimo_porcentaje)
             VALUES (?, ?, ?)
             ON CONFLICT(salon_id) DO UPDATE SET
                dias_semana = excluded.dias_semana,
                minimo_porcentaje = excluded.minimo_porcentaje`,
            [salon_id, JSON.stringify(dias_semana), minimo_porcentaje]
        );
        return { success: true };
    } catch (error) {
        console.error('Error al guardar config de asistencia:', error);
        return { success: false, error };
    }
}

// ─── Obtener configuración de asistencia ─────────────────────────────────
export async function obtenerConfigAsistencia(salon_id: number): Promise<ConfigAsistencia | null> {
    try {
        const database = await getDatabase();
        const rows = await database.select<ConfigAsistencia[]>(
            `SELECT * FROM CONFIG_ASISTENCIA WHERE salon_id = ?`,
            [salon_id]
        );
        return rows[0] ?? null;
    } catch (error) {
        console.error('Error al obtener config de asistencia:', error);
        return null;
    }
}

// ─── Registrar asistencia de un día ──────────────────────────────────────
export async function registrarAsistencia(
    salon_id: number,
    estudiante_id: number,
    fecha: string,
    presente: boolean
) {
    try {
        const database = await getDatabase();
        await database.execute(
            `INSERT INTO REGISTRO_ASISTENCIA (salon_id, estudiante_id, fecha, presente)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(salon_id, estudiante_id, fecha) DO UPDATE SET presente = excluded.presente`,
            [salon_id, estudiante_id, fecha, presente ? 1 : 0]
        );
        return { success: true };
    } catch (error) {
        console.error('Error al registrar asistencia:', error);
        return { success: false, error };
    }
}

// ─── Obtener registros de asistencia de un salón en una fecha ─────────────
export async function obtenerAsistenciaFecha(salon_id: number, fecha: string) {
    try {
        const database = await getDatabase();
        const rows = await database.select<(RegistroAsistencia & { nombre: string; apellido: string })[]>(
            `SELECT r.*, e.nombre, e.apellido
             FROM REGISTRO_ASISTENCIA r
             JOIN ESTUDIANTE e ON r.estudiante_id = e.id
             WHERE r.salon_id = ? AND r.fecha = ?
             ORDER BY e.apellido ASC`,
            [salon_id, fecha]
        );
        return rows;
    } catch (error) {
        console.error('Error al obtener asistencia:', error);
        return [];
    }
}

// ─── Calcular % de asistencia de un estudiante ───────────────────────────
export async function calcularAsistenciaEstudiante(
    salon_id: number,
    estudiante_id: number
): Promise<number> {
    try {
        const database = await getDatabase();
        const rows = await database.select<{ total: number; presentes: number }[]>(
            `SELECT 
                COUNT(*) as total,
                SUM(presente) as presentes
             FROM REGISTRO_ASISTENCIA
             WHERE salon_id = ? AND estudiante_id = ?`,
            [salon_id, estudiante_id]
        );
        const { total, presentes } = rows[0] ?? { total: 0, presentes: 0 };
        if (total === 0) return 0;
        return Math.round((presentes / total) * 100);
    } catch (error) {
        console.error('Error al calcular asistencia:', error);
        return 0;
    }
}
// ─── Obtener todos los registros de asistencia de un estudiante ───────────
export async function obtenerAsistenciaEstudiante(
    salon_id: number,
    estudiante_id: number
): Promise<RegistroAsistencia[]> {
    try {
        const database = await getDatabase();
        return await database.select<RegistroAsistencia[]>(
            `SELECT * FROM REGISTRO_ASISTENCIA
             WHERE salon_id = ? AND estudiante_id = ?
             ORDER BY fecha ASC`,
            [salon_id, estudiante_id]
        );
    } catch (error) {
        console.error('Error al obtener asistencia del estudiante:', error);
        return [];
    }
}
