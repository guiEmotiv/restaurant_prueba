#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🗄️  DATABASE SETUP & MIGRATIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "🗄️  CONFIGURANDO BASE DE DATOS DE PRODUCCIÓN"
echo "============================================"

cd "${PROJECT_DIR}"

# Verificar que estamos en el directorio correcto
if [ ! -f "docker-compose.production.yml" ]; then
    echo "❌ Error: docker-compose.production.yml no encontrado"
    echo "🔍 Directorio actual: $(pwd)"
    echo "📁 Contenido:"
    ls -la
    exit 1
fi

echo "✅ Proyecto encontrado en: ${PROJECT_DIR}"

# Crear directorio de datos si no existe
echo "📁 Creando directorios de datos..."
mkdir -p data
mkdir -p logs
sudo chown -R ubuntu:ubuntu data logs

# Hacer backup de la base de datos existente si existe
if [ -f "data/restaurant.prod.sqlite3" ]; then
    echo "💾 Creando backup de base de datos existente..."
    cp data/restaurant.prod.sqlite3 data/restaurant.prod.sqlite3.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Backup creado"
fi

# Construir y preparar el contenedor backend para migraciones
echo "🏗️  Construyendo contenedor backend..."
docker-compose -f docker-compose.production.yml build restaurant-web-backend

# Verificar que el contenedor puede ejecutar comandos Django
echo "🔍 Verificando configuración Django..."
docker-compose -f docker-compose.production.yml run --rm \
    -e DJANGO_SETTINGS_MODULE=backend.settings \
    restaurant-web-backend python manage.py check --deploy

# Ejecutar migraciones
echo "🚀 Ejecutando migraciones de base de datos..."
docker-compose -f docker-compose.production.yml run --rm \
    -e DJANGO_SETTINGS_MODULE=backend.settings \
    restaurant-web-backend python manage.py migrate

# Recopilar archivos estáticos
echo "📦 Recopilando archivos estáticos..."
docker-compose -f docker-compose.production.yml run --rm \
    -e DJANGO_SETTINGS_MODULE=backend.settings \
    restaurant-web-backend python manage.py collectstatic --noinput --clear

# Crear superusuario si no existe
echo "👤 Configurando usuario administrador..."
docker-compose -f docker-compose.production.yml run --rm \
    -e DJANGO_SETTINGS_MODULE=backend.settings \
    -e DJANGO_SUPERUSER_USERNAME=admin \
    -e DJANGO_SUPERUSER_EMAIL=admin@restaurant.com \
    -e DJANGO_SUPERUSER_PASSWORD=admin123 \
    restaurant-web-backend python manage.py shell -c "
from django.contrib.auth.models import User
import os

username = os.getenv('DJANGO_SUPERUSER_USERNAME', 'admin')
email = os.getenv('DJANGO_SUPERUSER_EMAIL', 'admin@restaurant.com')
password = os.getenv('DJANGO_SUPERUSER_PASSWORD', 'admin123')

if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username, email, password)
    print(f'✅ Superusuario {username} creado')
else:
    print(f'ℹ️  Superusuario {username} ya existe')
"

# Verificar estado de la base de datos
echo "🔍 Verificando estado de la base de datos..."
docker-compose -f docker-compose.production.yml run --rm \
    -e DJANGO_SETTINGS_MODULE=backend.settings \
    restaurant-web-backend python manage.py showmigrations

# Verificar que el backend funciona correctamente
echo "🧪 Probando conexión al backend..."
docker-compose -f docker-compose.production.yml run --rm \
    -e DJANGO_SETTINGS_MODULE=backend.settings \
    restaurant-web-backend python manage.py shell -c "
import django
from django.conf import settings
print(f'✅ Django configurado correctamente')
print(f'📊 Base de datos: {settings.DATABASES[\"default\"][\"NAME\"]}')
print(f'🌍 Debug mode: {settings.DEBUG}')
print(f'🔐 Allowed hosts: {settings.ALLOWED_HOSTS}')
"

# Mostrar información de la base de datos
if [ -f "data/restaurant.prod.sqlite3" ]; then
    echo ""
    echo "📊 INFORMACIÓN DE LA BASE DE DATOS"
    echo "================================="
    echo "📁 Ubicación: ${PROJECT_DIR}/data/restaurant.prod.sqlite3"
    echo "📏 Tamaño: $(du -h data/restaurant.prod.sqlite3 | cut -f1)"
    echo "📅 Última modificación: $(stat -c %y data/restaurant.prod.sqlite3 2>/dev/null || stat -f %Sm data/restaurant.prod.sqlite3)"
fi

echo ""
echo "✅ BASE DE DATOS CONFIGURADA CORRECTAMENTE"
echo "=========================================="
echo "🎯 La base de datos está lista para producción"
echo "🔐 Usuario admin creado/verificado"
echo "📦 Archivos estáticos recopilados"
echo "🚀 Migraciones aplicadas"
echo ""