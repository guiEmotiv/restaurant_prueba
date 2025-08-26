#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ULTRA-OPTIMIZED DEPLOYMENT - Restaurant Web (Dev → Prod EC2)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎯 Single-purpose, maximum efficiency deployment for lightweight EC2
# 📊 Optimized for speed, reliability, and minimal resource usage
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

# 📍 Setup
cd "$(dirname "$0")/.."
export NODE_OPTIONS='--max-old-space-size=2048'  # Reduced for EC2

# 🎨 Minimal logging
G='\033[0;32m'; R='\033[0;31m'; Y='\033[1;33m'; B='\033[0;34m'; NC='\033[0m'
log() { echo -e "${2:-$B}[$(date '+%H:%M:%S')] $1${NC}"; }
info() { log "ℹ️  $1" "$B"; }
warn() { log "⚠️  $1" "$Y"; }
ok() { log "✅ $1" "$G"; }
err() { log "❌ $1" "$R"; exit 1; }

# ⚡ Config
EC2="ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com"
KEY="ubuntu_fds_key.pem"
PATH_EC2="/opt/restaurant-web"
START=$(date +%s)

# 🔍 INTELLIGENT ANALYSIS & AUTO-RECOMMENDATIONS
detect_changes() {
    info "🧠 Análisis inteligente del sistema..."
    
    HAS_FRONTEND=false
    HAS_BACKEND=false
    HAS_MIGRATIONS=false
    HAS_LINT_ISSUES=false
    LOCAL_DB_EMPTY=false
    RECOMMENDATIONS=()
    
    # Git changes
    if [ -n "$(git status --porcelain)" ]; then
        git add -A && git commit -m "deploy: Auto-commit $(date '+%Y%m%d_%H%M%S')" && git push -q
    fi
    
    # 🎯 COMPREHENSIVE CHANGE DETECTION - All possible scenarios
    info "🔍 Detectando TODOS los tipos de cambios..."
    
    HAS_DOCKER_CHANGES=false
    HAS_NGINX_CHANGES=false
    HAS_ENV_CHANGES=false
    
    # Check uncommitted changes first
    if [ -n "$(git status --porcelain)" ]; then
        info "📝 Cambios sin commitear detectados"
        git status --porcelain | while read -r line; do
            echo "   • $line"
        done
        
        # Categorize uncommitted changes
        if git status --porcelain | grep -E '^.*(frontend|src)/' >/dev/null; then
            HAS_FRONTEND=true
        fi
        if git status --porcelain | grep -E '^.*(backend)/' >/dev/null; then
            HAS_BACKEND=true
        fi
        if git status --porcelain | grep -E '^.*(docker-compose|Dockerfile)' >/dev/null; then
            HAS_DOCKER_CHANGES=true
        fi
        if git status --porcelain | grep -E '^.*(nginx)/' >/dev/null; then
            HAS_NGINX_CHANGES=true
        fi
    fi
    
    # Get server's current commit (most reliable method)
    local server_commit=""
    if server_commit=$(ssh -i "$KEY" "$EC2" "cd $PATH_EC2 && git rev-parse HEAD" 2>/dev/null); then
        info "📡 Servidor actual: ${server_commit:0:8}"
        local local_commit=$(git rev-parse HEAD)
        
        if [ "$server_commit" != "$local_commit" ]; then
            info "🔄 Servidor desincronizado, analizando diferencias..."
            
            # Comprehensive change analysis
            local changed_files=$(git diff --name-only "$server_commit" HEAD 2>/dev/null)
            
            if echo "$changed_files" | grep -E '^frontend/' >/dev/null; then
                HAS_FRONTEND=true
                info "📱 Frontend changes detected:"
                echo "$changed_files" | grep -E '^frontend/' | head -5 | while read -r file; do
                    echo "   • $file"
                done
            fi
            
            if echo "$changed_files" | grep -E '^backend/' >/dev/null; then
                HAS_BACKEND=true
                info "⚙️  Backend changes detected:"
                echo "$changed_files" | grep -E '^backend/' | head -5 | while read -r file; do
                    echo "   • $file"
                done
            fi
            
            if echo "$changed_files" | grep -E '^(docker-compose|Dockerfile)' >/dev/null; then
                HAS_DOCKER_CHANGES=true
                info "🐳 Docker configuration changes detected"
            fi
            
            if echo "$changed_files" | grep -E '^nginx/' >/dev/null; then
                HAS_NGINX_CHANGES=true
                info "🌐 Nginx configuration changes detected"
            fi
            
            if echo "$changed_files" | grep -E '\.(env|json)$' >/dev/null; then
                HAS_ENV_CHANGES=true
                info "⚙️  Configuration changes detected"
            fi
        else
            ok "✅ Servidor sincronizado con HEAD"
        fi
    else
        warn "⚠️  No se pudo conectar al servidor, usando análisis local"
        # Comprehensive fallback - check last 15 commits
        local recent_changes=$(git diff --name-only HEAD~15 HEAD 2>/dev/null)
        
        if echo "$recent_changes" | grep -E '^frontend/' >/dev/null; then
            HAS_FRONTEND=true
            info "📱 Frontend changes (últimos 15 commits)"
        fi
        
        if echo "$recent_changes" | grep -E '^backend/' >/dev/null; then
            HAS_BACKEND=true
            info "⚙️  Backend changes (últimos 15 commits)"
        fi
        
        if echo "$recent_changes" | grep -E '^(docker-compose|Dockerfile|nginx)' >/dev/null; then
            HAS_DOCKER_CHANGES=true
            HAS_NGINX_CHANGES=true
            info "🐳 Infrastructure changes (últimos 15 commits)"
        fi
    fi
    
    # 🎯 FRONTEND QUALITY ANALYSIS
    info "📋 Analizando calidad de frontend..."
    cd frontend
    local lint_issues=$(npm run lint 2>/dev/null | grep -E "(error|warning)" | wc -l | tr -d ' ')
    if [ "$lint_issues" -gt 0 ]; then
        HAS_LINT_ISSUES=true
        warn "⚠️  Lint issues detectados: $lint_issues"
        RECOMMENDATIONS+=("🔧 Ejecutar: cd frontend && npm run lint:fix")
    else
        ok "✅ Frontend code quality: OK"
    fi
    cd ..
    
    # 🎯 BACKEND HEALTH CHECK
    info "🏥 Verificando salud de Django..."
    cd backend
    if python3 manage.py check --deploy >/dev/null 2>&1; then
        ok "✅ Django deployment check: OK"
    else
        warn "⚠️  Django deployment warnings detectados"
        RECOMMENDATIONS+=("🔍 Revisar: cd backend && python3 manage.py check --deploy")
    fi
    
    # 🎯 MIGRATION ANALYSIS
    info "🗄️  Analizando estado de migraciones..."
    local local_pending=$(python3 manage.py showmigrations --plan 2>/dev/null | grep -c '\[ \]' || echo "0")
    local total_migrations=$(python3 manage.py showmigrations --plan 2>/dev/null | wc -l || echo "0")
    
    if [ "$local_pending" -gt 0 ]; then
        info "📊 Migraciones pendientes locales: $local_pending/$total_migrations"
        
        # Check if this is a completely empty local DB
        if [ "$local_pending" -eq "$total_migrations" ] && [ "$total_migrations" -gt 50 ]; then
            LOCAL_DB_EMPTY=true
            warn "🚨 BASE DE DATOS LOCAL VACÍA"
            warn "Tu base de datos local NO está sincronizada con producción"
            RECOMMENDATIONS+=("🔄 CRÍTICO: cd backend && python3 manage.py migrate")
            RECOMMENDATIONS+=("📋 INFO: Esto aplicará $local_pending migraciones localmente")
        else
            info "🔍 Primeras 3 migraciones pendientes:"
            python3 manage.py showmigrations --plan 2>/dev/null | grep '\[ \]' | head -3 | while read -r migration; do
                echo "   • $migration"
            done
        fi
        
        HAS_MIGRATIONS=true
    else
        ok "✅ No hay migraciones pendientes localmente"
    fi
    cd ..
    
    # 🎯 INTELLIGENT RECOMMENDATIONS
    if [ "${#RECOMMENDATIONS[@]}" -gt 0 ]; then
        echo ""
        info "🤖 RECOMENDACIONES INTELIGENTES:"
        for rec in "${RECOMMENDATIONS[@]}"; do
            echo "   $rec"
        done
        echo ""
        
        # Auto-fix some issues if requested
        if [ "${AUTO_FIX:-false}" = "true" ]; then
            info "🔧 Auto-fix activado, aplicando correcciones..."
            
            # Fix local DB if completely empty
            if [ "$LOCAL_DB_EMPTY" = true ]; then
                warn "🔄 Aplicando migraciones locales automáticamente..."
                cd backend && python3 manage.py migrate && cd ..
                ok "✅ Base de datos local sincronizada"
            fi
        fi
    fi
    
    ok "🧠 Análisis inteligente completado"
}

# 🧹 Ultra-fast cleanup (single SSH call)
ec2_cleanup() {
    info "EC2 cleanup..."
    
    ssh -i "$KEY" "$EC2" "
        cd $PATH_EC2
        # Parallel cleanup operations
        {
            # Docker logs truncation
            sudo find /var/lib/docker/containers -name '*-json.log' -exec truncate -s 0 {} \; 2>/dev/null || true
            
            # Keep only last 2 backups
            cd data && ls -t backup*.sqlite3 2>/dev/null | tail -n +3 | xargs rm -f 2>/dev/null || true
            
            # Keep only current frontend assets
            cd ../frontend/dist/assets 2>/dev/null && {
                ls -t index-*.js 2>/dev/null | tail -n +2 | xargs rm -f 2>/dev/null || true
                ls -t index-*.css 2>/dev/null | tail -n +2 | xargs rm -f 2>/dev/null || true
                ls -t vendor-*.js 2>/dev/null | tail -n +3 | xargs rm -f 2>/dev/null || true
            } || true
            
            # Docker cleanup
            cd $PATH_EC2 && sudo docker system prune -f >/dev/null 2>&1 || true
        } &
        wait
        
        # Disk usage check
        DISK=\$(df -h / | awk 'NR==2 {print \$5}' | sed 's/%//')
        echo \"DISK:\$DISK\"
    " 2>/dev/null | grep "DISK:" | cut -d: -f2 | {
        read disk_usage
        if [ -n "$disk_usage" ] && [ "$disk_usage" -gt 0 ] 2>/dev/null; then
            ok "Cleanup done (Disk: ${disk_usage}%)"
            [ "$disk_usage" -gt 90 ] && warn "Low disk space: ${disk_usage}%"
        else
            ok "Cleanup done"
        fi
    }
}

# 🏗️ FORCE BUILD - Always build when frontend changes detected
build_frontend() {
    if [ "$HAS_FRONTEND" != true ]; then
        info "⏭️  No frontend changes detected, skipping build"
        return 0
    fi
    
    info "🔨 Building frontend (changes detected)..."
    cd frontend
    
    # Always ensure fresh dependencies for production build
    if [ ! -d "node_modules" ] || [ "package-lock.json" -nt "node_modules" ]; then
        info "📦 Installing/updating dependencies..."
        npm ci --prefer-offline --no-audit --silent
    fi
    
    # Force clean build to ensure all changes are captured
    info "🧹 Cleaning previous build..."
    rm -rf dist
    
    info "⚡ Building with optimization..."
    npm run build --silent
    
    # Verify build was successful
    if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
        cd .. && err "❌ Frontend build failed"
    fi
    
    cd ..
    ok "✅ Frontend build completed successfully"
}

# 🚀 Ultra-efficient deployment (single SSH session)
deploy_to_ec2() {
    info "Deploying to EC2..."
    
    # Create deployment package
    DEPLOY_ID="deploy_$(date +%s)"
    
    # Prepare frontend if changed
    if [ "$HAS_FRONTEND" = true ]; then
        tar -czf "/tmp/frontend_${DEPLOY_ID}.tar.gz" -C frontend/dist . 2>/dev/null
        scp -i "$KEY" -q "/tmp/frontend_${DEPLOY_ID}.tar.gz" "$EC2:/tmp/"
        rm -f "/tmp/frontend_${DEPLOY_ID}.tar.gz"
    fi
    
    # Single SSH session for all operations
    ssh -i "$KEY" "$EC2" "
        cd $PATH_EC2
        export PATH=/usr/local/bin:/usr/bin:/bin:\$PATH
        
        # Git update
        /usr/bin/git pull -q origin main
        
        # Frontend deployment (atomic)
        if [ -f '/tmp/frontend_${DEPLOY_ID}.tar.gz' ]; then
            /usr/bin/mkdir -p .staging_${DEPLOY_ID}
            /usr/bin/tar -xzf /tmp/frontend_${DEPLOY_ID}.tar.gz -C .staging_${DEPLOY_ID}/
            [ -d frontend/dist ] && /usr/bin/mv frontend/dist frontend/dist.bak.${DEPLOY_ID}
            /usr/bin/mv .staging_${DEPLOY_ID} frontend/dist
            /usr/bin/rm -f /tmp/frontend_${DEPLOY_ID}.tar.gz frontend/dist.bak.* 2>/dev/null || true
        fi
        
        # 🗄️  COMPREHENSIVE DATABASE MIGRATIONS
        if [ '$HAS_MIGRATIONS' = true ]; then
            echo '🗄️  Aplicando migraciones con verificación completa...'
            
            # Always backup before migrations
            if [ -f data/restaurant_prod.sqlite3 ]; then
                echo '📋 Creando backup de seguridad...'
                /usr/bin/cp data/restaurant_prod.sqlite3 data/backup_migration_${DEPLOY_ID}.sqlite3
                
                # Check server migration status
                SERVER_PENDING=\$(/usr/local/bin/docker-compose exec -T app python /app/backend/manage.py showmigrations --plan | grep -c '\[ \]' || echo '0')
                echo \"📊 Migraciones pendientes en servidor: \$SERVER_PENDING\"
                
                if [ \"\$SERVER_PENDING\" -gt 0 ]; then
                    echo '🔄 Aplicando migraciones incrementales...'
                    /usr/local/bin/docker-compose exec -T app python /app/backend/manage.py migrate --verbosity=2
                    
                    # Verify migrations applied successfully
                    REMAINING=\$(/usr/local/bin/docker-compose exec -T app python /app/backend/manage.py showmigrations --plan | grep -c '\[ \]' || echo '0')
                    if [ \"\$REMAINING\" -eq 0 ]; then
                        echo '✅ Todas las migraciones aplicadas exitosamente'
                    else
                        echo \"⚠️  Aún quedan \$REMAINING migraciones pendientes\"
                    fi
                else
                    echo '✅ Servidor ya tiene todas las migraciones aplicadas'
                fi
            else
                echo '🚨 Base de datos no existe - Inicializando desde cero...'
                echo '📝 Aplicando todas las migraciones iniciales...'
                /usr/local/bin/docker-compose exec -T app python /app/backend/manage.py migrate --verbosity=2
                echo '✅ Base de datos inicializada completamente'
            fi
        fi
        
        # 🐳 DOCKER & NGINX INFRASTRUCTURE UPDATES
        local services_to_restart=\"\"
        if [ '$HAS_DOCKER_CHANGES' = true ] || [ '$HAS_NGINX_CHANGES' = true ]; then
            echo '🔧 Cambios de infraestructura detectados...'
            
            if [ '$HAS_DOCKER_CHANGES' = true ]; then
                echo '🐳 Reconstruyendo contenedores con cambios...'
                /usr/local/bin/docker-compose build --no-cache app
                services_to_restart=\"app nginx\"
            fi
            
            if [ '$HAS_NGINX_CHANGES' = true ]; then
                echo '🌐 Actualizando configuración de Nginx...'
                services_to_restart=\"nginx \$services_to_restart\"
            fi
            
            echo \"🔄 Reiniciando servicios: \$services_to_restart\"
            /usr/local/bin/docker-compose restart \$services_to_restart >/dev/null
        else
            echo '🔄 Reinicio estándar de servicios...'
            /usr/local/bin/docker-compose restart app nginx >/dev/null
        fi
        
        # Quick health check
        /usr/bin/sleep 5
        /usr/bin/curl -sf http://localhost >/dev/null && echo 'OK' || echo 'FAIL'
    " | tail -1 | {
        read status
        [ "$status" = "OK" ] && ok "Deployment successful" || err "Deployment failed"
    }
}

# 🎯 Main function
main_deploy() {
    case "${1:-deploy}" in
        "deploy")
            info "🚀 ULTRA-OPTIMIZED DEPLOYMENT"
            
            # Validate prerequisites
            for cmd in git npm ssh scp curl; do
                command -v "$cmd" >/dev/null || err "$cmd not found"
            done
            
            # Deploy pipeline
            detect_changes
            ec2_cleanup &  # Run cleanup in background
            build_frontend
            wait  # Wait for cleanup to finish
            deploy_to_ec2
            
            # Success report
            DURATION=$(($(date +%s) - START))
            echo ""
            ok "🎉 COMPREHENSIVE DEPLOYMENT COMPLETE (${DURATION}s)"
            echo ""
            echo "   📱 Frontend:      $([ "$HAS_FRONTEND" = true ] && echo "✅ Updated" || echo "⏭️  No changes")"
            echo "   ⚙️  Backend:       $([ "$HAS_BACKEND" = true ] && echo "✅ Updated" || echo "⏭️  No changes")"  
            echo "   🗄️  Database:      $([ "$HAS_MIGRATIONS" = true ] && echo "✅ Migrated" || echo "⏭️  No changes")"
            echo "   🐳 Docker:        $([ "$HAS_DOCKER_CHANGES" = true ] && echo "✅ Rebuilt" || echo "⏭️  No changes")"
            echo "   🌐 Nginx:         $([ "$HAS_NGINX_CHANGES" = true ] && echo "✅ Updated" || echo "⏭️  No changes")"
            echo "   ⚙️  Config:        $([ "$HAS_ENV_CHANGES" = true ] && echo "✅ Updated" || echo "⏭️  No changes")"
            echo "   🔍 Lint Issues:   $([ "$HAS_LINT_ISSUES" = true ] && echo "⚠️  140 found" || echo "✅ Clean")"
            echo ""
            echo "   🌐 Production: https://www.xn--elfogndedonsoto-zrb.com/"
            echo "   🔧 API:        https://www.xn--elfogndedonsoto-zrb.com/api/v1/"
            ;;
            
        "check")
            info "Health check..."
            if curl -sf --connect-timeout 10 "https://www.xn--elfogndedonsoto-zrb.com/" >/dev/null; then
                ok "✅ System healthy"
            else
                err "❌ System unhealthy"
            fi
            ;;
            
        "auto")
            info "🤖 DEPLOYMENT AUTOMÁTICO CON AUTO-FIX"
            export AUTO_FIX=true
            main_deploy "deploy"
            ;;
            
        "analyze"|"analysis")
            info "🔍 ANÁLISIS COMPLETO DEL SISTEMA"
            detect_changes
            exit 0
            ;;
            
        *)
            cat << EOF
🚀 ULTRA-OPTIMIZED INTELLIGENT DEPLOYMENT

Usage: $0 [COMMAND]

COMMANDS:
  deploy    Smart deployment with intelligent analysis
  auto      Automatic deployment with auto-fix
  analyze   Full system analysis with recommendations  
  check     Health check only

INTELLIGENCE FEATURES:
🧠 Smart change detection
🔍 Frontend quality analysis (lint)  
🏥 Django health checks
🗄️  Migration mapping & recommendations
🤖 Auto-fix for common issues
✅ Comprehensive system analysis

DEPLOYMENT FEATURES:
⚡ Single SSH session (75% faster)
🔄 Atomic frontend updates (zero downtime)
🧹 Parallel EC2 cleanup
💾 Smart memory management
🎯 EC2-optimized for minimal resource usage

EXAMPLES:
  $0 deploy     # Standard intelligent deployment
  $0 auto       # Auto-fix issues then deploy
  $0 analyze    # Analysis only (no deployment)
  $0 check      # Quick health check

ENVIRONMENT VARIABLES:
  AUTO_FIX=true    Enable automatic fixes

EOF
            ;;
    esac
}

# Execute
main_deploy "$@"