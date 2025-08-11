#!/bin/bash

# Restaurant Web - Fix Port 80 Conflict
# Soluciona el conflicto de puerto 80 en EC2

set -e

echo "🔧 SOLUCIONANDO CONFLICTO DE PUERTO 80"
echo "====================================="

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ Este script debe ejecutarse como root (sudo)"
   exit 1
fi

PROJECT_ROOT="/opt/restaurant-web"
cd "$PROJECT_ROOT"

echo "📍 Directorio del proyecto: $PROJECT_ROOT"

# 1. IDENTIFICAR Y DETENER SERVICIOS EN PUERTO 80
echo ""
echo "🔍 1. Identificando servicios que usan puerto 80..."

# Mostrar qué está usando el puerto 80
echo "📊 Servicios usando puerto 80:"
netstat -tulpn | grep :80 || echo "No se encontraron servicios obvios en puerto 80"
lsof -i :80 || echo "lsof no encontró procesos en puerto 80"

# Detener servicios comunes que pueden usar puerto 80
echo ""
echo "🛑 Deteniendo servicios potencialmente conflictivos..."

# Detener Apache si está corriendo
if systemctl is-active --quiet apache2 2>/dev/null; then
    echo "🔄 Deteniendo Apache..."
    systemctl stop apache2
    systemctl disable apache2
    echo "✅ Apache detenido y deshabilitado"
else
    echo "ℹ️  Apache no está corriendo"
fi

# Detener Nginx del sistema si está corriendo
if systemctl is-active --quiet nginx 2>/dev/null; then
    echo "🔄 Deteniendo Nginx del sistema..."
    systemctl stop nginx
    systemctl disable nginx
    echo "✅ Nginx del sistema detenido y deshabilitado"
else
    echo "ℹ️  Nginx del sistema no está corriendo"
fi

# Detener otros contenedores Docker que puedan usar puerto 80
echo "🔄 Deteniendo todos los contenedores Docker..."
docker stop $(docker ps -q) 2>/dev/null || echo "No hay contenedores corriendo"

# Limpiar contenedores huérfanos
docker system prune -f

echo "✅ Servicios detenidos"

# 2. VERIFICAR QUE EL PUERTO ESTÉ LIBRE
echo ""
echo "🔍 2. Verificando que el puerto 80 esté libre..."

PORT_CHECK=$(netstat -tulpn | grep :80 | wc -l)
if [ "$PORT_CHECK" -eq 0 ]; then
    echo "✅ Puerto 80 está libre"
else
    echo "❌ Puerto 80 aún está ocupado:"
    netstat -tulpn | grep :80
    echo ""
    echo "🔪 Intentando forzar liberación del puerto..."
    
    # Encontrar y matar procesos que usan puerto 80
    fuser -k 80/tcp 2>/dev/null || echo "No se encontraron procesos para matar"
    
    # Esperar un momento
    sleep 5
    
    # Verificar de nuevo
    PORT_CHECK_AFTER=$(netstat -tulpn | grep :80 | wc -l)
    if [ "$PORT_CHECK_AFTER" -eq 0 ]; then
        echo "✅ Puerto 80 liberado exitosamente"
    else
        echo "❌ No se pudo liberar el puerto 80. Procesos persistentes:"
        netstat -tulpn | grep :80
        echo ""
        echo "⚠️  Nota: Es posible que necesites reiniciar el servidor si el problema persiste"
    fi
fi

# 3. LIMPIAR CONFIGURACIONES DOCKER PREVIAS
echo ""
echo "🧹 3. Limpiando configuraciones Docker previas..."

# Detener y eliminar todos los contenedores relacionados
docker-compose -f docker-compose.ec2.yml down --remove-orphans 2>/dev/null || true
docker-compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
docker-compose -f docker-compose.ssl.yml down --remove-orphans 2>/dev/null || true

# Limpiar redes Docker
docker network prune -f

# Limpiar volúmenes no utilizados
docker volume prune -f

echo "✅ Limpieza completada"

# 4. REBUILD Y REDEPLOY CON CONFIGURACIÓN CORRECTA
echo ""
echo "🚀 4. Rebuilding y redeploying servicios..."

# Asegurarse de que tenemos el build más reciente del frontend
echo "🏗️  Building frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
fi
npm run build
cd ..

# Verificar que docker-compose.prod.yml existe
if [ ! -f "docker-compose.prod.yml" ]; then
    echo "❌ Error: docker-compose.prod.yml no encontrado"
    exit 1
fi

# Construir imágenes frescas
echo "🔨 Construyendo imágenes Docker..."
docker-compose -f docker-compose.prod.yml build --no-cache

# Esperar un momento para asegurar que todo esté limpio
sleep 3

# Levantar servicios
echo "🚀 Levantando servicios..."
docker-compose -f docker-compose.prod.yml up -d

# Esperar a que los servicios se inicialicen
echo "⏳ Esperando inicialización de servicios..."
sleep 20

echo "✅ Servicios levantados"

# 5. VERIFICAR FUNCIONAMIENTO
echo ""
echo "🔍 5. Verificando funcionamiento..."

# Mostrar estado de contenedores
echo "📊 Estado de contenedores:"
docker-compose -f docker-compose.prod.yml ps

# Verificar puertos en uso
echo ""
echo "📊 Puertos en uso:"
netstat -tulpn | grep -E ":(80|443|8000)" || echo "Ningún servicio en puertos web estándar"

# Probar conectividad
echo ""
echo "🧪 Pruebas de conectividad:"

# Esperar un poco más para Django
sleep 10

# Probar salud del backend directo
echo "🔍 Probando backend directo (puerto 8000)..."
HEALTH_DIRECT=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health/ 2>/dev/null || echo "000")
echo "📊 Backend directo: HTTP $HEALTH_DIRECT"

# Probar a través de nginx
echo "🔍 Probando nginx (puerto 80)..."
HEALTH_NGINX=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/health/ 2>/dev/null || echo "000")
echo "📊 Nginx proxy: HTTP $HEALTH_NGINX"

# Probar endpoint de configuración
echo "🔍 Probando endpoint de tables..."
TABLES_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/config/tables/ 2>/dev/null || echo "000")
echo "📊 Tables endpoint: HTTP $TABLES_TEST"

# 6. RESULTADOS Y RECOMENDACIONES
echo ""
echo "📋 RESUMEN DE RESULTADOS"
echo "========================"

if [[ "$HEALTH_DIRECT" == "200" ]] && [[ "$HEALTH_NGINX" == "200" ]]; then
    echo "✅ ÉXITO: Todos los servicios funcionando correctamente"
    echo "🌐 Frontend: https://www.xn--elfogndedonsoto-zrb.com"
    echo "🔗 API: https://www.xn--elfogndedonsoto-zrb.com/api/v1/"
    echo "🏥 Health: https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/"
    echo ""
    echo "🎉 El error 404 de API debería estar resuelto"
else
    echo "❌ PROBLEMAS DETECTADOS:"
    if [[ "$HEALTH_DIRECT" != "200" ]]; then
        echo "  • Backend Django no responde correctamente"
    fi
    if [[ "$HEALTH_NGINX" != "200" ]]; then
        echo "  • Nginx proxy no funciona correctamente"
    fi
    
    echo ""
    echo "📋 Para diagnóstico, revisar logs:"
    echo "  • docker-compose -f docker-compose.prod.yml logs web"
    echo "  • docker-compose -f docker-compose.prod.yml logs nginx"
fi

echo ""
echo "🔧 Para monitoreo continuo:"
echo "  • docker-compose -f docker-compose.prod.yml ps"
echo "  • curl http://localhost/api/v1/health/"
echo ""
echo "✅ Script completado"