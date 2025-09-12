#!/usr/bin/env python
"""
Test script para reproducir el issue de regresión de status de Order
Simula el flujo: Order en PREPARING -> Agregar nuevo OrderItem CREATED -> ¿Order cambia a CREATED?
"""

import os
import sys
import django

# Setup Django environment
sys.path.append('/Users/guillermosotozuniga/restaurant-web/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from operation.models import Order, OrderItem
from inventory.models import Recipe
from config.models import Table
from decimal import Decimal


def test_order_status_regression():
    print("🔍 TESTING ORDER STATUS REGRESSION\n")
    
    # 1. Buscar Order #1 (que según logs está en PREPARING)
    try:
        order = Order.objects.get(id=1)
        print(f"📋 Order #{order.id} encontrado - Estado inicial: {order.status}")
        print(f"    Items existentes: {order.orderitem_set.count()}")
        for item in order.orderitem_set.all():
            print(f"    - Item #{item.id}: {item.recipe.name} ({item.status})")
    except Order.DoesNotExist:
        print("❌ Order #1 no existe")
        return
    
    # 2. Forzar Order a estado PREPARING si no lo está
    if order.status != 'PREPARING':
        print(f"    Cambiando Order de {order.status} a PREPARING...")
        order.status = 'PREPARING'
        order.save()
        print(f"    Order ahora en estado: {order.status}")
    
    # 3. Buscar una receta para crear nuevo OrderItem
    recipe = Recipe.objects.first()
    if not recipe:
        print("❌ No hay recetas disponibles")
        return
    
    print(f"\n🆕 Creando nuevo OrderItem con receta: {recipe.name}")
    print(f"    Estado del Order ANTES de crear item: {order.status}")
    
    # 4. Crear nuevo OrderItem (esto debería mantener Order en PREPARING)
    new_item = OrderItem.objects.create(
        order=order,
        recipe=recipe,
        quantity=1,
        status='CREATED',  # Nuevo item siempre empieza en CREATED
        unit_price=recipe.base_price if hasattr(recipe, 'base_price') else Decimal('15.00'),
        total_price=recipe.base_price if hasattr(recipe, 'base_price') else Decimal('15.00')
    )
    
    print(f"    OrderItem #{new_item.id} creado con estado: {new_item.status}")
    
    # 5. Verificar estado del Order después de crear el item
    order.refresh_from_db()
    print(f"    Estado del Order DESPUÉS de crear item: {order.status}")
    
    # 6. Resultado
    if order.status == 'PREPARING':
        print("✅ ÉXITO: Order mantuvo estado PREPARING")
    else:
        print(f"❌ ERROR: Order cambió de PREPARING a {order.status}")
        print("    ⚠️  CONFIRMADO: Existe regresión de estado")
    
    print(f"\n📊 Estado final:")
    print(f"    Order #{order.id}: {order.status}")
    for item in order.orderitem_set.all():
        print(f"    - Item #{item.id}: {item.recipe.name} ({item.status})")


if __name__ == "__main__":
    test_order_status_regression()