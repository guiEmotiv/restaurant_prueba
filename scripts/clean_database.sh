#!/bin/bash
# Script para LIMPIAR todos los datos de la base de datos
# Funciona tanto en desarrollo como en producción

echo "🗑️  LIMPIEZA DE BASE DE DATOS"
echo "=========================="
echo ""

# Detectar entorno (múltiples métodos)
if [ -f "/.dockerenv" ] || [ -n "${DOCKER_CONTAINER}" ] || [ -d "/opt/restaurant-web" ] || [ "$(whoami)" = "ubuntu" ]; then
    echo "🐳 Detectado: Servidor EC2 (Producción)"
    ENV_TYPE="production"
    DB_NAME="restaurant_prod.sqlite3"
    DB_PATH="/app/data"
else
    echo "💻 Detectado: Desarrollo local"
    ENV_TYPE="development" 
    DB_NAME="restaurant_dev.sqlite3"
    DB_PATH="./backend"
fi

echo "📂 Base de datos: $DB_PATH/$DB_NAME"
echo ""

# Confirmación de seguridad
if [ "$ENV_TYPE" = "production" ]; then
    echo "⚠️  ADVERTENCIA: Vas a eliminar TODOS los datos de PRODUCCIÓN"
    read -p "¿Estás ABSOLUTAMENTE SEGURO? (escribir 'ELIMINAR'): " confirm
    if [ "$confirm" != "ELIMINAR" ]; then
        echo "❌ Operación cancelada"
        exit 1
    fi
else
    read -p "¿Eliminar todos los datos de desarrollo? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "❌ Operación cancelada"
        exit 1
    fi
fi

echo ""
echo "🧹 Limpiando base de datos..."

# Script de limpieza según el entorno
if [ "$ENV_TYPE" = "production" ]; then
    # Ejecutar en el contenedor Docker
    docker exec restaurant-web-web-1 python << 'EOF'
import sqlite3
import os

db_file = "/app/data/restaurant_prod.sqlite3"
if not os.path.exists(db_file):
    print(f"✗ No se puede acceder a: {db_file}")
    exit(1)

print(f"✓ Conectando a: {db_file}")
conn = sqlite3.connect(db_file)
cursor = conn.cursor()

# Deshabilitar foreign keys
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

print("\n🧹 Limpiando tablas:")
total_deleted = 0
for table in tables:
    try:
        cursor.execute(f"SELECT COUNT(*) FROM {table};")
        count_before = cursor.fetchone()[0]
        if count_before > 0:
            cursor.execute(f"DELETE FROM {table};")
            print(f"  ✓ {table}: {count_before} registros eliminados")
            total_deleted += count_before
        else:
            print(f"  ○ {table}: ya estaba vacía")
    except Exception as e:
        print(f"  ⚠ {table}: {str(e)}")

# Reiniciar contadores de autoincremento
try:
    cursor.execute("DELETE FROM sqlite_sequence;")
    print("  ✓ Contadores de ID reiniciados")
except:
    print("  ○ No hay contadores que reiniciar")

conn.commit()
conn.close()

print(f"\n✅ Limpieza completada: {total_deleted} registros eliminados")
EOF

else
    # Ejecutar en desarrollo local
    python3 << 'EOF'
import sqlite3
import os

db_file = "./backend/restaurant_dev.sqlite3"
if not os.path.exists(db_file):
    print(f"⚠️  Archivo de base de datos no encontrado: {db_file}")
    print("Creando nueva base de datos vacía...")
    os.makedirs("./backend", exist_ok=True)
    open(db_file, 'a').close()

print(f"✓ Conectando a: {db_file}")
conn = sqlite3.connect(db_file)
cursor = conn.cursor()

# Deshabilitar foreign keys
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

print("\n🧹 Limpiando tablas:")
total_deleted = 0
for table in tables:
    try:
        cursor.execute(f"SELECT COUNT(*) FROM {table};")
        count_before = cursor.fetchone()[0]
        if count_before > 0:
            cursor.execute(f"DELETE FROM {table};")
            print(f"  ✓ {table}: {count_before} registros eliminados")
            total_deleted += count_before
        else:
            print(f"  ○ {table}: ya estaba vacía")
    except Exception as e:
        print(f"  ⚠ {table}: {str(e)}")

# Reiniciar contadores de autoincremento
try:
    cursor.execute("DELETE FROM sqlite_sequence;")
    print("  ✓ Contadores de ID reiniciados")
except:
    print("  ○ No hay contadores que reiniciar")

conn.commit()
conn.close()

print(f"\n✅ Limpieza completada: {total_deleted} registros eliminados")
EOF
fi

echo ""
echo "✅ Base de datos limpiada exitosamente"
echo ""
echo "💡 Para poblar con datos de prueba:"
echo "   ./scripts/populate_database.sh"