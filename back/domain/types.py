# domain/types.py
from dataclasses import dataclass
from typing import Optional
import datetime

@dataclass
class PromedioAlumnoDTO:
    alumno_id: int
    promedio: float
    numero_parcial: Optional[int]  # None = final

@dataclass
class GrupoPeriodoAlumnoDTO:
    numero_control : float
    peso_asistencia : float
    peso_participacion : float
    peso_tarea : float
    peso_examen : float
    
    asistencia : float
    participacion : float
    tarea : float
    examen : float
    
    