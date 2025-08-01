#!/bin/bash

# ============================================================================
# Script para restaurar datos selectivos desde backup SQLite
# Solo pobla tablas específicas de configuración e inventario
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

# Tables to restore (configuration and inventory only)
TABLES_TO_RESTORE=(
    "unit"              # Unidades
    "zone"              # Zonas  
    "table"             # Mesas
    "container"         # Envases
    "group"             # Grupos
    "ingredient"        # Ingredientes
    "recipe"            # Recetas
    "recipe_item"       # Items de recetas (relación ingrediente-receta)
)

# Function to show help
show_help() {
    echo -e "${BLUE}🎯 RESTAURAR DATOS SELECTIVOS${NC}"
    echo "=============================="
    echo ""
    echo "Uso: $0 <archivo.sqlite3> [opciones]"
    echo ""
    echo "Opciones:"
    echo "  --force                     No pedir confirmación"
    echo "  --list-tables              Mostrar tablas que se restaurarán"
    echo "  --help                      Mostrar esta ayuda"
    echo ""
    echo "Tablas que se restauran:"
    for table in "${TABLES_TO_RESTORE[@]}"; do
        case $table in
            "unit") echo "  📏 unit - Unidades de medida" ;;
            "zone") echo "  🏢 zone - Zonas del restaurante" ;;
            "table") echo "  🪑 table - Mesas" ;;
            "container") echo "  📦 container - Envases" ;;
            "group") echo "  📁 group - Grupos de ingredientes" ;;
            "ingredient") echo "  🥕 ingredient - Ingredientes" ;;
            "recipe") echo "  📋 recipe - Recetas" ;;
            "recipe_item") echo "  🔗 recipe_item - Relación receta-ingrediente" ;;
        esac
    done
    echo ""
    echo "Ejemplos:"
    echo "  $0 data/backup.sqlite3"
    echo "  $0 backup.sqlite3 --force"
}

# Store original directory
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
    PROJECT_ROOT=true
elif [ -f "manage.py" ]; then
    PROJECT_ROOT=false
else
    echo -e "${RED}❌ Error: No se encontró el proyecto Django${NC}"
    exit 1
fi

# Verify arguments
if [ $# -eq 0 ]; then
    echo -e "${RED}❌ Error: Debe especificar el archivo SQLite${NC}"
    show_help
    exit 1
fi

BACKUP_FILE_PARAM="$1"
shift

# Resolve absolute path
if [[ "$BACKUP_FILE_PARAM" = /* ]]; then
    BACKUP_FILE="$BACKUP_FILE_PARAM"
else
    BACKUP_FILE="$ORIGINAL_DIR/$BACKUP_FILE_PARAM"
fi

# Process options
FORCE=false
LIST_TABLES=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE=true
            shift
            ;;
        --list-tables)
            LIST_TABLES=true
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

if [ "$LIST_TABLES" = true ]; then
    show_help
    exit 0
fi

# Change to backend directory if needed
if [ "$RUNNING_ON_EC2" != true ] && [ "$PROJECT_ROOT" = true ]; then
    cd backend
fi

echo -e "${BLUE}🎯 RESTAURAR DATOS SELECTIVOS${NC}"
echo "=============================="
echo ""

if [ "$RUNNING_ON_EC2" = true ]; then
    echo -e "${YELLOW}🐳 Modo: EC2 Docker (${COMPOSE_FILE})${NC}"
else
    echo -e "${YELLOW}💻 Modo: Desarrollo Local${NC}"
fi

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Error: Archivo no encontrado: $BACKUP_FILE${NC}"
    exit 1
fi

FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo -e "${BLUE}📁 Archivo: $BACKUP_FILE${NC}"
echo -e "${BLUE}💾 Tamaño: $FILE_SIZE${NC}"

# Verify it's a SQLite file
if ! file "$BACKUP_FILE" | grep -q "SQLite"; then
    echo -e "${YELLOW}⚠️  Advertencia: El archivo no parece ser SQLite${NC}"
    if [ "$FORCE" != true ]; then
        read -p "¿Continuar de todos modos? (y/N): " continue_anyway
        if [[ ! "$continue_anyway" =~ ^[Yy]$ ]]; then
            exit 0
        fi
    fi
fi

echo ""
echo -e "${BLUE}📋 Tablas que se restaurarán:${NC}"
for table in "${TABLES_TO_RESTORE[@]}"; do
    case $table in
        "unit") echo "  📏 $table - Unidades de medida" ;;
        "zone") echo "  🏢 $table - Zonas del restaurante" ;;
        "table") echo "  🪑 $table - Mesas" ;;
        "container") echo "  📦 $table - Envases" ;;
        "group") echo "  📁 $table - Grupos de ingredientes" ;;
        "ingredient") echo "  🥕 $table - Ingredientes" ;;
        "recipe") echo "  📋 $table - Recetas" ;;
        "recipe_item") echo "  🔗 $table - Relación receta-ingrediente" ;;
    esac
done

echo ""

# Confirmation
if [ "$FORCE" != true ]; then
    echo -e "${YELLOW}⚠️  Esta operación SOBRESCRIBIRÁ los datos existentes en estas tablas${NC}"
    echo -e "${YELLOW}¿Continuar con la restauración selectiva? (escriba 'SI RESTAURAR'):${NC}"
    read -r confirmation
    
    if [ "$confirmation" != "SI RESTAURAR" ]; then
        echo -e "${YELLOW}Operación cancelada${NC}"
        exit 0
    fi
fi

echo ""
echo -e "${YELLOW}🚀 Iniciando restauración selectiva...${NC}"
echo ""

# Function to extract and import specific tables
restore_selective_data() {
    echo -e "${BLUE}📊 Extrayendo datos selectivos del backup...${NC}"
    
    # Create temporary directory for extracted data
    TEMP_DIR=$(mktemp -d)
    TEMP_JSON="$TEMP_DIR/selective_data.json"
    
    echo "   📁 Directorio temporal: $TEMP_DIR"
    
    # Extract data from specific tables using sqlite3
    echo "   🔍 Extrayendo datos de tablas específicas..."
    
    # Create a script to extract specific table data as JSON
    EXTRACT_SCRIPT="$TEMP_DIR/extract.py"
    
    cat > "$EXTRACT_SCRIPT" << 'EOF'
import sqlite3
import json
import sys
import os

def extract_table_data(db_path, tables):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row  # This enables column access by name
    cursor = conn.cursor()
    
    all_data = []
    
    for table_name in tables:
        try:
            # Get table info to understand the structure
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns_info = cursor.fetchall()
            
            if not columns_info:
                print(f"   ⚠️  Tabla '{table_name}' no encontrada en el backup")
                continue
            
            # Get all data from the table
            cursor.execute(f"SELECT * FROM {table_name}")
            rows = cursor.fetchall()
            
            print(f"   📋 {table_name}: {len(rows)} registros")
            
            # Convert rows to the Django fixture format
            for row in rows:
                # Create a Django fixture entry
                fixture_entry = {
                    "model": f"config.{table_name}" if table_name in ["unit", "zone", "table", "container"] else f"inventory.{table_name}",
                    "pk": row[0] if row[0] else None,  # Assume first column is the primary key
                    "fields": {}
                }
                
                # Add all fields except the primary key
                for i, column_info in enumerate(columns_info):
                    column_name = column_info[1]  # Column name is at index 1
                    if i > 0:  # Skip primary key (first column)
                        fixture_entry["fields"][column_name] = row[i]
                
                all_data.append(fixture_entry)
                
        except sqlite3.Error as e:
            print(f"   ❌ Error con tabla '{table_name}': {e}")
            continue
    
    conn.close()
    return all_data

if __name__ == "__main__":
    db_path = sys.argv[1]
    tables = sys.argv[2].split(",")
    output_file = sys.argv[3]
    
    print(f"📖 Leyendo backup: {db_path}")
    
    data = extract_table_data(db_path, tables)
    
    print(f"💾 Guardando {len(data)} registros en {output_file}")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)
    
    print("✅ Extracción completada")
EOF

    # Run extraction
    TABLES_STR=$(IFS=,; echo "${TABLES_TO_RESTORE[*]}")
    
    if [ "$RUNNING_ON_EC2" = true ]; then
        # Copy files to container and run extraction
        docker-compose -f $COMPOSE_FILE exec -T web python -c "
import tempfile
import os

# Create temp directory in container
temp_dir = tempfile.mkdtemp()
print(f'Directorio temporal en contenedor: {temp_dir}')
"
        
        # Copy backup file and script to container
        docker cp "$BACKUP_FILE" $(docker-compose -f $COMPOSE_FILE ps -q web):/tmp/backup_source.sqlite3
        docker cp "$EXTRACT_SCRIPT" $(docker-compose -f $COMPOSE_FILE ps -q web):/tmp/extract.py
        
        # Run extraction in container
        docker-compose -f $COMPOSE_FILE exec -T web python /tmp/extract.py /tmp/backup_source.sqlite3 "$TABLES_STR" /tmp/selective_data.json
        
        # Copy result back
        docker cp $(docker-compose -f $COMPOSE_FILE ps -q web):/tmp/selective_data.json "$TEMP_JSON"
        
    else
        # Local execution
        python3 "$EXTRACT_SCRIPT" "$BACKUP_FILE" "$TABLES_STR" "$TEMP_JSON"
    fi
    
    if [ ! -f "$TEMP_JSON" ]; then
        echo -e "${RED}❌ Error: No se pudo extraer los datos${NC}"
        rm -rf "$TEMP_DIR"
        return 1
    fi
    
    # Load extracted data
    echo ""
    echo -e "${BLUE}📥 Cargando datos extraídos...${NC}"
    
    if [ "$RUNNING_ON_EC2" = true ]; then
        # Copy JSON to container and load
        docker cp "$TEMP_JSON" $(docker-compose -f $COMPOSE_FILE ps -q web):/tmp/selective_data.json
        docker-compose -f $COMPOSE_FILE exec -T web python manage.py loaddata /tmp/selective_data.json
    else
        # Local loading
        python3 manage.py loaddata "$TEMP_JSON"
    fi
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    echo -e "${GREEN}✅ Datos selectivos cargados exitosamente${NC}"
}

# Execute selective restoration
restore_selective_data

echo ""
echo -e "${BLUE}🔍 Verificando datos restaurados...${NC}"

# Verify restoration
if [ "$RUNNING_ON_EC2" = true ]; then
    docker-compose -f $COMPOSE_FILE exec -T web python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection

tables = ['unit', 'zone', 'table', 'container', 'group', 'ingredient', 'recipe', 'recipe_item']

with connection.cursor() as cursor:
    total_records = 0
    for table_name in tables:
        try:
            cursor.execute(f'SELECT COUNT(*) FROM {table_name}')
            count = cursor.fetchone()[0]
            total_records += count
            if count > 0:
                print(f'   📋 {table_name}: {count} registros')
        except Exception as e:
            print(f'   ❌ Error con {table_name}: {e}')
    
    print(f'\\n📈 Total restaurado: {total_records} registros')
"
else
    python3 -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection

tables = ['unit', 'zone', 'table', 'container', 'group', 'ingredient', 'recipe', 'recipe_item']

with connection.cursor() as cursor:
    total_records = 0
    for table_name in tables:
        try:
            cursor.execute(f'SELECT COUNT(*) FROM {table_name}')
            count = cursor.fetchone()[0]
            total_records += count
            if count > 0:
                print(f'   📋 {table_name}: {count} registros')
        except Exception as e:
            print(f'   ❌ Error con {table_name}: {e}')
    
    print(f'\\n📈 Total restaurado: {total_records} registros')
" 2>/dev/null || echo "   ⚠️  No se pudo verificar (entorno Django no disponible)"
fi

echo ""
echo -e "${GREEN}🎉 RESTAURACIÓN SELECTIVA COMPLETADA${NC}"
echo ""
echo -e "${BLUE}📋 Datos restaurados:${NC}"
echo -e "${BLUE}   ✅ Configuración: unidades, zonas, mesas, envases${NC}"
echo -e "${BLUE}   ✅ Inventario: grupos, ingredientes, recetas${NC}"
echo ""
echo -e "${YELLOW}💡 No se restauraron: usuarios, órdenes, pagos${NC}"
echo ""