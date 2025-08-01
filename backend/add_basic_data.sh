#!/bin/bash

# ==========================================
# 🍽️ SCRIPT PARA AGREGAR DATOS BÁSICOS SIN LIMPIAR
# ==========================================
# Solo agrega datos mínimos necesarios SIN tocar datos existentes
# Perfecto para EC2 con AWS Cognito ya configurado
#
# INSTRUCCIONES:
# 1. Ejecutar: sudo ./add_basic_data.sh
# 2. Verificar en el dashboard
# ==========================================

set -e  # Salir si hay errores

echo "🍽️ ========================================"
echo "   AGREGANDO DATOS BÁSICOS DEL RESTAURANTE"
echo "=========================================="

# Verificar que estamos en el directorio correcto
if [ ! -f "manage.py" ]; then
    echo "❌ Error: No se encuentra manage.py"
    echo "   Ejecuta este script desde el directorio backend/"
    exit 1
fi

echo "📊 Verificando datos existentes..."
python3 manage.py shell -c "
from config.models import Zone, Table, Unit
from inventory.models import Group, Ingredient, Recipe
from operation.models import Order

print('📋 ESTADO ACTUAL:')
print(f'🏢 Zonas: {Zone.objects.count()}')
print(f'🪑 Mesas: {Table.objects.count()}')
print(f'📏 Unidades: {Unit.objects.count()}')
print(f'🏷️  Grupos: {Group.objects.count()}')
print(f'🥘 Ingredientes: {Ingredient.objects.count()}')
print(f'🍽️  Recetas: {Recipe.objects.count()}')
print(f'🧾 Órdenes: {Order.objects.count()}')
print('')
"

echo "➕ Agregando solo datos faltantes (SIN limpiar existentes)..."
python3 manage.py shell -c "
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

from django.db import transaction
from decimal import Decimal
import datetime
from config.models import Unit, Zone, Table, Container, RestaurantOperationalConfig
from inventory.models import Group, Ingredient, Recipe, RecipeItem

print('🔄 Agregando datos mínimos necesarios...')

with transaction.atomic():
    # Solo crear si no existen
    units_needed = ['kg', 'gr', 'litros', 'ml', 'unidades']
    for unit_name in units_needed:
        unit, created = Unit.objects.get_or_create(name=unit_name)
        if created:
            print(f'✅ Unidad creada: {unit_name}')

    zones_needed = ['Salón Principal', 'Terraza', 'Bar']
    for zone_name in zones_needed:
        zone, created = Zone.objects.get_or_create(name=zone_name)
        if created:
            print(f'✅ Zona creada: {zone_name}')

    # Crear algunas mesas si no existen
    if Table.objects.count() < 10:
        salon = Zone.objects.get_or_create(name='Salón Principal')[0]
        for i in range(1, 11):
            table, created = Table.objects.get_or_create(
                table_number=str(i),
                defaults={'zone': salon}
            )
            if created:
                print(f'✅ Mesa creada: {i}')

    # Grupos básicos
    grupos_basicos = ['Bebidas', 'Platos Principales', 'Entradas']
    for grupo_name in grupos_basicos:
        grupo, created = Group.objects.get_or_create(name=grupo_name)
        if created:
            print(f'✅ Grupo creado: {grupo_name}')

    # Ingredientes básicos
    kg = Unit.objects.get(name='kg')
    unidades = Unit.objects.get(name='unidades')
    
    ingredientes_basicos = [
        ('Pollo', Decimal('15.00'), Decimal('10.0'), kg),
        ('Arroz', Decimal('4.50'), Decimal('20.0'), kg),
        ('Coca Cola', Decimal('3.50'), Decimal('24'), unidades),
        ('Agua', Decimal('2.00'), Decimal('48'), unidades),
    ]
    
    for nombre, precio, stock, unidad in ingredientes_basicos:
        ingredient, created = Ingredient.objects.get_or_create(
            name=nombre,
            defaults={
                'unit_price': precio,
                'current_stock': stock,
                'unit': unidad
            }
        )
        if created:
            print(f'✅ Ingrediente creado: {nombre}')

    # Recetas básicas
    grupo_bebidas = Group.objects.get(name='Bebidas')
    grupo_platos = Group.objects.get(name='Platos Principales')
    
    recetas_basicas = [
        ('Coca Cola', grupo_bebidas, Decimal('3.50'), 1),
        ('Agua Mineral', grupo_bebidas, Decimal('2.00'), 1),
        ('Arroz con Pollo', grupo_platos, Decimal('15.00'), 25),
    ]
    
    for nombre, grupo, precio, tiempo in recetas_basicas:
        recipe, created = Recipe.objects.get_or_create(
            name=nombre,
            version='1.0',
            defaults={
                'group': grupo,
                'base_price': precio,
                'preparation_time': tiempo,
                'profit_percentage': Decimal('0')
            }
        )
        if created:
            print(f'✅ Receta creada: {nombre}')

print('✅ Datos básicos agregados exitosamente!')
"

echo ""
echo "📊 Verificando datos finales..."
python3 manage.py shell -c "
from config.models import Zone, Table, Unit
from inventory.models import Group, Ingredient, Recipe
from operation.models import Order

print('📈 ESTADO FINAL:')
print(f'🏢 Zonas: {Zone.objects.count()}')
print(f'🪑 Mesas: {Table.objects.count()}')
print(f'📏 Unidades: {Unit.objects.count()}')
print(f'🏷️  Grupos: {Group.objects.count()}')
print(f'🥘 Ingredientes: {Ingredient.objects.count()}')
print(f'🍽️  Recetas: {Recipe.objects.count()}')
print(f'🧾 Órdenes: {Order.objects.count()}')
print('')
print('🎯 ¡Datos básicos disponibles para el dashboard!')
"

echo ""
echo "🎉 ========================================"
echo "   ✅ DATOS BÁSICOS AGREGADOS"
echo "=========================================="
echo ""
echo "✅ PROCESO COMPLETADO:"
echo "   - Solo se agregaron datos faltantes"
echo "   - NO se eliminaron datos existentes"
echo "   - AWS Cognito se mantiene intacto"
echo ""
echo "🔗 SIGUIENTE PASO:"
echo "   sudo docker-compose -f docker-compose.ec2.yml restart"
echo "   Verificar dashboard: http://tu-dominio.com/"