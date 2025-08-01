#!/bin/bash

# ==========================================
# 🔄 SCRIPT DE LIMPIEZA Y POBLACIÓN COMPLETA
# ==========================================
# Este script limpia completamente la base de datos
# y luego la puebla con datos frescos del restaurante
#
# INSTRUCCIONES:
# 1. Ejecutar: sudo ./clean_and_populate.sh
# 2. Verificar datos con Django shell o admin
# ==========================================

set -e  # Salir si hay errores

echo "🔄 ========================================"
echo "   LIMPIEZA Y POBLACIÓN DE BASE DE DATOS"
echo "=========================================="

# Verificar que estamos en el directorio correcto
if [ ! -f "manage.py" ]; then
    echo "❌ Error: No se encuentra manage.py"
    echo "   Ejecuta este script desde el directorio backend/"
    exit 1
fi

# Verificar que existen los archivos necesarios
if [ ! -f "clean_database.sql" ]; then
    echo "❌ Error: No se encuentra clean_database.sql"
    exit 1
fi

if [ ! -f "populate_ec2_database.sql" ]; then
    echo "❌ Error: No se encuentra populate_ec2_database.sql"
    exit 1
fi

echo "⚠️  ADVERTENCIA: Este script eliminará TODOS los datos existentes"
echo "   Presiona Ctrl+C en los próximos 5 segundos para cancelar..."
sleep 5

echo ""
echo "🗑️ Limpiando base de datos existente..."
python3 manage.py dbshell < clean_database.sql

echo ""
echo "📊 Verificando limpieza..."
python3 manage.py shell -c "
from django.db import connection
cursor = connection.cursor()

tables_check = ['unit', 'zone', 'table', 'group', 'ingredient', 'recipe', 'order']
all_empty = True

for table in tables_check:
    if table == 'table':
        cursor.execute('SELECT COUNT(*) FROM \"table\"')
    elif table == 'group':
        cursor.execute('SELECT COUNT(*) FROM \"group\"')
    elif table == 'order':
        cursor.execute('SELECT COUNT(*) FROM \"order\"')
    else:
        cursor.execute(f'SELECT COUNT(*) FROM {table}')
    
    count = cursor.fetchone()[0]
    if count > 0:
        all_empty = False
        print(f'⚠️  {table}: {count} registros (no limpiado completamente)')
    else:
        print(f'✅ {table}: limpiado')

if all_empty:
    print('')
    print('🎯 ¡Base de datos completamente limpia!')
else:
    print('')
    print('⚠️  Algunas tablas no se limpiaron completamente')
"

echo ""
echo "🔄 Poblando base de datos con datos frescos..."
python3 manage.py dbshell < populate_ec2_database.sql

echo ""
echo "✅ Verificando datos poblados..."
python3 manage.py shell -c "
from django.db import connection
cursor = connection.cursor()

# Verificar datos principales
tables_data = {
    'unit': 'Unidades de medida',
    'zone': 'Zonas del restaurante',
    'table': 'Mesas',
    'container': 'Envases',
    'group': 'Grupos de recetas',
    'ingredient': 'Ingredientes',
    'recipe': 'Recetas',
    'recipe_item': 'Items de recetas'
}

print('📊 DATOS POBLADOS:')
print('=' * 40)
total_records = 0
for table, description in tables_data.items():
    if table == 'table':
        cursor.execute('SELECT COUNT(*) FROM \"table\"')
    elif table == 'group':
        cursor.execute('SELECT COUNT(*) FROM \"group\"')
    else:
        cursor.execute(f'SELECT COUNT(*) FROM {table}')
    count = cursor.fetchone()[0]
    total_records += count
    print(f'✓ {description}: {count} registros')

print('')
print(f'🎯 TOTAL: {total_records} registros cargados exitosamente')
"

echo ""
echo "🧹 Aplicando migraciones..."
python3 manage.py migrate --run-syncdb

echo ""
echo "🎉 ========================================"
echo "   ✅ PROCESO COMPLETADO EXITOSAMENTE"
echo "=========================================="
echo ""
echo "🔄 PROCESO REALIZADO:"
echo "   1. ✅ Base de datos completamente limpiada"
echo "   2. ✅ Contadores de ID reiniciados"
echo "   3. ✅ Datos frescos del restaurante cargados"
echo "   4. ✅ Migraciones aplicadas"
echo ""
echo "🚀 La base de datos está lista con datos frescos!"