#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 START PRODUCTION SERVICES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "🚀 INICIANDO SERVICIOS DE PRODUCCIÓN"
echo "===================================="

cd "${PROJECT_DIR}"

# Verificar archivos necesarios
required_files=(
    "docker-compose.production.yml"
    ".env.production"
    "frontend/dist/index.html"
)

echo "🔍 Verificando archivos requeridos..."
for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Error: $file no encontrado"
        exit 1
    fi
    echo "   ✅ $file"
done

# Detener servicios anteriores si están corriendo
echo "🛑 Deteniendo servicios anteriores..."
docker-compose -f docker-compose.production.yml down 2>/dev/null || true

# Esperar un momento
sleep 3

# Limpiar volúmenes de contenedores anteriores
echo "🧹 Limpiando recursos Docker anteriores..."
docker system prune -f

# Verificar espacio en disco antes de iniciar
echo "💾 Verificando espacio en disco..."
AVAILABLE_SPACE=$(df /home/ubuntu | awk 'NR==2{print $4}')
if [ $AVAILABLE_SPACE -lt 1000000 ]; then # Menos de 1GB disponible
    echo "⚠️  Advertencia: Espacio en disco bajo ($(df -h /home/ubuntu | awk 'NR==2{print $4}') disponible)"
    read -p "¿Continuar de todos modos? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Construir y iniciar servicios de producción
echo "🏗️  Construyendo servicios de producción..."
docker-compose -f docker-compose.production.yml build --no-cache

echo "🚀 Iniciando servicios en segundo plano..."
docker-compose -f docker-compose.production.yml up -d

# Esperar a que los servicios estén listos
echo "⏳ Esperando a que los servicios estén listos..."
sleep 10

# Verificar estado de los contenedores
echo "🔍 Verificando estado de los contenedores..."
docker-compose -f docker-compose.production.yml ps

# Función para verificar la salud de un servicio
check_service_health() {
    local service_name=$1
    local url=$2
    local max_attempts=30
    local attempt=1
    
    echo "🏥 Verificando salud de $service_name..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" > /dev/null 2>&1; then
            echo "   ✅ $service_name está funcionando"
            return 0
        fi
        
        echo "   ⏳ Intento $attempt/$max_attempts - Esperando $service_name..."
        sleep 5
        ((attempt++))
    done
    
    echo "   ❌ $service_name no responde después de $max_attempts intentos"
    return 1
}

# Verificar backend Django
if ! check_service_health "Backend Django" "http://localhost:8000/api/v1/health/"; then
    echo "🔍 Logs del backend:"
    docker-compose -f docker-compose.production.yml logs --tail=20 restaurant-web-backend
    exit 1
fi

# Verificar Nginx
if ! check_service_health "Nginx" "http://localhost/health"; then
    echo "🔍 Logs de Nginx:"
    docker-compose -f docker-compose.production.yml logs --tail=20 restaurant-web-nginx
    exit 1
fi

# Verificar acceso HTTPS si está configurado
DOMAIN="www.xn--elfogndedonsoto-zrb.com"
if [ -f "/etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com/fullchain.pem" ]; then
    echo "🔒 Verificando acceso HTTPS..."
    if curl -k -f -s "https://$DOMAIN/health" > /dev/null 2>&1; then
        echo "   ✅ HTTPS funcionando correctamente"
    else
        echo "   ⚠️  HTTPS no está respondiendo - verificar configuración SSL"
    fi
fi

# Mostrar información de los servicios
echo ""
echo "📊 ESTADO DE LOS SERVICIOS"
echo "=========================="
docker-compose -f docker-compose.production.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

# Mostrar logs recientes para verificar que todo está funcionando
echo ""
echo "📋 LOGS RECIENTES"
echo "================"
echo "🔧 Backend (últimas 5 líneas):"
docker-compose -f docker-compose.production.yml logs --tail=5 restaurant-web-backend | sed 's/^/   /'

echo ""
echo "🌐 Nginx (últimas 5 líneas):"
docker-compose -f docker-compose.production.yml logs --tail=5 restaurant-web-nginx | sed 's/^/   /'

# Información de conectividad
echo ""
echo "🌍 ACCESO A LA APLICACIÓN"
echo "========================"
echo "🏠 Local (servidor):"
echo "   - Backend: http://localhost:8000"
echo "   - Frontend: http://localhost"
echo ""
echo "🌐 Público:"
echo "   - HTTPS: https://$DOMAIN"
echo "   - HTTP (redirige): http://$DOMAIN"
echo ""
echo "🔧 Admin Django:"
echo "   - https://$DOMAIN/admin/"
echo "   - Usuario: admin"
echo "   - Contraseña: admin123"
echo ""

# Crear script de monitoreo
echo "📋 Creando script de monitoreo..."
cat > monitor-services.sh << 'EOF'
#!/bin/bash
echo "🔍 Estado de servicios $(date)"
echo "================================"
docker-compose -f docker-compose.production.yml ps
echo ""
echo "💾 Uso de recursos:"
echo "CPU y Memoria:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
echo ""
echo "📊 Espacio en disco:"
df -h /home/ubuntu
echo ""
echo "🌐 Verificación de conectividad:"
curl -s -o /dev/null -w "Backend: %{http_code}\n" http://localhost:8000/api/v1/health/
curl -s -o /dev/null -w "Nginx: %{http_code}\n" http://localhost/health
if [ -f "/etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com/fullchain.pem" ]; then
    curl -k -s -o /dev/null -w "HTTPS: %{http_code}\n" https://www.xn--elfogndedonsoto-zrb.com/health
fi
EOF

chmod +x monitor-services.sh

echo ""
echo "✅ SERVICIOS INICIADOS CORRECTAMENTE"
echo "===================================="
echo "🎯 Tu aplicación está funcionando en producción"
echo "🌐 Acceso público: https://$DOMAIN"
echo "📊 Monitoreo: ./monitor-services.sh"
echo "🔧 Logs en tiempo real: docker-compose -f docker-compose.production.yml logs -f"
echo ""
echo "🚨 COMANDOS ÚTILES"
echo "=================="
echo "Ver logs:      docker-compose -f docker-compose.production.yml logs -f"
echo "Reiniciar:     docker-compose -f docker-compose.production.yml restart"
echo "Detener:       docker-compose -f docker-compose.production.yml down"
echo "Estado:        docker-compose -f docker-compose.production.yml ps"
echo "Monitorear:    ./monitor-services.sh"
echo ""