#!/bin/bash

# ==========================================
# 🔍 DIAGNÓSTICO: Frontend no muestra datos
# ==========================================
# Verifica la conexión entre frontend y backend
# ==========================================

echo "🔍 ========================================"
echo "   DIAGNÓSTICO FRONTEND-BACKEND"
echo "=========================================="

echo "📊 1. Verificando datos en backend..."
python3 manage.py shell -c "
from config.models import Zone, Table, Unit
from inventory.models import Group, Ingredient, Recipe
from operation.models import Order

print('📋 DATOS EN BASE DE DATOS:')
print(f'🏢 Zonas: {Zone.objects.count()}')
print(f'🪑 Mesas: {Table.objects.count()}')
print(f'📏 Unidades: {Unit.objects.count()}')
print(f'🏷️  Grupos: {Group.objects.count()}')
print(f'🥘 Ingredientes: {Ingredient.objects.count()}')
print(f'🍽️  Recetas: {Recipe.objects.count()}')
print(f'🧾 Órdenes: {Order.objects.count()}')

# Mostrar algunas órdenes de ejemplo
print('')
print('📝 ÓRDENES RECIENTES:')
orders = Order.objects.all()[:5]
for order in orders:
    print(f'  #{order.id} - Mesa {order.table.table_number} - {order.status} - ${order.total_amount}')

print('')
print('🍽️  RECETAS DISPONIBLES:')
recipes = Recipe.objects.all()[:5]
for recipe in recipes:
    print(f'  {recipe.name} - ${recipe.base_price}')
"

echo ""
echo "🌐 2. Verificando endpoints de API..."

echo "   Probando /api/v1/health/"
curl -s http://localhost:8000/api/v1/health/ | head -c 200 || echo "❌ Health endpoint no responde"

echo ""
echo "   Probando /api/v1/zones/"
curl -s -H "Accept: application/json" http://localhost:8000/api/v1/zones/ | head -c 200 || echo "❌ Zones endpoint no responde"

echo ""
echo "   Probando /api/v1/recipes/"
curl -s -H "Accept: application/json" http://localhost:8000/api/v1/recipes/ | head -c 200 || echo "❌ Recipes endpoint no responde"

echo ""
echo "🐳 3. Verificando estado de contenedores..."
echo "   Estado de contenedores Docker:"
docker-compose -f ../docker-compose.ec2.yml ps || echo "❌ Error verificando contenedores"

echo ""
echo "📝 4. Verificando logs del backend..."
echo "   Últimas líneas del log del backend:"
docker-compose -f ../docker-compose.ec2.yml logs --tail=10 web || echo "❌ Error obteniendo logs"

echo ""
echo "🔧 5. Verificando configuración de CORS..."
python3 manage.py shell -c "
from django.conf import settings
print('🔒 CONFIGURACIÓN CORS:')
if hasattr(settings, 'CORS_ALLOWED_ORIGINS'):
    print(f'  CORS_ALLOWED_ORIGINS: {settings.CORS_ALLOWED_ORIGINS}')
if hasattr(settings, 'CORS_ALLOW_ALL_ORIGINS'):
    print(f'  CORS_ALLOW_ALL_ORIGINS: {settings.CORS_ALLOW_ALL_ORIGINS}')
print(f'  ALLOWED_HOSTS: {settings.ALLOWED_HOSTS}')
print(f'  DEBUG: {settings.DEBUG}')
"

echo ""
echo "🎯 RECOMENDACIONES:"
echo "   1. Si los datos existen pero el frontend no los muestra:"
echo "      - Verificar que el frontend se construyó correctamente"
echo "      - Revisar logs del navegador (F12 -> Console)"
echo "      - Verificar variables de entorno del frontend"
echo ""
echo "   2. Si los endpoints no responden:"
echo "      - Reiniciar contenedores: sudo docker-compose -f docker-compose.ec2.yml restart"
echo "      - Verificar que el puerto 8000 esté abierto"
echo ""
echo "   3. Para reiniciar completamente:"
echo "      - sudo docker-compose -f docker-compose.ec2.yml down"
echo "      - sudo docker-compose -f docker-compose.ec2.yml up -d"