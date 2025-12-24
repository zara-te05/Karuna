"""
URL configuration for Karuna project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from KarunaApp.views import login_api
from KarunaApp.views import login_view
from KarunaApp.views import register_api
from KarunaApp.views import prueba_promedios

urlpatterns = [
    path('admin/', admin.site.urls),
    path("", login_view),           # ← login por defecto
    path("api/login/", login_api), 
    path("api/register/", register_api),
    path(
        "api/prueba-periodo/<int:alumno_id>/<int:grupo_periodo_id>/",
         prueba_promedios,
         name="prubea_promedios")
]
