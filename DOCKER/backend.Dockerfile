FROM python:3.13.5

RUN mkdir /app

# Evitar que python genere archivos pyc (NO AGREGAR ESPACIOS ENTRE LOS =)
ENV PYTHONDONTWRITEBYCODE=1
ENV PYTHONUNBUFFERED=1

# Actualizar pip
RUN pip install --upgrade pip

# Copia requirements
COPY BACK/requirements.txt .

RUN pip install -r requirements.txt || true

# Copiar TODO el backend
COPY BACK .

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]