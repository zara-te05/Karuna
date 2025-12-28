SELECT
    a.numero_control,
    a.nombre,
    a.apellido,

    e.numero_parcial,
    e.valor_asistencia,
    e.valor_tarea,
    e.valor_participacion,
    e.valor_examen,

    gp.peso_asistencia,
    gp.peso_tarea,
    gp.peso_participacion,
    gp.peso_examen

FROM alumno a
INNER JOIN inscripcion i
    ON a.id = i.alumno_id
INNER JOIN evaluacion e
    ON i.id = e.inscripcion_id
INNER JOIN grupo_periodo gp
    ON i.grupo_periodo_id = gp.id