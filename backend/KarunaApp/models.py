from django.db import models

# Create your models here.

class Docente(models.Model):
    id = models.IntegerField(primary_key=True)
    nombre = models.CharField(max_length=50)
    apellido = models.CharField(max_length=50)
    rol = models.CharField(max_length=50)


class Grupo(models.Model):
    id = models.IntegerField(primary_key=True)
    descripcion = models.CharField(max_length=500)
    nombre = models.CharField(max_length=100)
    foto = models.CharField(max_length=1000)
    docente = models.ForeignKey(
        "KarunaApp.Docente",
        on_delete=models.CASCADE
    )


class Periodo(models.Model):
    id = models.IntegerField(primary_key=True)
    cantidad_evaluaciones = models.IntegerField()
    fecha_inicio = models.DateTimeField()
    fecha_fin = models.DateTimeField()


class GrupoPeriodo(models.Model):
    id = models.IntegerField(primary_key=True)

    grupo = models.ForeignKey(
        "KarunaApp.Grupo",
        on_delete=models.CASCADE
    )

    periodo = models.ForeignKey(
        "KarunaApp.Periodo",
        on_delete=models.CASCADE
    )

    valor_asistencia = models.FloatField()
    valor_tarea = models.FloatField()
    valor_participacion = models.FloatField()
    valor_examen = models.FloatField()


class Alumno(models.Model):
    id = models.IntegerField(primary_key=True)  # antes Identificador
    nombre = models.CharField(max_length=100)
    apellido = models.CharField(max_length=100)
    notas = models.CharField(max_length=1000)


class GrupoPeriodoAlumno(models.Model):
    id = models.IntegerField(primary_key=True)

    grupo_periodo = models.ForeignKey(
        "KarunaApp.GrupoPeriodo",
        on_delete=models.CASCADE
    )

    alumno = models.ForeignKey(
        "KarunaApp.Alumno",
        on_delete=models.CASCADE
    )

    asistencias = models.IntegerField()
    tareas = models.IntegerField()
    participaciones = models.IntegerField()
    examen = models.FloatField()
