#!/bin/bash

# ============================================================================
# Script para restaurar datos selectivos usando SQL directo
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

# Tables to restore
TABLES_TO_RESTORE="unit zone table container group ingredient recipe recipe_item"

# Function to get table description
get_table_description() {
    case "$1" in
        "unit") echo "Unidades de medida" ;;
        "zone") echo "Zonas del restaurante" ;;
        "table") echo "Mesas" ;;
        "container") echo "Envases" ;;
        "group") echo "Grupos de ingredientes" ;;
        "ingredient") echo "Ingredientes" ;;
        "recipe") echo "Recetas" ;;
        "recipe_item") echo "Relación receta-ingrediente" ;;
        *) echo "Tabla desconocida" ;;
    esac
}

# Function to show help
show_help() {
    echo -e "${BLUE}🎯 RESTAURAR DATOS SELECTIVOS (SQL)${NC}"
    echo "=================================="
    echo ""
    echo "Uso: $0 <archivo.sqlite3> [opciones]"
    echo ""
    echo "Opciones:"
    echo "  --force                     No pedir confirmación"
    echo "  --clean-first              Limpiar tablas antes de restaurar"
    echo "  --list-tables              Mostrar tablas que se restaurarán"
    echo "  --help                      Mostrar esta ayuda"
    echo ""
    echo "Tablas que se restauran:"
    for table in $TABLES_TO_RESTORE; do
        echo "  📋 $table - $(get_table_description "$table")"
    done
    echo ""
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
CLEAN_FIRST=false
LIST_TABLES=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE=true
            shift
            ;;
        --clean-first)
            CLEAN_FIRST=true
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

echo -e "${BLUE}🎯 RESTAURAR DATOS SELECTIVOS (SQL)${NC}"
echo "=================================="
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

# Analyze backup content
echo -e "${BLUE}🔍 Analizando contenido del backup...${NC}"
sqlite3 "$BACKUP_FILE" "
.headers off
.mode list
SELECT 
    name || ':' || (SELECT COUNT(*) FROM \"' || name || '\") 
FROM sqlite_master 
WHERE type='table' 
AND name IN ('unit','zone','table','container','group','ingredient','recipe','recipe_item')
ORDER BY name;
" 2>/dev/null | while IFS=':' read -r table_name count; do
    if [ -n "$table_name" ] && [ -n "$count" ]; then
        echo "   📋 $table_name: $count registros disponibles"
    fi
done

echo ""
echo -e "${BLUE}📋 Tablas que se restaurarán:${NC}"
for table in $TABLES_TO_RESTORE; do
    echo "  📋 $table - $(get_table_description "$table")"
done

if [ "$CLEAN_FIRST" = true ]; then
    echo -e "${BLUE}🧹 Se limpiarán las tablas antes de restaurar${NC}"
fi

echo ""

# Confirmation
if [ "$FORCE" != true ]; then
    echo -e "${YELLOW}⚠️  Esta operación modificará los datos de configuración e inventario${NC}"
    echo -e "${YELLOW}¿Continuar con la restauración selectiva? (escriba 'SI RESTAURAR'):${NC}"
    read -r confirmation
    
    if [ "$confirmation" != "SI RESTAURAR" ]; then
        echo -e "${YELLOW}Operación cancelada${NC}"
        exit 0
    fi
fi

echo ""
echo -e "${YELLOW}🚀 Iniciando restauración selectiva SQL...${NC}"
echo ""

# Function to get target database path
get_target_db_path() {
    if [ "$RUNNING_ON_EC2" = true ]; then
        echo "/app/db.sqlite3"
    else
        echo "db.sqlite3"
    fi
}

# Function to execute SQL in target database
execute_sql() {
    local sql="$1"
    local description="$2"
    
    if [ -n "$description" ]; then
        echo "   $description"
    fi
    
    if [ "$RUNNING_ON_EC2" = true ]; then
        # Execute SQL in Docker container
        docker-compose -f $COMPOSE_FILE exec -T web sqlite3 /app/db.sqlite3 "$sql"
    else
        # Execute SQL locally
        sqlite3 db.sqlite3 "$sql"
    fi
}

# Function to copy data from source to target
copy_table_data() {
    local table_name="$1"
    local description="$(get_table_description "$table_name")"
    
    echo -e "${BLUE}📋 Procesando: $table_name ($description)${NC}"
    
    # Create temporary SQL file
    TEMP_SQL=$(mktemp)
    
    # Generate SQL to copy data
    cat > "$TEMP_SQL" << EOF
-- Attach source database
ATTACH DATABASE '$BACKUP_FILE' AS source;

-- Clean target table if requested
EOF
    
    if [ "$CLEAN_FIRST" = true ]; then
        echo "DELETE FROM main.\"$table_name\";" >> "$TEMP_SQL"
        echo "   🧹 Limpiando tabla $table_name"
    fi
    
    cat >> "$TEMP_SQL" << EOF

-- Copy data from source to target
INSERT OR REPLACE INTO main."$table_name" 
SELECT * FROM source."$table_name";

-- Get count of copied records
SELECT '   ✅ ' || '$table_name' || ': ' || COUNT(*) || ' registros copiados' FROM main."$table_name";

-- Detach source database
DETACH DATABASE source;
EOF
    
    # Check if target table exists first
    if [ "$RUNNING_ON_EC2" = true ]; then
        TABLE_EXISTS=$(docker-compose -f $COMPOSE_FILE exec -T web sqlite3 /app/db.sqlite3 "SELECT name FROM sqlite_master WHERE type='table' AND name='$table_name';" 2>/dev/null || echo "")
    else
        TABLE_EXISTS=$(sqlite3 db.sqlite3 "SELECT name FROM sqlite_master WHERE type='table' AND name='$table_name';" 2>/dev/null || echo "")
    fi
    
    if [ -z "$TABLE_EXISTS" ]; then
        echo "   ⚠️  Tabla $table_name no existe en destino, saltando..."
        rm "$TEMP_SQL"
        return 0
    fi
    
    # Execute the SQL
    if [ "$RUNNING_ON_EC2" = true ]; then
        # Copy SQL file to container and execute
        docker cp "$TEMP_SQL" $(docker-compose -f $COMPOSE_FILE ps -q web):/tmp/copy_table.sql
        docker-compose -f $COMPOSE_FILE exec -T web sqlite3 /app/db.sqlite3 ".read /tmp/copy_table.sql" 2>/dev/null || echo "   ❌ Error procesando $table_name"
        docker-compose -f $COMPOSE_FILE exec -T web rm /tmp/copy_table.sql
    else
        # Execute locally
        sqlite3 db.sqlite3 ".read $TEMP_SQL" 2>/dev/null || echo "   ❌ Error procesando $table_name"
    fi
    
    # Clean up
    rm "$TEMP_SQL"
}

# Process each table
for table in $TABLES_TO_RESTORE; do
    copy_table_data "$table"
done

echo ""
echo -e "${BLUE}🔍 Verificando datos restaurados...${NC}"

# Final verification
VERIFICATION_SQL="
.headers off
.mode list
"

for table in $TABLES_TO_RESTORE; do
    VERIFICATION_SQL+="SELECT '$table:' || COUNT(*) FROM \"$table\";"$'\n'
done

if [ "$RUNNING_ON_EC2" = true ]; then
    # Execute verification in container
    docker-compose -f $COMPOSE_FILE exec -T web sqlite3 /app/db.sqlite3 "$VERIFICATION_SQL" | while IFS=':' read -r table_name count; do
        if [ -n "$table_name" ] && [ -n "$count" ]; then
            echo "   📋 $table_name: $count registros"
        fi
    done
else
    # Execute verification locally
    sqlite3 db.sqlite3 "$VERIFICATION_SQL" | while IFS=':' read -r table_name count; do
        if [ -n "$table_name" ] && [ -n "$count" ]; then
            echo "   📋 $table_name: $count registros"
        fi
    done
fi

echo ""
echo -e "${GREEN}🎉 RESTAURACIÓN SELECTIVA COMPLETADA${NC}"
echo ""
echo -e "${BLUE}📋 Datos restaurados:${NC}"
echo -e "${BLUE}   ✅ Configuración: unidades, zonas, mesas, envases${NC}"
echo -e "${BLUE}   ✅ Inventario: grupos, ingredientes, recetas${NC}"
echo ""
echo -e "${YELLOW}💡 No se modificaron: usuarios, órdenes, pagos${NC}"
echo ""
echo -e "${BLUE}📋 Próximos pasos:${NC}"
echo -e "${BLUE}   1. Verificar datos en la aplicación web${NC}"
echo -e "${BLUE}   2. Crear/verificar usuarios administrativos${NC}"
echo -e "${BLUE}   3. Probar funcionalidad básica${NC}"
echo ""