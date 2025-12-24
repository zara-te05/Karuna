SELECT tablename 
FROM pg_tables 
WHERE tablename LIKE '%docente%';
 
INSERT INTO "KarunaApp_docente"(id, nombre, apellido, rol)
VALUES(1,'Juan', 'Aragon', 'Docente')

SELECT * FROM "KarunaApp_docente"

INSERT INTO "KarunaApp_grupo"(id, descripcion, nombre, foto, docente_id)
VALUES(1, 'Fundamentos de Programacion', '1A', 'XD', 1)
SELECT * FROM "KarunaApp_grupo"

INSERT INTO "KarunaApp_periodo"(id, cantidad_evaluaciones, fecha_inicio, fecha_fin)
VALUES(1, 4, '2025-07-15 08:00:00', '2025-12-15 08:00:00')

INSERT INTO "KarunaApp_grupoperiodo" (
    id, grupo_id, periodo_id,
    valor_asistencia, valor_tarea,
    valor_participacion, valor_examen
)
VALUES
(1, 1, 1, 20.0, 20.0, 20.0, 40.0)

INSERT INTO "KarunaApp_alumno" (id, nombre, apellido, notas)
VALUES
(1, 'Carlos', 'Ramírez', 'Buen desempeño')

DROP TABLE django_migrations;

DROP TABLE IF EXISTS
    "KarunaApp_promedioalumno",
    "KarunaApp_grupoperiodoalumno",
    "KarunaApp_grupoperiodo",
    "KarunaApp_grupo",
    "KarunaApp_periodo",
    "KarunaApp_alumno",
    "KarunaApp_docente"
CASCADE;

DROP DATABASE "Karuna";
CREATE DATABASE "Karuna";

SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'Karuna';

SELECT datname FROM pg_database;

