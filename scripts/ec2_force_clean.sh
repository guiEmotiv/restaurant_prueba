#!/bin/bash
# Script FORZADO para limpiar la base de datos usando Python directamente
# No depende de comandos Django management

echo "🚨 LIMPIEZA FORZADA DE BASE DE DATOS DE PRODUCCIÓN"
echo "================================================="
echo ""
echo "⚠️  ADVERTENCIA CRÍTICA: Esto eliminará TODOS los datos"
echo ""
read -p "¿Estás ABSOLUTAMENTE SEGURO? (escribir 'BORRAR TODO' para confirmar): " confirm

if [ "$confirm" != "BORRAR TODO" ]; then
    echo "❌ Operación cancelada"
    exit 1
fi

echo ""
echo "🗑️  Ejecutando limpieza forzada..."

# Ejecutar Python directamente con el script de limpieza
docker exec restaurant-web-web-1 python << 'PYTHON_SCRIPT'
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_ec2')
django.setup()

from django.db import connection

# Tablas en orden inverso de dependencias
tables_to_clean = [
    'container_sale',
    'payment_item', 
    'payment',
    'order_item_ingredient',
    'order_item',
    '"order"',  # order es palabra reservada
    'recipe_item',
    'recipe',
    'ingredient',
    '"group"',  # group es palabra reservada
    'container',
    '"table"',  # table es palabra reservada
    'zone',
    'unit',
]

print("Limpiando tablas...")
with connection.cursor() as cursor:
    # Deshabilitar foreign keys temporalmente
    cursor.execute("PRAGMA foreign_keys = OFF;")
    
    for table in tables_to_clean:
        try:
            cursor.execute(f"DELETE FROM {table};")
            print(f"✓ Tabla {table} limpiada")
        except Exception as e:
            print(f"✗ Error en tabla {table}: {e}")
    
    # Limpiar sqlite_sequence para reiniciar autoincrements
    try:
        cursor.execute("DELETE FROM sqlite_sequence;")
        print("✓ Contadores reiniciados")
    except:
        pass
    
    # Rehabilitar foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")
    
print("\n✅ Limpieza completada")

# Verificar que está vacío
from config.models import Zone, Table
from inventory.models import Recipe, Ingredient
from operation.models import Order

print("\nVerificación:")
print(f"Zonas: {Zone.objects.count()}")
print(f"Mesas: {Table.objects.count()}")
print(f"Recetas: {Recipe.objects.count()}")
print(f"Ingredientes: {Ingredient.objects.count()}")
print(f"Órdenes: {Order.objects.count()}")
PYTHON_SCRIPT

echo ""
echo "✅ Base de datos limpiada completamente"
echo ""
echo "💡 Para poblar con datos nuevos, ejecuta:"
echo "   sudo ./scripts/ec2_populate_database.sh"