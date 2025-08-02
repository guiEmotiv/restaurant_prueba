#!/bin/bash
# Script para poblar la base de datos de producción usando Django management command
# No requiere SQLite3 instalado en el contenedor

echo "🚀 Poblando base de datos de producción usando Django..."
echo "=================================================="
echo ""

# Verificar que el contenedor esté corriendo
if ! docker ps | grep -q "restaurant-web-web-1"; then
    echo "❌ Error: El contenedor restaurant-web-web-1 no está corriendo"
    echo "   Ejecuta: docker-compose -f docker-compose.ec2.yml up -d"
    exit 1
fi

# Opción para limpiar primero
read -p "¿Deseas limpiar la base de datos antes de poblar? (yes/no): " clean_first

if [ "$clean_first" == "yes" ]; then
    echo "🌱 Limpiando y poblando base de datos..."
    docker exec restaurant-web-web-1 python manage.py populate_production --clean
else
    echo "🌱 Poblando base de datos (sin limpiar)..."
    docker exec restaurant-web-web-1 python manage.py populate_production
fi

echo ""
echo "✅ ¡Proceso completado!"
echo ""
echo "🌐 Verifica los datos en: http://xn--elfogndedonsoto-zrb.com"
echo "   El dashboard mostrará las métricas actualizadas"