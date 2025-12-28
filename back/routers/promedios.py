from fastapi import APIRouter, HTTPException
from repositories.promedios_repo import obtener_promedios_parcial, obtener_valores_calculo_parcial
from services.descriptivos import Descriptivos

router = APIRouter(prefix='/api/promedios')


@router.get("/alumno/{alumno_id}/evaluacion/{evaluacion_id}")
async def promedio_parcial_alumno(alumno_id : int, evaluacion_id : int):
    
    valores = obtener_valores_calculo_parcial(str(alumno_id), evaluacion_id)
 
    if not valores:
        raise HTTPException(status_code=404, detail='No hay valores')
    
    promedio = Descriptivos.calcular_promedio_individual(valores)
    
    return {
        "alumno_id": alumno_id,
        "evaluacion_id": evaluacion_id,
        "promedio_parcial": round(promedio, 2)
    }


@router.get("/grupo/{grupo_periodo_id}")
async def promedio_grupo(grupo_periodo_id : int):
    return #Descriptivos.(grupo_periodo_id)


@router.get("/grupo/{grupo_periodo_id}/parcial/{parcial}")
async def promedio_grupal_parcial(grupo_periodo_id:int, parcial:int):
    
    valores = obtener_promedios_parcial(grupo_periodo_id, parcial) 
    
    if not valores:
        raise ValueError("No hay datos")

    promedio = Descriptivos.calcular_promedio_individual(valores[0])
    


