#!/bin/bash
# Script para LIMPIAR completamente la base de datos de producción en EC2
# ADVERTENCIA: Esto eliminará TODOS los datos

echo "🗑️  LIMPIEZA DE BASE DE DATOS DE PRODUCCIÓN"
echo "==========================================="
echo ""
echo "⚠️  ADVERTENCIA: Esto eliminará TODOS los datos de producción"
echo ""
read -p "¿Estás SEGURO que quieres continuar? (escribir 'SI' para confirmar): " confirm

if [ "$confirm" != "SI" ]; then
    echo "❌ Operación cancelada"
    exit 1
fi

echo ""
echo "🔄 Limpiando base de datos..."

# Usar el comando Django clean_database que ya existe
docker exec restaurant-web-web-1 python manage.py clean_database --confirm

echo ""
echo "✅ Base de datos limpiada completamente"
echo "   - Todas las tablas han sido vaciadas"
echo "   - Los contadores se han reiniciado"
echo ""
echo "💡 Para poblar con datos de prueba, ejecuta:"
echo "   sudo ./scripts/ec2_populate_database.sh"