#!/bin/bash

# Restaurant Web - Fix Nginx with Simple Configuration
# Solves duplicate upstream issues by using only one clean config

set -e

echo "🔧 FIXING NGINX WITH SIMPLE CONFIGURATION"
echo "========================================="

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ Este script debe ejecutarse como root (sudo)"
   exit 1
fi

PROJECT_ROOT="/opt/restaurant-web"
cd "$PROJECT_ROOT"

echo "📍 Directorio del proyecto: $PROJECT_ROOT"

# 1. STOP ALL CONTAINERS
echo ""
echo "🛑 1. Deteniendo contenedores..."

docker-compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
docker-compose -f docker-compose.simple.yml down --remove-orphans 2>/dev/null || true

# 2. CLEAN NGINX CONFIG
echo ""
echo "🧹 2. Limpiando configuración nginx..."

cd nginx/conf.d/

# Disable conflicting configurations
mv alt-ports.conf alt-ports.conf.disabled 2>/dev/null || true
mv default.conf default.conf.backup 2>/dev/null || true

# Use simple configuration as default
cp simple.conf default.conf

echo "✅ Solo una configuración nginx activa: simple.conf -> default.conf"
ls -la

cd "$PROJECT_ROOT"

# 3. BUILD FRONTEND
echo ""
echo "🏗️  3. Building frontend..."

cd frontend

if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
fi

echo "🔨 Building producción..."
npm run build

if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo "❌ Error: Build del frontend falló"
    exit 1
fi

cd "$PROJECT_ROOT"

# 4. USE SIMPLE DOCKER COMPOSE
echo ""
echo "🐳 4. Usando configuración Docker Compose simplificada..."

# Create simple docker-compose if it doesn't exist
if [ ! -f "docker-compose.simple.yml" ]; then
    echo "📝 Creando docker-compose.simple.yml..."
    cat > docker-compose.simple.yml << 'EOF'
version: '3.8'

# Simplified production setup without SSL complications
# For debugging nginx issues and ensuring basic functionality

services:
  web:
    build:
      context: ./backend
      dockerfile: Dockerfile.ec2
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
      - ./.env.ec2:/app/.env.ec2
      - ./frontend/dist:/app/frontend_static
    environment:
      - DJANGO_SETTINGS_MODULE=backend.settings_ec2
    env_file:
      - .env.ec2
    restart: unless-stopped
    networks:
      - restaurant_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/conf.d/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./frontend/dist:/var/www/html:ro
    depends_on:
      - web
    restart: unless-stopped
    networks:
      - restaurant_network

networks:
  restaurant_network:
    driver: bridge
EOF
fi

# 5. DEPLOY WITH SIMPLE CONFIG
echo ""
echo "🚀 5. Desplegando con configuración simple..."

echo "🔨 Construyendo imágenes..."
docker-compose -f docker-compose.simple.yml build --no-cache

echo "🔄 Levantando servicios..."
docker-compose -f docker-compose.simple.yml up -d

echo "⏳ Esperando inicialización..."
sleep 25

# 6. VERIFY FUNCTIONALITY
echo ""
echo "🔍 6. Verificando funcionamiento..."

echo "📊 Estado de contenedores:"
docker-compose -f docker-compose.simple.yml ps

# Wait a bit more for Django
sleep 10

echo ""
echo "🧪 Ejecutando pruebas..."

# Test backend direct
echo "🔍 Backend directo (puerto 8000):"
HEALTH_DIRECT=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health/ 2>/dev/null || echo "000")
echo "  📊 HTTP $HEALTH_DIRECT"

# Test through nginx
echo "🔍 A través de nginx (puerto 80):"
HEALTH_HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/health/ 2>/dev/null || echo "000")
echo "  📊 HTTP $HEALTH_HTTP"

# Test tables endpoint
echo "🔍 Tables endpoint:"
TABLES_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/config/tables/ 2>/dev/null || echo "000")
echo "  📊 HTTP $TABLES_TEST"

# 7. RESULTS
echo ""
echo "🎯 RESULTADOS"
echo "============="

if [[ "$HEALTH_DIRECT" == "200" ]] && [[ "$HEALTH_HTTP" == "200" ]] && [[ "$TABLES_TEST" == "200" ]]; then
    echo "🎉 ¡NGINX ARREGLADO CON CONFIGURACIÓN SIMPLE!"
    echo ""
    echo "🌐 URLs funcionando:"
    echo "  • Frontend: http://www.xn--elfogndedonsoto-zrb.com"
    echo "  • API Health: http://www.xn--elfogndedonsoto-zrb.com/api/v1/health/"
    echo "  • Tables: http://www.xn--elfogndedonsoto-zrb.com/api/v1/config/tables/"
    echo ""
    echo "✅ Los errores 404 de API están solucionados"
    
else
    echo "❌ Aún hay problemas:"
    echo "  • Backend directo: $HEALTH_DIRECT"
    echo "  • Nginx: $HEALTH_HTTP"
    echo "  • Tables: $TABLES_TEST"
    
    echo ""
    echo "📋 Logs para diagnóstico:"
    docker-compose -f docker-compose.simple.yml logs nginx --tail=20
fi

echo ""
echo "🔧 Comandos para monitoreo:"
echo "  • Ver logs: docker-compose -f docker-compose.simple.yml logs"
echo "  • Reiniciar: docker-compose -f docker-compose.simple.yml restart"
echo "  • Estado: docker-compose -f docker-compose.simple.yml ps"

echo ""
echo "✅ Fix de nginx completado"