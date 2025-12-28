from statistics import mean


class Descriptivos:
    
    @staticmethod
    def calcular_promedio_individual(gpa):
        
        """
        gpa = TABLA GrupoPeriodoAlumno
        """
        gp = gpa.grupo_periodo
            
        suma = (
            gpa.examen * gp.valor_examen +
            gpa.tareas * gp.valor_tarea +
            gpa.asistencias * gp.valor_asistencia +
            gpa.participaciones * gp.valor_participacion
        )
            
        suma_pesos = (
            gp.valor_examen +
            gp.valor_tarea +
            gp.valor_asistencia +
            gp.valor_participacion
        )
            
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
            


    
def promedio_parcial_grupo(parcial_n):
   
    parcial_grupal = sum(parcial_n)/len(parcial_n)
    return parcial_grupal


def promedio_general_grupo(lista_parciales):
   return mean(lista_parciales)


