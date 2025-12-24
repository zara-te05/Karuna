from django.shortcuts import render, get_object_or_404
from django.http import HttpResponse
from django.http import JsonResponse
from .models import GrupoPeriodoAlumno
import json

# Create your views here.

def login_view(request):
    return render(request, "login.html")


def login_api(request):
    if request.method == "POST":
        data = json.loads(request.body)

        email = data.get("email")
        password = data.get("password")

        if email == "test@test.com" and password == "1234":
            return JsonResponse({"success": True})
        else:
            return JsonResponse({"success": False})

    return JsonResponse({"error": "Método no permitido"}, status=405)


def register_api(request):  
    if request.method != "POST":
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    
    data = json.loads(request.body)
    
    nombre = data.get('nombre')
    email = data.get('email')
    password = data.get('password')
    password_confirmacion = data.get('password_confirmacion')
    institucion = data.get('institucion')
    nivel_educativo = data.get('nivel_educativo')
    
    if not all([nombre, email, password, password_confirmacion, institucion, nivel_educativo]):
        return JsonResponse({'error': 'Datos incompletos'}, status = 400)
    
    if password != password_confirmacion:
        return JsonResponse({'error' : 'Las claves no coinciden'}, status=400)
    
    return JsonResponse({'succes':True})


def prueba_promedios(request, alumno_id, grupo_periodo_id):
    gpa = get_object_or_404(
        GrupoPeriodoAlumno,
        alumno_id = alumno_id,
        grupo_periodo_id = grupo_periodo_id
    )
    
    from analytics.descriptivos import Descriptivos
    promedio = Descriptivos.calcular_promedio_individual(gpa)
    
    # Guardar (solo si no existe aún)
    """PromedioAlumno.objects.update_or_create(
        alumno=gpa.alumno,
        grupo_periodo=gpa.grupo_periodo,
        numero_parcial=parcial,
        defaults={
            "promedio": promedio
        }
    )"""
    
    return JsonResponse({
        "alumno": f"{gpa.alumno.nombre} {gpa.alumno.apellido}",
        "grupo": gpa.grupo_periodo.grupo.nombre,
        "promedio": promedio
    })