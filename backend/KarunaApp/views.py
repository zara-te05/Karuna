from django.shortcuts import render
from django.http import HttpResponse
from django.http import JsonResponse
import json

# Create your views here.
def hello(request):
    return HttpResponse("Hola Mundo")

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
