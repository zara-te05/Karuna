import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

async function getDatabase(): Promise<Database> {
    if (db) return db;
    db = await Database.load("sqlite:karuna.db");
    return db;
}

// ─── Estadísticas por salón ───────────────────────────────────────────────────
export interface EstadisticasSalon {
    salon_id: number;
    promedioCalificaciones: number | null;
    promedioAsistencia: number | null;
    tasaEntrega: number | null;
    alumnosEnRiesgo: number;
    totalAlumnos: number;
    totalAsignaciones: number;
}

export async function obtenerEstadisticasSalon(salon_id: number): Promise<EstadisticasSalon> {
    try {
        const database = await getDatabase();

        const configRows = await database.select<{ calificacion_minima: number }[]>(
            `SELECT calificacion_minima FROM CONFIG_AULA WHERE salon_id = ?`, [salon_id]
        );
        const cal_min = configRows[0]?.calificacion_minima ?? 60;

        const promedioRows = await database.select<{ avg: number | null }[]>(
            `SELECT AVG(c.calificacion) as avg FROM CALIFICACION c
             JOIN ASIGNACION a ON c.asignacion_id = a.id
             WHERE a.salon_id = ? AND c.calificacion IS NOT NULL`, [salon_id]
        );

        const asistRows = await database.select<{ avg: number | null }[]>(
            `SELECT AVG(CASE WHEN presente=1 THEN 100.0 ELSE 0.0 END) as avg
             FROM REGISTRO_ASISTENCIA WHERE salon_id = ?`, [salon_id]
        );

        const entregaRows = await database.select<{ total: number; entregadas: number }[]>(
            `SELECT COUNT(*) as total,
                    COUNT(CASE WHEN calificacion IS NOT NULL THEN 1 END) as entregadas
             FROM CALIFICACION c JOIN ASIGNACION a ON c.asignacion_id = a.id
             WHERE a.salon_id = ?`, [salon_id]
        );

        const alumnosRows = await database.select<{ cnt: number }[]>(
            `SELECT COUNT(*) as cnt FROM ESTUDIANTE WHERE salon_id = ?`, [salon_id]
        );

        const riesgo = await database.select<{ id: number }[]>(
            `SELECT e.id FROM ESTUDIANTE e
             WHERE e.salon_id = ?
             AND (
                 SELECT AVG(c.calificacion)
                 FROM CALIFICACION c JOIN ASIGNACION a ON c.asignacion_id = a.id
                 WHERE a.salon_id = ? AND c.estudiante_id = e.id AND c.calificacion IS NOT NULL
             ) < ?`, [salon_id, salon_id, cal_min]
        );

        const asigRows = await database.select<{ cnt: number }[]>(
            `SELECT COUNT(*) as cnt FROM ASIGNACION WHERE salon_id = ?`, [salon_id]
        );

        const total = entregaRows[0]?.total ?? 0;
        const entregadas = entregaRows[0]?.entregadas ?? 0;

        return {
            salon_id,
            promedioCalificaciones: promedioRows[0]?.avg != null ? Math.round(promedioRows[0].avg * 10) / 10 : null,
            promedioAsistencia: asistRows[0]?.avg != null ? Math.round(asistRows[0].avg * 10) / 10 : null,
            tasaEntrega: total > 0 ? Math.round((entregadas / total) * 1000) / 10 : null,
            alumnosEnRiesgo: riesgo.length,
            totalAlumnos: alumnosRows[0]?.cnt ?? 0,
            totalAsignaciones: asigRows[0]?.cnt ?? 0,
        };
    } catch (err) {
        console.error("Error estadísticas salón:", err);
        return { salon_id, promedioCalificaciones: null, promedioAsistencia: null, tasaEntrega: null, alumnosEnRiesgo: 0, totalAlumnos: 0, totalAsignaciones: 0 };
    }
}

// ─── Ranking de alumnos por salón ─────────────────────────────────────────────
export interface AlumnoRanking {
    id: number;
    nombre: string;
    apellido: string;
    id_control: string;
    promedio: number | null;
    asistencia: number | null;
}

export async function obtenerRankingAlumnos(salon_id: number): Promise<AlumnoRanking[]> {
    try {
        const database = await getDatabase();
        const rows = await database.select<AlumnoRanking[]>(
            `SELECT e.id, e.nombre, e.apellido, e.id_control,
                    AVG(c.calificacion) as promedio,
                    (SELECT AVG(CASE WHEN presente=1 THEN 100.0 ELSE 0.0 END)
                     FROM REGISTRO_ASISTENCIA ra WHERE ra.estudiante_id = e.id AND ra.salon_id = e.salon_id) as asistencia
             FROM ESTUDIANTE e
             LEFT JOIN CALIFICACION c ON c.estudiante_id = e.id
             LEFT JOIN ASIGNACION a ON c.asignacion_id = a.id AND a.salon_id = e.salon_id
             WHERE e.salon_id = ?
             GROUP BY e.id, e.nombre, e.apellido, e.id_control
             ORDER BY promedio DESC`, [salon_id]
        );
        return rows;
    } catch (err) {
        console.error("Error ranking alumnos:", err);
        return [];
    }
}

// ─── Datos ML ─────────────────────────────────────────────────────────────────
export interface DatosML {
    estudiante_id: number;
    nombre: string;
    apellido: string;
    cal_final: number;
    prom_tareas: number;
    prom_asist: number;
}

export async function obtenerDatosMLSalon(salon_id: number): Promise<DatosML[]> {
    try {
        const database = await getDatabase();
        const rows = await database.select<{
            estudiante_id: number; nombre: string; apellido: string;
            prom_examenes: number | null; prom_tareas: number | null; prom_asist: number | null;
        }[]>(
            `SELECT e.id as estudiante_id, e.nombre, e.apellido,
                    AVG(CASE WHEN a.tipo='examen' THEN c.calificacion END) as prom_examenes,
                    AVG(CASE WHEN a.tipo='tarea'  THEN c.calificacion END) as prom_tareas,
                    (SELECT AVG(CASE WHEN presente=1 THEN 100.0 ELSE 0.0 END)
                     FROM REGISTRO_ASISTENCIA ra WHERE ra.estudiante_id = e.id AND ra.salon_id = e.salon_id) as prom_asist
             FROM ESTUDIANTE e
             LEFT JOIN CALIFICACION c ON c.estudiante_id = e.id
             LEFT JOIN ASIGNACION a ON c.asignacion_id = a.id AND a.salon_id = ?
             WHERE e.salon_id = ?
             GROUP BY e.id, e.nombre, e.apellido`, [salon_id, salon_id]
        );
        return rows.map(r => ({
            estudiante_id: r.estudiante_id,
            nombre: r.nombre,
            apellido: r.apellido,
            cal_final:   Math.round((r.prom_examenes ?? 70) * 10) / 10,
            prom_tareas: Math.round((r.prom_tareas   ?? 70) * 10) / 10,
            prom_asist:  Math.round((r.prom_asist    ?? 80) * 10) / 10,
        }));
    } catch (err) {
        console.error("Error datos ML:", err);
        return [];
    }
}

export interface TendenciaGeneral {
    label: string;
    promedio: number | null;
}

export async function obtenerTendenciaGeneral(docente_id: number): Promise<TendenciaGeneral[]> {
    try {
        const database = await getDatabase();
        const rows = await database.select<{ titulo: string; avg: number | null }[]>(
            `SELECT a.titulo, AVG(c.calificacion) as avg
             FROM ASIGNACION a
             LEFT JOIN CALIFICACION c ON c.asignacion_id = a.id
             WHERE a.salon_id IN (SELECT id FROM SALON WHERE docente_id = ?)
             GROUP BY a.id, a.titulo
             ORDER BY a.created_at ASC`, [docente_id]
        );
        return rows.map((r, index) => ({
            label: r.titulo?.trim() || `Asignación ${index + 1}`,
            promedio: r.avg != null ? Math.round(r.avg * 10) / 10 : null,
        }));
    } catch (err) {
        console.error("Error tendencia global:", err);
        return [];
    }
}

export interface TendenciaSalonPunto {
    titulo: string;
    promedio: number | null;
}

export interface TendenciaPorSalonSerie {
    salon_id: number;
    salon_nombre: string;
    puntos: TendenciaSalonPunto[];
}

export async function obtenerTendenciaPorSalones(docente_id: number): Promise<TendenciaPorSalonSerie[]> {
    try {
        const database = await getDatabase();
        const rows = await database.select<{
            salon_id: number;
            salon_nombre: string;
            titulo: string;
            avg: number | null;
        }[]>(
            `SELECT s.id as salon_id, s.nombre as salon_nombre, a.titulo, AVG(c.calificacion) as avg
             FROM ASIGNACION a
             JOIN SALON s ON a.salon_id = s.id
             LEFT JOIN CALIFICACION c ON c.asignacion_id = a.id
             WHERE s.docente_id = ?
             GROUP BY s.id, s.nombre, a.id, a.titulo
             ORDER BY a.created_at ASC`, [docente_id]
        );

        const seriesMap = new Map<number, TendenciaPorSalonSerie>();
        for (const row of rows) {
            if (!seriesMap.has(row.salon_id)) {
                seriesMap.set(row.salon_id, {
                    salon_id: row.salon_id,
                    salon_nombre: row.salon_nombre || `Aula ${row.salon_id}`,
                    puntos: [],
                });
            }
            seriesMap.get(row.salon_id)!.puntos.push({
                titulo: row.titulo || 'Sin título',
                promedio: row.avg != null ? Math.round(row.avg * 10) / 10 : null,
            });
        }

        return Array.from(seriesMap.values());
    } catch (err) {
        console.error("Error tendencia por salones:", err);
        return [];
    }
}

// ─── Tendencia de calificaciones por asignación ───────────────────────────────
export interface TendenciaPunto {
    label: string;
    promedio: number | null;
}

export async function obtenerTendenciaSalon(salon_id: number): Promise<TendenciaPunto[]> {
    try {
        const database = await getDatabase();
        const rows = await database.select<{ titulo: string; avg: number | null }[]>(
            `SELECT a.titulo, AVG(c.calificacion) as avg
             FROM ASIGNACION a
             LEFT JOIN CALIFICACION c ON c.asignacion_id = a.id
             WHERE a.salon_id = ?
             GROUP BY a.id, a.titulo
             ORDER BY a.created_at ASC`, [salon_id]
        );
        return rows.map(r => ({ label: r.titulo, promedio: r.avg != null ? Math.round(r.avg * 10) / 10 : null }));
    } catch (err) {
        console.error("Error tendencia salón:", err);
        return [];
    }
}

// ─── Calificaciones de un alumno ─────────────────────────────────────────────
export interface CalificacionAlumno {
    titulo: string;
    tipo: string;
    calificacion: number | null;
}

export async function obtenerCalificacionesAlumno(salon_id: number, estudiante_id: number): Promise<CalificacionAlumno[]> {
    try {
        const database = await getDatabase();
        return database.select<CalificacionAlumno[]>(
            `SELECT a.titulo, a.tipo, c.calificacion
             FROM ASIGNACION a
             LEFT JOIN CALIFICACION c ON c.asignacion_id = a.id AND c.estudiante_id = ?
             WHERE a.salon_id = ?
             ORDER BY a.created_at ASC`, [estudiante_id, salon_id]
        );
    } catch (err) {
        console.error("Error calificaciones alumno:", err);
        return [];
    }
}

// ─── KPIs de un alumno ────────────────────────────────────────────────────────
export interface KpisAlumno {
    promedio: number | null;
    asistencia: number | null;
    totalAsig: number;
    entregadas: number;
}

export async function obtenerKpisAlumno(salon_id: number, estudiante_id: number): Promise<KpisAlumno> {
    try {
        const database = await getDatabase();
        const calRows = await database.select<{ avg: number | null }[]>(
            `SELECT AVG(c.calificacion) as avg FROM CALIFICACION c
             JOIN ASIGNACION a ON c.asignacion_id = a.id
             WHERE c.estudiante_id = ? AND a.salon_id = ? AND c.calificacion IS NOT NULL`,
            [estudiante_id, salon_id]
        );
        const asistRows = await database.select<{ avg: number | null }[]>(
            `SELECT AVG(CASE WHEN presente=1 THEN 100.0 ELSE 0.0 END) as avg
             FROM REGISTRO_ASISTENCIA WHERE estudiante_id = ? AND salon_id = ?`,
            [estudiante_id, salon_id]
        );
        const entRows = await database.select<{ total: number; entregadas: number }[]>(
            `SELECT COUNT(*) as total,
                    COUNT(CASE WHEN calificacion IS NOT NULL THEN 1 END) as entregadas
             FROM CALIFICACION c JOIN ASIGNACION a ON c.asignacion_id = a.id
             WHERE c.estudiante_id = ? AND a.salon_id = ?`,
            [estudiante_id, salon_id]
        );
        return {
            promedio:    calRows[0]?.avg   != null ? Math.round(calRows[0].avg   * 10) / 10 : null,
            asistencia: asistRows[0]?.avg  != null ? Math.round(asistRows[0].avg * 10) / 10 : null,
            totalAsig:  entRows[0]?.total    ?? 0,
            entregadas: entRows[0]?.entregadas ?? 0,
        };
    } catch (err) {
        console.error("Error KPIs alumno:", err);
        return { promedio: null, asistencia: null, totalAsig: 0, entregadas: 0 };
    }
}
