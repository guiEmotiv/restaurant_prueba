#!/bin/bash
# Script para verificar qué base de datos existe realmente en producción

echo "🔍 VERIFICAR BASE DE DATOS EN PRODUCCIÓN"
echo "======================================"
echo ""

echo "📂 Buscando archivos de base de datos..."
docker exec restaurant-web-web-1 find /app -name "*.sqlite3" -type f 2>/dev/null

echo ""
echo "📊 Contenido del directorio de datos:"
docker exec restaurant-web-web-1 ls -la /app/data/ 2>/dev/null

echo ""
echo "🔍 Verificando posibles ubicaciones:"

# Verificar cada posible ubicación
locations=(
    "/app/data/restaurant.sqlite3"
    "/app/data/restaurant_prod.sqlite3" 
    "/app/restaurant.sqlite3"
    "/app/db.sqlite3"
)

for location in "${locations[@]}"; do
    echo -n "$location: "
    if docker exec restaurant-web-web-1 test -f "$location" 2>/dev/null; then
        size=$(docker exec restaurant-web-web-1 stat -c%s "$location" 2>/dev/null)
        echo "✅ Existe (${size} bytes)"
        
        # Verificar si tiene tablas
        table_count=$(docker exec restaurant-web-web-1 python << EOF 2>/dev/null
import sqlite3
try:
    conn = sqlite3.connect('$location')
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    count = cursor.fetchone()[0]
    conn.close()
    print(count)
except:
    print(0)
EOF
)
        echo "    📊 Tablas de usuario: $table_count"
    else
        echo "❌ No existe"
    fi
done

echo ""
echo "💡 Configuración actual de Django:"
docker exec restaurant-web-web-1 python << 'EOF'
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_ec2')
django.setup()

from django.conf import settings
print(f"BASE_DIR: {settings.BASE_DIR}")
print(f"DATABASE_NAME: {settings.DATABASES['default']['NAME']}")
EOF