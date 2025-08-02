#!/bin/bash
# Script DIRECTO para limpiar la base de datos accediendo al archivo SQLite

echo "🔍 LIMPIEZA DIRECTA DE BASE DE DATOS"
echo "===================================="
echo ""

# Verificar primero dónde está la base de datos
echo "📂 Buscando archivo de base de datos..."
docker exec restaurant-web-web-1 find / -name "restaurant.sqlite3" 2>/dev/null | head -5

echo ""
echo "🗑️  Limpiando base de datos directamente..."

# Ejecutar Python con acceso directo al archivo
docker exec restaurant-web-web-1 python << 'EOF'
import sqlite3
import os

# Posibles ubicaciones de la base de datos
db_paths = [
    '/app/restaurant.sqlite3',
    '/app/backend/restaurant.sqlite3',
    '/code/restaurant.sqlite3',
    '/code/backend/restaurant.sqlite3',
    'restaurant.sqlite3'
]

db_file = None
for path in db_paths:
    if os.path.exists(path):
        db_file = path
        print(f"✓ Base de datos encontrada en: {path}")
        break

if not db_file:
    print("✗ No se encontró el archivo de base de datos")
    exit(1)

# Conectar y limpiar
conn = sqlite3.connect(db_file)
cursor = conn.cursor()

# Deshabilitar foreign keys
cursor.execute("PRAGMA foreign_keys = OFF;")

# Tablas a limpiar (en orden inverso de dependencias)
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
    'config_unit',
]

print("\nLimpiando tablas:")
for table in tables:
    try:
        cursor.execute(f"DELETE FROM {table};")
        count = cursor.rowcount
        print(f"  ✓ {table}: {count} registros eliminados")
    except Exception as e:
        print(f"  ✗ {table}: {str(e)}")

# Limpiar sqlite_sequence
try:
    cursor.execute("DELETE FROM sqlite_sequence;")
    print("  ✓ Contadores reiniciados")
except:
    pass

# Commit cambios
conn.commit()

# Verificar
print("\nVerificación:")
for table in ['config_zone', 'config_table', 'inventory_recipe', 'operation_order']:
    cursor.execute(f"SELECT COUNT(*) FROM {table};")
    count = cursor.fetchone()[0]
    print(f"  {table}: {count} registros")

cursor.close()
conn.close()

print("\n✅ Limpieza directa completada")
EOF

echo ""
echo "💡 Para verificar: sudo ./scripts/ec2_check_database.sh"
echo "💡 Para poblar: sudo ./scripts/ec2_populate_database.sh"