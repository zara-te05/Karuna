from statistics import mean
from domain.types import PromedioAlumnoDTO, GrupoPeriodoAlumnoDTO

class Descriptivos:
    
    @staticmethod
    def calcular_promedio_individual(n : GrupoPeriodoAlumnoDTO) -> float:
                
        suma = (
            n.examen * n.peso_examen +
            n.tarea * n.peso_tarea +
            n.asistencia * n.peso_asistencia +
            n.participacion * n.peso_participacion
        )
            
        suma_pesos = (
            n.peso_examen +
            n.peso_tarea +
            n.peso_asistencia +
            n.peso_participacion
        )
            
        if suma_pesos == 0:
            raise ValueError("Los pesos no pueden sumar 0")
        
        return suma/suma_pesos
        
    @staticmethod
    def promedio_final_alumno(parciales):

        if not parciales.exists():
            raise ValueError("No hay parciales")

        grupo_periodo = parciales.first().grupo_periodo
        N = grupo_periodo.periodo.cantidad_evaluaciones

        if parciales.count() != N:
            raise ValueError("Faltan parciales")

        return mean([p.promedio for p in parciales])
    
    @staticmethod
    def promedio_parcial_grupo(promedios: list[PromedioAlumnoDTO]) -> float:
        if not promedios:
            raise ValueError('No hay promedios')
        
        return mean(p.promedio for p in promedios)
            


def promedio_general_grupo(lista_parciales):
   return mean(lista_parciales)



