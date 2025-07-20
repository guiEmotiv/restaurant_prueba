# ───────────────────────── stage 1 · builder ─────────────────────────
FROM python:3.12-slim-bookworm AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Dependencias del sistema para compilar paquetes Python
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    build-essential && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/app

# Copiar requirements
COPY requirements-dev.txt ./
#COPY requirements.txt ./

# Verificar archivos (debugging)
RUN ls -la /opt/app/

# Instalar dependencias
RUN python -m pip install --upgrade pip
RUN pip install --prefix=/install -r requirements-dev.txt
#RUN pip install --prefix=/install -r requirements.txt

# Limpiar caché
RUN rm -rf /root/.cache/pip

# Copiar código de la aplicación
COPY backend/ ./backend/

# ───────────────────────── stage 2 · runtime ─────────────────────────
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/home/django/app

# INSTALAR POSTGRESQL CLIENT EN DEBIAN (NO Alpine!)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    postgresql-client \
    libpq5 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copiar paquetes instalados del builder
COPY --from=builder /install /usr/local

# Crear usuario no root
RUN useradd -m django
WORKDIR /home/django/app

# Copiar código de la aplicación
COPY --from=builder /opt/app/backend/ ./backend/

# Copiar entrypoint y dar permisos
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Cambiar propietario
RUN chown -R django:django /home/django/app

USER django

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]