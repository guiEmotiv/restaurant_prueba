#!/bin/bash
# Script para POBLAR la base de datos de producción con datos de prueba
# Para el restaurante "El Fogón de Don Soto"

echo "🌱 POBLACIÓN DE BASE DE DATOS DE PRODUCCIÓN"
echo "=========================================="
echo ""
echo "📊 Se insertarán datos de prueba para el restaurante"
echo ""
read -p "¿Deseas continuar? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Operación cancelada"
    exit 1
fi

echo ""
echo "🔄 Poblando base de datos con datos de prueba..."

# Usar el comando Django populate_test_data que ya existe
docker exec restaurant-web-web-1 python manage.py populate_test_data

echo ""
echo "✅ ¡Base de datos poblada exitosamente!"
echo ""
echo "📊 Datos insertados:"
echo "   • 5 zonas del restaurante"
echo "   • 15 mesas distribuidas"
echo "   • 10+ ingredientes con stock"
echo "   • 10 recetas (parrillas, bebidas, etc.)"
echo "   • Órdenes y pagos de ejemplo"
echo ""
echo "🌐 Verifica en: http://xn--elfogndedonsoto-zrb.com"
echo "   El dashboard mostrará las nuevas métricas"