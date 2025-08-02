#!/bin/bash
# Script rápido para poblar base de datos de producción en EC2
# Sin confirmaciones - usar con cuidado

echo "🚀 Poblando base de datos de producción en EC2..."

# Ejecutar script de población directamente
docker exec -i restaurant-web-web-1 sqlite3 /app/data/restaurant.sqlite3 < /opt/restaurant-web/scripts/populate_test_data.sql

# Verificar resultados
echo ""
echo "📊 Datos insertados:"
docker exec restaurant-web-web-1 sqlite3 /app/data/restaurant.sqlite3 "
SELECT 
    'Zonas: ' || COUNT(*) as datos FROM zone
    UNION ALL  
SELECT 'Mesas: ' || COUNT(*) FROM \"table\"
    UNION ALL
SELECT 'Ingredientes: ' || COUNT(*) FROM ingredient
    UNION ALL
SELECT 'Recetas: ' || COUNT(*) FROM recipe
    UNION ALL
SELECT 'Órdenes: ' || COUNT(*) FROM \"order\"
    UNION ALL
SELECT 'Pagos: ' || COUNT(*) FROM payment;"

echo ""
echo "✅ Listo! Verifica en http://xn--elfogndedonsoto-zrb.com"