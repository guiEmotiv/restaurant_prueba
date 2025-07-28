#!/bin/bash
# Script específico para EC2 para crear backup completo de la base de datos

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Función para mostrar ayuda
show_help() {
    echo -e "${BLUE}🍽️  BACKUP DE BASE DE DATOS - EC2${NC}"
    echo "======================================"
    echo ""
    echo "Uso: $0 [opciones]"
    echo ""
    echo "Opciones:"
    echo "  --backup-name nombre.sql     Nombre específico para el backup"
    echo "  --compress                   Comprimir el backup con gzip"
    echo "  --data-only                  Solo datos (sin estructura)"
    echo "  --schema-only                Solo estructura (sin datos)"
    echo "  --help                       Mostrar esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0                                    # Backup completo"
    echo "  $0 --backup-name mi_backup.sql      # Nombre específico"
    echo "  $0 --compress                        # Backup comprimido"
    echo "  $0 --data-only --compress           # Solo datos comprimido"
}

# Procesar argumentos
BACKUP_NAME=""
COMPRESS=false
DATA_ONLY=false
SCHEMA_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --backup-name)
            BACKUP_NAME="$2"
            shift 2
            ;;
        --compress)
            COMPRESS=true
            shift
            ;;
        --data-only)
            DATA_ONLY=true
            shift
            ;;
        --schema-only)
            SCHEMA_ONLY=true
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

echo -e "${YELLOW}🍽️  BACKUP DE BASE DE DATOS - EC2${NC}"
echo "======================================"

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

# Generar nombre de archivo si no se especifica
if [[ -z "$BACKUP_NAME" ]]; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    if [[ "$DATA_ONLY" == true ]]; then
        BACKUP_NAME="backup_data_${TIMESTAMP}.sql"
    elif [[ "$SCHEMA_ONLY" == true ]]; then
        BACKUP_NAME="backup_schema_${TIMESTAMP}.sql"
    else
        BACKUP_NAME="backup_full_${TIMESTAMP}.sql"
    fi
fi

# Agregar extensión .gz si se comprime
if [[ "$COMPRESS" == true ]]; then
    BACKUP_NAME="${BACKUP_NAME}.gz"
fi

# Mostrar configuración
echo -e "${BLUE}📁 Archivo de backup: $BACKUP_NAME${NC}"
if [[ "$DATA_ONLY" == true ]]; then
    echo -e "${BLUE}📋 Tipo: Solo datos${NC}"
elif [[ "$SCHEMA_ONLY" == true ]]; then
    echo -e "${BLUE}📋 Tipo: Solo estructura${NC}"
else
    echo -e "${BLUE}📋 Tipo: Completo (estructura + datos)${NC}"
fi

if [[ "$COMPRESS" == true ]]; then
    echo -e "${BLUE}🗜️  Compresión: Habilitada${NC}"
else
    echo -e "${BLUE}🗜️  Compresión: Deshabilitada${NC}"
fi

echo ""
echo -e "${YELLOW}Creando backup de la base de datos...${NC}"
echo ""

# Ejecutar script Python dentro del contenedor
PYTHON_SCRIPT="
import os
import sys
import django
import gzip
from datetime import datetime

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.core.management import call_command
from django.db import connection
from io import StringIO

def create_database_backup():
    print('=' * 60)
    print('CREANDO BACKUP DE BASE DE DATOS')
    print('=' * 60)
    
    backup_name = '$BACKUP_NAME'
    compress = $COMPRESS
    data_only = $DATA_ONLY  
    schema_only = $SCHEMA_ONLY
    
    print(f'📁 Archivo: {backup_name}')
    print(f'📋 Tipo: {\"Solo datos\" if data_only else \"Solo estructura\" if schema_only else \"Completo\"}')
    print(f'🗜️  Compresión: {\"Sí\" if compress else \"No\"}')
    print()
    
    try:
        # Obtener estadísticas de la base de datos
        with connection.cursor() as cursor:
            # Contar tablas principales
            cursor.execute(\"\"\"
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
                ORDER BY name
            \"\"\")
            tables = cursor.fetchall()
            
            print('📊 TABLAS EN LA BASE DE DATOS:')
            total_records = 0
            
            for (table_name,) in tables:
                cursor.execute(f'SELECT COUNT(*) FROM \"{table_name}\"')
                count = cursor.fetchone()[0]
                total_records += count
                print(f'   📋 {table_name}: {count} registros')
            
            print(f'\\n📈 Total de registros: {total_records}')
            print()
        
        print('💾 Generando backup...')
        
        # Crear el backup usando dumpdata de Django
        output = StringIO()
        
        if schema_only:
            # Solo estructura - usar SQL directo
            with connection.cursor() as cursor:
                cursor.execute(\"\"\"
                    SELECT sql || ';' FROM sqlite_master 
                    WHERE type IN ('table', 'index', 'trigger', 'view') 
                    AND name NOT LIKE 'sqlite_%'
                    ORDER BY type, name
                \"\"\")
                
                schema_sql = []
                for (sql,) in cursor.fetchall():
                    if sql and sql.strip():
                        schema_sql.append(sql)
                
                backup_content = '\\n'.join(schema_sql)
        
        elif data_only:
            # Solo datos - usar dumpdata
            call_command('dumpdata', 
                        '--natural-foreign', 
                        '--natural-primary',
                        '--indent=2',
                        stdout=output)
            backup_content = output.getvalue()
        
        else:
            # Backup completo - estructura + datos
            # Primero la estructura
            with connection.cursor() as cursor:
                cursor.execute(\"\"\"
                    SELECT sql || ';' FROM sqlite_master 
                    WHERE type IN ('table', 'index', 'trigger', 'view') 
                    AND name NOT LIKE 'sqlite_%'
                    ORDER BY type, name
                \"\"\")
                
                schema_sql = []
                for (sql,) in cursor.fetchall():
                    if sql and sql.strip():
                        schema_sql.append(sql)
            
            # Luego los datos
            call_command('dumpdata', 
                        '--natural-foreign', 
                        '--natural-primary',
                        '--indent=2',
                        stdout=output)
            
            backup_content = '-- ESTRUCTURA DE BASE DE DATOS\\n'
            backup_content += '-- Generado: ' + datetime.now().isoformat() + '\\n\\n'
            backup_content += '\\n'.join(schema_sql) + '\\n\\n'
            backup_content += '-- DATOS DE BASE DE DATOS\\n'
            backup_content += '-- Usar: python manage.py loaddata archivo.json\\n\\n'
            backup_content += output.getvalue()
        
        # Escribir archivo
        base_name = backup_name.replace('.gz', '') if compress else backup_name
        
        if compress:
            with gzip.open(backup_name, 'wt', encoding='utf-8') as f:
                f.write(backup_content)
        else:
            with open(backup_name, 'w', encoding='utf-8') as f:
                f.write(backup_content)
        
        # Obtener tamaño del archivo
        import os
        file_size = os.path.getsize(backup_name)
        file_size_mb = file_size / (1024 * 1024)
        
        print('✅ BACKUP CREADO EXITOSAMENTE')
        print(f'   📁 Archivo: {backup_name}')
        print(f'   💾 Tamaño: {file_size_mb:.2f} MB')
        print(f'   📊 Registros: {total_records}')
        print(f'   📅 Fecha: {datetime.now().strftime(\"%Y-%m-%d %H:%M:%S\")}')
        
    except Exception as e:
        print(f'❌ ERROR: {str(e)}')
        return False
    
    print('=' * 60)
    return True

# Ejecutar backup
success = create_database_backup()
sys.exit(0 if success else 1)
"

# Convertir booleanos de bash a Python
COMPRESS_PY=$([ "$COMPRESS" = true ] && echo "True" || echo "False")
DATA_ONLY_PY=$([ "$DATA_ONLY" = true ] && echo "True" || echo "False")
SCHEMA_ONLY_PY=$([ "$SCHEMA_ONLY" = true ] && echo "True" || echo "False")

# Reemplazar variables en el script Python
PYTHON_SCRIPT=$(echo "$PYTHON_SCRIPT" | sed "s/\$BACKUP_NAME/$BACKUP_NAME/g")
PYTHON_SCRIPT=$(echo "$PYTHON_SCRIPT" | sed "s/\$COMPRESS/$COMPRESS_PY/g")
PYTHON_SCRIPT=$(echo "$PYTHON_SCRIPT" | sed "s/\$DATA_ONLY/$DATA_ONLY_PY/g")
PYTHON_SCRIPT=$(echo "$PYTHON_SCRIPT" | sed "s/\$SCHEMA_ONLY/$SCHEMA_ONLY_PY/g")

# Ejecutar en el contenedor
docker-compose -f $COMPOSE_FILE exec -T web python -c "$PYTHON_SCRIPT"

# Verificar resultado
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Backup creado exitosamente${NC}"
    echo -e "${BLUE}📄 Información del backup:${NC}"
    echo -e "${BLUE}   - Contiene estructura completa de tablas${NC}"
    echo -e "${BLUE}   - Incluye todos los datos actuales${NC}"
    echo -e "${BLUE}   - Compatible con Django loaddata${NC}"
    echo -e "${BLUE}   - Preserva relaciones y constraints${NC}"
    echo ""
    echo -e "${YELLOW}💡 Para restaurar el backup:${NC}"
    echo -e "${YELLOW}   1. Limpiar base de datos actual${NC}"
    echo -e "${YELLOW}   2. Ejecutar migraciones: python manage.py migrate${NC}"
    echo -e "${YELLOW}   3. Cargar datos: python manage.py loaddata $BACKUP_NAME${NC}"
else
    echo ""
    echo -e "${RED}❌ Error durante la creación del backup${NC}"
    exit 1
fi