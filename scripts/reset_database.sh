#!/bin/bash
# Script para resetear completamente la base de datos con datos de prueba
# Para uso en desarrollo y testing

set -e  # Salir si hay algún error

echo "🗑️  Reseteando base de datos de El Fogón de Don Soto..."

# Verificar que estamos en el directorio correcto
if [ ! -f "manage.py" ]; then
    echo "❌ Error: Este script debe ejecutarse desde el directorio backend/"
    echo "   Uso: cd backend && ../scripts/reset_database.sh"
    exit 1
fi

# Verificar que existe el archivo de la base de datos
if [ ! -f "db.sqlite3" ]; then
    echo "⚠️  Base de datos no encontrada, se creará una nueva"
fi

echo "📋 Paso 1: Limpiando base de datos..."
sqlite3 db.sqlite3 < ../scripts/clean_database.sql

echo "🌱 Paso 2: Poblando con datos de prueba..."
sqlite3 db.sqlite3 < ../scripts/populate_test_data.sql

echo ""
echo "✅ ¡Base de datos reseteada exitosamente!"
echo ""
echo "📊 Datos de prueba disponibles:"
echo "   • 8 unidades de medida"  
echo "   • 5 zonas (Terraza, Salón, VIP, Barra, Jardín)"
echo "   • 15 mesas distribuidas en las zonas"
echo "   • 4 tipos de envases para llevar"
echo "   • 7 grupos de ingredientes" 
echo "   • 16 ingredientes variados"
echo "   • 10 recetas (parrillas, bebidas, acompañamientos)"
echo "   • 5 órdenes (4 pagadas, 1 pendiente)"
echo "   • 4 pagos con diferentes métodos"
echo ""
echo "🚀 La aplicación está lista para usar con datos de prueba"
echo "   Ejecuta: python manage.py runserver"