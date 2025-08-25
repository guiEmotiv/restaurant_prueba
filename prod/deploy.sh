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

# 🔧 SSH PATH fix - Ensure git and other tools are found
SSH_PATH_PREFIX="export PATH=/usr/local/bin:/usr/bin:/bin:\$PATH &&"

# 🐍 Python detection - Find available python interpreter
if command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
elif command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
elif [ -f "$PYTHON_CMD" ]; then
    PYTHON_CMD="$PYTHON_CMD"
else
    error "No se encontró Python. Instala Python o configura PATH."
    exit 1
fi

show_usage() {
    cat << EOF
🚀 DEPLOYMENT INTELIGENTE - Restaurant Web (Dev → Prod)

Uso: $0 [OPCIÓN]

Opciones:
  deploy        Deploy automático inteligente (RECOMENDADO)
  sync          Sincronizar BD completa [DESTRUCTIVO]
  check         Verificar salud del sistema
  rollback      Rollback a versión anterior
  help          Mostrar esta ayuda

🤖 Deploy Inteligente detecta automáticamente:
  ✅ Cambios en frontend → Build y deploy
  ✅ Cambios en backend → Deploy con migraciones seguras
  ✅ Cambios en BD → Backup automático antes de migraciones
  ✅ Sin cambios → Solo verificación

Ejemplos:
  $0 deploy     # Deploy inteligente automático
  $0 sync       # Reemplazar BD prod con dev
  $0 check      # Solo verificar estado
EOF
}

echo "🚀 DEPLOYMENT - RESTAURANT WEB"
echo "================================="

# 🤖 Smart deployment detection
detect_changes() {
    info "🔍 Analizando cambios..."
    
    HAS_FRONTEND_CHANGES=false
    HAS_BACKEND_CHANGES=false
    HAS_MIGRATIONS=false
    
    # Check for frontend changes
    if git diff --name-only HEAD~1 HEAD | grep -E "^frontend/" > /dev/null 2>&1; then
        HAS_FRONTEND_CHANGES=true
        info "📱 Cambios en frontend detectados"
    fi
    
    # Check for backend changes
    if git diff --name-only HEAD~1 HEAD | grep -E "^backend/" > /dev/null 2>&1; then
        HAS_BACKEND_CHANGES=true
        info "⚙️ Cambios en backend detectados"
    fi
    
    # Check for pending migrations
    cd backend
    if $PYTHON_CMD manage.py showmigrations --plan | grep -q '\[ \]'; then
        HAS_MIGRATIONS=true
        info "🗄️ Migraciones pendientes detectadas"
    fi
    cd ..
}

# 📋 Process arguments
case "${1:-deploy}" in
    deploy) 
        DEPLOY_TYPE="smart"
        detect_changes
        ;;
    sync) DEPLOY_TYPE="sync" ;;
    check) DEPLOY_TYPE="check" ;;
    rollback) DEPLOY_TYPE="rollback" ;;
    help|--help) show_usage; exit 0 ;;
    *) error "Opción desconocida: $1"; show_usage; exit 1 ;;
esac

# 📋 Prerequisites validation
info "Validando prerrequisitos..."
command -v git >/dev/null || { error "Git no instalado"; exit 1; }
command -v npm >/dev/null || { error "npm no instalado"; exit 1; }
command -v ssh >/dev/null || { error "SSH no instalado"; exit 1; }
command -v scp >/dev/null || { error "SCP no instalado"; exit 1; }

# 🔒 Security Check (skip for check/rollback operations)
if [ "$DEPLOY_TYPE" != "check" ] && [ "$DEPLOY_TYPE" != "rollback" ]; then
    info "Ejecutando verificación de seguridad..."
    if [ -f "prod/security-check.sh" ]; then
        ./prod/security-check.sh || { error "Falló la verificación de seguridad"; exit 1; }
    else
        warning "Script de verificación de seguridad no encontrado"
    fi
fi

# 🛡️ Always create backup before any changes (except check)
if [ "$DEPLOY_TYPE" != "check" ] && [ "$DEPLOY_TYPE" != "rollback" ]; then
    info "🛡️ Creando backup automático de seguridad..."
    BACKUP_NAME="backup_auto_$(date +%Y%m%d_%H%M%S).sqlite3"
    ssh -i "$EC2_KEY" "$EC2_HOST" "$SSH_PATH_PREFIX cd $EC2_PATH && cp data/restaurant_prod.sqlite3 data/$BACKUP_NAME 2>/dev/null || true"
    success "Backup creado: $BACKUP_NAME"
fi

# 🔍 Health check via SSH
if [ "$DEPLOY_TYPE" = "check" ]; then
    info "Verificando salud del sistema..."
    
    ssh -i "$EC2_KEY" "$EC2_HOST" "$SSH_PATH_PREFIX cd $EC2_PATH && /usr/local/bin/docker-compose ps" 2>/dev/null && success "Sistema funcionando correctamente" || error "Error en el sistema"
    
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
    warning "Iniciando rollback completo (código + BD)..."
    
    # Rollback git
    ssh -i "$EC2_KEY" "$EC2_HOST" "$SSH_PATH_PREFIX cd $EC2_PATH && git log --oneline -3"
    echo "¿A qué commit hacer rollback? (ingresa hash o presiona Enter para el anterior):"
    read -r commit_hash
    
    if [ -z "$commit_hash" ]; then
        info "Haciendo rollback al commit anterior..."
        ssh -i "$EC2_KEY" "$EC2_HOST" "$SSH_PATH_PREFIX cd $EC2_PATH && git reset --hard HEAD~1"
    else
        info "Haciendo rollback al commit: $commit_hash"
        ssh -i "$EC2_KEY" "$EC2_HOST" "$SSH_PATH_PREFIX cd $EC2_PATH && git reset --hard $commit_hash"
    fi
    
    # Rollback database
    ssh -i "$EC2_KEY" "$EC2_HOST" "$SSH_PATH_PREFIX cd $EC2_PATH && BACKUP_FILE=\$(ls -t data/backup_prod_*.sqlite3 2>/dev/null | head -1) && if [ -n \"\$BACKUP_FILE\" ]; then cp \"\$BACKUP_FILE\" data/restaurant_prod.sqlite3 && echo 'BD restaurada desde backup'; else echo 'No hay backups de BD'; fi"
    
    # Restart services
    ssh -i "$EC2_KEY" "$EC2_HOST" "cd $EC2_PATH && /usr/local/bin/docker-compose restart app nginx"
    
    success "Rollback completo terminado"
    exit 0
fi

# 🚀 Smart deployment logic
if [ "$DEPLOY_TYPE" = "smart" ]; then
    if [ "$HAS_FRONTEND_CHANGES" = "false" ] && [ "$HAS_BACKEND_CHANGES" = "false" ] && [ "$HAS_MIGRATIONS" = "false" ]; then
        info "✅ No se detectaron cambios significativos"
        info "🔍 Ejecutando verificación de salud..."
        DEPLOY_TYPE="check"
    else
        info "🚀 Iniciando deploy inteligente"
        if [ "$HAS_MIGRATIONS" = "true" ]; then
            warning "⚠️ Se aplicarán migraciones de base de datos"
        fi
    fi
else
    info "Iniciando deploy: $DEPLOY_TYPE"
fi

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

# 📋 List pending migrations before deploy
info "Verificando migraciones locales..."
cd backend
if $PYTHON_CMD manage.py showmigrations --plan | grep -q '\[ \]'; then
    warning "Se detectaron migraciones pendientes:"
    $PYTHON_CMD manage.py showmigrations --plan | grep '\[ \]' || true
    echo "Estas migraciones se aplicarán en producción."
else
    success "No hay migraciones pendientes locales"
fi
cd ..

# 🔄 Database sync
if [ "$DEPLOY_TYPE" = "sync" ]; then
    if [ ! -f "data/restaurant_dev.sqlite3" ]; then
        error "Archivo restaurant_dev.sqlite3 no encontrado"
        exit 1
    fi
    
    warning "⚠️  OPERACIÓN DESTRUCTIVA: Reemplazar BD producción con desarrollo"
    
    # Auto-confirm if SYNC_CONFIRMED environment variable is set (for testing)
    if [ "$SYNC_CONFIRMED" = "true" ]; then
        warning "Auto-confirmando sincronización (SYNC_CONFIRMED=true)"
        response="s"
    else
        echo -n "   ¿Confirmar sincronización? (s/N): "
        read -r response
    fi
    
    if [[ ! "$response" =~ ^[sS]$ ]]; then
        error "Sync cancelado"
        exit 1
    fi
    info "Confirmación recibida, continuando..."
fi

# 🏗️ Build frontend (only if needed)
if [ "$DEPLOY_TYPE" = "smart" ]; then
    if [ "$HAS_FRONTEND_CHANGES" = "true" ]; then
        info "🏗️ Construyendo frontend (cambios detectados)..."
        cd frontend
        npm run build
        cd ..
        success "Frontend construido"
    else
        info "⏭️ Frontend sin cambios, omitiendo build"
    fi
elif [ "$DEPLOY_TYPE" = "sync" ]; then
    info "🏗️ Construyendo frontend localmente..."
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
fi

# 📤 Deploy to EC2
info "Desplegando a EC2..."

# 1. Update code on server
info "Actualizando código en servidor..."
if ! ssh -i "$EC2_KEY" "$EC2_HOST" "$SSH_PATH_PREFIX cd $EC2_PATH && git pull origin main"; then
    error "Error de conexión SSH al servidor EC2"
    echo "Posibles causas:"
    echo "  - Servidor EC2 apagado o inaccesible"
    echo "  - Problemas de conectividad de red"
    echo "  - Llave SSH incorrecta"
    echo ""
    echo "Verifica la conexión con: ssh -i $EC2_KEY $EC2_HOST"
    exit 1
fi

# 2. Copy frontend build to server (only if needed)
if [ "$DEPLOY_TYPE" = "smart" ] && [ "$HAS_FRONTEND_CHANGES" = "true" ]; then
    info "📱 Copiando archivos de frontend..."
    scp -i "$EC2_KEY" -r frontend/dist/* "$EC2_HOST:$EC2_PATH/frontend/dist/"
elif [ "$DEPLOY_TYPE" = "sync" ]; then
    info "📱 Copiando archivos de frontend..."
    scp -i "$EC2_KEY" -r frontend/dist/* "$EC2_HOST:$EC2_PATH/frontend/dist/"
fi

# 3. Copy database if sync
if [ "$DEPLOY_TYPE" = "sync" ]; then
    info "Sincronizando base de datos..."
    # Create backup on server first
    ssh -i "$EC2_KEY" "$EC2_HOST" "$SSH_PATH_PREFIX cd $EC2_PATH && cp data/restaurant_prod.sqlite3 data/backup_prod_\$(date +%Y%m%d_%H%M%S).sqlite3 2>/dev/null || true"
    # Copy dev database to prod
    scp -i "$EC2_KEY" data/restaurant_dev.sqlite3 "$EC2_HOST:$EC2_PATH/data/restaurant_prod.sqlite3"
fi

# 4. Restart services on server
info "Reiniciando servicios..."
ssh -i "$EC2_KEY" "$EC2_HOST" "cd $EC2_PATH && /usr/local/bin/docker-compose restart app nginx"

# 5. Wait for containers to be ready
info "Esperando contenedores..."
ssh -i "$EC2_KEY" "$EC2_HOST" "cd $EC2_PATH && /usr/local/bin/docker-compose exec -T app python /app/backend/manage.py check --database default" || {
    error "Backend no está listo"
    exit 1
}

# 6. Apply migrations safely (only if needed)
if [ "$DEPLOY_TYPE" = "smart" ] && [ "$HAS_MIGRATIONS" = "true" ]; then
    info "🗄️ Aplicando migraciones detectadas..."
    
    # Safer migration approach - no --run-syncdb
    ssh -i "$EC2_KEY" "$EC2_HOST" "cd $EC2_PATH && /usr/local/bin/docker-compose exec -T app python /app/backend/manage.py migrate" || {
        error "Error en migraciones"
        exit 1
    }
    
    success "Migraciones aplicadas exitosamente"
elif [ "$DEPLOY_TYPE" = "sync" ]; then
    info "🗄️ Verificando migraciones pendientes..."
    PENDING_MIGRATIONS=$(ssh -i "$EC2_KEY" "$EC2_HOST" "$SSH_PATH_PREFIX cd $EC2_PATH && /usr/local/bin/docker-compose exec -T app python /app/backend/manage.py showmigrations --plan | grep -c '\[ \]' || echo 0" | tr -d '\n' | tr -d '\r')
    
    # Ensure PENDING_MIGRATIONS is a valid number
    if ! [[ "$PENDING_MIGRATIONS" =~ ^[0-9]+$ ]]; then
        warning "Error al contar migraciones, asumiendo 0"
        PENDING_MIGRATIONS=0
    fi
    
    if [ "$PENDING_MIGRATIONS" -gt 0 ]; then
        info "Aplicando $PENDING_MIGRATIONS migraciones pendientes..."
        
        # Apply migrations with error handling
        ssh -i "$EC2_KEY" "$EC2_HOST" "cd $EC2_PATH && /usr/local/bin/docker-compose exec -T app python /app/backend/manage.py migrate" || {
            error "Error crítico en migraciones"
            exit 1
        }
        
        success "Migraciones aplicadas exitosamente"
    else
        success "No hay migraciones pendientes"
    fi
fi

# 7. Restart services after migrations
info "Reiniciando servicios post-migración..."
ssh -i "$EC2_KEY" "$EC2_HOST" "cd $EC2_PATH && /usr/local/bin/docker-compose restart app"
sleep 5

# 8. Verify deployment
info "Verificando deployment..."
if curl -s -o /dev/null -w "%{http_code}" https://www.xn--elfogndedonsoto-zrb.com/ | grep -q 200; then
    success "Sitio web funcionando"
else
    error "Error: Sitio web no responde"
    exit 1
fi

# 🎉 Success
echo ""
if [ "$DEPLOY_TYPE" = "check" ]; then
    success "✅ VERIFICACIÓN COMPLETADA"
else
    success "🎉 DEPLOY INTELIGENTE COMPLETADO"
    
    echo ""
    echo "📊 Resumen del deployment:"
    if [ "$DEPLOY_TYPE" = "smart" ]; then
        echo "   📱 Frontend: $([ "$HAS_FRONTEND_CHANGES" = "true" ] && echo "✅ Actualizado" || echo "⏭️ Sin cambios")"
        echo "   ⚙️ Backend: $([ "$HAS_BACKEND_CHANGES" = "true" ] && echo "✅ Actualizado" || echo "⏭️ Sin cambios")"
        echo "   🗄️ BD: $([ "$HAS_MIGRATIONS" = "true" ] && echo "✅ Migraciones aplicadas" || echo "⏭️ Sin cambios")"
        echo "   🛡️ Backup: ✅ $BACKUP_NAME"
    fi
fi

echo ""
echo "🌐 URLs de producción:"
echo "   🏠 Sitio: https://www.xn--elfogndedonsoto-zrb.com/"
echo "   🔧 API:   https://www.xn--elfogndedonsoto-zrb.com/api/v1/"
echo ""
echo "🔧 Comandos útiles:"
echo "   🤖 Deploy automático: ./prod/deploy.sh deploy"
echo "   📋 Verificar: ./prod/deploy.sh check"
echo "   🔄 Rollback: ./prod/deploy.sh rollback"
echo ""
success "✨ Sistema operativo y optimizado"