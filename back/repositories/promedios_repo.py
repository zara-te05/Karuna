from core.database import obtener_conexion
from domain.types import PromedioAlumnoDTO, GrupoPeriodoAlumnoDTO

def obtener_valores_calculo_parcial(numero_control: str, evaluacion_id: int) -> GrupoPeriodoAlumnoDTO | None:
    conn = obtener_conexion()
    cur = conn.cursor()
    
    query = """
    SELECT
        a.numero_control,
        e.valor_asistencia,
        e.valor_tarea,
        e.valor_participacion,
        e.valor_examen,
        gp.peso_asistencia,
        gp.peso_tarea,
        gp.peso_participacion,
        gp.peso_examen
    FROM alumno a
    INNER JOIN inscripcion i ON a.id = i.alumno_id
    INNER JOIN evaluacion e ON i.id = e.inscripcion_id
    INNER JOIN grupo_periodo gp ON i.grupo_periodo_id = gp.id
    WHERE a.numero_control = %s AND e.numero_parcial = %s
    """
    
    cur.execute(query, (numero_control, evaluacion_id))
    row = cur.fetchone()
    
    cur.close()
    conn.close()
    
    if not row:
        return None
    
    return GrupoPeriodoAlumnoDTO(
        numero_control=row[0],
        asistencia=row[1],
        tarea=row[2],
        participacion=row[3],
        examen=row[4],
        peso_asistencia=row[5],
        peso_tarea=row[6],
        peso_participacion=row[7],
        peso_examen=row[8],
    )

def obtener_promedio_final_alumno(alumno_id: int, grupo_periodo_id: int) -> list[PromedioAlumnoDTO]:

    conn = obtener_conexion()
    cur = conn.cursor()

    sql = """
        SELECT alumno_id, numero_parcial, promedio
        FROM promedio
        WHERE alumno_id = %s
          AND grupo_periodo_id = %s
          AND numero_parcial IS NOT NULL
        ORDER BY numero_parcial
    """

    cur.execute(sql, (alumno_id, grupo_periodo_id))  # ✅ AQUÍ
    rows = cur.fetchall()

    cur.close()
    conn.close()

    if not rows:
        return []

    return [
        PromedioAlumnoDTO(
            alumno_id=r[0],
            numero_parcial=r[1],
            promedio=r[2]
        )
        for r in rows
    ]



def obtener_promedios_finales(grupo_periodo_id: int) -> list[float]:
    conn = obtener_conexion()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT promedio 
        FROM promedio_alumno
        WHERE grupo_periodo_id = %s
        AND numero_parcial IS NULL
    """, (grupo_periodo_id,))
    
    rows = cur.fetchall()
    cur.close()
    conn.close()
    
    return [r[0] for r in rows]

def obtener_promedios_parcial(grupo_periodo_id: int, parcial: int) -> list[PromedioAlumnoDTO]:
    pass


def obtener_cantidad_parciales(grupo_periodo_id: int) -> int:
    conn = obtener_conexion()
    cur = conn.cursor()

    cur.execute(
        "SELECT cantidad_parciales FROM grupo_periodo WHERE id = %s",
        (grupo_periodo_id,)
    )

    row = cur.fetchone()

    cur.close()
    conn.close()

    if not row:
        raise Exception("Grupo periodo no encontrado")

    return row[0]
