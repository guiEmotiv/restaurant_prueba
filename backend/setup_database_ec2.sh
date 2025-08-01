#!/bin/bash

# ==========================================
# 🚀 SCRIPT DE CONFIGURACIÓN COMPLETA PARA EC2
# ==========================================
# Este script instala SQLite3 y configura la base de datos
# usando Django management commands (sin dependencia de sqlite3 CLI)
#
# INSTRUCCIONES:
# 1. Ejecutar: sudo ./setup_database_ec2.sh
# 2. Verificar con Django admin o shell
# ==========================================

set -e  # Salir si hay errores

echo "🚀 ========================================"
echo "   CONFIGURACIÓN COMPLETA DE BASE DE DATOS"
echo "=========================================="

# Verificar que estamos en el directorio correcto
if [ ! -f "manage.py" ]; then
    echo "❌ Error: No se encuentra manage.py"
    echo "   Ejecuta este script desde el directorio backend/"
    exit 1
fi

echo "📦 Instalando SQLite3..."
apt-get update -qq
apt-get install -y sqlite3

echo "✅ SQLite3 instalado correctamente"

echo ""
echo "🗑️ Limpiando base de datos existente..."
python3 manage.py clean_database --confirm

echo ""
echo "🍽️ Poblando base de datos con datos del restaurante..."
python3 manage.py populate_database

echo ""
echo "🧹 Aplicando migraciones..."
python3 manage.py migrate --run-syncdb

echo ""
echo "📊 Verificación final..."
python3 manage.py shell -c "
from config.models import Zone, Table, Unit
from inventory.models import Group, Ingredient, Recipe
from operation.models import Order

print('📈 ESTADO FINAL DE LA BASE DE DATOS:')
print('=' * 50)
print(f'🏢 Zonas: {Zone.objects.count()}')
print(f'🪑 Mesas: {Table.objects.count()}')
print(f'📏 Unidades: {Unit.objects.count()}')
print(f'🏷️  Grupos de recetas: {Group.objects.count()}')
print(f'🥘 Ingredientes: {Ingredient.objects.count()}')
print(f'🍽️  Recetas: {Recipe.objects.count()}')
print(f'🧾 Órdenes: {Order.objects.count()}')
print('')

# Mostrar distribución de mesas por zona
print('🏠 DISTRIBUCIÓN DE MESAS:')
print('-' * 30)
from django.db.models import Count
zones_with_tables = Zone.objects.annotate(table_count=Count('table_set')).order_by('name')
for zone in zones_with_tables:
    print(f'{zone.name}: {zone.table_count} mesas')

print('')
print('🍽️  GRUPOS DE MENÚ:')
print('-' * 20)
groups = Group.objects.order_by('name')
for group in groups:
    recipe_count = group.recipe_set.count()
    print(f'📂 {group.name}: {recipe_count} recetas')
"

echo ""
echo "🎉 ========================================"
echo "   ✅ CONFIGURACIÓN COMPLETADA EXITOSAMENTE"
echo "=========================================="
echo ""
echo "📋 PROCESO REALIZADO:"
echo "   1. ✅ SQLite3 instalado en el sistema"
echo "   2. ✅ Base de datos limpiada completamente"
echo "   3. ✅ Datos del restaurante cargados"
echo "   4. ✅ Migraciones aplicadas"
echo "   5. ✅ Verificación completada"
echo ""
echo "🚀 ¡El restaurante está listo para operar!"
echo ""
echo "🔗 PRÓXIMOS PASOS:"
echo "   - Acceder al panel admin: http://tu-dominio.com/admin/"
echo "   - Crear usuarios desde la aplicación web"
echo "   - Verificar que el dashboard muestre datos"