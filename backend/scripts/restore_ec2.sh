#!/bin/bash
# Script específico para EC2 para restaurar backup de base de datos

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Función para mostrar ayuda
show_help() {
    echo -e "${BLUE}🍽️  RESTAURAR BACKUP DE BASE DE DATOS - EC2${NC}"
    echo "=============================================="
    echo ""
    echo "Uso: $0 <archivo_backup> [opciones]"
    echo ""
    echo "Opciones:"
    echo "  --force                      No pedir confirmación"
    echo "  --clean-first               Limpiar base de datos antes de restaurar"
    echo "  --help                      Mostrar esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0 backup_full_20240128_140530.sql"
    echo "  $0 backup_data_20240128_140530.sql.gz --force"
    echo "  $0 backup_full_20240128_140530.sql --clean-first"
    echo ""
    echo "⚠️  ADVERTENCIA:"
    echo "   Este proceso puede sobrescribir datos existentes."
    echo "   Haga un backup antes de restaurar si es necesario."
}

# Verificar argumentos
if [ $# -eq 0 ]; then
    echo -e "${RED}❌ Error: Debe especificar el archivo de backup${NC}"
    show_help
    exit 1
fi

BACKUP_FILE="$1"
shift

# Procesar opciones
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

echo -e "${YELLOW}🍽️  RESTAURAR BACKUP DE BASE DE DATOS - EC2${NC}"
echo "=============================================="

# Verificar que el archivo existe
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Error: El archivo $BACKUP_FILE no existe${NC}"
    exit 1
fi

# Detectar archivo docker-compose
if [ -f "docker-compose.ec2.yml" ]; then
    COMPOSE_FILE="docker-compose.ec2.yml"
elif [ -f "docker-compose.yml" ]; then
    COMPOSE_FILE="docker-compose.yml"
else
    echo -e "${RED}❌ Error: No se encontró archivo docker-compose${NC}"
    exit 1
fi

echo -e "${YELLOW}Usando: $COMPOSE_FILE${NC}"
echo -e "${BLUE}📁 Archivo de backup: $BACKUP_FILE${NC}"

# Obtener información del archivo
FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo -e "${BLUE}💾 Tamaño del archivo: $FILE_SIZE${NC}"

# Detectar si es comprimido
IS_COMPRESSED=false
if [[ "$BACKUP_FILE" == *.gz ]]; then
    IS_COMPRESSED=true
    echo -e "${BLUE}🗜️  Archivo comprimido: Sí${NC}"
else
    echo -e "${BLUE}🗜️  Archivo comprimido: No${NC}"
fi

if [[ "$CLEAN_FIRST" == true ]]; then
    echo -e "${BLUE}🧹 Limpiar antes de restaurar: Sí${NC}"
fi

echo ""

# Confirmación si no es forzado
if [[ "$FORCE" != true ]]; then
    echo -e "${YELLOW}⚠️  ADVERTENCIA: Esta operación puede modificar o eliminar datos existentes${NC}"
    echo -e "${YELLOW}¿Está seguro de que desea continuar? (escriba 'SI RESTAURAR' para confirmar):${NC}"
    read -r confirmation
    
    if [ "$confirmation" != "SI RESTAURAR" ]; then
        echo -e "${YELLOW}Operación cancelada por el usuario${NC}"
        exit 0
    fi
fi

echo -e "${YELLOW}Iniciando proceso de restauración...${NC}"
echo ""

# Ejecutar script Python dentro del contenedor
PYTHON_SCRIPT="
import os
import sys
import django
import gzip
import json
from datetime import datetime

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.core.management import call_command
from django.db import connection, transaction
from io import StringIO
from django.core.management.base import CommandError

def restore_database_backup():
    print('=' * 60)
    print('RESTAURANDO BACKUP DE BASE DE DATOS')
    print('=' * 60)
    
    backup_file = '$BACKUP_FILE'
    is_compressed = $IS_COMPRESSED
    clean_first = $CLEAN_FIRST
    
    print(f'📁 Archivo: {backup_file}')
    print(f'🗜️  Comprimido: {\"Sí\" if is_compressed else \"No\"}')
    print(f'🧹 Limpiar primero: {\"Sí\" if clean_first else \"No\"}')
    print()
    
    try:
        # Leer contenido del archivo
        print('📖 Leyendo archivo de backup...')
        
        if is_compressed:
            with gzip.open(backup_file, 'rt', encoding='utf-8') as f:
                backup_content = f.read()
        else:
            with open(backup_file, 'r', encoding='utf-8') as f:
                backup_content = f.read()
        
        print(f'   📄 Contenido leído: {len(backup_content)} caracteres')
        
        # Limpiar base de datos si se solicita
        if clean_first:
            print('🧹 Limpiando base de datos actual...')
            
            with transaction.atomic():
                with connection.cursor() as cursor:
                    # Obtener todas las tablas
                    cursor.execute(\"\"\"
                        SELECT name FROM sqlite_master 
                        WHERE type='table' AND name NOT LIKE 'sqlite_%' 
                        AND name NOT LIKE 'django_%'
                        ORDER BY name
                    \"\"\")
                    tables = [row[0] for row in cursor.fetchall()]
                    
                    # Deshabilitar foreign keys temporalmente
                    cursor.execute('PRAGMA foreign_keys = OFF')
                    
                    # Eliminar datos de todas las tablas
                    for table in tables:
                        cursor.execute(f'DELETE FROM \"{table}\"')
                        deleted = cursor.rowcount
                        print(f'   ✓ {table}: {deleted} registros eliminados')
                    
                    # Rehabilitar foreign keys
                    cursor.execute('PRAGMA foreign_keys = ON')
            
            print('   ✅ Base de datos limpiada')
            print()
        
        # Determinar tipo de backup y restaurar
        print('🔄 Restaurando datos...')
        
        # Verificar si es un backup JSON de Django
        is_django_json = False
        try:
            if backup_content.strip().startswith('[') or backup_content.strip().startswith('{'):
                json.loads(backup_content)
                is_django_json = True
        except:
            pass
        
        if is_django_json:
            # Es un backup JSON de Django - usar loaddata
            print('   📋 Detectado: Backup JSON de Django')
            
            # Escribir contenido a archivo temporal
            temp_file = 'temp_restore.json'
            with open(temp_file, 'w', encoding='utf-8') as f:
                f.write(backup_content)
            
            try:
                # Usar loaddata para restaurar
                call_command('loaddata', temp_file, verbosity=2)
                print('   ✅ Datos restaurados con loaddata')
            finally:
                # Limpiar archivo temporal
                if os.path.exists(temp_file):
                    os.remove(temp_file)
        
        else:
            # Es un backup SQL - ejecutar como SQL
            print('   📋 Detectado: Backup SQL')
            
            with connection.cursor() as cursor:
                # Dividir en declaraciones SQL
                statements = [stmt.strip() for stmt in backup_content.split(';') if stmt.strip()]
                
                executed = 0
                for statement in statements:
                    if statement and not statement.startswith('--'):
                        try:
                            cursor.execute(statement)
                            executed += 1
                        except Exception as e:
                            # Ignorar errores de creación de tabla si ya existe
                            if 'already exists' not in str(e).lower():
                                print(f'   ⚠️  Advertencia en SQL: {str(e)[:100]}...')
                
                print(f'   ✅ Ejecutado: {executed} declaraciones SQL')
        
        # Verificar restauración
        print('\\n🔍 Verificando restauración...')
        with connection.cursor() as cursor:
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
            
            print(f'\\n📈 Total de registros restaurados: {total_records}')
        
        print('\\n✅ RESTAURACIÓN COMPLETADA EXITOSAMENTE')
        print(f'   📁 Archivo: {backup_file}')
        print(f'   📊 Registros: {total_records}')
        print(f'   📅 Fecha: {datetime.now().strftime(\"%Y-%m-%d %H:%M:%S\")}')
        
    except Exception as e:
        print(f'❌ ERROR: {str(e)}')
        return False
    
    print('=' * 60)
    return True

# Ejecutar restauración
success = restore_database_backup()
sys.exit(0 if success else 1)
"

# Convertir booleanos de bash a Python
IS_COMPRESSED_PY=$([ "$IS_COMPRESSED" = true ] && echo "True" || echo "False")
CLEAN_FIRST_PY=$([ "$CLEAN_FIRST" = true ] && echo "True" || echo "False")

# Reemplazar variables en el script Python
PYTHON_SCRIPT=$(echo "$PYTHON_SCRIPT" | sed "s|\$BACKUP_FILE|$BACKUP_FILE|g")
PYTHON_SCRIPT=$(echo "$PYTHON_SCRIPT" | sed "s/\$IS_COMPRESSED/$IS_COMPRESSED_PY/g")
PYTHON_SCRIPT=$(echo "$PYTHON_SCRIPT" | sed "s/\$CLEAN_FIRST/$CLEAN_FIRST_PY/g")

# Ejecutar en el contenedor
docker-compose -f $COMPOSE_FILE exec -T web python -c "$PYTHON_SCRIPT"

# Verificar resultado
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Backup restaurado exitosamente${NC}"
    echo -e "${BLUE}📄 Próximos pasos recomendados:${NC}"
    echo -e "${BLUE}   1. Verificar integridad de los datos${NC}"
    echo -e "${BLUE}   2. Probar funcionalidad de la aplicación${NC}"
    echo -e "${BLUE}   3. Verificar usuarios y permisos${NC}"
    echo -e "${BLUE}   4. Comprobar configuración de la aplicación${NC}"
else
    echo ""
    echo -e "${RED}❌ Error durante la restauración del backup${NC}"
    exit 1
fi