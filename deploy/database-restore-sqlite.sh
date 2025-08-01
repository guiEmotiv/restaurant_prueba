#!/bin/bash

# ============================================================================
# Script especializado para restaurar base de datos SQLite
# Maneja correctamente archivos .sqlite3 completos
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
BACKUP_FILE=""

# Function to show help
show_help() {
    echo -e "${BLUE}🗃️  RESTAURAR BASE DE DATOS SQLITE${NC}"
    echo "==================================="
    echo ""
    echo "Uso: $0 <archivo.sqlite3> [opciones]"
    echo ""
    echo "Opciones:"
    echo "  --force                     No pedir confirmación"
    echo "  --backup-current           Crear backup de BD actual antes"
    echo "  --help                      Mostrar esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0 data/backup-before-cleanup-20250721-165200.sqlite3"
    echo "  $0 backup.sqlite3 --force --backup-current"
    echo ""
}

# Store original directory before changing
ORIGINAL_DIR=$(pwd)

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
    # Running from project root - will change to backend later
    PROJECT_ROOT=true
elif [ -f "manage.py" ]; then
    # Already in backend directory
    PROJECT_ROOT=false
else
    echo -e "${RED}❌ Error: No se encontró el proyecto Django${NC}"
    echo "Ejecutar desde la raíz del proyecto o directorio backend/"
    exit 1
fi

# Verify arguments
if [ $# -eq 0 ]; then
    echo -e "${RED}❌ Error: Debe especificar el archivo SQLite${NC}"
    show_help
    exit 1
fi

# Get the backup file path relative to original directory
BACKUP_FILE_PARAM="$1"
shift

# Resolve absolute path before changing directories
if [[ "$BACKUP_FILE_PARAM" = /* ]]; then
    # Already absolute path
    BACKUP_FILE="$BACKUP_FILE_PARAM"
else
    # Relative path - make it absolute from original directory
    BACKUP_FILE="$ORIGINAL_DIR/$BACKUP_FILE_PARAM"
fi

# Process options
FORCE=false
BACKUP_CURRENT=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE=true
            shift
            ;;
        --backup-current)
            BACKUP_CURRENT=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Opción desconocida: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Now change to backend directory if needed
if [ "$RUNNING_ON_EC2" != true ] && [ "$PROJECT_ROOT" = true ]; then
    cd backend
fi

echo -e "${BLUE}🗃️  RESTAURAR BASE DE DATOS SQLITE${NC}"
echo "==================================="
echo ""

if [ "$RUNNING_ON_EC2" = true ]; then
    echo -e "${YELLOW}🐳 Modo: EC2 Docker (${COMPOSE_FILE})${NC}"
else
    echo -e "${YELLOW}💻 Modo: Desarrollo Local${NC}"
fi

# Verify backup file exists and get absolute path
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Error: Archivo no encontrado: $BACKUP_FILE${NC}"
    exit 1
fi

# Get absolute path (already resolved above)
BACKUP_FILE_ABS="$BACKUP_FILE"
FILE_SIZE=$(du -h "$BACKUP_FILE_ABS" | cut -f1)

echo -e "${BLUE}📁 Archivo: $BACKUP_FILE_ABS${NC}"
echo -e "${BLUE}💾 Tamaño: $FILE_SIZE${NC}"

# Verify it's a SQLite file
if ! file "$BACKUP_FILE_ABS" | grep -q "SQLite"; then
    echo -e "${YELLOW}⚠️  Advertencia: El archivo no parece ser una base de datos SQLite${NC}"
    if [ "$FORCE" != true ]; then
        read -p "¿Continuar de todos modos? (y/N): " continue_anyway
        if [[ ! "$continue_anyway" =~ ^[Yy]$ ]]; then
            echo "Operación cancelada"
            exit 0
        fi
    fi
fi

echo ""

# Function to create backup of current database
create_current_backup() {
    echo -e "${BLUE}💾 Creando backup de base de datos actual...${NC}"
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    CURRENT_BACKUP="backup_current_${TIMESTAMP}.sqlite3"
    
    if [ "$RUNNING_ON_EC2" = true ]; then
        # Copy from container to host
        docker-compose -f $COMPOSE_FILE exec -T web cp /app/db.sqlite3 /tmp/current_backup.sqlite3
        docker cp $(docker-compose -f $COMPOSE_FILE ps -q web):/tmp/current_backup.sqlite3 "$CURRENT_BACKUP"
    else
        if [ -f "db.sqlite3" ]; then
            cp db.sqlite3 "$CURRENT_BACKUP"
        else
            echo -e "${YELLOW}⚠️  No hay base de datos actual para respaldar${NC}"
            return 0
        fi
    fi
    
    if [ -f "$CURRENT_BACKUP" ]; then
        BACKUP_SIZE=$(du -h "$CURRENT_BACKUP" | cut -f1)
        echo -e "${GREEN}✅ Backup actual creado: $CURRENT_BACKUP ($BACKUP_SIZE)${NC}"
    fi
    
    echo ""
}

# Function to show database info
show_db_info() {
    local db_file="$1"
    local label="$2"
    
    echo -e "${BLUE}📊 $label:${NC}"
    
    if [ "$RUNNING_ON_EC2" = true ]; then
        # Execute inside container
        docker-compose -f $COMPOSE_FILE exec -T web python -c "
import sqlite3
import os

try:
    conn = sqlite3.connect('$db_file')
    cursor = conn.cursor()
    
    # Get table count and info
    cursor.execute(\"\"\"
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
    \"\"\")
    tables = cursor.fetchall()
    
    total_records = 0
    for (table_name,) in tables:
        cursor.execute(f'SELECT COUNT(*) FROM \"{table_name}\"')
        count = cursor.fetchone()[0]
        total_records += count
        if count > 0:
            print(f'   📋 {table_name}: {count} registros')
    
    print(f'\\n   📈 Total: {total_records} registros')
    
    # Check for users
    cursor.execute('SELECT COUNT(*) FROM auth_user WHERE 1')
    user_count = cursor.fetchone()[0]
    if user_count > 0:
        print(f'   👥 Usuarios: {user_count}')
    
    conn.close()
    
except Exception as e:
    print(f'   ❌ Error: {e}')
"
    else
        # Local execution
        python3 -c "
import sqlite3
import os

try:
    conn = sqlite3.connect('$db_file')
    cursor = conn.cursor()
    
    # Get table count and info
    cursor.execute(\"\"\"
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
    \"\"\")
    tables = cursor.fetchall()
    
    total_records = 0
    for (table_name,) in tables:
        cursor.execute(f'SELECT COUNT(*) FROM \"{table_name}\"')
        count = cursor.fetchone()[0]
        total_records += count
        if count > 0:
            print(f'   📋 {table_name}: {count} registros')
    
    print(f'\\n   📈 Total: {total_records} registros')
    
    # Check for users
    cursor.execute('SELECT COUNT(*) FROM auth_user WHERE 1')
    user_count = cursor.fetchone()[0]
    if user_count > 0:
        print(f'   👥 Usuarios: {user_count}')
    
    conn.close()
    
except Exception as e:
    print(f'   ❌ Error: {e}')
" 2>/dev/null || echo "   ⚠️  No se pudo analizar el archivo"
    fi
    
    echo ""
}

# Show info about backup file
echo -e "${YELLOW}Analizando archivo de backup...${NC}"
show_db_info "$BACKUP_FILE_ABS" "CONTENIDO DEL BACKUP"

# Confirmation if not forced
if [ "$FORCE" != true ]; then
    echo -e "${YELLOW}⚠️  Esta operación REEMPLAZARÁ completamente la base de datos actual${NC}"
    echo -e "${YELLOW}¿Continuar con la restauración? (escriba 'SI RESTAURAR'):${NC}"
    read -r confirmation
    
    if [ "$confirmation" != "SI RESTAURAR" ]; then
        echo -e "${YELLOW}Operación cancelada${NC}"
        exit 0
    fi
fi

echo ""

# Create backup of current database if requested
if [ "$BACKUP_CURRENT" = true ]; then
    create_current_backup
fi

echo -e "${YELLOW}🚀 Iniciando restauración de SQLite...${NC}"
echo ""

# Perform the restoration
if [ "$RUNNING_ON_EC2" = true ]; then
    echo -e "${YELLOW}🐳 Restaurando en EC2 Docker...${NC}"
    
    # Stop containers to safely replace database
    echo "   • Deteniendo contenedores..."
    docker-compose -f $COMPOSE_FILE down
    
    # Copy file into container volume
    echo "   • Copiando archivo de backup..."
    
    # Start a temporary container to copy the file
    docker-compose -f $COMPOSE_FILE run --rm \
        -v "$BACKUP_FILE_ABS:/tmp/backup.sqlite3:ro" \
        web sh -c "
            echo '   • Verificando archivo de backup...'
            ls -la /tmp/backup.sqlite3
            echo '   • Copiando a /app/db.sqlite3...'
            cp /tmp/backup.sqlite3 /app/db.sqlite3
            echo '   • Estableciendo permisos...'
            chmod 644 /app/db.sqlite3
            echo '   • Verificando copia...'
            ls -la /app/db.sqlite3
        "
    
    # Start containers again
    echo "   • Iniciando contenedores..."
    docker-compose -f $COMPOSE_FILE up -d
    
    # Wait for containers to be ready
    echo "   • Esperando que los contenedores estén listos..."
    sleep 5
    
else
    echo -e "${YELLOW}💻 Restaurando en desarrollo local...${NC}"
    
    echo "   • Copiando archivo..."
    cp "$BACKUP_FILE_ABS" db.sqlite3
    
    echo "   • Estableciendo permisos..."
    chmod 644 db.sqlite3
fi

echo ""
echo -e "${GREEN}✅ Restauración completada${NC}"
echo ""

# Verify restoration
echo -e "${YELLOW}🔍 Verificando restauración...${NC}"
if [ "$RUNNING_ON_EC2" = true ]; then
    show_db_info "/app/db.sqlite3" "BASE DE DATOS RESTAURADA"
else
    show_db_info "db.sqlite3" "BASE DE DATOS RESTAURADA"
fi

echo -e "${GREEN}🎉 RESTAURACIÓN DE SQLITE COMPLETADA EXITOSAMENTE${NC}"
echo ""
echo -e "${BLUE}📋 Próximos pasos recomendados:${NC}"
echo -e "${BLUE}   1. Verificar funcionalidad de la aplicación${NC}"
echo -e "${BLUE}   2. Probar autenticación con usuarios existentes${NC}"
echo -e "${BLUE}   3. Verificar integridad de los datos${NC}"
if [ "$RUNNING_ON_EC2" = true ]; then
    echo -e "${BLUE}   4. Reiniciar aplicación si es necesario${NC}"
fi
echo ""