#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DEPLOYMENT - Restaurant Web (Dev → Prod EC2) - SIMPLIFIED & EFFECTIVE
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

# 🌐 EC2 Configuration
EC2_HOST="ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com"
EC2_KEY="ubuntu_fds_key.pem"
EC2_PATH="/opt/restaurant-web"

show_usage() {
    cat << EOF
🚀 DEPLOYMENT - Restaurant Web (Dev → Prod)

Uso: $0 [OPCION]

Opciones:
  --full        Deploy completo a producción (RECOMENDADO)
  --sync        Deploy + sincronizar BD (dev → prod) [DESTRUCTIVO]
  --check       Verificar salud del sistema
  --rollback    Rollback a versión anterior
  --help        Mostrar esta ayuda

Ejemplos:
  $0 --full     # Deploy completo (cambios de código)
  $0 --sync     # Deploy con datos (menú/configuración)
  $0 --check    # Verificar estado
EOF
}

echo "🚀 DEPLOYMENT - RESTAURANT WEB"
echo "================================="

# 📋 Process arguments
case "${1:-}" in
    --full) DEPLOY_TYPE="full" ;;
    --sync) DEPLOY_TYPE="sync" ;;
    --check) DEPLOY_TYPE="check" ;;
    --rollback) DEPLOY_TYPE="rollback" ;;
    --help) show_usage; exit 0 ;;
    "") error "Se requiere una opción"; show_usage; exit 1 ;;
    *) error "Opción desconocida: $1"; show_usage; exit 1 ;;
esac

# 📋 Prerequisites validation
info "Validando prerrequisitos..."
command -v git >/dev/null || { error "Git no instalado"; exit 1; }
command -v npm >/dev/null || { error "npm no instalado"; exit 1; }
command -v ssh >/dev/null || { error "SSH no instalado"; exit 1; }
command -v scp >/dev/null || { error "SCP no instalado"; exit 1; }

# 🔍 Health check via SSH
if [ "$DEPLOY_TYPE" = "check" ]; then
    info "Verificando salud del sistema..."
    
    ssh -i "$EC2_KEY" "$EC2_HOST" "cd $EC2_PATH && /usr/local/bin/docker-compose ps" 2>/dev/null && success "Sistema funcionando correctamente" || error "Error en el sistema"
    
    # Test web response
    if curl -s -o /dev/null -w "%{http_code}" https://www.xn--elfogndedonsoto-zrb.com/ | grep -q 200; then
        success "Sitio web accesible"
    else
        error "Sitio web no accesible"
    fi
    exit 0
fi

# 🔄 Rollback via SSH
if [ "$DEPLOY_TYPE" = "rollback" ]; then
    warning "Iniciando rollback..."
    
    ssh -i "$EC2_KEY" "$EC2_HOST" "cd $EC2_PATH && BACKUP_FILE=\$(ls -t data/backup_prod_*.sqlite3 2>/dev/null | head -1) && if [ -n \"\$BACKUP_FILE\" ]; then cp \"\$BACKUP_FILE\" data/restaurant_prod.sqlite3 && /usr/local/bin/docker-compose restart app; echo 'Rollback completado'; else echo 'No hay backups'; exit 1; fi"
    
    success "Rollback completado"
    exit 0
fi

# 🚀 Main deployment logic
info "Iniciando deploy: $DEPLOY_TYPE"

# 📝 Git status check and auto-commit
if [ -n "$(git status --porcelain)" ]; then
    warning "Hay cambios sin commitear. ¿Continuar y auto-commitear? (s/N)"
    read -r response
    if [[ "$response" =~ ^[sS]$ ]]; then
        info "Auto-commiteando cambios..."
        git add -A
        git commit -m "deploy: Automatic commit before deployment

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
        git push origin main
    else
        error "Deploy cancelado"
        exit 1
    fi
fi

# 🔄 Database sync
if [ "$DEPLOY_TYPE" = "sync" ]; then
    if [ ! -f "data/restaurant_dev.sqlite3" ]; then
        error "Archivo restaurant_dev.sqlite3 no encontrado"
        exit 1
    fi
    
    warning "⚠️  OPERACIÓN DESTRUCTIVA: Reemplazar BD producción con desarrollo"
    echo "   ¿Confirmar sincronización? (s/N)"
    read -r response
    if [[ ! "$response" =~ ^[sS]$ ]]; then
        error "Sync cancelado"
        exit 1
    fi
fi

# 🏗️ Build frontend locally
info "Construyendo frontend localmente..."
cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ] || [ "package-lock.json" -nt "node_modules" ]; then
    info "Instalando dependencias..."
    npm install
fi

# Build frontend
npm run build
cd ..
success "Frontend construido"

# 📤 Deploy to EC2
info "Desplegando a EC2..."

# 1. Update code on server
info "Actualizando código en servidor..."
ssh -i "$EC2_KEY" "$EC2_HOST" "cd $EC2_PATH && git pull origin main"

# 2. Copy frontend build to server
info "Copiando archivos de frontend..."
scp -i "$EC2_KEY" -r frontend/dist/* "$EC2_HOST:$EC2_PATH/frontend/dist/"

# 3. Copy database if sync
if [ "$DEPLOY_TYPE" = "sync" ]; then
    info "Sincronizando base de datos..."
    # Create backup on server first
    ssh -i "$EC2_KEY" "$EC2_HOST" "cd $EC2_PATH && cp data/restaurant_prod.sqlite3 data/backup_prod_\$(date +%Y%m%d_%H%M%S).sqlite3 2>/dev/null || true"
    # Copy dev database to prod
    scp -i "$EC2_KEY" data/restaurant_dev.sqlite3 "$EC2_HOST:$EC2_PATH/data/restaurant_prod.sqlite3"
fi

# 4. Restart services on server
info "Reiniciando servicios..."
ssh -i "$EC2_KEY" "$EC2_HOST" "cd $EC2_PATH && /usr/local/bin/docker-compose restart app nginx"

# 5. Wait for services to be ready
info "Esperando servicios..."
sleep 10

# 6. Verify deployment
info "Verificando deployment..."
if curl -s -o /dev/null -w "%{http_code}" https://www.xn--elfogndedonsoto-zrb.com/ | grep -q 200; then
    success "Sitio web funcionando"
else
    error "Error: Sitio web no responde"
    exit 1
fi

# 🎉 Success
echo ""
success "🎉 DEPLOY COMPLETADO"
echo ""
echo "🌐 URLs de producción:"
echo "   🏠 Sitio: https://www.xn--elfogndedonsoto-zrb.com/"
echo "   🔧 API:   https://www.xn--elfogndedonsoto-zrb.com/api/v1/"
echo ""
echo "🔧 Comandos útiles:"
echo "   📋 Verificar: ./prod/deploy.sh --check"
echo "   🔄 Rollback: ./prod/deploy.sh --rollback"
echo ""
success "✨ Sistema desplegado exitosamente"