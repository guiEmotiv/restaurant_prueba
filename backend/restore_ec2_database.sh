#!/bin/bash

# ==========================================
# 🍽️ SCRIPT DE RESTAURACIÓN DE BASE DE DATOS
# ==========================================
# Este script restaura todos los datos del restaurante en EC2
#
# INSTRUCCIONES:
# 1. Copiar populate_ec2_database.sql al servidor EC2
# 2. Ejecutar: sudo ./restore_ec2_database.sh
# 3. Verificar datos con Django admin
# ==========================================

set -e  # Salir si hay errores

echo "🍽️ ========================================"
echo "   RESTAURANDO BASE DE DATOS DEL RESTAURANTE"
echo "=========================================="

# Verificar que estamos en el directorio correcto
if [ ! -f "manage.py" ]; then
    echo "❌ Error: No se encuentra manage.py"
    echo "   Ejecuta este script desde el directorio backend/"
    exit 1
fi

# Verificar que existe el archivo SQL
if [ ! -f "populate_ec2_database.sql" ]; then
    echo "❌ Error: No se encuentra populate_ec2_database.sql"
    echo "   Asegúrate de haber copiado el archivo al directorio backend/"
    exit 1
fi

echo "📋 Verificando estado actual de la base de datos..."
python manage.py shell -c "
from django.db import connection
cursor = connection.cursor()
cursor.execute('SELECT COUNT(*) FROM unit')
units = cursor.fetchone()[0]
cursor.execute('SELECT COUNT(*) FROM zone')
zones = cursor.fetchone()[0]
cursor.execute('SELECT COUNT(*) FROM \"table\"')
tables = cursor.fetchone()[0]
cursor.execute('SELECT COUNT(*) FROM waiter')
waiters = cursor.fetchone()[0]
print(f'📊 Estado actual:')
print(f'   - Unidades: {units}')
print(f'   - Zonas: {zones}')
print(f'   - Mesas: {tables}')
print(f'   - Meseros: {waiters}')
"

echo ""
echo "🔄 Aplicando datos del restaurante..."
python manage.py dbshell < populate_ec2_database.sql

echo ""
echo "✅ Verificando datos restaurados..."
python manage.py shell -c "
from django.db import connection
cursor = connection.cursor()

# Verificar todos los datos
tables_data = {
    'unit': 'Unidades de medida',
    'zone': 'Zonas del restaurante', 
    'table': 'Mesas',
    'waiter': 'Meseros',
    'container': 'Envases',
    'group': 'Grupos de recetas',
    'ingredient': 'Ingredientes',
    'recipe': 'Recetas',
    'recipe_item': 'Items de recetas'
}

print('📊 DATOS RESTAURADOS:')
print('=' * 40)
for table, description in tables_data.items():
    if table == 'table':
        cursor.execute('SELECT COUNT(*) FROM \"table\"')
    elif table == 'group':
        cursor.execute('SELECT COUNT(*) FROM \"group\"')
    else:
        cursor.execute(f'SELECT COUNT(*) FROM {table}')
    count = cursor.fetchone()[0]
    print(f'✓ {description}: {count} registros')

print('')
print('🍽️ DATOS DEL MENÚ:')
print('=' * 40)
cursor.execute('SELECT name FROM \"group\" ORDER BY name')
groups = cursor.fetchall()
for group in groups:
    print(f'📂 {group[0]}')

print('')
print('👨‍🍳 MESEROS ACTIVOS:')
print('=' * 40)
cursor.execute('SELECT name, phone FROM waiter WHERE is_active = 1 ORDER BY name')
waiters = cursor.fetchall()
for waiter in waiters:
    print(f'👤 {waiter[0]} - {waiter[1]}')

print('')
print('🏢 DISTRIBUCIÓN DE MESAS:')
print('=' * 40)
cursor.execute('SELECT z.name, COUNT(t.id) FROM zone z LEFT JOIN \"table\" t ON z.id = t.zone_id GROUP BY z.name ORDER BY z.name')
zones = cursor.fetchall()
for zone in zones:
    print(f'🏠 {zone[0]}: {zone[1]} mesas')
"

echo ""
echo "🎯 Creando usuario administrador..."
python manage.py shell -c "
from django.contrib.auth.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@restaurant.com', 'admin123')
    print('✅ Usuario admin creado (admin/admin123)')
else:
    print('ℹ️  Usuario admin ya existe')
"

echo ""
echo "🧹 Aplicando migraciones pendientes..."
python manage.py migrate --run-syncdb

echo ""
echo "🎉 ========================================"
echo "   ✅ BASE DE DATOS RESTAURADA EXITOSAMENTE"
echo "=========================================="
echo ""
echo "📋 RESUMEN DE DATOS CARGADOS:"
echo "   ✓ 9+ Unidades de medida"
echo "   ✓ 5 Zonas del restaurante"
echo "   ✓ 30 Mesas distribuidas"
echo "   ✓ 5 Meseros activos"
echo "   ✓ 4 Tipos de envases"
echo "   ✓ 12 Grupos de recetas"
echo "   ✓ 41 Ingredientes con stock"
echo "   ✓ 18 Recetas del menú"
echo "   ✓ 54+ Relaciones ingrediente-receta"
echo ""
echo "🔐 CREDENCIALES DE ACCESO:"
echo "   Usuario: admin"
echo "   Contraseña: admin123"
echo "   Panel: http://tu-dominio.com/admin/"
echo ""
echo "🚀 El restaurante está listo para operar!"