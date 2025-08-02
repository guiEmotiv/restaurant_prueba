#!/bin/bash
# Script para poblar la base de datos de PRODUCCIÓN en EC2
# ADVERTENCIA: Este script modificará la base de datos de producción

set -e  # Salir si hay algún error

echo "🚀 Script de población de base de datos de PRODUCCIÓN en EC2"
echo "==========================================================="
echo ""
echo "⚠️  ADVERTENCIA: Este script modificará la base de datos de PRODUCCIÓN"
echo "   Ubicación: /opt/restaurant-web/data/restaurant.sqlite3"
echo ""
read -p "¿Estás seguro de que quieres continuar? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Operación cancelada"
    exit 1
fi

echo ""
echo "🔍 Verificando contenedor Docker..."

# Verificar que el contenedor esté corriendo
if ! docker ps | grep -q "restaurant-web-web-1"; then
    echo "❌ Error: El contenedor restaurant-web-web-1 no está corriendo"
    echo "   Ejecuta: docker-compose -f docker-compose.ec2.yml up -d"
    exit 1
fi

echo "✅ Contenedor encontrado"
echo ""

# Opción para limpiar primero
read -p "¿Deseas limpiar la base de datos antes de poblar? (yes/no): " clean_first

if [ "$clean_first" == "yes" ]; then
    echo "🗑️  Limpiando base de datos..."
    docker exec -i restaurant-web-web-1 sqlite3 /app/data/restaurant.sqlite3 < /opt/restaurant-web/scripts/clean_database.sql
    echo "✅ Base de datos limpiada"
    echo ""
fi

echo "🌱 Poblando base de datos con datos de prueba..."
docker exec -i restaurant-web-web-1 sqlite3 /app/data/restaurant.sqlite3 < /opt/restaurant-web/scripts/populate_test_data.sql

echo ""
echo "📊 Verificando datos insertados..."
docker exec restaurant-web-web-1 sqlite3 /app/data/restaurant.sqlite3 "
SELECT 'RESUMEN DE DATOS EN PRODUCCIÓN:' as status;
SELECT 
    'Zonas' as tabla, COUNT(*) as registros FROM zone
    UNION ALL  
SELECT 'Mesas', COUNT(*) FROM \"table\"
    UNION ALL
SELECT 'Ingredientes', COUNT(*) FROM ingredient
    UNION ALL
SELECT 'Recetas', COUNT(*) FROM recipe
    UNION ALL
SELECT 'Órdenes', COUNT(*) FROM \"order\"
    UNION ALL
SELECT 'Pagos', COUNT(*) FROM payment;"

echo ""
echo "✅ ¡Base de datos de PRODUCCIÓN poblada exitosamente!"
echo ""
echo "🔄 Reiniciando aplicación para aplicar cambios..."
docker-compose -f docker-compose.ec2.yml restart web

echo ""
echo "🎯 Datos disponibles en producción:"
echo "   • 5 zonas del restaurante"
echo "   • 15 mesas distribuidas"
echo "   • 16 ingredientes con stock"
echo "   • 10 recetas activas"
echo "   • 5 órdenes de ejemplo (4 pagadas)"
echo "   • 4 pagos procesados"
echo ""
echo "🌐 Puedes verificar en: http://xn--elfogndedonsoto-zrb.com"
echo "   El dashboard mostrará las métricas actualizadas"