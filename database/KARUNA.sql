SELECT tablename 
FROM pg_tables 
WHERE tablename LIKE '%docente%';
 
INSERT INTO "KarunaApp_docente"(nombre, apellido, rol)
VALUES('Juan', 'Aragon', 'Docente')

INSERT INTO "KarunaApp_grupo"(descripcion, nombre, foto, docente_id)
VALUES('Fundamentos de Programacion', '1A', 'XD', 1)
SELECT * FROM "KarunaApp_grupo"

INSERT INTO "KarunaApp_periodo"(cantidad_evaluaciones, fecha_inicio, fecha_fin)
VALUES(4, '2025-07-15 08:00:00', '2025-12-15 08:00:00')

INSERT INTO "KarunaApp_grupoperiodo" (
    grupo_id, periodo_id,
    valor_asistencia, valor_tarea,
    valor_participacion, valor_examen
)
VALUES
(1, 1, 20.0, 20.0, 20.0, 40.0)

SELECT * FROM "KarunaApp_grupoperiodo"

INSERT INTO "KarunaApp_alumno" (nombre, apellido, notas)
VALUES
('Diego', 'Zarae', 'Buen desempeño')

SELECT * FROM "KarunaApp_docente";
SELECT * FROM "KarunaApp_alumno";

UPDATE "KarunaApp_alumno"
SET apellido = 'Zarate'
WHERE apellido = 'Zarae'



SELECT * 
FROM "KarunaApp_grupoperiodoalumno"
WHERE alumno_id = 1 AND grupo_periodo_id = 1;

INSERT INTO "KarunaApp_grupoperiodoalumno"
(alumno_id, grupo_periodo_id, asistencias, tareas, participaciones, examen)
VALUES
(1, 1, 10, 8, 9, 8.5);
