#!/bin/bash
# Script para analizar el esquema real de la base de datos en producción

echo "🔍 ANÁLISIS PROFUNDO DEL ESQUEMA DE BASE DE DATOS"
echo "================================================="
echo ""

echo "📊 1. Verificando qué base de datos existe realmente..."
docker exec restaurant-web-web-1 find /app -name "*.sqlite3" -type f 2>/dev/null

echo ""
echo "📋 2. Analizando esquema de tablas existentes..."
docker exec restaurant-web-web-1 python << 'EOF'
import sqlite3
import os

# Buscar archivo de BD
db_paths = ['/app/data/restaurant_prod.sqlite3', '/app/data/restaurant.sqlite3', '/app/restaurant.sqlite3']
db_file = None

for path in db_paths:
    if os.path.exists(path):
        db_file = path
        break

if not db_file:
    print("❌ No se encontró base de datos")
    exit(1)

print(f"✅ Usando base de datos: {db_file}")
conn = sqlite3.connect(db_file)
cursor = conn.cursor()

# Obtener todas las tablas
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
tables = cursor.fetchall()

print(f"\n📊 Tablas encontradas ({len(tables)}):")
for table in tables:
    table_name = table[0]
    if not table_name.startswith('sqlite_'):
        print(f"  • {table_name}")

# Analizar tabla recipe específicamente
print("\n🔍 ANÁLISIS DETALLADO DE TABLA 'recipe':")
try:
    cursor.execute("PRAGMA table_info(recipe);")
    columns = cursor.fetchall()
    if columns:
        print("  Columnas existentes:")
        for col in columns:
            col_id, name, type_, notnull, default, pk = col
            null_str = "NOT NULL" if notnull else "NULL"
            pk_str = " PRIMARY KEY" if pk else ""
            print(f"    {name}: {type_} {null_str}{pk_str}")
    else:
        print("  ❌ Tabla 'recipe' no existe")
except Exception as e:
    print(f"  ❌ Error analizando tabla recipe: {e}")

# Analizar tabla ingredient
print("\n🔍 ANÁLISIS DETALLADO DE TABLA 'ingredient':")
try:
    cursor.execute("PRAGMA table_info(ingredient);")
    columns = cursor.fetchall()
    if columns:
        print("  Columnas existentes:")
        for col in columns:
            col_id, name, type_, notnull, default, pk = col
            null_str = "NOT NULL" if notnull else "NULL"
            pk_str = " PRIMARY KEY" if pk else ""
            print(f"    {name}: {type_} {null_str}{pk_str}")
    else:
        print("  ❌ Tabla 'ingredient' no existe")
except Exception as e:
    print(f"  ❌ Error analizando tabla ingredient: {e}")

conn.close()
EOF

echo ""
echo "🔧 3. Verificando estado de migraciones Django..."
docker exec restaurant-web-web-1 python manage.py showmigrations

echo ""
echo "✅ Análisis completado"