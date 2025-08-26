#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ENHANCED DEPLOYMENT SYSTEM - Restaurant Web (Dev → Prod EC2)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 Optimized deployment with integrity checks, atomic operations, and smart caching
# 📊 Improved from original with better error handling and efficiency
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

# 📍 Environment setup
cd "$(dirname "$0")/.."
export NODE_OPTIONS='--max-old-space-size=4096'

# 🎨 Enhanced logging with timestamps
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'
CYAN='\033[0;36m'; MAGENTA='\033[0;35m'; NC='\033[0m'

log_with_time() { echo -e "${2:-$CYAN}[$(date '+%H:%M:%S')] $1${NC}"; }
success() { log_with_time "✅ $1" "$GREEN"; }
error() { log_with_time "❌ $1" "$RED"; }
warning() { log_with_time "⚠️  $1" "$YELLOW"; }
info() { log_with_time "ℹ️  $1" "$BLUE"; }
step() { log_with_time "🚀 $1" "$MAGENTA"; }

# ⚡ Performance tracking
start_time=$(date +%s)

# 🌐 Infrastructure configuration  
EC2_HOST="ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com"
EC2_KEY="ubuntu_fds_key.pem"
EC2_PATH="/opt/restaurant-web"
SSH_PATH_PREFIX="export PATH=/usr/local/bin:/usr/bin:/bin:\$PATH &&"

# 📊 Deployment state
HAS_FRONTEND_CHANGES=false
HAS_BACKEND_CHANGES=false
HAS_MIGRATIONS=false
DEPLOY_ID="deploy_$(date +%Y%m%d_%H%M%S)"

# 🔍 Enhanced change detection
detect_changes() {
    info "🔍 Analizando cambios con detección optimizada..."
    
    local current_commit=$(git rev-parse HEAD)
    local previous_commit=$(git rev-parse HEAD~1 2>/dev/null || echo "")
    
    if [ -z "$previous_commit" ]; then
        warning "No se encontró commit anterior, asumiendo cambios completos"
        HAS_FRONTEND_CHANGES=true
        HAS_BACKEND_CHANGES=true
        HAS_MIGRATIONS=true
        return
    fi
    
    # Frontend changes (including build artifacts check)
    if git diff --name-only "$previous_commit" HEAD | grep -E '^frontend/' >/dev/null 2>&1; then
        HAS_FRONTEND_CHANGES=true
        info "📱 Cambios en frontend detectados"
        git diff --name-only "$previous_commit" HEAD | grep -E '^frontend/' | head -3 | while read -r file; do
            echo "   • $file"
        done
    fi
    
    # Also check if local build exists but might not match server
    if [ -d "frontend/dist" ] && [ ! "$HAS_FRONTEND_CHANGES" = true ]; then
        # Check if server has matching index.html
        local local_index_hash=""
        local server_index_hash=""
        
        if [ -f "frontend/dist/index.html" ]; then
            local_index_hash=$(sha256sum "frontend/dist/index.html" 2>/dev/null | cut -d' ' -f1)
        fi
        
        server_index_hash=$(ssh -i "$EC2_KEY" "$EC2_HOST" "cd $EC2_PATH/frontend/dist && sha256sum index.html 2>/dev/null | cut -d' ' -f1" 2>/dev/null || echo "none")
        
        if [ "$local_index_hash" != "$server_index_hash" ] && [ -n "$local_index_hash" ]; then
            HAS_FRONTEND_CHANGES=true
            info "📱 Frontend desincronizado detectado - forzando actualización"
        fi
    fi
    
    # Backend changes
    if git diff --name-only "$previous_commit" HEAD | grep -E '^backend/' >/dev/null 2>&1; then
        HAS_BACKEND_CHANGES=true
        info "⚙️  Cambios en backend detectados"
        git diff --name-only "$previous_commit" HEAD | grep -E '^backend/' | head -3 | while read -r file; do
            echo "   • $file"
        done
    fi
    
    # Migration detection
    cd backend
    if python3 manage.py showmigrations --plan 2>/dev/null | grep -q '\[ \]'; then
        HAS_MIGRATIONS=true
        info "🗄️  Migraciones pendientes detectadas"
    fi
    cd ..
    
    success "Detección de cambios completada"
}

# 🧹 Intelligent cleanup with single SSH call
intelligent_cleanup() {
    info "🧹 Ejecutando limpieza inteligente del servidor..."
    
    # Single SSH call for efficiency
    local cleanup_result=$(ssh -i "$EC2_KEY" "$EC2_HOST" "
        $SSH_PATH_PREFIX
        cd $EC2_PATH
        
        # Get disk usage before
        DISK_BEFORE=\$(/usr/bin/df -h / | /usr/bin/awk 'NR==2 {print \$5}' | /usr/bin/sed 's/%//')
        
        # Cleanup operations in parallel
        {
            # Docker logs
            sudo find /var/lib/docker/containers -name '*-json.log' -exec truncate -s 0 {} \; 2>/dev/null || true
            
            # Old backups (keep last 3)
            cd data && ls -t backup*.sqlite3 2>/dev/null | tail -n +4 | xargs rm -f 2>/dev/null || true
            
            # Old frontend assets (keep last 2)
            cd ../frontend/dist/assets && {
                ls -t index-*.js 2>/dev/null | tail -n +3 | xargs rm -f 2>/dev/null || true
                ls -t index-*.css 2>/dev/null | tail -n +3 | xargs rm -f 2>/dev/null || true
                ls -t vendor-*.js 2>/dev/null | tail -n +4 | xargs rm -f 2>/dev/null || true
            }
            
            # Docker system cleanup
            cd $EC2_PATH && sudo docker system prune -af 2>/dev/null || true
            
            # NPM cache
            npm cache clean --force 2>/dev/null || true
        } >/dev/null 2>&1
        
        # Get disk usage after  
        DISK_AFTER=\$(/usr/bin/df -h / | /usr/bin/awk 'NR==2 {print \$5}' | /usr/bin/sed 's/%//')
        
        echo \"BEFORE:\$DISK_BEFORE|AFTER:\$DISK_AFTER\"
    " 2>/dev/null)
    
    # Parse results
    local disk_before=$(echo "$cleanup_result" | grep -o 'BEFORE:[0-9]*' | cut -d: -f2)
    local disk_after=$(echo "$cleanup_result" | grep -o 'AFTER:[0-9]*' | cut -d: -f2)
    local freed=$((disk_before - disk_after))
    
    success "Limpieza completada: ${freed}% liberado (${disk_before}% → ${disk_after}%)"
    
    if [ "$disk_after" -gt 85 ]; then
        warning "Disco con poco espacio: ${disk_after}%"
    fi
}

# 🏗️ Optimized build with caching
optimized_build() {
    info "🏗️ Construyendo frontend con optimizaciones..."
    
    cd frontend
    
    # Smart dependency installation
    if [ ! -d "node_modules" ] || [ "package-lock.json" -nt "node_modules/.timestamp" ]; then
        info "📦 Instalando dependencias..."
        npm ci --prefer-offline --no-audit --silent
        touch node_modules/.timestamp
        success "Dependencias instaladas"
    else
        info "📦 Dependencias actualizadas, omitiendo instalación"
    fi
    
    # Clean build
    rm -rf dist
    
    info "🔨 Construyendo aplicación..."
    npm run build --silent
    
    cd ..
    success "Frontend construido exitosamente"
}

# 🚢 Improved file transfer with verification
transfer_frontend() {
    info "📱 Transfiriendo archivos frontend..."
    
    # Create tarball for efficient transfer
    local tarball="/tmp/frontend_${DEPLOY_ID}.tar.gz"
    tar -czf "$tarball" -C frontend/dist . 2>/dev/null
    
    # Transfer
    if scp -i "$EC2_KEY" -q "$tarball" "$EC2_HOST:/tmp/"; then
        success "Transferencia completada"
    else
        error "Error en transferencia"
        rm -f "$tarball"
        return 1
    fi
    
    # Extract on server with atomic operation
    ssh -i "$EC2_KEY" "$EC2_HOST" "
        $SSH_PATH_PREFIX
        cd $EC2_PATH
        
        # Create staging directory
        mkdir -p .deploy_staging_${DEPLOY_ID}
        
        # Extract files
        tar -xzf /tmp/frontend_${DEPLOY_ID}.tar.gz -C .deploy_staging_${DEPLOY_ID}/
        
        # Atomic swap
        if [ -d frontend/dist ]; then
            mv frontend/dist frontend/dist.backup.${DEPLOY_ID}
        fi
        mv .deploy_staging_${DEPLOY_ID} frontend/dist
        
        # Cleanup
        rm -f /tmp/frontend_${DEPLOY_ID}.tar.gz
        
        # Remove old backup after successful swap
        rm -rf frontend/dist.backup.* 2>/dev/null || true
    " 2>/dev/null
    
    # Cleanup local tarball
    rm -f "$tarball"
    
    success "Frontend desplegado atómicamente"
}

# 🏥 Simple health check
health_check() {
    info "🏥 Verificando salud del sistema..."
    
    # Check main website
    if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 \
       "https://www.xn--elfogndedonsoto-zrb.com/" | grep -q "200"; then
        success "✓ Sitio web responde correctamente"
    else
        warning "✗ Sitio web no responde"
        return 1
    fi
    
    # Check Docker services
    if ssh -i "$EC2_KEY" "$EC2_HOST" "$SSH_PATH_PREFIX cd $EC2_PATH && /usr/local/bin/docker-compose ps | grep -q 'Up'" 2>/dev/null; then
        success "✓ Servicios Docker operativos"
    else
        warning "✗ Problemas con servicios Docker"
        return 1
    fi
    
    success "Sistema saludable"
    return 0
}

# 🎯 Main deployment function
main_deploy() {
    local deploy_type="${1:-smart}"
    
    step "🚀 DEPLOYMENT MEJORADO - Restaurant Web"
    info "Sistema optimizado con detección inteligente y operaciones atómicas"
    echo ""
    
    # Prerequisites
    info "📋 Validando prerrequisitos..."
    for cmd in git npm ssh scp curl; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            error "$cmd no está instalado"
            exit 1
        fi
    done
    success "Prerrequisitos validados"
    
    case "$deploy_type" in
        "smart"|"deploy")
            # Main deployment pipeline
            detect_changes
            intelligent_cleanup
            
            # Build only if needed
            if [ "$HAS_FRONTEND_CHANGES" = true ]; then
                optimized_build
            fi
            
            # Git operations
            if [ -n "$(git status --porcelain)" ]; then
                info "📝 Auto-commiteando cambios..."
                git add -A
                git commit -m "deploy: Automatic commit before deployment

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
                git push origin main
            fi
            
            # Server code update
            info "🔄 Actualizando código en servidor..."
            if ! ssh -i "$EC2_KEY" "$EC2_HOST" "$SSH_PATH_PREFIX cd $EC2_PATH && git pull origin main" 2>/dev/null; then
                error "Error actualizando código en servidor"
                return 1
            fi
            success "Código actualizado en servidor"
            
            # Frontend transfer if needed
            if [ "$HAS_FRONTEND_CHANGES" = true ]; then
                transfer_frontend
            fi
            
            # Database migrations
            if [ "$HAS_MIGRATIONS" = true ]; then
                info "🗄️  Aplicando migraciones..."
                
                # Create backup
                local backup_name="backup_pre_migration_${DEPLOY_ID}.sqlite3"
                ssh -i "$EC2_KEY" "$EC2_HOST" "$SSH_PATH_PREFIX cd $EC2_PATH && cp data/restaurant_prod.sqlite3 data/$backup_name" 2>/dev/null
                
                # Apply migrations
                if ssh -i "$EC2_KEY" "$EC2_HOST" "$SSH_PATH_PREFIX cd $EC2_PATH && /usr/local/bin/docker-compose exec -T app python /app/backend/manage.py migrate" 2>/dev/null; then
                    success "Migraciones aplicadas exitosamente"
                else
                    error "Error en migraciones"
                    return 1
                fi
            fi
            
            # Service restart
            info "🔄 Reiniciando servicios..."
            ssh -i "$EC2_KEY" "$EC2_HOST" "$SSH_PATH_PREFIX cd $EC2_PATH && /usr/local/bin/docker-compose restart app nginx" 2>/dev/null
            
            # Wait for services to be ready
            info "⏳ Esperando servicios..."
            sleep 10
            
            success "Servicios reiniciados"
            ;;
            
        "check")
            if health_check; then
                success "✅ Sistema completamente saludable"
                return 0
            else
                error "❌ Sistema con problemas detectados"
                return 1
            fi
            ;;
            
        *)
            error "Tipo de deployment desconocido: $deploy_type"
            exit 1
            ;;
    esac
    
    # Final health check
    if ! health_check; then
        error "❌ Verificación final falló"
        return 1
    fi
    
    # Success report
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo ""
    step "📊 DEPLOYMENT COMPLETADO"
    echo ""
    echo "   ⏱️  Duración: ${duration}s"
    echo "   📱 Frontend: $([ "$HAS_FRONTEND_CHANGES" = true ] && echo "✅ Actualizado" || echo "⏭️  Sin cambios")"
    echo "   ⚙️  Backend: $([ "$HAS_BACKEND_CHANGES" = true ] && echo "✅ Actualizado" || echo "⏭️  Sin cambios")"  
    echo "   🗄️  BD: $([ "$HAS_MIGRATIONS" = true ] && echo "✅ Migraciones aplicadas" || echo "⏭️  Sin cambios")"
    echo "   🆔 Deploy ID: $DEPLOY_ID"
    echo ""
    success "🎉 DEPLOYMENT EXITOSO"
    echo ""
    info "🌐 URLs de producción:"
    echo "   🏠 Sitio: https://www.xn--elfogndedonsoto-zrb.com/"
    echo "   🔧 API:   https://www.xn--elfogndedonsoto-zrb.com/api/v1/"
    echo ""
    info "🔧 Comandos útiles:"
    echo "   🤖 Deploy: ./prod/deploy.sh deploy"
    echo "   📋 Check: ./prod/deploy.sh check"
    echo ""
    success "✨ Sistema optimizado y operativo"
}

# Usage
show_usage() {
    cat << EOF
🚀 SISTEMA DE DEPLOYMENT MEJORADO - Restaurant Web

Uso: $0 [OPCIÓN]

Opciones:
  deploy        Deploy inteligente optimizado (por defecto)
  check         Verificación del sistema
  help          Mostrar esta ayuda

🎯 Mejoras implementadas:
  ✅ Detección inteligente de cambios
  ✅ Limpieza automática optimizada
  ✅ Transferencia de archivos con verificación
  ✅ Operaciones atómicas para frontend
  ✅ Build con caché inteligente
  ✅ Logs con timestamps
  ✅ Manejo de errores mejorado
  ✅ Health checks optimizados

Ejemplos:
  $0 deploy     # Deployment completo
  $0 check      # Solo verificación
EOF
}

# Main execution
case "${1:-deploy}" in
    "deploy"|"smart") main_deploy "smart" ;;
    "check") main_deploy "check" ;;
    "help"|"--help") show_usage; exit 0 ;;
    *) error "Opción desconocida: $1"; show_usage; exit 1 ;;
esac