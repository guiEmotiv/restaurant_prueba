#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DEPLOYMENT - Restaurant Web (Dev → Prod EC2) - OPTIMIZED
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e
cd "$(dirname "$0")/.."

# 🎨 Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

log() { echo -e "${!1}${@:2}${NC}"; }
success() { log GREEN "✅ $1"; }
error() { log RED "❌ $1"; }
warning() { log YELLOW "⚠️  $1"; }
info() { log BLUE "ℹ️  $1"; }

# ⚡ Performance optimizations
export NODE_OPTIONS='--max-old-space-size=4096'
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

show_usage() {
    cat << EOF
🚀 DEPLOYMENT - Restaurant Web

Uso: $0 [OPCION]

Opciones:
  --full        Deploy completo a producción (recomendado)
  --sync        Deploy + sincronizar BD (dev → prod) [DESTRUCTIVO]
  --build       Solo build del frontend
  --quick       Deploy rápido (sin rebuild si no hay cambios)
  --check       Verificar salud del sistema
  --rollback    Rollback a versión anterior
  --help        Mostrar esta ayuda

Ejemplos:
  $0 --full     # Deploy completo normal
  $0 --quick    # Deploy inteligente (más rápido)
  $0 --check    # Verificar estado post-deploy
EOF
}

echo "🚀 DEPLOYMENT - RESTAURANT WEB (OPTIMIZED)"
echo "==========================================="

# 📋 Process arguments with optimized logic
case "${1:-}" in
    --full) DEPLOY_TYPE="full" ;;
    --sync) DEPLOY_TYPE="sync" ;;
    --build) DEPLOY_TYPE="build" ;;
    --quick) DEPLOY_TYPE="quick" ;;
    --check) DEPLOY_TYPE="check" ;;
    --rollback) DEPLOY_TYPE="rollback" ;;
    --help) show_usage; exit 0 ;;
    "") error "Se requiere una opción"; show_usage; exit 1 ;;
    *) error "Opción desconocida: $1"; show_usage; exit 1 ;;
esac

# ⚡ Parallel prerequisite validation
info "Validando prerrequisitos..."
{
    command -v docker >/dev/null || { error "Docker no instalado"; exit 1; }
    command -v npm >/dev/null || { error "npm no instalado"; exit 1; }
} &
wait

# 🔍 Health check (optimized)
if [ "$DEPLOY_TYPE" = "check" ]; then
    info "Verificando salud del sistema..."
    
    # Parallel health checks
    {
        if docker exec restaurant-backend curl -sf http://localhost:8000/api/v1/health/ >/dev/null; then
            success "Backend responde correctamente"
        else
            error "Backend no responde"
        fi
    } &
    
    {
        if docker ps | grep -q restaurant-nginx && docker exec restaurant-nginx nginx -t >/dev/null 2>&1; then
            success "Nginx configuración válida"
        else
            error "Error en configuración Nginx"
        fi
    } &
    
    wait
    
    echo ""
    echo "📊 Estado de contenedores:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | grep restaurant || echo "No hay contenedores corriendo"
    exit 0
fi

# 🏗️ Build only (optimized)
if [ "$DEPLOY_TYPE" = "build" ]; then
    info "Construyendo frontend..."
    cd frontend
    
    # Smart npm install
    if [ ! -d "node_modules" ] || [ "package-lock.json" -nt "node_modules" ]; then
        npm ci --prefer-offline --silent
    else
        info "Dependencias npm ya están actualizadas"
    fi
    
    npm run build
    cd ..
    success "Frontend construido en frontend/dist/"
    exit 0
fi

# 🔄 Rollback (improved)
if [ "$DEPLOY_TYPE" = "rollback" ]; then
    warning "Iniciando rollback..."
    
    BACKUP_FILE=$(ls -t data/backup_prod_*.sqlite3 2>/dev/null | head -1)
    if [ -n "$BACKUP_FILE" ]; then
        info "Restaurando BD desde: $(basename $BACKUP_FILE)"
        cp "$BACKUP_FILE" data/restaurant_prod.sqlite3
        docker-compose restart app >/dev/null
        success "Rollback completado"
    else
        error "No se encontraron backups para rollback"
        exit 1
    fi
    exit 0
fi

# 🚀 Main deployment logic
info "Iniciando deploy: $DEPLOY_TYPE"

# 📝 Git status check (optimized)
if [ -n "$(git status --porcelain)" ]; then
    warning "Hay cambios sin commitear. ¿Continuar? (s/N)"
    read -r response
    if [[ ! "$response" =~ ^[sS]$ ]]; then
        error "Deploy cancelado"
        exit 1
    fi
fi

# 💾 Smart backup
if [ -f "data/restaurant_prod.sqlite3" ]; then
    BACKUP_NAME="data/backup_prod_$(date +%Y%m%d_%H%M%S).sqlite3"
    info "Creando backup: $(basename $BACKUP_NAME)"
    cp data/restaurant_prod.sqlite3 "$BACKUP_NAME" &
fi

# 🔄 Database sync (with safety checks)
if [ "$DEPLOY_TYPE" = "sync" ]; then
    warning "⚠️  OPERACIÓN DESTRUCTIVA: Sync BD dev → prod"
    echo "   Esto reemplazará TODOS los datos de producción"
    echo "   ¿Confirmar sync BD dev → prod? (s/N)"
    read -r response
    if [[ ! "$response" =~ ^[sS]$ ]]; then
        error "Sync cancelado"
        exit 1
    fi
    
    if [ ! -f "data/restaurant_dev.sqlite3" ]; then
        error "Archivo restaurant_dev.sqlite3 no encontrado"
        exit 1
    fi
    
    info "Sincronizando base de datos..."
    cp data/restaurant_dev.sqlite3 data/restaurant_prod.sqlite3
fi

# 🏗️ Smart frontend build
should_build_frontend() {
    [ "$DEPLOY_TYPE" = "quick" ] || return 0
    
    # Check if build is needed
    [ ! -d "frontend/dist" ] && return 0
    [ "frontend/package-lock.json" -nt "frontend/dist" ] && return 0
    [ "frontend/src" -nt "frontend/dist" ] && return 0
    
    return 1
}

if should_build_frontend; then
    info "Construyendo frontend..."
    cd frontend
    
    # Parallel npm operations when possible
    if [ ! -d "node_modules" ] || [ "package-lock.json" -nt "node_modules" ]; then
        npm ci --prefer-offline --silent
    fi
    
    npm run build
    cd ..
else
    info "⚡ Frontend build skipped (no changes detected)"
fi

# 🐳 Optimized container deployment
info "Desplegando containers..."

# Parallel operations
{
    # Ensure SSL configuration
    sed -i.bak 's|./nginx/conf.d/simple.conf|./nginx/conf.d/ssl.conf|g' docker-compose.yml
} &

{
    # Graceful container shutdown
    docker-compose down --timeout 10 >/dev/null 2>&1
} &

wait

# Start services with optimized timing
info "Iniciando servicios de producción..."
docker-compose --profile production up -d

# ⏱️ Smart backend wait (optimized)
info "Esperando backend..."
for i in {1..20}; do
    if docker exec restaurant-backend python -c "import django" >/dev/null 2>&1; then
        break
    fi
    sleep 1
    [ $i -eq 10 ] && info "Backend tardando más de lo esperado..."
done

# 🔄 Intelligent migrations
info "Aplicando migraciones..."
if ! docker exec restaurant-backend python /app/backend/manage.py migrate --verbosity=0; then
    warning "Aplicando fixes conocidos..."
    
    # Parallel migration fixes
    {
        docker exec restaurant-backend python /app/backend/manage.py migrate config 0013 --fake >/dev/null 2>&1 || true
    } &
    {
        docker exec restaurant-backend python /app/backend/manage.py migrate operation 0021 --fake >/dev/null 2>&1 || true
    } &
    
    wait
    docker exec restaurant-backend python /app/backend/manage.py migrate --verbosity=0
fi

# 🏥 Parallel health checks
info "Verificando despliegue..."

{
    if docker exec restaurant-backend curl -sf http://localhost:8000/api/v1/health/ >/dev/null; then
        success "Backend funcionando"
    else
        error "Error en backend"
        exit 1
    fi
} &

{
    sleep 2  # Give nginx time to start
    if docker exec restaurant-nginx nginx -t >/dev/null 2>&1; then
        success "Nginx funcionando"
    else
        error "Error en Nginx"
        exit 1
    fi
} &

wait

# 🎉 Success output (optimized)
echo ""
success "🎉 DEPLOY COMPLETADO"
echo ""
echo "🌐 URLs de producción:"
echo "   🏠 Sitio: https://www.xn--elfogndedonsoto-zrb.com/"
echo "   🔧 API:   https://www.xn--elfogndedonsoto-zrb.com/api/v1/"
echo ""
echo "🔧 Comandos útiles:"
echo "   📋 Logs: docker-compose logs app nginx -f"
echo "   ❤️  Check: ./prod/deploy.sh --check"
echo "   ⚡ Quick: ./prod/deploy.sh --quick"
echo ""
echo "✨ Sistema en producción"