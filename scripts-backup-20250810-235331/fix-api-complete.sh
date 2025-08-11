#!/bin/bash

# Restaurant Web - Fix API 404 Errors - Complete Solution
# Soluciona completamente los errores 404 de API endpoints

set -e  # Exit on error

echo "🔧 SOLUCIONANDO ERRORES 404 DE API - DEPLOYMENT COMPLETO"
echo "==========================================================="

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ Este script debe ejecutarse como root (sudo)"
   exit 1
fi

# Variables de configuración
PROJECT_ROOT="/opt/restaurant-web"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
BACKEND_DIR="$PROJECT_ROOT/backend"
DEPLOY_DIR="$PROJECT_ROOT/deploy"

echo "📍 Directorio del proyecto: $PROJECT_ROOT"
echo "📍 Frontend: $FRONTEND_DIR"
echo "📍 Backend: $BACKEND_DIR"

# 1. PARAR SERVICIOS ACTUALES
echo ""
echo "🛑 1. Parando servicios actuales..."
cd "$PROJECT_ROOT"

# Parar todos los contenedores
docker-compose -f docker-compose.ec2.yml down --remove-orphans 2>/dev/null || true
docker-compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true

# Limpiar contenedores e imágenes huérfanas
docker system prune -f

echo "✅ Servicios detenidos y limpiados"

# 2. BUILD DEL FRONTEND
echo ""
echo "🏗️  2. Building frontend..."
cd "$FRONTEND_DIR"

# Verificar que node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias de Node.js..."
    npm install
fi

# Build de producción
echo "🔨 Ejecutando build de producción..."
npm run build

# Verificar que el build fue exitoso
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo "❌ Error: Build del frontend falló"
    exit 1
fi

echo "✅ Frontend build completado"

# 3. PREPARAR ARCHIVOS DE CONFIGURACIÓN
echo ""
echo "⚙️  3. Preparando configuración..."

# Verificar que existe docker-compose.prod.yml
if [ ! -f "$PROJECT_ROOT/docker-compose.prod.yml" ]; then
    echo "❌ Error: Falta docker-compose.prod.yml"
    exit 1
fi

# Copiar archivos de configuración de nginx
if [ ! -d "$PROJECT_ROOT/nginx/conf.d" ]; then
    echo "❌ Error: Faltan archivos de configuración de nginx"
    exit 1
fi

echo "✅ Configuración preparada"

# 4. CONSTRUIR Y LEVANTAR SERVICIOS
echo ""
echo "🚀 4. Construyendo y levantando servicios..."
cd "$PROJECT_ROOT"

# Usar docker-compose.prod.yml que incluye nginx
echo "🔄 Construyendo imágenes..."
docker-compose -f docker-compose.prod.yml build --no-cache

echo "🔄 Levantando servicios..."
docker-compose -f docker-compose.prod.yml up -d

# Esperar a que los servicios estén listos
echo "⏳ Esperando a que los servicios estén listos..."
sleep 15

echo "✅ Servicios levantados"

# 5. VERIFICAR ESTADO DE LOS SERVICIOS
echo ""
echo "🔍 5. Verificando estado de servicios..."

# Mostrar estado de contenedores
echo "📊 Estado de contenedores:"
docker-compose -f docker-compose.prod.yml ps

# Verificar que los contenedores están corriendo
WEB_STATUS=$(docker-compose -f docker-compose.prod.yml ps -q web | wargs docker inspect -f '{{.State.Status}}' 2>/dev/null || echo "not running")
NGINX_STATUS=$(docker-compose -f docker-compose.prod.yml ps -q nginx | wargs docker inspect -f '{{.State.Status}}' 2>/dev/null || echo "not running")

echo "🌐 Estado web: $WEB_STATUS"
echo "🌐 Estado nginx: $NGINX_STATUS"

if [[ "$WEB_STATUS" != "running" ]] || [[ "$NGINX_STATUS" != "running" ]]; then
    echo "❌ Error: Algunos servicios no están corriendo correctamente"
    echo "📋 Logs del contenedor web:"
    docker-compose -f docker-compose.prod.yml logs web --tail=20
    echo "📋 Logs del contenedor nginx:"
    docker-compose -f docker-compose.prod.yml logs nginx --tail=20
    exit 1
fi

echo "✅ Todos los servicios están corriendo"

# 6. PRUEBAS DE CONECTIVIDAD
echo ""
echo "🧪 6. Ejecutando pruebas de conectividad..."

# Esperar un poco más para que Django termine de inicializar
sleep 10

# Probar endpoint de salud directo (puerto 8000)
echo "🔍 Probando endpoint de salud directo..."
HEALTH_DIRECT=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health/ || echo "000")
echo "📊 Health directo (puerto 8000): $HEALTH_DIRECT"

# Probar endpoint a través de nginx (puerto 80)
echo "🔍 Probando endpoint a través de nginx..."
HEALTH_NGINX=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/health/ || echo "000")
echo "📊 Health nginx (puerto 80): $HEALTH_NGINX"

# Probar endpoint de configuración
echo "🔍 Probando endpoint de configuración..."
CONFIG_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/config/tables/ || echo "000")
echo "📊 Config tables: $CONFIG_TEST"

# Verificar resultados
if [[ "$HEALTH_DIRECT" == "200" ]] && [[ "$HEALTH_NGINX" == "200" ]]; then
    echo "✅ Conectividad verificada - API funcionando correctamente"
else
    echo "❌ Problemas de conectividad detectados"
    echo "📋 Logs para diagnóstico:"
    docker-compose -f docker-compose.prod.yml logs web --tail=30
    docker-compose -f docker-compose.prod.yml logs nginx --tail=30
fi

# 7. INFORMACIÓN FINAL
echo ""
echo "📋 RESUMEN DE DEPLOYMENT"
echo "========================"
echo "🌐 URL Frontend: https://www.xn--elfogndedonsoto-zrb.com"
echo "🔗 URL API: https://www.xn--elfogndedonsoto-zrb.com/api/v1/"
echo "🏥 Health Check: https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/"
echo ""
echo "📊 Endpoints principales:"
echo "  • Tables: /api/v1/config/tables/"
echo "  • Recipes: /api/v1/inventory/recipes/"
echo "  • Orders: /api/v1/operation/orders/"
echo "  • Groups: /api/v1/inventory/groups/"
echo "  • Containers: /api/v1/config/containers/"
echo ""
echo "🔧 Para ver logs:"
echo "  • Web: docker-compose -f docker-compose.prod.yml logs web"
echo "  • Nginx: docker-compose -f docker-compose.prod.yml logs nginx"
echo ""
echo "🎉 DEPLOYMENT COMPLETADO"

# Mostrar algunos logs importantes al final
echo ""
echo "📋 Últimos logs importantes:"
echo "=========================="
echo "🐳 Web Container:"
docker-compose -f docker-compose.prod.yml logs web --tail=10
echo ""
echo "🌐 Nginx Container:"
docker-compose -f docker-compose.prod.yml logs nginx --tail=10

echo ""
echo "✅ Script completado exitosamente"