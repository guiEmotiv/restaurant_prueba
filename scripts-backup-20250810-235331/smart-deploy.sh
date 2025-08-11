#!/bin/bash

# Restaurant Web - Smart Deploy
# Automatically detects port conflicts and chooses best configuration

set -e

echo "🚀 SMART DEPLOYMENT - RESTAURANT WEB"
echo "===================================="

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ Este script debe ejecutarse como root (sudo)"
   exit 1
fi

PROJECT_ROOT="/opt/restaurant-web"
cd "$PROJECT_ROOT"

echo "📍 Directorio del proyecto: $PROJECT_ROOT"

# 1. DETECTAR CONFLICTOS DE PUERTO
echo ""
echo "🔍 1. Detectando conflictos de puerto..."

PORT_80_FREE=true
PORT_443_FREE=true

# Verificar puerto 80
if netstat -tulpn | grep -q ":80 "; then
    echo "⚠️  Puerto 80 está ocupado"
    PORT_80_FREE=false
    
    echo "📊 Servicios usando puerto 80:"
    netstat -tulpn | grep ":80 " || true
    lsof -i :80 2>/dev/null || true
else
    echo "✅ Puerto 80 está libre"
fi

# Verificar puerto 443
if netstat -tulpn | grep -q ":443 "; then
    echo "⚠️  Puerto 443 está ocupado"
    PORT_443_FREE=false
    
    echo "📊 Servicios usando puerto 443:"
    netstat -tulpn | grep ":443 " || true
else
    echo "✅ Puerto 443 está libre"
fi

# 2. SELECCIONAR ESTRATEGIA DE DEPLOYMENT
DEPLOYMENT_STRATEGY=""
COMPOSE_FILE=""
NGINX_CONFIG=""
ACCESS_URLS=""

if [ "$PORT_80_FREE" = true ] && [ "$PORT_443_FREE" = true ]; then
    echo ""
    echo "🎯 Estrategia: PUERTOS ESTÁNDAR (80/443)"
    DEPLOYMENT_STRATEGY="standard"
    COMPOSE_FILE="docker-compose.prod.yml"
    NGINX_CONFIG="default.conf"
    ACCESS_URLS="http://localhost y https://www.xn--elfogndedonsoto-zrb.com"
    
elif [ "$PORT_80_FREE" = false ] || [ "$PORT_443_FREE" = false ]; then
    echo ""
    echo "🎯 Estrategia: PUERTOS ALTERNATIVOS (8080/8443)"
    echo "⚠️  Se usarán puertos alternativos debido a conflictos"
    DEPLOYMENT_STRATEGY="alternative"
    COMPOSE_FILE="docker-compose.alt-ports.yml"
    NGINX_CONFIG="alt-ports.conf"
    ACCESS_URLS="http://localhost:8080 y https://www.xn--elfogndedonsoto-zrb.com:8443"
    
    # Intentar liberar puertos si es posible
    echo ""
    echo "🔄 Intentando liberar puertos estándar..."
    
    # Detener servicios comunes
    systemctl stop apache2 2>/dev/null || true
    systemctl disable apache2 2>/dev/null || true
    systemctl stop nginx 2>/dev/null || true
    systemctl disable nginx 2>/dev/null || true
    
    # Forzar liberación de puertos
    fuser -k 80/tcp 2>/dev/null || true
    fuser -k 443/tcp 2>/dev/null || true
    
    sleep 5
    
    # Verificar de nuevo
    if ! netstat -tulpn | grep -q ":80 " && ! netstat -tulpn | grep -q ":443 "; then
        echo "✅ Puertos liberados! Cambiando a estrategia estándar"
        DEPLOYMENT_STRATEGY="standard"
        COMPOSE_FILE="docker-compose.prod.yml"
        NGINX_CONFIG="default.conf"
        ACCESS_URLS="http://localhost y https://www.xn--elfogndedonsoto-zrb.com"
    fi
fi

echo "📋 Configuración seleccionada:"
echo "  • Docker Compose: $COMPOSE_FILE"
echo "  • Nginx Config: $NGINX_CONFIG"
echo "  • URLs de acceso: $ACCESS_URLS"

# 3. LIMPIAR SERVICIOS PREVIOS
echo ""
echo "🧹 3. Limpiando servicios previos..."

# Detener todos los contenedores Docker del proyecto
docker-compose -f docker-compose.ec2.yml down --remove-orphans 2>/dev/null || true
docker-compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
docker-compose -f docker-compose.alt-ports.yml down --remove-orphans 2>/dev/null || true
docker-compose -f docker-compose.ssl.yml down --remove-orphans 2>/dev/null || true

# Limpiar sistema Docker
docker system prune -f

echo "✅ Limpieza completada"

# 4. PREPARAR CONFIGURACIÓN NGINX
echo ""
echo "⚙️  4. Preparando configuración nginx..."

# Respaldar configuración actual
if [ -f "nginx/conf.d/default.conf" ]; then
    cp nginx/conf.d/default.conf nginx/conf.d/default.conf.backup
fi

# Copiar configuración apropiada
if [ "$DEPLOYMENT_STRATEGY" = "alternative" ] && [ -f "nginx/conf.d/alt-ports.conf" ]; then
    echo "🔄 Usando configuración de puertos alternativos"
    cp nginx/conf.d/alt-ports.conf nginx/conf.d/default.conf
else
    echo "🔄 Usando configuración estándar"
    # La configuración estándar ya debería estar en default.conf
fi

# 5. BUILD FRONTEND
echo ""
echo "🏗️  5. Building frontend..."
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

cd ..
echo "✅ Frontend build completado"

# 6. DEPLOY SERVICIOS
echo ""
echo "🚀 6. Desplegando servicios..."

# Verificar que el archivo compose existe
if [ ! -f "$COMPOSE_FILE" ]; then
    echo "❌ Error: $COMPOSE_FILE no encontrado"
    exit 1
fi

echo "🔨 Construyendo imágenes..."
docker-compose -f "$COMPOSE_FILE" build --no-cache

echo "🔄 Levantando servicios..."
docker-compose -f "$COMPOSE_FILE" up -d

echo "⏳ Esperando inicialización..."
sleep 25

# 7. VERIFICAR FUNCIONAMIENTO
echo ""
echo "🔍 7. Verificando funcionamiento..."

echo "📊 Estado de contenedores:"
docker-compose -f "$COMPOSE_FILE" ps

# Definir puertos para pruebas según estrategia
if [ "$DEPLOYMENT_STRATEGY" = "alternative" ]; then
    HTTP_PORT="8080"
    HTTPS_PORT="8443"
else
    HTTP_PORT="80"
    HTTPS_PORT="443"
fi

# Esperar un poco más para Django
sleep 15

echo ""
echo "🧪 Ejecutando pruebas de conectividad..."

# Probar backend directo
echo "🔍 Backend directo (puerto 8000):"
HEALTH_DIRECT=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health/ 2>/dev/null || echo "000")
echo "  📊 HTTP $HEALTH_DIRECT"

# Probar a través de nginx HTTP
echo "🔍 Nginx HTTP (puerto $HTTP_PORT):"
HEALTH_HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$HTTP_PORT/api/v1/health/ 2>/dev/null || echo "000")
echo "  📊 HTTP $HEALTH_HTTP"

# Probar endpoint de tables
echo "🔍 Tables endpoint:"
TABLES_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$HTTP_PORT/api/v1/config/tables/ 2>/dev/null || echo "000")
echo "  📊 HTTP $TABLES_TEST"

# 8. RESULTADOS FINALES
echo ""
echo "🎯 RESULTADOS DEL DEPLOYMENT"
echo "============================="

if [[ "$HEALTH_DIRECT" == "200" ]] && [[ "$HEALTH_HTTP" == "200" ]] && [[ "$TABLES_TEST" == "200" ]]; then
    echo "🎉 ¡DEPLOYMENT EXITOSO!"
    echo ""
    echo "🌐 URLs de acceso:"
    if [ "$DEPLOYMENT_STRATEGY" = "alternative" ]; then
        echo "  • Frontend HTTP: http://www.xn--elfogndedonsoto-zrb.com:8080"
        echo "  • Frontend HTTPS: https://www.xn--elfogndedonsoto-zrb.com:8443"
        echo "  • API Base: http://www.xn--elfogndedonsoto-zrb.com:8080/api/v1/"
        echo "  • Health Check: http://www.xn--elfogndedonsoto-zrb.com:8080/api/v1/health/"
    else
        echo "  • Frontend HTTP: http://www.xn--elfogndedonsoto-zrb.com"
        echo "  • Frontend HTTPS: https://www.xn--elfogndedonsoto-zrb.com"
        echo "  • API Base: https://www.xn--elfogndedonsoto-zrb.com/api/v1/"
        echo "  • Health Check: https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/"
    fi
    echo ""
    echo "✅ Los errores 404 de API deberían estar resueltos"
    
else
    echo "❌ PROBLEMAS EN EL DEPLOYMENT"
    echo ""
    echo "📊 Estado de pruebas:"
    echo "  • Backend directo: $HEALTH_DIRECT"
    echo "  • Nginx HTTP: $HEALTH_HTTP"
    echo "  • Tables endpoint: $TABLES_TEST"
    echo ""
    echo "📋 Para diagnóstico:"
    echo "  docker-compose -f $COMPOSE_FILE logs web"
    echo "  docker-compose -f $COMPOSE_FILE logs nginx"
fi

echo ""
echo "🔧 Comandos útiles:"
echo "  • Ver logs: docker-compose -f $COMPOSE_FILE logs"
echo "  • Reiniciar: docker-compose -f $COMPOSE_FILE restart"
echo "  • Parar: docker-compose -f $COMPOSE_FILE down"
echo ""
echo "✅ Smart deployment completado"