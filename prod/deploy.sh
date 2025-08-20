#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DEPLOYMENT - Restaurant Web (Dev → Prod EC2)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e
cd "$(dirname "$0")/.."

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    case $1 in
        ERROR) echo -e "${RED}❌ $2${NC}" ;;
        SUCCESS) echo -e "${GREEN}✅ $2${NC}" ;;
        WARNING) echo -e "${YELLOW}⚠️  $2${NC}" ;;
        INFO) echo -e "${BLUE}ℹ️  $2${NC}" ;;
    esac
}

show_usage() {
    echo "Uso: $0 [OPCION]"
    echo ""
    echo "Opciones:"
    echo "  --full        Deploy completo a producción"
    echo "  --sync        Deploy + sincronizar BD (dev → prod)"
    echo "  --build       Solo build del frontend"
    echo "  --check       Verificar salud del sistema"
    echo "  --rollback    Rollback a versión anterior"
    echo "  --help        Mostrar esta ayuda"
}

echo "🚀 DEPLOYMENT - RESTAURANT WEB"
echo "==============================="

# Procesar argumentos
case "${1:-}" in
    --full)
        DEPLOY_TYPE="full"
        ;;
    --sync)
        DEPLOY_TYPE="sync"
        ;;
    --build)
        DEPLOY_TYPE="build"
        ;;
    --check)
        DEPLOY_TYPE="check"
        ;;
    --rollback)
        DEPLOY_TYPE="rollback"
        ;;
    --help)
        show_usage
        exit 0
        ;;
    "")
        log ERROR "Se requiere una opción"
        show_usage
        exit 1
        ;;
    *)
        log ERROR "Opción desconocida: $1"
        show_usage
        exit 1
        ;;
esac

# Validaciones base
log INFO "Validando prerrequisitos..."
command -v docker >/dev/null || { log ERROR "Docker no instalado"; exit 1; }
command -v npm >/dev/null || { log ERROR "npm no instalado"; exit 1; }

# Solo check
if [ "$DEPLOY_TYPE" = "check" ]; then
    log INFO "Verificando salud del sistema..."
    echo ""
    echo "📊 Estado de contenedores:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep restaurant || echo "No hay contenedores corriendo"
    echo ""
    
    if docker exec restaurant-backend curl -s http://localhost:8000/api/v1/health/ &>/dev/null; then
        log SUCCESS "Backend responde correctamente"
    else
        log ERROR "Backend no responde"
    fi
    
    if docker ps | grep -q restaurant-nginx; then
        if docker exec restaurant-nginx nginx -t &>/dev/null; then
            log SUCCESS "Nginx configuración válida"
        else
            log ERROR "Error en configuración Nginx"
        fi
    fi
    exit 0
fi

# Solo build
if [ "$DEPLOY_TYPE" = "build" ]; then
    log INFO "Construyendo frontend..."
    cd frontend
    npm ci --prefer-offline
    npm run build
    cd ..
    log SUCCESS "Frontend construido en frontend/dist/"
    exit 0
fi

# Rollback
if [ "$DEPLOY_TYPE" = "rollback" ]; then
    log WARNING "Iniciando rollback..."
    
    # Buscar último backup
    BACKUP_FILE=$(ls -t data/backup_prod_*.sqlite3 2>/dev/null | head -1)
    if [ -n "$BACKUP_FILE" ]; then
        log INFO "Restaurando BD desde: $BACKUP_FILE"
        cp "$BACKUP_FILE" data/restaurant_prod.sqlite3
        docker-compose restart app
        log SUCCESS "Rollback completado"
    else
        log ERROR "No se encontraron backups para rollback"
        exit 1
    fi
    exit 0
fi

# Deploy completo o con sync
log INFO "Iniciando deploy: $DEPLOY_TYPE"

# Verificar cambios git
if [ -n "$(git status --porcelain)" ]; then
    log WARNING "Hay cambios sin commitear. ¿Continuar? (s/N)"
    read -r response
    if [[ ! "$response" =~ ^[sS]$ ]]; then
        log ERROR "Deploy cancelado"
        exit 1
    fi
fi

# Backup de BD producción
if [ -f "data/restaurant_prod.sqlite3" ]; then
    log INFO "Creando backup de producción..."
    cp data/restaurant_prod.sqlite3 "data/backup_prod_$(date +%Y%m%d_%H%M%S).sqlite3"
fi

# Sync BD si se requiere
if [ "$DEPLOY_TYPE" = "sync" ]; then
    log WARNING "¿Confirmar sync BD dev → prod? (s/N)"
    read -r response
    if [[ ! "$response" =~ ^[sS]$ ]]; then
        log ERROR "Sync cancelado"
        exit 1
    fi
    
    log INFO "Sincronizando base de datos..."
    cp data/restaurant_dev.sqlite3 data/restaurant_prod.sqlite3
fi

# Build frontend
log INFO "Construyendo frontend..."
cd frontend
npm ci --prefer-offline
npm run build
cd ..

# Deploy containers
log INFO "Desplegando containers..."
docker-compose down

# Ensure nginx uses SSL configuration  
log INFO "Configurando nginx para SSL..."
sed -i 's|./nginx/conf.d/simple.conf:/etc/nginx/conf.d/default.conf|./nginx/conf.d/ssl.conf:/etc/nginx/conf.d/default.conf|' docker-compose.yml

# Start with production profile
log INFO "Iniciando servicios de producción..."
docker-compose --profile production up -d

# Esperar backend
log INFO "Esperando backend..."
for i in {1..30}; do
    if docker exec restaurant-backend python -c "import django; print('OK')" &>/dev/null 2>&1; then
        break
    fi
    sleep 1
done

# Migraciones
log INFO "Aplicando migraciones..."
if ! docker exec restaurant-backend python /app/backend/manage.py migrate; then
    log WARNING "Aplicando fixes conocidos..."
    docker exec restaurant-backend python /app/backend/manage.py migrate config 0013 --fake 2>/dev/null || true
    docker exec restaurant-backend python /app/backend/manage.py migrate operation 0021 --fake 2>/dev/null || true
    docker exec restaurant-backend python /app/backend/manage.py migrate
fi

# Health check
log INFO "Verificando despliegue..."
sleep 5

if docker exec restaurant-backend curl -s http://localhost:8000/api/v1/health/ &>/dev/null; then
    log SUCCESS "Backend funcionando"
else
    log ERROR "Error en backend"
    exit 1
fi

if docker exec restaurant-nginx nginx -t &>/dev/null; then
    log SUCCESS "Nginx funcionando"
else
    log ERROR "Error en Nginx"
    exit 1
fi

# Resultado final
echo ""
log SUCCESS "🎉 DEPLOY COMPLETADO"
echo ""
echo "🌐 URLs de producción:"
echo "   🏠 Sitio: https://www.xn--elfogndedonsoto-zrb.com/"
echo "   🔧 API:   https://www.xn--elfogndedonsoto-zrb.com/api/v1/"
echo ""
echo "🔧 Monitoreo:"
echo "   📋 Logs: docker-compose logs app nginx -f"
echo "   ❤️  Check: ./prod/deploy.sh --check"
echo ""
echo "✨ Sistema en producción"