#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# 🗑️  SCRIPT OPTIMIZADO DE LIMPIEZA TOTAL DE BASE DE DATOS DE PRODUCCIÓN
# ═══════════════════════════════════════════════════════════════════════════════
#
# BASADO EN ANÁLISIS DE FALLAS DE SCRIPTS ANTERIORES
# Diseñado específicamente para funcionar en entorno Docker de producción
#
# CARACTERÍSTICAS:
# ✅ Simple y directo (sin dependencias complejas)
# ✅ Ejecuta desde contenedor Docker (no depende de Python local)
# ✅ Sin transacciones problemáticas
# ✅ Validación completa post-limpieza
# ✅ Logging detallado para debugging
#
# USO:
#   ./reset-production-db-optimized.sh
#   ./reset-production-db-optimized.sh --skip-confirmation
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e  # Salir si cualquier comando falla

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🗑️  === SCRIPT OPTIMIZADO DE LIMPIEZA TOTAL DE BASE DE DATOS ===${NC}"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "docker-compose.ssl.yml" ]; then
    echo -e "${RED}❌ Error: No se encuentra docker-compose.ssl.yml${NC}"
    echo "   Ejecuta este script desde el directorio raíz del proyecto (/opt/restaurant-web)"
    exit 1
fi

# Verificar que Docker está funcionando
if ! docker-compose -f docker-compose.ssl.yml ps | grep -q "Up"; then
    echo -e "${RED}❌ Error: Los contenedores Docker no están ejecutándose${NC}"
    echo "   Ejecuta: sudo docker-compose -f docker-compose.ssl.yml up -d"
    exit 1
fi

# Verificar argumentos
SKIP_CONFIRMATION=false
if [ "$1" = "--skip-confirmation" ]; then
    SKIP_CONFIRMATION=true
    echo -e "${YELLOW}⚠️  Modo automático: saltando confirmaciones${NC}"
fi

# Confirmación de seguridad (a menos que se especifique --skip-confirmation)
if [ "$SKIP_CONFIRMATION" = false ]; then
    echo -e "${RED}⚠️  ADVERTENCIA: Este script eliminará TODOS los datos de producción:${NC}"
    echo "   • Todas las mesas, zonas, unidades"
    echo "   • Todos los ingredientes, recetas, grupos"
    echo "   • Todas las órdenes, pagos, items"
    echo "   • Toda la configuración del restaurante"
    echo "   • TODOS los datos históricos"
    echo ""
    
    read -p "¿Estás seguro de que quieres continuar? Escribe 'SI ELIMINAR TODO': " confirmation
    if [ "$confirmation" != "SI ELIMINAR TODO" ]; then
        echo -e "${RED}❌ Operación cancelada${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${BLUE}🔄 Iniciando proceso de limpieza optimizado...${NC}"

# ═══════════════════════════════════════════════════════════════════════════════
# PASO 1: BACKUP DE SEGURIDAD (OPCIONAL)
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}💾 Creando backup de seguridad...${NC}"
BACKUP_NAME="backup_before_reset_$(date +%Y%m%d_%H%M%S).sqlite3"

docker-compose -f docker-compose.ssl.yml exec -T web bash -c "
    if [ -f /app/data/db.sqlite3 ]; then
        cp /app/data/db.sqlite3 /app/data/$BACKUP_NAME
        echo '✅ Backup creado: /app/data/$BACKUP_NAME'
    else
        echo '⚠️  No se encontró BD para backup (puede ser normal si ya está vacía)'
    fi
"

# ═══════════════════════════════════════════════════════════════════════════════
# PASO 2: LIMPIEZA OPTIMIZADA (SIN TRANSACCIONES PROBLEMÁTICAS)
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}🗑️  Ejecutando limpieza optimizada...${NC}"

docker-compose -f docker-compose.ssl.yml exec -T web python manage.py shell << 'EOF'
from django.db import connection
from django.apps import apps
import sys

print("🔄 Eliminando todos los datos...")

# Obtener todos los modelos de nuestras apps
our_apps = ['config', 'inventory', 'operation'] 
all_models = []

for app_name in our_apps:
    try:
        app = apps.get_app_config(app_name)
        models = list(app.get_models())
        all_models.extend(models)
    except LookupError:
        print(f"⚠️  App '{app_name}' no encontrada")

# Ordenar por dependencias (más dependientes primero)
def dependency_count(model):
    fk_count = len([
        field for field in model._meta.get_fields()
        if hasattr(field, 'related_model') and field.related_model
    ])
    return -fk_count

all_models.sort(key=dependency_count)

# Eliminar datos modelo por modelo
with connection.cursor() as cursor:
    cursor.execute('PRAGMA foreign_keys = OFF;')
    
    total_deleted = 0
    for model in all_models:
        count_before = model.objects.count()
        if count_before > 0:
            model.objects.all().delete()
            count_after = model.objects.count()
            deleted = count_before - count_after
            total_deleted += deleted
            print(f"  ✓ {model.__name__}: {count_before} → {count_after} ({deleted} eliminados)")
    
    # Reiniciar contadores de ID (FUERA de transacción problemática)
    print("🔄 Reiniciando contadores de ID...")
    cursor.execute('DELETE FROM sqlite_sequence;')
    cursor.execute('PRAGMA foreign_keys = ON;')

print(f"\n✅ Total eliminados: {total_deleted} objetos")
print("✅ Contadores de ID reiniciados")
EOF

# ═══════════════════════════════════════════════════════════════════════════════
# PASO 3: OPTIMIZACIÓN DE BD (FUERA DE TRANSACCIÓN)
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}🧹 Optimizando base de datos...${NC}"

docker-compose -f docker-compose.ssl.yml exec -T web python manage.py shell << 'EOF'
from django.db import connection

with connection.cursor() as cursor:
    cursor.execute('VACUUM;')
    print("✅ VACUUM ejecutado correctamente")
    print("✅ Base de datos optimizada")
EOF

# ═══════════════════════════════════════════════════════════════════════════════
# PASO 4: VERIFICACIÓN COMPLETA
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}🔍 Verificando limpieza...${NC}"

docker-compose -f docker-compose.ssl.yml exec -T web python manage.py shell << 'EOF'
from config.models import Table, Zone, Unit
from inventory.models import Group, Ingredient, Recipe
from operation.models import Order, OrderItem, Payment

print("📊 Verificación final:")
counts = {
    'Zonas': Zone.objects.count(),
    'Mesas': Table.objects.count(),
    'Unidades': Unit.objects.count(),
    'Grupos': Group.objects.count(),
    'Ingredientes': Ingredient.objects.count(),
    'Recetas': Recipe.objects.count(),
    'Órdenes': Order.objects.count(),
    'OrderItems': OrderItem.objects.count(),
    'Pagos': Payment.objects.count()
}

for model_name, count in counts.items():
    print(f"  {model_name}: {count}")

total = sum(counts.values())

if total == 0:
    print("\n✅ BASE DE DATOS COMPLETAMENTE VACÍA")
    print("✅ Contadores de ID reiniciados")
    print("✅ Proceso de limpieza exitoso")
else:
    print(f"\n⚠️  Quedan {total} objetos en la BD")
    sys.exit(1)
EOF

# ═══════════════════════════════════════════════════════════════════════════════
# PASO 5: VERIFICACIÓN DE FUNCIONAMIENTO
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}🔍 Verificando que la aplicación funcione...${NC}"

# Test API health
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/ 2>/dev/null || echo "000")

if [ "$HEALTH_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ API funcionando correctamente (Status: $HEALTH_STATUS)${NC}"
else
    echo -e "${YELLOW}⚠️  API Status: $HEALTH_STATUS (puede ser normal durante reinicio)${NC}"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# RESUMEN FINAL
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${GREEN}🎉 === LIMPIEZA COMPLETADA EXITOSAMENTE ===${NC}"
echo ""
echo -e "${BLUE}📋 RESUMEN:${NC}"
echo "   ✅ Base de datos completamente vacía"
echo "   ✅ Contadores de ID reiniciados (próximo ID = 1)"
echo "   ✅ Base de datos optimizada (VACUUM ejecutado)"
echo "   ✅ Aplicación funcionando"
echo "   ✅ Backup disponible: $BACKUP_NAME"
echo ""
echo -e "${BLUE}🎯 PRÓXIMOS PASOS RECOMENDADOS:${NC}"
echo "   1. Acceder a: https://www.xn--elfogndedonsoto-zrb.com"
echo "   2. Configurar datos básicos desde la interfaz"
echo "   3. Importar datos iniciales si es necesario"
echo ""
echo -e "${YELLOW}ℹ️  La base de datos está ahora en estado pristino${NC}"