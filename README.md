# Karuna

**Karuna** es una aplicación de escritorio diseñada para docentes e instituciones educativas, orientada a la gestión académica integral de aulas, control de calificaciones, asistencia, integración con Google Classroom y análisis predictivo del rendimiento estudiantil mediante Machine Learning.

---

## Características Principales

- **Gestión de Docentes y Aulas:**
  - Registro e inicio de sesión seguro con contraseñas hasheadas (`bcrypt` en Rust).
  - Creación, personalización (temas/colores) y administración de múltiples salones y materias.
- **Control de Estudiantes y Evaluación:**
  - Padrón de alumnos con identificación/matrícula y puntos de participación.
  - Criterios de evaluación ponderados personalizados (tareas, exámenes, proyectos, asistencia).
  - Registro de asistencias por sesión y captura de calificaciones por parcial y asignación.
- **Integración con Google Classroom:**
  - Sincronización de cursos, tareas y notas mediante OAuth2 / API de Google Classroom.
- **Módulo de Reportes & Machine Learning (ML):**
  - **Random Forest:** Clasificación y predicción de riesgo de reprobación.
  - **Gradient Boosting:** Análisis de desempeño e importancia de variables académicas.
  - **Regresión Logística:** Estimación de probabilidad de aprobación basada en calificaciones, tareas y asistencias.
  - **K-Means & DBSCAN:** Agrupamiento y segmentación de perfiles de estudiantes (alto rendimiento, rezago, etc.).
  - **Kaplan-Meier (Análisis de Supervivencia):** Estimación temporal y curvas de retención/riesgo de deserción a lo largo de las semanas lectivas.
  - Generación de gráficos analíticos detallados (ROC, matrices de confusión, curvas de supervivencia).

---

## Tecnologías Utilizadas

- **Frontend:**
  - HTML5, CSS3, JavaScript / TypeScript
  - [Vite](https://vitejs.dev/)
  - [React](https://react.dev/)
- **Backend de Escritorio:**
  - [Tauri v2](https://tauri.app/) (Rust)
  - Base de datos local: **SQLite** (`karuna.db`) mediante `@tauri-apps/plugin-sql`
  - Manejo de procesos asíncronos y puente de ejecución de scripts de Machine Learning
- **Machine Learning & Análisis de Datos:**
  - **Python 3.10+**
  - Librerías: `scikit-learn`, `pandas`, `numpy`, `matplotlib`, `seaborn`, `lifelines`

---

## Estructura del Proyecto

```text
Karuna/
├── KarunaApp/
│   ├── src/
│   │   ├── BD/               # Scripts de inicialización y migración SQLite
│   │   ├── ml/               # Modelos y scripts de Machine Learning en Python
│   │   │   ├── clasificacion_gb.py      # Gradient Boosting
│   │   │   ├── clasificacion_lr.py      # Regresión Logística
│   │   │   ├── clasificacion_rf.py      # Random Forest
│   │   │   ├── clustering_dbscan.py     # Agrupamiento DBSCAN
│   │   │   ├── clustering_kmeans.py     # Agrupamiento K-Means
│   │   │   └── supervivencia_kaplan.py  # Análisis de supervivencia Kaplan-Meier
│   │   └── pages/            # Vistas y lógica de la interfaz de usuario
│   ├── src-tauri/            # Código nativo en Rust (comandos, seguridad, puente ML)
│   ├── documentacion_bd.txt  # Esquema y diseño de la base de datos
│   └── package.json          # Dependencias y scripts de frontend/Tauri
└── README.md
```

---

## Requisitos Previos

Antes de ejecutar el proyecto, asegúrate de tener instalado:

1. **Node.js** (versión 18 o superior) y gestor de paquetes (`npm` o `pnpm`).
2. **Rust y Cargo:** [rustup.rs](https://rustup.rs/) (con las dependencias requeridas por [Tauri Prerequisites](https://tauri.app/start/prerequisites/)).
3. **Python 3.10+** agregado al `PATH` del sistema.

### Dependencias de Python para Machine Learning

Para que los modelos de Machine Learning y el análisis gráfico funcionen correctamente, instala las librerías necesarias:

```bash
pip install scikit-learn pandas numpy matplotlib seaborn lifelines
```

---

## Instalación y Puesta en Marcha

1. **Clonar el repositorio:**
   ```bash
   git clone <url-del-repositorio>
   cd Karuna/KarunaApp
   ```

2. **Instalar dependencias de Node:**
   ```bash
   npm install
   # o si usas pnpm:
   pnpm install
   ```

3. **Iniciar en modo desarrollo (Tauri + Vite):**
   ```bash
   npm run tauri dev
   # o:
   pnpm tauri dev
   ```

4. **Compilar para producción (instalador de escritorio):**
   ```bash
   npm run tauri build
   # o:
   pnpm tauri build
   ```

---

## Notas sobre los Modelos de Machine Learning

Para ejecutar análisis en el módulo de reportes sin errores de datos insuficientes:
- **Gradient Boosting y Regresión Logística:** Requieren un mínimo de **5 alumnos**, y la muestra debe incluir alumnos aprobados y reprobados para que los algoritmos puedan aprender ambas clases. Se recomiendan al menos **15 alumnos** para evaluaciones con validación cruzada óptima.
- **Kaplan-Meier:** Requiere un mínimo de **5 alumnos** con calificaciones y asistencias registradas.
- **K-Means / DBSCAN:** Requieren un mínimo de alumnos suficiente para definir los centroides y clusters.

---

## Licencia

Este proyecto está bajo desarrollo privado para fines educativos y de gestión docente. Consulta los términos de la institución para más detalles.
