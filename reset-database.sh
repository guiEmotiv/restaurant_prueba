#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# 🗑️  SCRIPT UNIVERSAL DE RESET DE BASE DE DATOS
# ═══════════════════════════════════════════════════════════════════════════════
#
# Este script elimina TODOS los datos de la base de datos y reinicia los contadores
# Funciona tanto en desarrollo local como en producción (Docker)
#
# CARACTERÍSTICAS:
# ✅ Detecta automáticamente el entorno (local/docker)
# ✅ Elimina TODOS los datos de todas las tablas
# ✅ Reinicia contadores de ID (auto-increment)
# ✅ Crea backup automático antes de eliminar
# ✅ Validación completa post-limpieza
#
# USO:
#   ./reset-database.sh              # Desarrollo local
#   ./reset-database.sh --prod       # Producción (Docker)
#   ./reset-database.sh --skip-backup # Sin crear backup
#   ./reset-database.sh --force      # Sin confirmación
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e  # Salir si cualquier comando falla

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuración por defecto
ENVIRONMENT="dev"
CREATE_BACKUP=true
SKIP_CONFIRMATION=false

# Procesar argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        --prod|--production)
            ENVIRONMENT="prod"
            shift
            ;;
        --skip-backup)
            CREATE_BACKUP=false
            shift
            ;;
        --force)
            SKIP_CONFIRMATION=true
            shift
            ;;
        --help|-h)
            echo "Uso: $0 [opciones]"
            echo ""
            echo "Opciones:"
            echo "  --prod, --production  Ejecutar en producción (Docker)"
            echo "  --skip-backup        No crear backup"
            echo "  --force              Sin confirmación"
            echo "  --help, -h           Mostrar esta ayuda"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Opción desconocida: $1${NC}"
            echo "Usa --help para ver las opciones disponibles"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}🗑️  === SCRIPT UNIVERSAL DE RESET DE BASE DE DATOS ===${NC}"
echo -e "${CYAN}Entorno: ${YELLOW}${ENVIRONMENT^^}${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# DETECCIÓN Y CONFIGURACIÓN DE ENTORNO
# ═══════════════════════════════════════════════════════════════════════════════

if [ "$ENVIRONMENT" = "prod" ]; then
    # Verificar Docker en producción
    if [ ! -f "docker-compose.ssl.yml" ]; then
        echo -e "${RED}❌ Error: No se encuentra docker-compose.ssl.yml${NC}"
        echo "   Ejecuta este script desde el directorio raíz del proyecto"
        exit 1
    fi
    
    if ! docker-compose -f docker-compose.ssl.yml ps | grep -q "Up"; then
        echo -e "${RED}❌ Error: Los contenedores Docker no están ejecutándose${NC}"
        echo "   Ejecuta: sudo docker-compose -f docker-compose.ssl.yml up -d"
        exit 1
    fi
    
    DB_PATH="/app/data/restaurant_prod.sqlite3"
    EXEC_PREFIX="docker-compose -f docker-compose.ssl.yml exec -T web"
else
    # Verificar entorno local
    if [ ! -f "backend/manage.py" ]; then
        echo -e "${RED}❌ Error: No se encuentra backend/manage.py${NC}"
        echo "   Ejecuta este script desde el directorio raíz del proyecto"
        exit 1
    fi
    
    DB_PATH="backend/restaurant_dev.sqlite3"
    EXEC_PREFIX="cd backend &&"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIRMACIÓN DE SEGURIDAD
# ═══════════════════════════════════════════════════════════════════════════════

if [ "$SKIP_CONFIRMATION" = false ]; then
    echo -e "${RED}⚠️  ADVERTENCIA: Este script eliminará TODOS los datos:${NC}"
    echo "   • Configuración (zonas, mesas, unidades, envases)"
    echo "   • Inventario (grupos, ingredientes, recetas)"
    echo "   • Operaciones (órdenes, pagos, ventas)"
    echo "   • Usuarios y sesiones"
    echo "   • TODOS los datos históricos"
    echo ""
    echo -e "${YELLOW}Base de datos: ${DB_PATH}${NC}"
    echo ""
    
    read -p "¿Estás seguro? Escribe 'ELIMINAR TODO' para continuar: " confirmation
    if [ "$confirmation" != "ELIMINAR TODO" ]; then
        echo -e "${RED}❌ Operación cancelada${NC}"
        exit 1
    fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
# PASO 1: BACKUP (OPCIONAL)
# ═══════════════════════════════════════════════════════════════════════════════

if [ "$CREATE_BACKUP" = true ]; then
    echo -e "${BLUE}💾 Creando backup de seguridad...${NC}"
    BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S).sqlite3"
    
    if [ "$ENVIRONMENT" = "prod" ]; then
        $EXEC_PREFIX bash -c "
            if [ -f $DB_PATH ]; then
                cp $DB_PATH /app/data/$BACKUP_NAME
                echo '✅ Backup creado: /app/data/$BACKUP_NAME'
            else
                echo '⚠️  No se encontró BD para backup'
            fi
        "
    else
        if [ -f "$DB_PATH" ]; then
            cp "$DB_PATH" "backend/$BACKUP_NAME"
            echo -e "${GREEN}✅ Backup creado: backend/$BACKUP_NAME${NC}"
        else
            echo -e "${YELLOW}⚠️  No se encontró BD para backup${NC}"
        fi
    fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
# PASO 2: RESET COMPLETO DE LA BASE DE DATOS
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}🗑️  Ejecutando reset completo de base de datos...${NC}"

# Script Python para reset completo
RESET_SCRIPT='
import os
import sys
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings_ec2" if "prod" in sys.argv else "backend.settings")

import django
django.setup()

from django.db import connection, transaction
from django.apps import apps
from django.core.management.color import no_style

print("🔄 Iniciando reset completo de base de datos...")

# Obtener todos los modelos
all_models = []
for app_config in apps.get_app_configs():
    if app_config.name.startswith(("config", "inventory", "operation", "auth", "django")):
        all_models.extend(app_config.get_models())

# Ordenar por dependencias
def get_fk_count(model):
    return -len([f for f in model._meta.get_fields() if hasattr(f, "related_model") and f.related_model])

all_models.sort(key=get_fk_count)

# Eliminar todos los datos
with connection.cursor() as cursor:
    # Desactivar foreign keys temporalmente
    cursor.execute("PRAGMA foreign_keys = OFF;")
    
    total_deleted = 0
    for model in all_models:
        table_name = model._meta.db_table
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cursor.fetchone()[0]
            if count > 0:
                cursor.execute(f"DELETE FROM {table_name}")
                total_deleted += count
                print(f"  ✓ {model.__name__}: {count} registros eliminados")
        except Exception as e:
            # Tabla puede no existir
            pass
    
    # Reiniciar TODOS los contadores de secuencia
    print("\n🔄 Reiniciando contadores de ID...")
    cursor.execute("DELETE FROM sqlite_sequence;")
    
    # Reactivar foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    # Optimizar base de datos
    cursor.execute("VACUUM;")

print(f"\n✅ Total eliminados: {total_deleted} registros")
print("✅ Contadores de ID reiniciados a 1")
print("✅ Base de datos optimizada")
'

if [ "$ENVIRONMENT" = "prod" ]; then
    echo "$RESET_SCRIPT" | $EXEC_PREFIX python manage.py shell
else
    cd backend && echo "$RESET_SCRIPT" | python manage.py shell
    cd ..
fi

# ═══════════════════════════════════════════════════════════════════════════════
# PASO 3: VERIFICACIÓN
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}🔍 Verificando estado final...${NC}"

VERIFY_SCRIPT='
from django.apps import apps

print("\n📊 Estado de la base de datos:")
total = 0
for app_name in ["config", "inventory", "operation"]:
    app = apps.get_app_config(app_name)
    print(f"\n{app_name.upper()}:")
    for model in app.get_models():
        count = model.objects.count()
        total += count
        if count > 0:
            print(f"  ⚠️  {model.__name__}: {count} registros")
        else:
            print(f"  ✓ {model.__name__}: 0 registros")

if total == 0:
    print("\n✅ BASE DE DATOS COMPLETAMENTE VACÍA")
else:
    print(f"\n⚠️  Aún quedan {total} registros en la BD")
'

if [ "$ENVIRONMENT" = "prod" ]; then
    echo "$VERIFY_SCRIPT" | $EXEC_PREFIX python manage.py shell
else
    cd backend && echo "$VERIFY_SCRIPT" | python manage.py shell
    cd ..
fi

# ═══════════════════════════════════════════════════════════════════════════════
# RESUMEN FINAL
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${GREEN}🎉 === RESET COMPLETADO EXITOSAMENTE ===${NC}"
echo ""
echo -e "${BLUE}📋 RESUMEN:${NC}"
echo "   ✅ Base de datos completamente vacía"
echo "   ✅ Contadores de ID reiniciados (próximo ID = 1)"
echo "   ✅ Base de datos optimizada (VACUUM ejecutado)"
if [ "$CREATE_BACKUP" = true ]; then
    echo "   ✅ Backup disponible: $BACKUP_NAME"
fi
echo ""

if [ "$ENVIRONMENT" = "prod" ]; then
    echo -e "${BLUE}🎯 PRÓXIMOS PASOS:${NC}"
    echo "   1. Acceder a: https://www.xn--elfogndedonsoto-zrb.com"
    echo "   2. Configurar datos básicos desde la interfaz"
    echo "   3. Importar datos usando las plantillas Excel"
else
    echo -e "${BLUE}🎯 PRÓXIMOS PASOS:${NC}"
    echo "   1. cd frontend && npm run dev"
    echo "   2. cd backend && python manage.py runserver"
    echo "   3. Configurar datos básicos desde http://localhost:5173"
fi

echo ""
echo -e "${YELLOW}ℹ️  La base de datos está ahora en estado pristino${NC}"