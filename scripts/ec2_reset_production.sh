#!/bin/bash
# Script DEFINITIVO para resetear la base de datos de producción
# El Fogón de Don Soto - Producción EC2

echo "🔄 RESET COMPLETO BASE DE DATOS PRODUCCIÓN"
echo "=========================================="
echo ""
echo "⚠️  ADVERTENCIA: Esto eliminará TODOS los datos"
echo "   y los reemplazará con datos de prueba frescos"
echo ""
read -p "¿CONFIRMAR RESET? (escribir 'CONFIRMAR'): " confirm

if [ "$confirm" != "CONFIRMAR" ]; then
    echo "❌ Operación cancelada"
    exit 1
fi

echo ""
echo "🗑️  Limpiando base de datos directamente..."

# Limpieza directa del archivo SQLite
docker exec restaurant-web-web-1 python << 'EOF'
import sqlite3
import os

# Buscar el archivo restaurant.sqlite3
db_paths = ['/app/restaurant.sqlite3', '/code/restaurant.sqlite3', 'restaurant.sqlite3']
db_file = None

for path in db_paths:
    if os.path.exists(path):
        db_file = path
        print(f"✓ Base de datos encontrada: {path}")
        break

if not db_file:
    print("✗ Archivo restaurant.sqlite3 no encontrado")
    exit(1)

# Conectar y limpiar
conn = sqlite3.connect(db_file)
cursor = conn.cursor()

# Deshabilitar foreign keys para limpieza
cursor.execute("PRAGMA foreign_keys = OFF;")

# Tablas a limpiar en orden correcto
tables = [
    'operation_containerssale',
    'operation_paymentitem', 
    'operation_payment',
    'operation_orderitemingredient',
    'operation_orderitem',
    'operation_order',
    'inventory_recipeitem',
    'inventory_recipe',
    'inventory_ingredient',
    'inventory_group',
    'config_container',
    'config_table',
    'config_zone',
    'config_unit'
]

print("Limpiando tablas:")
total_deleted = 0
for table in tables:
    try:
        cursor.execute(f"SELECT COUNT(*) FROM {table};")
        count_before = cursor.fetchone()[0]
        cursor.execute(f"DELETE FROM {table};")
        print(f"  ✓ {table}: {count_before} registros eliminados")
        total_deleted += count_before
    except Exception as e:
        print(f"  ⚠ {table}: {str(e)}")

# Reiniciar contadores
cursor.execute("DELETE FROM sqlite_sequence;")
print(f"  ✓ Contadores reiniciados")

conn.commit()
conn.close()

print(f"\n✅ Total eliminados: {total_deleted} registros")
EOF

echo ""
echo "🌱 Poblando con datos frescos..."
docker exec restaurant-web-web-1 python manage.py populate_production

echo ""
echo "🔍 Verificación final..."
docker exec restaurant-web-web-1 python manage.py shell << 'EOF'
from config.models import Zone, Table, Unit
from inventory.models import Recipe, Ingredient, Group
from operation.models import Order, Payment

print("📊 Estado final de la base de datos:")
print(f"  • Zonas: {Zone.objects.count()}")
print(f"  • Mesas: {Table.objects.count()}")
print(f"  • Unidades: {Unit.objects.count()}")
print(f"  • Grupos: {Group.objects.count()}")
print(f"  • Ingredientes: {Ingredient.objects.count()}")
print(f"  • Recetas: {Recipe.objects.count()}")
print(f"  • Órdenes: {Order.objects.count()}")
print(f"  • Pagos: {Payment.objects.count()}")

print("\n🏷️  Últimas órdenes creadas:")
for order in Order.objects.all().order_by('-created_at')[:3]:
    print(f"  #{order.id}: Mesa {order.table.table_number} - {order.status} - ${order.total_amount}")
EOF

echo ""
echo "✅ ¡RESET COMPLETADO EXITOSAMENTE!"
echo ""
echo "🌐 Dashboard actualizado en:"
echo "   http://xn--elfogndedonsoto-zrb.com"
echo ""
echo "📈 Los nuevos datos ya están disponibles"