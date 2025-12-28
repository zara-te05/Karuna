-- =========================
-- DOCENTE
-- =========================
INSERT INTO docente (nombre, apellido, rol) VALUES
('Juan', 'Aragón', 'Docente'),
('María', 'López', 'Docente');

-- =========================
-- GRUPO
-- =========================
INSERT INTO grupo (nombre, descripcion, foto, docente_id) VALUES
('Programación I', 'Primer semestre', NULL, 1),
('Bases de Datos', 'Segundo semestre', NULL, 2);

-- =========================
-- PERIODO
-- =========================
INSERT INTO periodo (nombre, fecha_inicio, fecha_fin) VALUES
('2025-1', '2025-01-15', '2025-06-15');

-- =========================
-- GRUPO_PERIODO
-- =========================
INSERT INTO grupo_periodo (
    grupo_id, periodo_id, cantidad_parciales,
    peso_asistencia, peso_tarea, peso_participacion, peso_examen
) VALUES
(1, 1, 3, 0.10, 0.20, 0.20, 0.50),
(2, 1, 2, 0.15, 0.25, 0.10, 0.50);

-- =========================
-- ALUMNO
-- =========================
INSERT INTO alumno (nombre, apellido, numero_control) VALUES
('Carlos', 'Hernández', '2025001'),
('Ana', 'Martínez', '2025002');

-- =========================
-- INSCRIPCIÓN
-- =========================
INSERT INTO inscripcion (
    alumno_id, grupo_periodo_id, asistencias, tareas, participaciones
) VALUES
(1, 1, 28, 9, 8),
(2, 1, 25, 7, 6);

-- =========================
-- EVALUACIONES (PARCIALES)
-- =========================
INSERT INTO evaluacion (
    inscripcion_id, numero_parcial,
    valor_asistencia, valor_tarea, valor_participacion, valor_examen
) VALUES
(1, 1, 9, 8, 8, 9),
(1, 2, 10, 9, 9, 8),
(1, 3, 9, 8, 8, 9),

(2, 1, 8, 7, 6, 7),
(2, 2, 7, 6, 6, 7),
(2, 3, 8, 7, 7, 8);

-- =========================
-- PROMEDIOS
-- =========================
INSERT INTO promedio (
    alumno_id, grupo_periodo_id, numero_parcial, promedio, motivo
) VALUES
(1, 1, 1, 8.8, 'Parcial 1'),
(1, 1, 2, 9.0, 'Parcial 2'),
(1, 1, 3, 8.7, 'Parcial 3'),
(1, 1, NULL, 8.83, 'Final'),

(2, 1, 1, 7.0, 'Parcial 1'),
(2, 1, 2, 6.8, 'Parcial 2'),
(2, 1, 3, 7.5, 'Parcial 3'),
(2, 1, NULL, 7.10, 'Final');
