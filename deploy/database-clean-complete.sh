#!/bin/bash

# ============================================================================
# Script para limpiar COMPLETAMENTE la base de datos
# Funciona en desarrollo local y EC2 (Docker)
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
RUNNING_ON_EC2=false
COMPOSE_FILE=""

# Detect environment
if [ -d "/opt/restaurant-web" ] && [ -f "/opt/restaurant-web/.env.ec2" ]; then
    RUNNING_ON_EC2=true
    cd /opt/restaurant-web
    
    if [ -f "docker-compose.ec2.yml" ]; then
        COMPOSE_FILE="docker-compose.ec2.yml"
    elif [ -f "docker-compose.yml" ]; then
        COMPOSE_FILE="docker-compose.yml"
    fi
elif [ -f "backend/manage.py" ]; then
    # Running from project root
    cd backend
elif [ -f "manage.py" ]; then
    # Already in backend directory
    :
else
    echo -e "${RED}❌ Error: No se encontró el proyecto Django${NC}"
    echo "Ejecutar desde la raíz del proyecto o directorio backend/"
    exit 1
fi

echo -e "${BLUE}🗑️  LIMPIEZA COMPLETA DE BASE DE DATOS${NC}"
echo "========================================"
echo ""

if [ "$RUNNING_ON_EC2" = true ]; then
    echo -e "${YELLOW}🐳 Modo: EC2 Docker (${COMPOSE_FILE})${NC}"
else
    echo -e "${YELLOW}💻 Modo: Desarrollo Local${NC}"
fi

# Function to show what will be done
show_operations() {
    echo -e "${YELLOW}Esta operación realizará:${NC}"
    echo ""
    echo "  🗑️  ELIMINACIÓN COMPLETA DE DATOS:"
    echo "     • Todas las tablas de la aplicación"
    echo "     • Datos de configuración (unidades, zonas, mesas)"
    echo "     • Inventario (grupos, ingredientes, recetas)" 
    echo "     • Operaciones (órdenes, pagos, historial)"
    echo "     • Usuarios de Django (admin, staff)"
    echo ""
    echo "  🔄 REINICIO DE CONTADORES:"
    echo "     • Auto-increment IDs reseteados a 1"
    echo "     • Secuencias SQLite reiniciadas"
    echo ""
    echo "  ✅ PRESERVACIÓN:"
    echo "     • Estructura de tablas (schemas)"
    echo "     • Índices y constraints"
    echo "     • Migraciones de Django"
    echo ""
    echo -e "${RED}⚠️  ADVERTENCIA: Esta operación es IRREVERSIBLE${NC}"
    echo -e "${RED}⚠️  Todos los datos se perderán permanentemente${NC}"
    echo ""
}

# Function for local development cleanup
clean_local() {
    echo -e "${BLUE}🧹 Limpiando base de datos local...${NC}"
    echo ""
    
    # Check if Python command is available
    PYTHON_CMD="python"
    if command -v python3 >/dev/null 2>&1; then
        PYTHON_CMD="python3"
    elif command -v python >/dev/null 2>&1; then
        PYTHON_CMD="python"
    else
        echo -e "${RED}❌ Error: Python no encontrado${NC}"
        exit 1
    fi
    
    # Run Django cleanup command
    echo -e "${YELLOW}Ejecutando limpieza con Django...${NC}"
    $PYTHON_CMD manage.py clean_database --confirm
    
    echo ""
    echo -e "${GREEN}✅ Limpieza local completada${NC}"
}

# Function for EC2 Docker cleanup
clean_ec2() {
    echo -e "${BLUE}🐳 Limpiando base de datos en EC2 Docker...${NC}"
    echo ""
    
    if [ -z "$COMPOSE_FILE" ]; then
        echo -e "${RED}❌ Error: Archivo docker-compose no encontrado${NC}"
        exit 1
    fi
    
    # Check if containers are running
    if ! docker-compose -f $COMPOSE_FILE ps | grep -q "Up"; then
        echo -e "${YELLOW}⚠️  Contenedores no están ejecutándose, iniciando...${NC}"
        docker-compose -f $COMPOSE_FILE up -d
        sleep 5
    fi
    
    echo -e "${YELLOW}Ejecutando limpieza en contenedor Docker...${NC}"
    
    # Execute cleanup in Docker container
    docker-compose -f $COMPOSE_FILE exec -T web python manage.py clean_database --confirm
    
    echo ""
    echo -e "${GREEN}✅ Limpieza EC2 completada${NC}"
}

# Function to create automatic backup before cleanup
create_backup() {
    echo -e "${BLUE}💾 Creando backup automático antes de limpieza...${NC}"
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_NAME="backup_before_cleanup_${TIMESTAMP}"
    
    if [ "$RUNNING_ON_EC2" = true ]; then
        # Use existing EC2 backup script
        if [ -f "backend/scripts/backup_ec2.sh" ]; then
            bash backend/scripts/backup_ec2.sh --backup-name "${BACKUP_NAME}.json" --compress
        else
            echo -e "${YELLOW}⚠️  Script de backup EC2 no encontrado, continuando sin backup${NC}"
        fi
    else
        # Local backup using Django
        echo -e "${YELLOW}Creando backup local...${NC}"
        python manage.py dumpdata --natural-foreign --natural-primary --indent=2 > "${BACKUP_NAME}.json"
        gzip "${BACKUP_NAME}.json"
        echo -e "${GREEN}✅ Backup local creado: ${BACKUP_NAME}.json.gz${NC}"
    fi
    
    echo ""
}

# Main execution
main() {
    show_operations
    
    # Ask for confirmation
    echo -e "${YELLOW}¿Desea crear un backup automático antes de la limpieza? (y/N):${NC}"
    read -r create_backup_answer
    
    echo ""
    echo -e "${YELLOW}Para continuar con la LIMPIEZA COMPLETA, escriba 'CONFIRMAR LIMPIEZA':${NC}"
    read -r confirmation
    
    if [ "$confirmation" != "CONFIRMAR LIMPIEZA" ]; then
        echo -e "${YELLOW}Operación cancelada por el usuario${NC}"
        exit 0
    fi
    
    echo ""
    echo -e "${RED}🚨 INICIANDO LIMPIEZA COMPLETA EN 3 SEGUNDOS...${NC}"
    sleep 1
    echo -e "${RED}🚨 2...${NC}"
    sleep 1  
    echo -e "${RED}🚨 1...${NC}"
    sleep 1
    echo ""
    
    # Create backup if requested
    if [[ "$create_backup_answer" =~ ^[Yy]$ ]]; then
        create_backup
    fi
    
    # Execute cleanup based on environment
    if [ "$RUNNING_ON_EC2" = true ]; then
        clean_ec2
    else
        clean_local
    fi
    
    echo ""
    echo -e "${GREEN}🎉 LIMPIEZA COMPLETA FINALIZADA${NC}"
    echo ""
    echo -e "${BLUE}📋 Próximos pasos recomendados:${NC}"
    echo -e "${BLUE}   1. Poblad datos: usar script database-populate.sh${NC}"
    echo -e "${BLUE}   2. Crear superusuario: python manage.py createsuperuser${NC}"
    echo -e "${BLUE}   3. Verificar funcionalidad de la aplicación${NC}"
    echo ""
    echo -e "${YELLOW}💡 La base de datos está completamente limpia y lista para nuevos datos${NC}"
}

# Execute main function
main "$@"