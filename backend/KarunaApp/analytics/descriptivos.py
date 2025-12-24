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
            



def promedio_final_alumno(lista_parciales):
    
    return mean(lista_parciales)

    
def promedio_parcial_grupo(parcial_n):
   
    parcial_grupal = sum(parcial_n)/len(parcial_n)
    return parcial_grupal


def promedio_general_grupo(lista_parciales):
   return mean(lista_parciales)


