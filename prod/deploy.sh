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

# 🔍 Smart change detection with migration mapping
detect_changes() {
    info "Analizando cambios y migraciones..."
    
    HAS_FRONTEND=false
    HAS_BACKEND=false
    HAS_MIGRATIONS=false
    PENDING_MIGRATIONS=""
    
    # Git changes
    if [ -n "$(git status --porcelain)" ]; then
        git add -A && git commit -m "deploy: Auto-commit $(date '+%Y%m%d_%H%M%S')" && git push -q
    fi
    
    # Check last 2 commits for changes
    if git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -E '^frontend/' >/dev/null; then
        HAS_FRONTEND=true
        info "Frontend changes detected"
    fi
    
    if git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -E '^backend/' >/dev/null; then
        HAS_BACKEND=true
        info "Backend changes detected"
    fi
    
    # 🎯 ADVANCED MIGRATION ANALYSIS
    info "Analizando estado de migraciones..."
    
    # Check local migrations first
    cd backend
    local local_pending=$(python3 manage.py showmigrations --plan 2>/dev/null | grep -c '\[ \]' || echo "0")
    
    if [ "$local_pending" -gt 0 ]; then
        info "📊 Migraciones pendientes locales: $local_pending"
        
        # Get specific pending migrations
        PENDING_MIGRATIONS=$(python3 manage.py showmigrations --plan 2>/dev/null | grep '\[ \]' | head -5)
        info "🔍 Primeras 5 migraciones pendientes:"
        echo "$PENDING_MIGRATIONS" | while read -r migration; do
            echo "   • $migration"
        done
        
        # Check if this is a fresh database (all migrations pending)
        local total_migrations=$(python3 manage.py showmigrations --plan 2>/dev/null | wc -l || echo "0")
        if [ "$local_pending" -eq "$total_migrations" ]; then
            warn "🚨 BASE DE DATOS VACÍA - Todas las migraciones pendientes ($local_pending/$total_migrations)"
            warn "Esto indica que necesitas inicializar la base de datos"
        fi
        
        HAS_MIGRATIONS=true
    else
        ok "✅ No hay migraciones pendientes localmente"
    fi
    cd ..
    
    ok "Análisis de cambios completado"
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

# 🏗️ Optimized build (only if needed)
build_frontend() {
    [ "$HAS_FRONTEND" != true ] && return 0
    
    info "Building frontend..."
    cd frontend
    
    # Smart npm install
    [ ! -d "node_modules" ] || [ "package-lock.json" -nt "node_modules" ] && {
        npm ci --prefer-offline --no-audit --silent
    }
    
    # Clean build
    rm -rf dist && npm run build --silent
    cd ..
    ok "Frontend built"
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
        
        # Migrations (with comprehensive handling)
        if [ '$HAS_MIGRATIONS' = true ]; then
            echo '🗄️  Aplicando migraciones...'
            
            # Check if database exists
            if [ -f data/restaurant_prod.sqlite3 ]; then
                echo '📋 Creando backup antes de migraciones...'
                /usr/bin/cp data/restaurant_prod.sqlite3 data/backup_migration_${DEPLOY_ID}.sqlite3
                
                # Check server migration status
                SERVER_PENDING=\$(/usr/local/bin/docker-compose exec -T app python /app/backend/manage.py showmigrations --plan | grep -c '\[ \]' || echo '0')
                echo \"📊 Migraciones pendientes en servidor: \$SERVER_PENDING\"
                
                if [ \"\$SERVER_PENDING\" -gt 0 ]; then
                    echo '🔄 Aplicando migraciones incrementales...'
                    /usr/local/bin/docker-compose exec -T app python /app/backend/manage.py migrate --verbosity=2
                else
                    echo '✅ Servidor ya tiene todas las migraciones aplicadas'
                fi
            else
                echo '🚨 Base de datos no existe - Inicializando desde cero...'
                echo '📝 Aplicando todas las migraciones iniciales...'
                /usr/local/bin/docker-compose exec -T app python /app/backend/manage.py migrate --verbosity=2
            fi
            
            echo '✅ Proceso de migraciones completado'
        fi
        
        # Service restart (minimal downtime)
        /usr/local/bin/docker-compose restart app nginx >/dev/null
        
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
            ok "🎉 DEPLOYMENT COMPLETE (${DURATION}s)"
            echo ""
            echo "   📱 Frontend: $([ "$HAS_FRONTEND" = true ] && echo "✅ Updated" || echo "⏭️  No changes")"
            echo "   ⚙️  Backend:  $([ "$HAS_BACKEND" = true ] && echo "✅ Updated" || echo "⏭️  No changes")"  
            echo "   🗄️  DB:       $([ "$HAS_MIGRATIONS" = true ] && echo "✅ Migrated" || echo "⏭️  No changes")"
            echo ""
            echo "   🌐 https://www.xn--elfogndedonsoto-zrb.com/"
            ;;
            
        "check")
            info "Health check..."
            if curl -sf --connect-timeout 10 "https://www.xn--elfogndedonsoto-zrb.com/" >/dev/null; then
                ok "✅ System healthy"
            else
                err "❌ System unhealthy"
            fi
            ;;
            
        *)
            cat << EOF
🚀 ULTRA-OPTIMIZED DEPLOYMENT

Usage: $0 [deploy|check]

  deploy    Smart deployment with minimal downtime
  check     Health check only

Features:
✅ Single SSH session deployment
✅ Atomic frontend updates  
✅ Parallel operations
✅ Smart change detection
✅ Minimal resource usage
✅ EC2-optimized cleanup

EOF
            ;;
    esac
}

# Execute
main_deploy "$@"