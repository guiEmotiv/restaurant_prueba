#!/bin/bash
# Script COMPLETO para resetear la base de datos de producción
# Limpia TODO y luego pobla con datos de prueba

echo "🔄 RESET COMPLETO DE BASE DE DATOS DE PRODUCCIÓN"
echo "=============================================="
echo ""
echo "⚠️  Este script:"
echo "   1. Eliminará TODOS los datos actuales"
echo "   2. Poblará con datos de prueba frescos"
echo ""
read -p "¿Estás SEGURO? (escribir 'RESET' para confirmar): " confirm

if [ "$confirm" != "RESET" ]; then
    echo "❌ Operación cancelada"
    exit 1
fi

echo ""
echo "🗑️  Paso 1: Limpiando base de datos..."
docker exec restaurant-web-web-1 python manage.py clean_database --confirm

echo ""
echo "🌱 Paso 2: Poblando con datos de prueba..."
docker exec restaurant-web-web-1 python manage.py populate_test_data

echo ""
echo "✅ ¡Reset completo finalizado!"
echo ""
echo "📊 Estado actual:"
echo "   • Base de datos limpia con datos frescos"
echo "   • Contadores reiniciados"
echo "   • Datos de prueba listos para usar"
echo ""
echo "🌐 Dashboard actualizado en: http://xn--elfogndedonsoto-zrb.com"