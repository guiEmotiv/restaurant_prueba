#!/bin/bash
# Script para verificar la base de datos de producción en EC2

echo "🔍 VERIFICANDO BASE DE DATOS DE PRODUCCIÓN"
echo "=========================================="

# Verificar si el contenedor está corriendo
echo "📦 Estado del contenedor:"
docker-compose -f docker-compose.ec2.yml ps

echo ""
echo "📂 Archivos en directorio data:"
ls -la /opt/restaurant-web/data/

echo ""
echo "🗄️ Verificando base de datos dentro del contenedor:"
docker exec restaurant-web-web-1 ls -la /app/data/

echo ""
echo "📊 TABLAS EN BASE DE DATOS DE PRODUCCIÓN:"
echo "----------------------------------------"
docker exec restaurant-web-web-1 sqlite3 /app/data/restaurant.sqlite3 "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

echo ""
echo "📈 CONTEO DE REGISTROS EN TABLAS PRINCIPALES:"
echo "--------------------------------------------"

tables=("zone" "table" "unit" "group" "ingredient" "recipe" "order" "payment" "waiter" "container")

for table in "${tables[@]}"; do
    count=$(docker exec restaurant-web-web-1 sqlite3 /app/data/restaurant.sqlite3 "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "0")
    printf "%-20s: %s registros\n" "$table" "$count"
done

echo ""
echo "🔍 EJEMPLOS DE DATOS:"
echo "-------------------"

echo "Zonas:"
docker exec restaurant-web-web-1 sqlite3 /app/data/restaurant.sqlite3 "SELECT id, name FROM zone LIMIT 5;" 2>/dev/null || echo "No hay datos en zona"

echo ""
echo "Mesas:"
docker exec restaurant-web-web-1 sqlite3 /app/data/restaurant.sqlite3 "SELECT id, table_number, zone_id FROM table LIMIT 5;" 2>/dev/null || echo "No hay datos en mesa"

echo ""
echo "Grupos:"
docker exec restaurant-web-web-1 sqlite3 /app/data/restaurant.sqlite3 "SELECT id, name FROM group LIMIT 5;" 2>/dev/null || echo "No hay datos en grupo"

echo ""
echo "Ingredientes:"
docker exec restaurant-web-web-1 sqlite3 /app/data/restaurant.sqlite3 "SELECT id, name, group_id FROM ingredient LIMIT 5;" 2>/dev/null || echo "No hay datos en ingrediente"

echo ""
echo "✅ Verificación completa!"