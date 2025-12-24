from django.db import models


class Docente(models.Model):
    nombre = models.CharField(max_length=50)
    apellido = models.CharField(max_length=50)
    rol = models.CharField(max_length=50)

    def __str__(self):
        return f"{self.nombre} {self.apellido}"


class Grupo(models.Model):
    nombre = models.CharField(max_length=100)
    descripcion = models.CharField(max_length=500)
    foto = models.CharField(max_length=1000)

    docente = models.ForeignKey(
        Docente,
        on_delete=models.CASCADE,
        related_name="grupos"
    )

    def __str__(self):
        return self.nombre


class Periodo(models.Model):
    cantidad_evaluaciones = models.PositiveIntegerField()
    fecha_inicio = models.DateTimeField()
    fecha_fin = models.DateTimeField()

    def __str__(self):
        return f"{self.fecha_inicio.date()} - {self.fecha_fin.date()}"


class GrupoPeriodo(models.Model):
    grupo = models.ForeignKey(
        Grupo,
        on_delete=models.CASCADE,
        related_name="periodos"
    )

    periodo = models.ForeignKey(
        Periodo,
        on_delete=models.CASCADE,
        related_name="grupos"
    )

    valor_asistencia = models.FloatField()
    valor_tarea = models.FloatField()
    valor_participacion = models.FloatField()
    valor_examen = models.FloatField()

    def __str__(self):
        return f"{self.grupo} / {self.periodo}"


class Alumno(models.Model):
    nombre = models.CharField(max_length=100)
    apellido = models.CharField(max_length=100)
    notas = models.TextField()

    def __str__(self):
        return f"{self.nombre} {self.apellido}"


class GrupoPeriodoAlumno(models.Model):
    grupo_periodo = models.ForeignKey(
        GrupoPeriodo,
        on_delete=models.CASCADE,
        related_name="alumnos"
    )

    alumno = models.ForeignKey(
        Alumno,
        on_delete=models.CASCADE,
        related_name="grupos"
    )

    asistencias = models.PositiveIntegerField(default=0)
    tareas = models.PositiveIntegerField(default=0)
    participaciones = models.PositiveIntegerField(default=0)
    examen = models.FloatField()

    class Meta:
        unique_together = ("grupo_periodo", "alumno")



class PromedioAlumno(models.Model):
    alumno = models.ForeignKey(
        Alumno,
        on_delete=models.CASCADE,
        related_name="promedios"
    )

    grupo_periodo = models.ForeignKey(
        GrupoPeriodo,
        on_delete=models.CASCADE,
        related_name="promedios"
    )

    numero_parcial = models.PositiveIntegerField(
        null=True,
        blank=True
    )
    # null => promedio final del periodo

    promedio = models.FloatField()
    fecha_cierre = models.DateTimeField(auto_now_add=True)

    motivo = models.CharField(
        max_length=100,
        default="Cierre de parcial"
    )
