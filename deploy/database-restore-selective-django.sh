#!/bin/bash

# ============================================================================
# Script para restaurar datos selectivos usando Django ORM
# Funciona sin sqlite3 ejecutable en contenedor Docker
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
    echo -e "${BLUE}🎯 RESTAURAR DATOS SELECTIVOS (DJANGO)${NC}"
    echo "====================================="
    echo ""
    echo "Uso: $0 <archivo.sqlite3> [opciones]"
    echo ""
    echo "Opciones:"
    echo "  --force                     No pedir confirmación"
    echo "  --clean-first              Limpiar tablas antes de restaurar"
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

# Change to backend directory if needed
if [ "$RUNNING_ON_EC2" != true ] && [ "$PROJECT_ROOT" = true ]; then
    cd backend
fi

echo -e "${BLUE}🎯 RESTAURAR DATOS SELECTIVOS (DJANGO)${NC}"
echo "====================================="
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
echo -e "${YELLOW}🚀 Iniciando restauración selectiva Django...${NC}"
echo ""

# Create Django script for selective restoration
DJANGO_SCRIPT="
import os
import sys
import django
import sqlite3
from django.db import connection, transaction
from django.conf import settings

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

def restore_selective_data(backup_path, tables_to_restore, clean_first=False):
    print('📋 Iniciando restauración selectiva...')
    
    # Connect to backup database
    backup_conn = sqlite3.connect(backup_path)
    backup_conn.row_factory = sqlite3.Row
    backup_cursor = backup_conn.cursor()
    
    # Use Django's database connection
    from django.db import connection as django_connection
    
    total_restored = 0
    
    try:
        with transaction.atomic():
            for table_name in tables_to_restore:
                print(f'\\n📋 Procesando: {table_name}')
                
                # Check if table exists in target using Django connection
                with django_connection.cursor() as target_cursor:
                    target_cursor.execute(\"\"\"
                        SELECT name FROM sqlite_master 
                        WHERE type='table' AND name=%s
                    \"\"\", [table_name])
                    
                    if not target_cursor.fetchone():
                        print(f'   ⚠️  Tabla {table_name} no existe en destino, saltando...')
                        continue
                
                # Check if table has data in backup
                try:
                    backup_cursor.execute(f'SELECT COUNT(*) FROM \"{table_name}\"')
                    backup_count = backup_cursor.fetchone()[0]
                    
                    if backup_count == 0:
                        print(f'   ⚠️  No hay datos en {table_name} del backup')
                        continue
                        
                    print(f'   📊 {backup_count} registros disponibles en backup')
                    
                except sqlite3.Error as e:
                    print(f'   ❌ Error accediendo a tabla {table_name} en backup: {e}')
                    continue
                
                # Clean target table if requested
                if clean_first:
                    print(f'   🧹 Limpiando tabla {table_name}')
                    with django_connection.cursor() as target_cursor:
                        target_cursor.execute(f'DELETE FROM \"{table_name}\"')
                
                # Get table structure from target
                with django_connection.cursor() as target_cursor:
                    target_cursor.execute(f'PRAGMA table_info(\"{table_name}\")')
                    columns_info = target_cursor.fetchall()
                    column_names = [col[1] for col in columns_info]
                
                # Fetch all data from backup
                backup_cursor.execute(f'SELECT * FROM \"{table_name}\"')
                backup_rows = backup_cursor.fetchall()
                
                # Insert data into target
                placeholders = ','.join(['%s' for _ in column_names])
                insert_sql = f'INSERT OR REPLACE INTO \"{table_name}\" ({','.join([f'\"{col}\"' for col in column_names])}) VALUES ({placeholders})'
                
                inserted_count = 0
                with django_connection.cursor() as target_cursor:
                    for row in backup_rows:
                        try:
                            # Convert Row to list, handling only available columns
                            row_values = []
                            for col_name in column_names:
                                try:
                                    row_values.append(row[col_name])
                                except (IndexError, KeyError):
                                    row_values.append(None)
                            
                            target_cursor.execute(insert_sql, row_values)
                            inserted_count += 1
                        except Exception as e:
                            print(f'   ⚠️  Error insertando registro en {table_name}: {e}')
                            continue
                
                print(f'   ✅ {table_name}: {inserted_count} registros copiados')
                total_restored += inserted_count
                
    except Exception as e:
        print(f'❌ Error durante la restauración: {e}')
        return False
        
    finally:
        backup_conn.close()
    
    print(f'\\n📈 Total restaurado: {total_restored} registros')
    return True

def verify_restored_data(tables_to_restore):
    print('\\n🔍 Verificando datos restaurados...')
    
    from django.db import connection as django_connection
    
    with django_connection.cursor() as cursor:
        for table_name in tables_to_restore:
            try:
                cursor.execute(f'SELECT COUNT(*) FROM \"{table_name}\"')
                count = cursor.fetchone()[0]
                if count > 0:
                    print(f'   📋 {table_name}: {count} registros')
            except Exception as e:
                print(f'   ❌ Error verificando {table_name}: {e}')

if __name__ == '__main__':
    backup_file = sys.argv[1]
    tables = sys.argv[2].split(',')
    clean_first = sys.argv[3].lower() == 'true' if len(sys.argv) > 3 else False
    
    print(f'📁 Archivo de backup: {backup_file}')
    print(f'📋 Tablas a restaurar: {', '.join(tables)}')
    print(f'🧹 Limpiar primero: {clean_first}')
    
    success = restore_selective_data(backup_file, tables, clean_first)
    
    if success:
        verify_restored_data(tables)
        print('\\n✅ Restauración completada exitosamente')
    else:
        print('\\n❌ Error durante la restauración')
        sys.exit(1)
"

# Prepare arguments
TABLES_ARG=$(echo $TABLES_TO_RESTORE | tr ' ' ',')
CLEAN_ARG=$([ "$CLEAN_FIRST" = true ] && echo "true" || echo "false")

# Execute Django script
if [ "$RUNNING_ON_EC2" = true ]; then
    # Copy backup file to container and execute
    CONTAINER_BACKUP="/tmp/selective_backup.sqlite3"
    
    echo "   📋 Copiando backup al contenedor..."
    docker cp "$BACKUP_FILE" $(docker-compose -f $COMPOSE_FILE ps -q web):$CONTAINER_BACKUP
    
    echo "   🚀 Ejecutando restauración en contenedor..."
    docker-compose -f $COMPOSE_FILE exec -T web python -c "$DJANGO_SCRIPT" "$CONTAINER_BACKUP" "$TABLES_ARG" "$CLEAN_ARG"
    
    # Cleanup
    docker-compose -f $COMPOSE_FILE exec -T web rm -f $CONTAINER_BACKUP
    
else
    # Local execution
    python3 -c "$DJANGO_SCRIPT" "$BACKUP_FILE" "$TABLES_ARG" "$CLEAN_ARG"
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