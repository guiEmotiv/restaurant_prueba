#!/usr/bin/env python3

"""
Test para verificar que los items CANCELED NO aparecen en el panel lateral
"""

import os
import django

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from operation.models import Order, OrderItem, PrintQueue, PrinterConfig
from inventory.models import Recipe
from config.models import Table

def test_canceled_items_completely_hidden():
    print("🚫 TEST: ITEMS CANCELED COMPLETAMENTE OCULTOS EN FRONTEND")
    print("=" * 60)
    
    # 1. Limpiar órdenes previas
    print("1️⃣ Limpiando datos previos...")
    Order.objects.filter(customer_name__startswith="Test Hidden").delete()
    
    # 2. Crear nueva orden con 3 items
    recipe = Recipe.objects.first()
    table = Table.objects.first()
    
    if not recipe or not table:
        print("❌ No hay datos suficientes")
        return
    
    order = Order.objects.create(
        customer_name="Test Hidden CANCELED",
        table_id=table.id,
        status='CREATED',
        party_size=1
    )
    
    # Crear 3 items
    item1 = OrderItem.objects.create(order=order, recipe=recipe, quantity=1, unit_price=10.00, status='CREATED')
    item2 = OrderItem.objects.create(order=order, recipe=recipe, quantity=1, unit_price=10.00, status='CREATED')  
    item3 = OrderItem.objects.create(order=order, recipe=recipe, quantity=1, unit_price=10.00, status='CREATED')
    
    print(f"✅ Orden #{order.id} creada con 3 items")
    
    # 3. Cancelar 2 items, dejar 1 activo
    print(f"\n2️⃣ Cancelando 2 de los 3 items...")
    
    item1.cancellation_reason = "Test - Item 1 cancelado"
    item1.update_status('CANCELED')
    
    item2.cancellation_reason = "Test - Item 2 cancelado" 
    item2.update_status('CANCELED')
    
    # item3 se queda como CREATED (activo)
    
    print(f"✅ Item #{item1.id}: {item1.status}")
    print(f"✅ Item #{item2.id}: {item2.status}")
    print(f"✅ Item #{item3.id}: {item3.status}")
    
    # 4. Simular lo que ve el frontend
    print(f"\n3️⃣ Simulando filtrado del frontend...")
    
    all_items = order.orderitem_set.all()
    visible_items = order.orderitem_set.exclude(status='CANCELED')
    canceled_items = order.orderitem_set.filter(status='CANCELED')
    
    print(f"📊 Resumen:")
    print(f"   • Total items: {all_items.count()}")
    print(f"   • Items visibles: {visible_items.count()}")
    print(f"   • Items cancelados: {canceled_items.count()}")
    
    print(f"\n🖥️  Lo que debería mostrar el frontend:")
    print(f"   Panel lateral:")
    
    if visible_items.count() > 0:
        print(f"   ✅ {visible_items.count()} OrderItem(s) visible(s):")
        for item in visible_items:
            print(f"      • Item #{item.id}: {item.status}")
    else:
        print(f"   ❌ Ningún OrderItem visible (todos cancelados)")
    
    print(f"\n🚫 Items que NO deben aparecer:")
    for item in canceled_items:
        print(f"      • Item #{item.id}: {item.status} (OCULTO)")
    
    # 5. Verificar que los logs mostrarían los valores correctos
    print(f"\n4️⃣ Valores esperados en logs del frontend:")
    print(f"   orderId: {order.id}")
    print(f"   totalItems: {all_items.count()}")
    print(f"   visibleItems: {visible_items.count()}")
    print(f"   canceledItems: {canceled_items.count()}")
    print(f"   visibleStatuses: {list(visible_items.values_list('id', 'status'))}")
    
    print(f"\n" + "=" * 60)
    print(f"🎯 RESULTADO ESPERADO:")
    
    if visible_items.count() == 1:
        print(f"✅ Panel lateral debe mostrar SOLO 1 OrderItem (#{item3.id})")
        print(f"✅ Items CANCELED (#{item1.id}, #{item2.id}) deben estar COMPLETAMENTE OCULTOS")
        print(f"✅ No debe ejecutarse checkPrintStatus para items CANCELED")
    else:
        print(f"❌ Problema con el filtrado")
    
    return order.id

if __name__ == "__main__":
    test_canceled_items_completely_hidden()