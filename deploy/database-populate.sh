#!/bin/bash

# ============================================================================
# Script para poblar la base de datos desde backup o datos de prueba
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
BACKUP_FILE=""
POPULATE_TYPE=""

# Function to show help
show_help() {
    echo -e "${BLUE}🍽️  POBLAR BASE DE DATOS${NC}"
    echo "=========================="
    echo ""
    echo "Uso: $0 [opciones]"
    echo ""
    echo "Opciones:"
    echo "  --backup-file <archivo>     Archivo de backup para restaurar"
    echo "  --test-data                 Usar datos de prueba por defecto"
    echo "  --force                     No pedir confirmación"
    echo "  --help                      Mostrar esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0 --test-data                              # Datos de prueba"
    echo "  $0 --backup-file backup_20240128.json.gz   # Desde backup"
    echo "  $0 --backup-file backup_20240128.json --force  # Sin confirmación"
    echo ""
    echo "Archivos de backup disponibles:"
    find . -name "*.json" -o -name "*.json.gz" -o -name "backup*.sqlite3" 2>/dev/null | head -10 | while read file; do
        echo "  📁 $file"
    done
}

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

# Process arguments
FORCE=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --backup-file)
            BACKUP_FILE="$2"
            POPULATE_TYPE="backup"
            shift 2
            ;;
        --test-data)
            POPULATE_TYPE="test"
            shift
            ;;
        --force)
            FORCE=true
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

# Interactive selection if no option provided
if [ -z "$POPULATE_TYPE" ]; then
    echo -e "${BLUE}🍽️  POBLAR BASE DE DATOS${NC}"
    echo "=========================="
    echo ""
    echo "Seleccione el tipo de datos a poblar:"
    echo ""
    echo "1) Datos de prueba (configuración básica + datos demo)"
    echo "2) Restaurar desde archivo de backup"
    echo "3) Salir"
    echo ""
    read -p "Seleccione una opción (1-3): " choice
    
    case $choice in
        1)
            POPULATE_TYPE="test"
            ;;
        2)
            POPULATE_TYPE="backup"
            echo ""
            echo "Archivos de backup disponibles:"
            echo ""
            
            # Find backup files
            backup_files=()
            counter=1
            
            # Search for backup files in different locations
            for location in "." "../data" "data" "../" "backup" "scripts"; do
                if [ -d "$location" ]; then
                    while IFS= read -r -d '' file; do
                        backup_files+=("$file")
                        echo "$counter) $(basename "$file") ($(du -h "$file" | cut -f1))"
                        ((counter++))
                    done < <(find "$location" -maxdepth 1 \( -name "*.json" -o -name "*.json.gz" -o -name "backup*.sqlite3" \) -print0 2>/dev/null)
                fi
            done
            
            if [ ${#backup_files[@]} -eq 0 ]; then
                echo -e "${YELLOW}⚠️  No se encontraron archivos de backup${NC}"
                echo ""
                read -p "Ingrese la ruta completa del archivo de backup: " BACKUP_FILE
            else
                echo ""
                read -p "Seleccione un archivo (1-$((counter-1))) o ingrese ruta completa: " backup_choice
                
                if [[ "$backup_choice" =~ ^[0-9]+$ ]] && [ "$backup_choice" -ge 1 ] && [ "$backup_choice" -lt $counter ]; then
                    BACKUP_FILE="${backup_files[$((backup_choice-1))]}"
                else
                    BACKUP_FILE="$backup_choice"
                fi
            fi
            ;;
        3)
            echo "Saliendo..."
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Opción inválida${NC}"
            exit 1
            ;;
    esac
fi

echo ""
echo -e "${BLUE}🍽️  POBLAR BASE DE DATOS${NC}"
echo "=========================="
echo ""

if [ "$RUNNING_ON_EC2" = true ]; then
    echo -e "${YELLOW}🐳 Modo: EC2 Docker (${COMPOSE_FILE})${NC}"
else
    echo -e "${YELLOW}💻 Modo: Desarrollo Local${NC}"
fi

# Function to populate with test data
populate_test_data() {
    echo -e "${BLUE}🧪 Poblando con datos de prueba...${NC}"
    echo ""
    
    if [ "$RUNNING_ON_EC2" = true ]; then
        # Check if containers are running
        if ! docker-compose -f $COMPOSE_FILE ps | grep -q "Up"; then
            echo -e "${YELLOW}⚠️  Iniciando contenedores...${NC}"
            docker-compose -f $COMPOSE_FILE up -d
            sleep 5
        fi
        
        echo -e "${YELLOW}Ejecutando populate_test_data en Docker...${NC}"
        docker-compose -f $COMPOSE_FILE exec -T web python manage.py populate_test_data
    else
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
        
        echo -e "${YELLOW}Ejecutando populate_test_data localmente...${NC}"
        $PYTHON_CMD manage.py populate_test_data
    fi
    
    echo ""
    echo -e "${GREEN}✅ Datos de prueba poblados exitosamente${NC}"
}

# Function to populate from backup
populate_from_backup() {
    echo -e "${BLUE}📁 Poblando desde backup: $BACKUP_FILE${NC}"
    echo ""
    
    # Verify backup file exists
    if [ ! -f "$BACKUP_FILE" ]; then
        echo -e "${RED}❌ Error: Archivo de backup no encontrado: $BACKUP_FILE${NC}"
        exit 1
    fi
    
    # Get file info
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${BLUE}💾 Tamaño del archivo: $FILE_SIZE${NC}"
    
    # Detect file type
    IS_COMPRESSED=false
    IS_SQLITE=false
    IS_JSON=false
    
    if [[ "$BACKUP_FILE" == *.gz ]]; then
        IS_COMPRESSED=true
        echo -e "${BLUE}🗜️  Archivo comprimido: Sí${NC}"
    fi
    
    if [[ "$BACKUP_FILE" == *.sqlite3 ]]; then
        IS_SQLITE=true
        echo -e "${BLUE}📋 Tipo: Base de datos SQLite${NC}"
    elif [[ "$BACKUP_FILE" == *.json* ]]; then
        IS_JSON=true
        echo -e "${BLUE}📋 Tipo: Backup JSON de Django${NC}"
    else
        echo -e "${BLUE}📋 Tipo: Detectando automáticamente...${NC}"
    fi
    
    echo ""
    
    if [ "$IS_SQLITE" = true ]; then
        # SQLite file - use specialized restore script
        echo -e "${YELLOW}📋 Usando script especializado para SQLite...${NC}"
        
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        SQLITE_SCRIPT="$SCRIPT_DIR/database-restore-sqlite.sh"
        
        if [ -f "$SQLITE_SCRIPT" ]; then
            echo -e "${YELLOW}Ejecutando: $SQLITE_SCRIPT${NC}"
            bash "$SQLITE_SCRIPT" "$BACKUP_FILE" --force
        else
            echo -e "${RED}❌ Error: Script de restauración SQLite no encontrado${NC}"
            echo -e "${YELLOW}Intentando método básico...${NC}"
            
            if [ "$RUNNING_ON_EC2" = true ]; then
                # Basic EC2 method
                docker-compose -f $COMPOSE_FILE down
                docker-compose -f $COMPOSE_FILE run --rm -v "$(realpath "$BACKUP_FILE"):/backup.sqlite3" web sh -c "cp /backup.sqlite3 /app/db.sqlite3"
                docker-compose -f $COMPOSE_FILE up -d
            else
                # Basic local method
                cp "$BACKUP_FILE" db.sqlite3
            fi
        fi
        
        echo -e "${GREEN}✅ Base de datos SQLite restaurada${NC}"
        
    else
        # JSON backup - use Django loaddata
        if [ "$RUNNING_ON_EC2" = true ]; then
            # Copy file to container and execute loaddata
            if [ "$IS_COMPRESSED" = true ]; then
                echo -e "${YELLOW}Descomprimiendo y cargando en Docker...${NC}"
                gunzip -c "$BACKUP_FILE" | docker-compose -f $COMPOSE_FILE exec -T web python manage.py loaddata --format=json -
            else
                echo -e "${YELLOW}Cargando en Docker...${NC}"
                cat "$BACKUP_FILE" | docker-compose -f $COMPOSE_FILE exec -T web python manage.py loaddata --format=json -
            fi
        else
            # Local development
            PYTHON_CMD="python"
            if command -v python3 >/dev/null 2>&1; then
                PYTHON_CMD="python3"
            fi
            
            if [ "$IS_COMPRESSED" = true ]; then
                echo -e "${YELLOW}Descomprimiendo y cargando localmente...${NC}"
                gunzip -c "$BACKUP_FILE" | $PYTHON_CMD manage.py loaddata --format=json -
            else
                echo -e "${YELLOW}Cargando localmente...${NC}"
                $PYTHON_CMD manage.py loaddata "$BACKUP_FILE"
            fi
        fi
        
        echo -e "${GREEN}✅ Backup JSON cargado exitosamente${NC}"
    fi
}

# Function to verify populated data
verify_data() {
    echo ""
    echo -e "${BLUE}🔍 Verificando datos poblados...${NC}"
    
    if [ "$RUNNING_ON_EC2" = true ]; then
        docker-compose -f $COMPOSE_FILE exec -T web python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    cursor.execute(\"\"\"
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'django_%'
        ORDER BY name
    \"\"\")
    tables = cursor.fetchall()
    
    print('📊 DATOS EN LA BASE DE DATOS:')
    total_records = 0
    
    for (table_name,) in tables:
        cursor.execute(f'SELECT COUNT(*) FROM \"{table_name}\"')
        count = cursor.fetchone()[0]
        total_records += count
        if count > 0:
            print(f'   📋 {table_name}: {count} registros')
    
    print(f'\\n📈 Total de registros: {total_records}')
"
    else
        PYTHON_CMD="python"
        if command -v python3 >/dev/null 2>&1; then
            PYTHON_CMD="python3"
        fi
        
        $PYTHON_CMD -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    cursor.execute(\"\"\"
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'django_%'
        ORDER BY name
    \"\"\")
    tables = cursor.fetchall()
    
    print('📊 DATOS EN LA BASE DE DATOS:')
    total_records = 0
    
    for (table_name,) in tables:
        cursor.execute(f'SELECT COUNT(*) FROM \"{table_name}\"')
        count = cursor.fetchone()[0]
        total_records += count
        if count > 0:
            print(f'   📋 {table_name}: {count} registros')
    
    print(f'\\n📈 Total de registros: {total_records}')
"
    fi
}

# Main execution
main() {
    if [ "$POPULATE_TYPE" = "test" ]; then
        echo -e "${YELLOW}📋 Tipo: Datos de prueba${NC}"
    elif [ "$POPULATE_TYPE" = "backup" ]; then
        echo -e "${YELLOW}📋 Tipo: Backup - $BACKUP_FILE${NC}"
    fi
    
    echo ""
    
    # Confirmation if not forced
    if [ "$FORCE" != true ]; then
        echo -e "${YELLOW}¿Continuar con la población de datos? (y/N):${NC}"
        read -r confirmation
        
        if [[ ! "$confirmation" =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}Operación cancelada${NC}"
            exit 0
        fi
    fi
    
    echo ""
    echo -e "${YELLOW}🚀 Iniciando población de datos...${NC}"
    echo ""
    
    # Execute population based on type
    if [ "$POPULATE_TYPE" = "test" ]; then
        populate_test_data
    elif [ "$POPULATE_TYPE" = "backup" ]; then
        populate_from_backup
    fi
    
    # Verify populated data
    verify_data
    
    echo ""
    echo -e "${GREEN}🎉 POBLACIÓN DE DATOS COMPLETADA${NC}"
    echo ""
    echo -e "${BLUE}📋 Próximos pasos recomendados:${NC}"
    echo -e "${BLUE}   1. Crear superusuario: python manage.py createsuperuser${NC}"
    echo -e "${BLUE}   2. Verificar funcionalidad en navegador${NC}"
    echo -e "${BLUE}   3. Probar autenticación y permisos${NC}"
    echo ""
}

# Execute main function
main "$@"