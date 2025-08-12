#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# SCRIPT DE CONFIGURACIÓN DE DESARROLLO
# Configura el ambiente de desarrollo idéntico a producción
# ═══════════════════════════════════════════════════════════════════════════════

set -e  # Exit en error

echo "🏗️  Configurando ambiente de desarrollo..."

# ───────────────────────────────────────────────────────────────────────────────
# 1. Verificar prerrequisitos
# ───────────────────────────────────────────────────────────────────────────────

echo "🔍 Verificando prerrequisitos..."

# Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado. Instálalo desde https://docker.com"
    exit 1
fi

# Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose no está instalado."
    exit 1
fi

# Node.js (para builds locales)
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado. Instálalo desde https://nodejs.org"
    exit 1
fi

echo "✅ Prerrequisitos verificados"

# ───────────────────────────────────────────────────────────────────────────────
# 2. Crear directorios necesarios
# ───────────────────────────────────────────────────────────────────────────────

echo "📁 Creando directorios..."

mkdir -p data
mkdir -p logs

echo "✅ Directorios creados"

# ───────────────────────────────────────────────────────────────────────────────
# 3. Build del frontend
# ───────────────────────────────────────────────────────────────────────────────

echo "🔨 Building frontend..."

cd frontend
npm ci
npm run build
cd ..

echo "✅ Frontend buildeado"

# ───────────────────────────────────────────────────────────────────────────────
# 4. Configurar base de datos
# ───────────────────────────────────────────────────────────────────────────────

echo "🗃️  Configurando base de datos..."

# Si no existe la base de datos, copiar desde backup
if [ ! -f "data/restaurant_dev.sqlite3" ]; then
    if [ -f "backend/db.sqlite3" ]; then
        cp backend/db.sqlite3 data/restaurant_dev.sqlite3
        echo "✅ Base de datos copiada desde backend"
    else
        echo "⚠️  No se encontró base de datos existente. Se creará nueva."
    fi
fi

# ───────────────────────────────────────────────────────────────────────────────
# 5. Iniciar servicios
# ───────────────────────────────────────────────────────────────────────────────

echo "🚀 Iniciando servicios de desarrollo..."

docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
docker-compose -f docker-compose.dev.yml up -d

echo "⏳ Esperando que los servicios estén listos..."
sleep 10

# Verificar que los servicios estén funcionando
if curl -f http://localhost:8000/api/v1/health/ > /dev/null 2>&1; then
    echo "✅ Backend funcionando en http://localhost:8000"
else
    echo "❌ Backend no responde"
    exit 1
fi

if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Frontend funcionando en http://localhost:3000"
else
    echo "❌ Frontend no responde"
    exit 1
fi

# ───────────────────────────────────────────────────────────────────────────────
# 6. Mostrar información final
# ───────────────────────────────────────────────────────────────────────────────

echo ""
echo "🎉 ¡Ambiente de desarrollo configurado!"
echo ""
echo "📋 URLs disponibles:"
echo "   Frontend (Producción-like): http://localhost:3000"
echo "   Backend API:                http://localhost:8000"
echo "   Django Admin:               http://localhost:3000/admin"
echo ""
echo "🔧 Comandos útiles:"
echo "   Ver logs:       docker-compose -f docker-compose.dev.yml logs -f"
echo "   Reiniciar:      docker-compose -f docker-compose.dev.yml restart"
echo "   Detener:        docker-compose -f docker-compose.dev.yml down"
echo "   Hot reload:     docker-compose -f docker-compose.dev.yml --profile dev-hot-reload up -d"
echo ""
echo "✅ Tu ambiente de desarrollo es IDÉNTICO a producción"