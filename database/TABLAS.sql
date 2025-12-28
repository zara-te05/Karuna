-- =========================
-- DOCENTE
-- =========================
CREATE TABLE docente (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    apellido VARCHAR(50) NOT NULL,
    rol VARCHAR(50) NOT NULL
);

-- =========================
-- GRUPO
-- =========================
CREATE TABLE grupo (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(500),
    foto VARCHAR(1000),
    docente_id INTEGER NOT NULL,
    CONSTRAINT fk_grupo_docente
        FOREIGN KEY (docente_id)
        REFERENCES docente(id)
        ON DELETE CASCADE
);

-- =========================
-- PERIODO
-- =========================
CREATE TABLE periodo (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,        -- Ej: 2025-1
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL
);

-- =========================
-- GRUPO_PERIODO
-- Define cómo se evalúa un grupo en un periodo
-- =========================
CREATE TABLE grupo_periodo (
    id SERIAL PRIMARY KEY,
    grupo_id INTEGER NOT NULL,
    periodo_id INTEGER NOT NULL,

    cantidad_parciales INTEGER NOT NULL CHECK (cantidad_parciales > 0),

    peso_asistencia REAL NOT NULL,
    peso_tarea REAL NOT NULL,
    peso_participacion REAL NOT NULL,
    peso_examen REAL NOT NULL,

    CONSTRAINT fk_gp_grupo
        FOREIGN KEY (grupo_id)
        REFERENCES grupo(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_gp_periodo
        FOREIGN KEY (periodo_id)
        REFERENCES periodo(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_grupo_periodo
        UNIQUE (grupo_id, periodo_id)
);

-- =========================
-- ALUMNO
-- =========================
CREATE TABLE alumno (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL
);

-- =========================
-- OBSERVACIONES DEL ALUMNO
-- =========================
CREATE TABLE observacion_alumno (
    id SERIAL PRIMARY KEY,
    alumno_id INTEGER NOT NULL,
    texto TEXT NOT NULL,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_obs_alumno
        FOREIGN KEY (alumno_id)
        REFERENCES alumno(id)
        ON DELETE CASCADE
);

-- =========================
-- INSCRIPCION
-- Define que un alumno pertenece a un grupo en un periodo
-- =========================
CREATE TABLE inscripcion (
    id SERIAL PRIMARY KEY,
    alumno_id INTEGER NOT NULL,
    grupo_periodo_id INTEGER NOT NULL,

    asistencias INTEGER NOT NULL DEFAULT 0 CHECK (asistencias >= 0),
    tareas INTEGER NOT NULL DEFAULT 0 CHECK (tareas >= 0),
    participaciones INTEGER NOT NULL DEFAULT 0 CHECK (participaciones >= 0),

    CONSTRAINT fk_insc_alumno
        FOREIGN KEY (alumno_id)
        REFERENCES alumno(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_insc_gp
        FOREIGN KEY (grupo_periodo_id)
        REFERENCES grupo_periodo(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_inscripcion
        UNIQUE (alumno_id, grupo_periodo_id)
);

-- =========================
-- EVALUACION
-- Cada parcial es un registro
-- =========================
CREATE TABLE evaluacion (
    id SERIAL PRIMARY KEY,
    inscripcion_id INTEGER NOT NULL,
    numero_parcial INTEGER NOT NULL CHECK (numero_parcial > 0),

    valor_asistencia REAL NOT NULL CHECK (valor_asistencia BETWEEN 0 AND 10),
    valor_tarea REAL NOT NULL CHECK (valor_tarea BETWEEN 0 AND 10),
    valor_participacion REAL NOT NULL CHECK (valor_participacion BETWEEN 0 AND 10),
    valor_examen REAL NOT NULL CHECK (valor_examen BETWEEN 0 AND 10),

    CONSTRAINT fk_eval_insc
        FOREIGN KEY (inscripcion_id)
        REFERENCES inscripcion(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_evaluacion
        UNIQUE (inscripcion_id, numero_parcial)
);


-- =========================
-- PROMEDIO
-- NULL en numero_parcial = promedio final
-- =========================
CREATE TABLE promedio (
    id SERIAL PRIMARY KEY,
    alumno_id INTEGER NOT NULL,
    grupo_periodo_id INTEGER NOT NULL,

    numero_parcial INTEGER NULL,
    promedio REAL NOT NULL CHECK (promedio BETWEEN 0 AND 10),
    fecha_cierre TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    motivo VARCHAR(100) NOT NULL DEFAULT 'Cierre',

    CONSTRAINT fk_prom_alumno
        FOREIGN KEY (alumno_id)
        REFERENCES alumno(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_prom_gp
        FOREIGN KEY (grupo_periodo_id)
        REFERENCES grupo_periodo(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_promedio
        UNIQUE (alumno_id, grupo_periodo_id, numero_parcial)
);

-- =========================
-- INDICES RECOMENDADOS
-- =========================
CREATE INDEX idx_inscripcion_alumno ON inscripcion(alumno_id);
CREATE INDEX idx_eval_inscripcion ON evaluacion(inscripcion_id);
CREATE INDEX idx_promedio_alumno ON promedio(alumno_id);

ALTER TABLE alumno
ADD COLUMN numero_control VARCHAR(20) NOT NULL UNIQUE;
