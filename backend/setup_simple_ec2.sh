#!/bin/bash

# ==========================================
# 🚀 SCRIPT SUPER SIMPLE PARA EC2
# ==========================================
# Usa solo comandos que ya existen y funcionan
#
# INSTRUCCIONES:
# 1. Ejecutar: sudo ./setup_simple_ec2.sh
# 2. Verificar en el dashboard
# ==========================================

set -e  # Salir si hay errores

echo "🚀 ========================================"
echo "   CONFIGURACIÓN SIMPLE PARA EC2"
echo "=========================================="

# Verificar que estamos en el directorio correcto
if [ ! -f "manage.py" ]; then
    echo "❌ Error: No se encuentra manage.py"
    echo "   Ejecuta este script desde el directorio backend/"
    exit 1
fi

echo "🏗️ Aplicando migraciones..."
python3 manage.py migrate --noinput

echo ""
echo "🍽️ Agregando datos básicos (sin limpiar existentes)..."
python3 manage.py populate_test_data --no-clean

echo ""
echo "📊 Verificando datos..."
python3 manage.py shell -c "
from config.models import Zone, Table, Unit
from inventory.models import Group, Ingredient, Recipe
from operation.models import Order

print('✅ DATOS CARGADOS:')
print(f'🏢 Zonas: {Zone.objects.count()}')
print(f'🪑 Mesas: {Table.objects.count()}')
print(f'📏 Unidades: {Unit.objects.count()}')
print(f'🏷️  Grupos: {Group.objects.count()}')
print(f'🥘 Ingredientes: {Ingredient.objects.count()}')
print(f'🍽️  Recetas: {Recipe.objects.count()}')
print(f'🧾 Órdenes: {Order.objects.count()}')
print('')
print('🎯 ¡Base de datos configurada exitosamente!')
"

echo ""
echo "🎉 ========================================"
echo "   ✅ CONFIGURACIÓN COMPLETADA"
echo "=========================================="
echo ""
echo "🚀 ¡Listo! Datos agregados sin tocar AWS Cognito."
echo ""
echo "🔗 SIGUIENTE PASO:"
echo "   - Reiniciar contenedores: sudo docker-compose -f docker-compose.ec2.yml restart"
echo "   - Verificar dashboard: http://tu-dominio.com/"