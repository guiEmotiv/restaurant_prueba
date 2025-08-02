#!/bin/bash
# Script COMPLETO para reset de base de datos con acceso directo

echo "🔄 RESET COMPLETO CON ACCESO DIRECTO"
echo "===================================="
echo ""
echo "⚠️  Este proceso:"
echo "   1. Limpiará DIRECTAMENTE el archivo SQLite"
echo "   2. Poblará con datos frescos usando Django"
echo ""
read -p "¿Confirmar reset completo? (RESET): " confirm

if [ "$confirm" != "RESET" ]; then
    echo "❌ Cancelado"
    exit 1
fi

echo ""
echo "🗑️  Paso 1: Limpieza directa..."
docker exec restaurant-web-web-1 python << 'EOF'
import sqlite3
import os

# Buscar base de datos
db_paths = ['/app/db.sqlite3', '/app/backend/db.sqlite3', '/code/db.sqlite3', '/code/backend/db.sqlite3']
db_file = None
for path in db_paths:
    if os.path.exists(path):
        db_file = path
        break

if db_file:
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    
    cursor.execute("PRAGMA foreign_keys = OFF;")
    
    # Limpiar todas las tablas principales
    tables = [
        'operation_containerssale', 'operation_paymentitem', 'operation_payment',
        'operation_orderitemingredient', 'operation_orderitem', 'operation_order',
        'inventory_recipeitem', 'inventory_recipe', 'inventory_ingredient', 'inventory_group',
        'config_container', 'config_table', 'config_zone', 'config_unit'
    ]
    
    for table in tables:
        try:
            cursor.execute(f"DELETE FROM {table};")
            print(f"✓ {table} limpiada")
        except:
            pass
    
    cursor.execute("DELETE FROM sqlite_sequence;")
    conn.commit()
    conn.close()
    print("✅ Limpieza directa completada")
else:
    print("✗ Base de datos no encontrada")
EOF

echo ""
echo "🌱 Paso 2: Poblando datos..."
docker exec restaurant-web-web-1 python manage.py populate_test_data

echo ""
echo "🔍 Paso 3: Verificación final..."
docker exec restaurant-web-web-1 python manage.py shell << 'EOF'
from config.models import Zone, Table
from inventory.models import Recipe, Ingredient  
from operation.models import Order

print(f"Zonas: {Zone.objects.count()}")
print(f"Mesas: {Table.objects.count()}")
print(f"Recetas: {Recipe.objects.count()}")
print(f"Ingredientes: {Ingredient.objects.count()}")
print(f"Órdenes: {Order.objects.count()}")
EOF

echo ""
echo "✅ ¡RESET COMPLETO FINALIZADO!"
echo "🌐 Revisar en: http://xn--elfogndedonsoto-zrb.com"