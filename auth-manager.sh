#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔐 GESTOR DE AUTENTICACIÓN - El Fogón de Don Soto
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 
# Script único para gestionar toda la autenticación AWS Cognito
# Reemplaza todos los scripts obsoletos de auth/cognito
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funciones de logging
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Verificar ubicación
check_location() {
    if [ ! -f ".env.ec2" ]; then
        log_error ".env.ec2 no encontrado"
        log_error "Ejecuta este script desde /opt/restaurant-web/ en EC2"
        exit 1
    fi
}

# Mostrar ayuda
show_help() {
    echo "🔐 Gestor de Autenticación - El Fogón de Don Soto"
    echo "==============================================="
    echo
    echo "COMANDOS DISPONIBLES:"
    echo
    echo "  disable           Deshabilitar autenticación completamente"
    echo "  enable <pool> <client> [region]"
    echo "                    Habilitar autenticación con AWS Cognito"
    echo "  status            Mostrar estado actual de autenticación"
    echo "  debug             Diagnóstico completo de autenticación"
    echo "  reset             Reset completo (rebuild sin auth)"
    echo
    echo "EJEMPLOS:"
    echo "  ./auth-manager.sh disable"
    echo "  ./auth-manager.sh enable us-west-2_abc123 4i9hrd7srgbq us-west-2"
    echo "  ./auth-manager.sh status"
    echo "  ./auth-manager.sh debug"
    echo "  ./auth-manager.sh reset"
    echo
}

# Deshabilitar autenticación
disable_auth() {
    log_info "Deshabilitando autenticación AWS Cognito..."
    
    # Backup
    cp .env.ec2 .env.ec2.backup.$(date +%Y%m%d-%H%M%S)
    
    # Configurar backend
    sed -i 's/USE_COGNITO_AUTH=True/USE_COGNITO_AUTH=False/' .env.ec2
    sed -i 's/USE_COGNITO_AUTH=true/USE_COGNITO_AUTH=False/' .env.ec2
    
    if ! grep -q "USE_COGNITO_AUTH" .env.ec2; then
        echo "USE_COGNITO_AUTH=False" >> .env.ec2
    fi
    
    # Limpiar frontend
    cat > frontend/.env.production << 'EOF'
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Frontend Production Environment Variables (NO AUTH)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# NO AWS Cognito Configuration - Running without authentication

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# NOTA: Sin variables VITE_AWS_COGNITO_* para evitar problemas de Amplify
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
    
    log_success "Autenticación deshabilitada"
    log_info "Para aplicar cambios: docker-compose -f docker-compose.ec2.yml restart web"
}

# Habilitar autenticación
enable_auth() {
    local USER_POOL_ID="$1"
    local APP_CLIENT_ID="$2"
    local REGION="${3:-us-east-1}"
    
    if [[ -z "$USER_POOL_ID" || -z "$APP_CLIENT_ID" ]]; then
        log_error "Faltan parámetros"
        echo "Uso: ./auth-manager.sh enable <USER_POOL_ID> <APP_CLIENT_ID> [REGION]"
        echo "Ejemplo: ./auth-manager.sh enable us-west-2_abc123 4i9hrd7srgbq us-west-2"
        exit 1
    fi
    
    log_info "Habilitando autenticación AWS Cognito..."
    log_info "User Pool ID: $USER_POOL_ID"
    log_info "App Client ID: $APP_CLIENT_ID"
    log_info "Region: $REGION"
    
    # Backup
    cp .env.ec2 .env.ec2.backup.$(date +%Y%m%d-%H%M%S)
    cp frontend/.env.production frontend/.env.production.backup.$(date +%Y%m%d-%H%M%S) 2>/dev/null || true
    
    # Obtener EC2 IP
    local EC2_IP=$(grep "EC2_PUBLIC_IP" .env.ec2 | cut -d'=' -f2 | tr -d '"')
    EC2_IP=${EC2_IP:-localhost}
    
    # Configurar backend
    sed -i "s/USE_COGNITO_AUTH=.*/USE_COGNITO_AUTH=True/" .env.ec2
    sed -i "s/AWS_REGION=.*/AWS_REGION=$REGION/" .env.ec2
    sed -i "s/COGNITO_USER_POOL_ID=.*/COGNITO_USER_POOL_ID=$USER_POOL_ID/" .env.ec2
    sed -i "s/COGNITO_APP_CLIENT_ID=.*/COGNITO_APP_CLIENT_ID=$APP_CLIENT_ID/" .env.ec2
    
    # Configurar frontend
    cat > frontend/.env.production << EOF
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Frontend Production Environment Variables (AWS Cognito)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# AWS Cognito Configuration
VITE_AWS_REGION=$REGION
VITE_AWS_COGNITO_USER_POOL_ID=$USER_POOL_ID
VITE_AWS_COGNITO_APP_CLIENT_ID=$APP_CLIENT_ID

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# NOTA: Variables configuradas automáticamente por auth-manager.sh
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
    
    log_success "Autenticación habilitada"
    log_info "Para aplicar cambios: ./deploy/ec2-deploy.sh"
}

# Mostrar estado
show_status() {
    log_info "Estado actual de autenticación:"
    echo
    
    echo "📋 Backend (.env.ec2):"
    if grep -q "USE_COGNITO_AUTH=True" .env.ec2; then
        echo "  ✅ Autenticación: HABILITADA"
        echo "  Region: $(grep "AWS_REGION" .env.ec2 | cut -d'=' -f2)"
        echo "  User Pool: $(grep "COGNITO_USER_POOL_ID" .env.ec2 | cut -d'=' -f2)"
        echo "  Client ID: $(grep "COGNITO_APP_CLIENT_ID" .env.ec2 | cut -d'=' -f2 | cut -c1-10)..."
    else
        echo "  ❌ Autenticación: DESHABILITADA"
    fi
    
    echo
    echo "📋 Frontend (.env.production):"
    if [ -f "frontend/.env.production" ] && grep -q "VITE_AWS_COGNITO_USER_POOL_ID" frontend/.env.production; then
        echo "  ✅ Variables Cognito: CONFIGURADAS"
        echo "  Region: $(grep "VITE_AWS_REGION" frontend/.env.production | cut -d'=' -f2 2>/dev/null || echo "No configurada")"
    else
        echo "  ❌ Variables Cognito: NO CONFIGURADAS"
    fi
    
    echo
    echo "📋 Contenedores:"
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f docker-compose.ec2.yml ps 2>/dev/null || echo "  ❌ No se pudo verificar containers"
    else
        echo "  ❌ docker-compose no disponible"
    fi
}

# Diagnóstico completo
run_debug() {
    log_info "Ejecutando diagnóstico completo..."
    echo
    
    show_status
    
    echo
    echo "📋 Test de API:"
    local API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/units/ 2>/dev/null || echo "FAILED")
    echo "  Estado: $API_STATUS"
    
    echo
    echo "📋 Variables de entorno en contenedor:"
    docker-compose -f docker-compose.ec2.yml exec -T web printenv | grep -E "(USE_COGNITO|COGNITO_|AWS_)" | sort 2>/dev/null || echo "  ❌ No se pudo acceder al contenedor"
    
    echo
    echo "📋 Logs recientes:"
    docker-compose -f docker-compose.ec2.yml logs web --tail=10 2>/dev/null || echo "  ❌ No se pudieron obtener logs"
}

# Reset completo
reset_complete() {
    log_warning "Realizando reset completo (rebuild sin autenticación)..."
    
    # Deshabilitar auth
    disable_auth
    
    # Limpiar build
    log_info "Limpiando builds anteriores..."
    rm -rf frontend/dist frontend/node_modules
    
    # Rebuild
    log_info "Rebuilding frontend..."
    cd frontend
    export NODE_OPTIONS="--max-old-space-size=512"
    npm install --no-package-lock --no-audit --no-fund --prefer-offline
    npm run build
    cd ..
    
    # Restart containers
    log_info "Reiniciando contenedores..."
    docker-compose -f docker-compose.ec2.yml down
    docker-compose -f docker-compose.ec2.yml up -d
    
    sleep 10
    
    local API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/units/ 2>/dev/null || echo "FAILED")
    if [ "$API_STATUS" = "200" ]; then
        log_success "Reset completado - Aplicación funcionando sin autenticación"
    else
        log_error "Reset completado pero API no responde correctamente"
    fi
}

# Main
main() {
    case "${1:-help}" in
        disable)
            check_location
            disable_auth
            ;;
        enable)
            check_location
            enable_auth "$2" "$3" "$4"
            ;;
        status)
            check_location
            show_status
            ;;
        debug)
            check_location
            run_debug
            ;;
        reset)
            check_location
            reset_complete
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Comando no reconocido: $1"
            show_help
            exit 1
            ;;
    esac
}

# Ejecutar
main "$@"