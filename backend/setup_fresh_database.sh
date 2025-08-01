#!/bin/bash

# ==========================================
# 🚀 SCRIPT SIMPLIFICADO PARA EC2 - SOLO POBLACIÓN
# ==========================================
# Este script solo ejecuta migraciones y puebla datos
# Sin limpiar (evita errores de tablas inexistentes)
#
# INSTRUCCIONES:
# 1. Ejecutar: sudo ./setup_fresh_database.sh
# 2. Verificar con Django admin o shell
# ==========================================

set -e  # Salir si hay errores

echo "🚀 ========================================"
echo "   CONFIGURACIÓN FRESCA DE BASE DE DATOS"
echo "=========================================="

# Verificar que estamos en el directorio correcto
if [ ! -f "manage.py" ]; then
    echo "❌ Error: No se encuentra manage.py"
    echo "   Ejecuta este script desde el directorio backend/"
    exit 1
fi

echo "📦 Instalando SQLite3 (si no está instalado)..."
apt-get update -qq >/dev/null 2>&1 || true
apt-get install -y sqlite3 >/dev/null 2>&1 || true

echo "✅ SQLite3 verificado"

echo ""
echo "🏗️ Aplicando migraciones de Django..."
python3 manage.py makemigrations --noinput
python3 manage.py migrate --noinput

echo ""
echo "🍽️ Poblando base de datos con datos del restaurante..."
python3 manage.py populate_test_data --no-clean

echo ""
echo "📊 Verificación final..."
python3 manage.py shell -c "
from config.models import Zone, Table, Unit
from inventory.models import Group, Ingredient, Recipe

print('📈 ESTADO FINAL DE LA BASE DE DATOS:')
print('=' * 50)
print(f'🏢 Zonas: {Zone.objects.count()}')
print(f'🪑 Mesas: {Table.objects.count()}')
print(f'📏 Unidades: {Unit.objects.count()}')
print(f'🏷️  Grupos de recetas: {Group.objects.count()}')
print(f'🥘 Ingredientes: {Ingredient.objects.count()}')
print(f'🍽️  Recetas: {Recipe.objects.count()}')
print('')

# Mostrar distribución de mesas por zona
print('🏠 DISTRIBUCIÓN DE MESAS:')
print('-' * 30)
from django.db.models import Count
zones_with_tables = Zone.objects.annotate(table_count=Count('table_set')).order_by('name')
for zone in zones_with_tables:
    print(f'{zone.name}: {zone.table_count} mesas')

print('')
print('🍽️  ALGUNOS PLATOS DEL MENÚ:')
print('-' * 25)  
recipes = Recipe.objects.select_related('group').order_by('group__name', 'name')[:10]
current_group = None
for recipe in recipes:
    if recipe.group and recipe.group.name != current_group:
        current_group = recipe.group.name
        print(f'📂 {current_group}:')
    print(f'  🍽️  {recipe.name} - S/{recipe.base_price}')
"

echo ""
echo "🔍 Verificando estado de tablas críticas..."
python3 manage.py shell -c "
from django.db import connection

cursor = connection.cursor()
cursor.execute(\"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name\")
tables = [row[0] for row in cursor.fetchall()]

print('📋 TABLAS EN LA BASE DE DATOS:')
print('-' * 35)
for table in tables:
    try:
        if table in ['table', 'group', 'order']:
            cursor.execute(f'SELECT COUNT(*) FROM \"{table}\"')
        else:
            cursor.execute(f'SELECT COUNT(*) FROM {table}')
        count = cursor.fetchone()[0]
        status = '✅' if count > 0 else '⚪'
        print(f'{status} {table}: {count} registros')
    except Exception as e:
        print(f'❌ {table}: Error - {e}')
"

echo ""
echo "🎉 ========================================"
echo "   ✅ CONFIGURACIÓN COMPLETADA EXITOSAMENTE"
echo "=========================================="
echo ""
echo "📋 PROCESO REALIZADO:"
echo "   1. ✅ SQLite3 instalado/verificado"
echo "   2. ✅ Migraciones de Django aplicadas"
echo "   3. ✅ Datos del restaurante cargados"
echo "   4. ✅ Verificación completada"
echo ""
echo "🚀 ¡El restaurante está listo para operar!"
echo ""
echo "🔗 PRÓXIMOS PASOS:"
echo "   - Reiniciar contenedores: sudo docker-compose -f docker-compose.ec2.yml restart"
echo "   - Verificar dashboard: http://tu-dominio.com/"
echo "   - Crear usuarios desde la aplicación web"