#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LIMPIAR DATOS OPERACIONALES EN PRODUCCIÓN EC2 - Restaurant Web
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e
cd "$(dirname "$0")/.."

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    case $1 in
        ERROR) echo -e "${RED}❌ $2${NC}" ;;
        SUCCESS) echo -e "${GREEN}✅ $2${NC}" ;;
        WARNING) echo -e "${YELLOW}⚠️  $2${NC}" ;;
        INFO) echo -e "${BLUE}ℹ️  $2${NC}" ;;
    esac
}

show_usage() {
    echo "🧹 Uso: $0"
    echo ""
    echo "📋 Funcionalidad:"
    echo "  1. Conectar a servidor de producción EC2"
    echo "  2. Crear backup automático de seguridad"
    echo "  3. Limpiar SOLO datos operacionales (órdenes, pagos)"
    echo "  4. Conservar menú, inventario y configuración"
    echo ""
    echo "⚠️  IMPORTANTE:"
    echo "  - Se conecta a EC2 via SSH"
    echo "  - Limpia PRODUCCIÓN (no desarrollo)"
    echo "  - Crea backup antes de limpiar"
    echo ""
    echo "🔧 Servidor:"
    echo "  Host: ec2-44-248-47-186.us-west-2.compute.amazonaws.com"
    echo "  User: ubuntu"
    echo "  Key:  ubuntu_fds_key.pem"
}

clean_operational_data() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    
    log INFO "🧹 LIMPIEZA DE DATOS OPERACIONALES EN PRODUCCIÓN"
    echo ""
    
    # Verificar que existe la clave SSH
    if [ ! -f "ubuntu_fds_key.pem" ]; then
        log ERROR "No se encontró la clave SSH: ubuntu_fds_key.pem"
        exit 1
    fi
    
    log INFO "Conectando a servidor de producción..."
    
    # Ejecutar comandos en el servidor remoto
    ssh -i ubuntu_fds_key.pem ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com << 'REMOTE_EOF'

# Cambiar al directorio del proyecto
cd /opt/restaurant-web

echo "📍 Ubicación actual: $(pwd)"

# Verificar que estamos en el lugar correcto
if [ ! -f "data/restaurant_prod.sqlite3" ]; then
    echo "❌ No se encontró la BD de producción en $(pwd)"
    exit 1
fi

echo "✅ BD de producción encontrada"

# 1. Crear backup automático
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="data/backups/restaurant_prod_before_cleanup_$TIMESTAMP.sqlite3"

echo "💾 Creando backup de seguridad..."
mkdir -p data/backups
cp data/restaurant_prod.sqlite3 "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backup creado: $BACKUP_FILE"
else
    echo "❌ Error al crear backup"
    exit 1
fi

# 2. Ejecutar limpieza de datos operacionales via Django
echo "🧹 Limpiando datos operacionales..."

docker exec restaurant-backend python -c "
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_ec2')
django.setup()

from django.db import connection
from operation.models import Order, OrderItem, Payment, ContainerSale
from django.contrib.sessions.models import Session

print('🔄 Limpiando datos operacionales en PRODUCCIÓN...')

models_to_clean = [
    (OrderItem, 'Items de órdenes'),
    (Payment, 'Pagos'),
    (ContainerSale, 'Ventas de contenedores'),
    (Order, 'Órdenes'),
    (Session, 'Sesiones'),
]

with connection.cursor() as cursor:
    cursor.execute('PRAGMA foreign_keys = OFF;')
    
    total = 0
    for model, name in models_to_clean:
        count = model.objects.count()
        if count > 0:
            model.objects.all().delete()
            total += count
            print(f'  ✓ {name}: {count} eliminados')
        else:
            print(f'  ✓ {name}: ya vacío')
    
    # Reset counters - FIX: Use correct table names
    operational_tables = ['order', 'order_item', 'payment', 'container_sale']
    for table in operational_tables:
        try:
            cursor.execute('DELETE FROM sqlite_sequence WHERE name=?', (table,))
            print(f'  ✓ Reset counter for {table}')
        except Exception as e:
            print(f'  ⚠️  Could not reset counter for {table}: {e}')
    
    cursor.execute('PRAGMA foreign_keys = ON;')
    cursor.execute('VACUUM;')

print(f'✅ {total} registros operacionales eliminados')

# Mostrar lo que se conservó
from inventory.models import Recipe, Ingredient
from config.models import Zone, Table, Container
print(f'✅ Conservado: {Recipe.objects.count()} recetas, {Ingredient.objects.count()} ingredientes')
print(f'✅ Conservado: {Zone.objects.count()} zonas, {Table.objects.count()} mesas, {Container.objects.count()} containers')
"

if [ $? -eq 0 ]; then
    echo "✅ Limpieza completada exitosamente"
else
    echo "❌ Error durante la limpieza"
    echo "🔄 Restaurando backup..."
    cp "$BACKUP_FILE" data/restaurant_prod.sqlite3
    echo "⚠️  BD restaurada desde backup"
    exit 1
fi

# 3. Verificar integridad
echo "🔍 Verificando integridad de la BD..."
if sqlite3 data/restaurant_prod.sqlite3 "PRAGMA integrity_check;" | grep -q "ok"; then
    echo "✅ Integridad verificada"
else
    echo "⚠️  Advertencia: Verificación de integridad falló"
fi

# 4. Mostrar resumen
DB_SIZE=$(du -h data/restaurant_prod.sqlite3 | cut -f1)
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

echo ""
echo "🎉 LIMPIEZA DE PRODUCCIÓN COMPLETADA"
echo ""
echo "📊 Resumen:"
echo "   📄 BD Producción: $DB_SIZE"
echo "   💾 Backup seguridad: $BACKUP_SIZE"
echo "   📁 Backup guardado en: $BACKUP_FILE"
echo ""
echo "✅ Datos operacionales eliminados"
echo "✅ Menú e inventario conservados"

REMOTE_EOF

    if [ $? -eq 0 ]; then
        log SUCCESS "🎉 Limpieza de producción completada exitosamente"
        echo ""
        log INFO "📋 Qué se eliminó:"
        echo "   ❌ Todas las órdenes/pedidos"
        echo "   ❌ Items de pedidos"
        echo "   ❌ Historial de pagos"
        echo "   ❌ Ventas de contenedores"
        echo "   ❌ Sesiones de usuarios"
        echo ""
        log INFO "📋 Qué se conservó:"
        echo "   ✅ Recetas del menú"
        echo "   ✅ Ingredientes y stock"
        echo "   ✅ Configuración (mesas, zonas)"
        echo "   ✅ Envases/contenedores"
        echo "   ✅ Usuarios y configuración"
    else
        log ERROR "Error durante la limpieza remota"
        exit 1
    fi
}

echo "🧹 LIMPIAR DATOS OPERACIONALES PRODUCCIÓN - RESTAURANT WEB"
echo "========================================================="

# Verificar argumentos
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    show_usage
    exit 0
fi

# Confirmación de seguridad
echo ""
log WARNING "⚠️  ATENCIÓN: Esta operación va a limpiar PRODUCCIÓN"
echo ""
echo "🖥️  Servidor: EC2 ec2-44-248-47-186.us-west-2.compute.amazonaws.com"
echo "📋 Se eliminará:"
echo "   ❌ Todas las órdenes/pedidos de producción"
echo "   ❌ Historial de pagos de producción"
echo "   ❌ Datos operacionales de producción"
echo ""
echo "✅ Se conservará:"
echo "   ✅ Menú completo (recetas, ingredientes)"
echo "   ✅ Configuración (mesas, zonas, containers)"
echo "   ✅ Usuarios y configuración del sistema"
echo ""
echo "💾 Se creará backup automático antes de limpiar"
echo ""

read -p "¿Confirmar limpieza de datos operacionales en PRODUCCIÓN? (escribir 'LIMPIAR_PROD'): " confirm
if [ "$confirm" != "LIMPIAR_PROD" ]; then
    log INFO "Operación cancelada (confirmación incorrecta)"
    exit 0
fi

clean_operational_data

echo ""
log SUCCESS "✨ Proceso completado"
log INFO "💡 Ahora puedes sincronizar desarrollo con: scp -i ubuntu_fds_key.pem ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com:/opt/restaurant-web/data/restaurant_prod.sqlite3 data/restaurant_dev.sqlite3"