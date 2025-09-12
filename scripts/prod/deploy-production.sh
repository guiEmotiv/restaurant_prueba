#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 RESTAURANT WEB - PRODUCTION DEPLOYMENT SCRIPT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# 🎯 PROPÓSITO: Script master para deployar la aplicación restaurant-web en producción EC2
# 📋 USO: ./deploy-production.sh [--skip-cleanup] [--skip-ssl] [--help]
# 🌐 DOMINIO: www.xn--elfogndedonsoto-zrb.com
# 
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🔧 CONFIGURACIÓN
# ═══════════════════════════════════════════════════════════════════════════════════════

PROJECT_NAME="Restaurant Web"
PROJECT_DIR="/home/ubuntu/restaurant-web"
DOMAIN="www.xn--elfogndedonsoto-zrb.com"
LOG_FILE="/tmp/restaurant-deployment-$(date +%Y%m%d_%H%M%S).log"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Flags
SKIP_CLEANUP=false
SKIP_SSL=false
SHOW_HELP=false

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🎨 FUNCIONES AUXILIARES
# ═══════════════════════════════════════════════════════════════════════════════════════

print_header() {
    echo ""
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}🚀 $1${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}$1${NC} $2"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Función para ejecutar scripts con manejo de errores
execute_script() {
    local script_name=$1
    local script_path="${PROJECT_DIR}/scripts/prod/${script_name}"
    
    print_step "🔄" "Ejecutando: $script_name"
    
    if [ ! -f "$script_path" ]; then
        print_error "Script no encontrado: $script_path"
        exit 1
    fi
    
    chmod +x "$script_path"
    
    if bash "$script_path" 2>&1 | tee -a "$LOG_FILE"; then
        print_success "$script_name completado"
        echo "" >> "$LOG_FILE"
        echo "=== $script_name COMPLETADO ===" >> "$LOG_FILE"
        echo "" >> "$LOG_FILE"
    else
        print_error "$script_name falló"
        echo "" >> "$LOG_FILE"
        echo "=== $script_name FALLÓ ===" >> "$LOG_FILE"
        echo "" >> "$LOG_FILE"
        exit 1
    fi
}

# Función para mostrar ayuda
show_help() {
    cat << EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 RESTAURANT WEB - PRODUCTION DEPLOYMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DESCRIPCIÓN:
  Script de deployment automatizado para producción en EC2
  
USO:
  ./deploy-production.sh [opciones]

OPCIONES:
  --skip-cleanup    Omite la limpieza del sistema (útil para re-deployments)
  --skip-ssl        Omite la configuración SSL (útil si ya está configurado)
  --help           Muestra esta ayuda

REQUISITOS PREVIOS:
  1. Estar en el servidor EC2 de producción
  2. Tener los archivos del proyecto en /home/ubuntu/restaurant-web
  3. Archivo .env.production configurado
  4. DNS apuntando a la IP del servidor

PROCESO DE DEPLOYMENT:
  1. 🧹 Limpieza del sistema y optimización
  2. 📦 Instalación de dependencias
  3. 🗄️  Configuración de base de datos
  4. ⚛️  Build del frontend
  5. 🔒 Configuración SSL y dominio
  6. 🚀 Inicio de servicios

RESULTADO:
  - Aplicación disponible en: https://www.xn--elfogndedonsoto-zrb.com
  - Panel admin: https://www.xn--elfogndedonsoto-zrb.com/admin
  - Logs en: $LOG_FILE

EJEMPLOS:
  ./deploy-production.sh                    # Deployment completo
  ./deploy-production.sh --skip-cleanup     # Re-deployment sin limpieza
  ./deploy-production.sh --skip-ssl         # Deployment sin configurar SSL

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
}

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🔍 PROCESAMIENTO DE ARGUMENTOS
# ═══════════════════════════════════════════════════════════════════════════════════════

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-cleanup)
            SKIP_CLEANUP=true
            shift
            ;;
        --skip-ssl)
            SKIP_SSL=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            print_error "Opción desconocida: $1"
            echo "Usa --help para ver las opciones disponibles"
            exit 1
            ;;
    esac
done

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🚀 INICIO DEL DEPLOYMENT
# ═══════════════════════════════════════════════════════════════════════════════════════

print_header "$PROJECT_NAME - PRODUCTION DEPLOYMENT"

echo -e "${CYAN}📋 INFORMACIÓN DEL DEPLOYMENT${NC}"
echo "═════════════════════════════════════════════"
echo "🏷️  Proyecto: $PROJECT_NAME"
echo "📁 Directorio: $PROJECT_DIR"
echo "🌐 Dominio: $DOMAIN"
echo "📝 Log: $LOG_FILE"
echo "⏰ Inicio: $(date)"
echo ""

# Verificaciones previas
print_step "🔍" "Verificando requisitos previos..."

# Verificar que estamos en EC2
if [ ! -d "/home/ubuntu" ]; then
    print_warning "No estás en el servidor EC2 estándar (/home/ubuntu no existe)"
fi

# Verificar que existe el directorio del proyecto
if [ ! -d "$PROJECT_DIR" ]; then
    print_error "Directorio del proyecto no encontrado: $PROJECT_DIR"
    echo ""
    echo "🛠️  Pasos para solucionar:"
    echo "1. cd /home/ubuntu"
    echo "2. git clone [tu-repositorio] restaurant-web"
    echo "3. cd restaurant-web"
    echo "4. ./scripts/prod/deploy-production.sh"
    exit 1
fi

# Cambiar al directorio del proyecto
cd "$PROJECT_DIR"

# Verificar archivos esenciales
essential_files=(".env.production" "docker-compose.production.yml" "frontend/package.json" "backend/manage.py")
for file in "${essential_files[@]}"; do
    if [ ! -f "$file" ]; then
        print_error "Archivo esencial no encontrado: $file"
        exit 1
    fi
done

print_success "Verificaciones previas completadas"

# Iniciar logging
echo "=== DEPLOYMENT LOG ===" > "$LOG_FILE"
echo "Fecha: $(date)" >> "$LOG_FILE"
echo "Usuario: $(whoami)" >> "$LOG_FILE"
echo "Directorio: $(pwd)" >> "$LOG_FILE"
echo "Opciones: SKIP_CLEANUP=$SKIP_CLEANUP, SKIP_SSL=$SKIP_SSL" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🎯 EJECUCIÓN DE SCRIPTS DE DEPLOYMENT
# ═══════════════════════════════════════════════════════════════════════════════════════

# Paso 1: Limpieza del sistema (opcional)
if [ "$SKIP_CLEANUP" = false ]; then
    print_header "PASO 1: LIMPIEZA DEL SISTEMA"
    execute_script "01-cleanup-system.sh"
else
    print_step "⏭️ " "Omitiendo limpieza del sistema (--skip-cleanup)"
fi

# Paso 2: Instalación de dependencias
print_header "PASO 2: INSTALACIÓN DE DEPENDENCIAS"
execute_script "02-install-dependencies.sh"

# Paso 3: Configuración de base de datos
print_header "PASO 3: CONFIGURACIÓN DE BASE DE DATOS"
execute_script "03-setup-database.sh"

# Paso 4: Build del frontend
print_header "PASO 4: BUILD DEL FRONTEND"
execute_script "04-build-frontend.sh"

# Paso 5: Configuración SSL y dominio (opcional)
if [ "$SKIP_SSL" = false ]; then
    print_header "PASO 5: CONFIGURACIÓN SSL Y DOMINIO"
    execute_script "05-setup-ssl-domain.sh"
else
    print_step "⏭️ " "Omitiendo configuración SSL (--skip-ssl)"
fi

# Paso 6: Inicio de servicios
print_header "PASO 6: INICIO DE SERVICIOS"
execute_script "06-start-services.sh"

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🎉 FINALIZACIÓN Y RESUMEN
# ═══════════════════════════════════════════════════════════════════════════════════════

print_header "DEPLOYMENT COMPLETADO EXITOSAMENTE"

echo -e "${GREEN}🎉 ¡Tu aplicación está funcionando en producción!${NC}"
echo ""
echo -e "${CYAN}🌐 ACCESO A LA APLICACIÓN${NC}"
echo "═════════════════════════════════════════"
echo "🏠 Sitio web: https://$DOMAIN"
echo "🔧 Admin Django: https://$DOMAIN/admin/"
echo "📊 API: https://$DOMAIN/api/v1/"
echo ""
echo -e "${CYAN}🔐 CREDENCIALES DE ADMIN${NC}"
echo "═════════════════════════════════════════"
echo "👤 Usuario: admin"
echo "🔑 Contraseña: admin123"
echo "📧 Email: admin@restaurant.com"
echo ""
echo -e "${CYAN}📊 MONITOREO Y MANTENIMIENTO${NC}"
echo "═════════════════════════════════════════"
echo "📝 Log completo: $LOG_FILE"
echo "📊 Monitor: ./monitor-services.sh"
echo "📋 Estado: docker-compose -f docker-compose.production.yml ps"
echo "🔍 Logs: docker-compose -f docker-compose.production.yml logs -f"
echo ""
echo -e "${CYAN}🚨 COMANDOS ÚTILES${NC}"
echo "═════════════════════════════════════════"
echo "🔄 Reiniciar: docker-compose -f docker-compose.production.yml restart"
echo "🛑 Detener: docker-compose -f docker-compose.production.yml down"
echo "🚀 Iniciar: docker-compose -f docker-compose.production.yml up -d"
echo ""

# Verificación final
print_step "🔍" "Realizando verificación final..."

# Verificar estado de contenedores
BACKEND_STATUS=$(docker-compose -f docker-compose.production.yml ps -q restaurant-web-backend | wc -l)
NGINX_STATUS=$(docker-compose -f docker-compose.production.yml ps -q restaurant-web-nginx | wc -l)

if [ "$BACKEND_STATUS" -gt 0 ] && [ "$NGINX_STATUS" -gt 0 ]; then
    print_success "Todos los contenedores están funcionando"
else
    print_warning "Algunos contenedores pueden no estar funcionando correctamente"
    print_step "🔍" "Estado actual de contenedores:"
    docker-compose -f docker-compose.production.yml ps
fi

# Test de conectividad básico
if curl -s -f "http://localhost/health" > /dev/null 2>&1; then
    print_success "Servidor web respondiendo correctamente"
else
    print_warning "El servidor web puede no estar respondiendo"
fi

echo ""
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ DEPLOYMENT FINALIZADO - $(date)${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Logging final
echo "" >> "$LOG_FILE"
echo "=== DEPLOYMENT COMPLETADO ===" >> "$LOG_FILE"
echo "Finalizado: $(date)" >> "$LOG_FILE"
echo "Estado: EXITOSO" >> "$LOG_FILE"