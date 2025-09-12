#!/usr/bin/env python3

"""
Test completo del flujo de items CANCELED
- Crear orden con items
- Crear print jobs para los items
- Cancelar un item 
- Verificar que los print jobs se cancelan automáticamente
- Verificar que el item CANCELED no se procesa en print process
"""

import os
import django

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from operation.models import Order, OrderItem, PrintQueue, PrinterConfig
from inventory.models import Recipe
from config.models import Table

def test_canceled_items_workflow():
    print("🔥 INICIANDO TEST COMPLETO DEL FLUJO DE ITEMS CANCELED")
    print("=" * 60)
    
    # 1. Limpiar datos previos
    print("1️⃣ Limpiando datos previos...")
    Order.objects.all().delete()
    PrintQueue.objects.all().delete()
    
    # 2. Crear/obtener receta y impresora
    recipe = Recipe.objects.first()
    printer = PrinterConfig.objects.first()
    table = Table.objects.first()
    
    if not recipe or not printer or not table:
        print("❌ ERROR: Necesitas al menos una receta, impresora y mesa")
        return
    
    print(f"   ✅ Receta: {recipe.name}")
    print(f"   ✅ Impresora: {printer.name}")
    print(f"   ✅ Mesa: {table.table_number}")
    
    # 3. Crear orden con 2 items
    print("\n2️⃣ Creando orden con 2 items...")
    order = Order.objects.create(
        customer_name="Test CANCELED",
        table_id=table.id,
        status='CREATED',
        party_size=2
    )
    
    item1 = OrderItem.objects.create(
        order=order,
        recipe=recipe,
        quantity=1,
        unit_price=15.00,
        status='CREATED'
    )
    
    item2 = OrderItem.objects.create(
        order=order,
        recipe=recipe,
        quantity=1,
        unit_price=15.00,
        status='CREATED'
    )
    
    print(f"   ✅ Orden #{order.id} creada")
    print(f"   ✅ Item1 #{item1.id} - Estado: {item1.status}")
    print(f"   ✅ Item2 #{item2.id} - Estado: {item2.status}")
    
    # 4. Crear print jobs manualmente para ambos items
    print("\n3️⃣ Creando print jobs para ambos items...")
    
    job1 = PrintQueue.objects.create(
        order_item=item1,
        printer=printer,
        status='pending',
        attempts=0,
        max_attempts=3
    )
    
    job2 = PrintQueue.objects.create(
        order_item=item2,
        printer=printer,
        status='failed',  # Simular que falló
        attempts=3,
        max_attempts=3,
        error_message='Simulado - Error de conexión'
    )
    
    print(f"   ✅ Print Job1 #{job1.id} - Estado: {job1.status}")
    print(f"   ✅ Print Job2 #{job2.id} - Estado: {job2.status}")
    
    # 5. Verificar estado inicial
    print("\n4️⃣ Estado inicial:")
    print(f"   📋 Orden #{order.id}: {order.status}")
    print(f"   🍽️  Item1 #{item1.id}: {item1.status}")
    print(f"   🍽️  Item2 #{item2.id}: {item2.status}")
    print(f"   🖨️  Job1 #{job1.id}: {job1.status}")
    print(f"   🖨️  Job2 #{job2.id}: {job2.status}")
    
    # 6. Cancelar Item1 usando update_status()
    print(f"\n5️⃣ Cancelando Item1 #{item1.id} usando update_status()...")
    item1.cancellation_reason = "Test de cancelación automática"
    item1.update_status('CANCELED')
    
    # Refrescar desde DB
    job1.refresh_from_db()
    job2.refresh_from_db()
    
    print(f"   ✅ Item1 #{item1.id} cancelado - Estado: {item1.status}")
    print(f"   🔄 Job1 #{job1.id} - Estado después de cancelar: {job1.status}")
    print(f"   🔄 Job2 #{job2.id} - Estado (debería seguir igual): {job2.status}")
    
    # 7. Verificar que solo Job1 se canceló automáticamente
    print("\n6️⃣ Verificando cancelación automática de print jobs...")
    
    if job1.status == 'cancelled':
        print(f"   ✅ Job1 #{job1.id} se canceló automáticamente ✅")
        print(f"   ✅ Error message: {job1.error_message}")
    else:
        print(f"   ❌ Job1 #{job1.id} NO se canceló (Estado: {job1.status})")
    
    if job2.status == 'failed':
        print(f"   ✅ Job2 #{job2.id} sigue como 'failed' (correcto, item no cancelado)")
    else:
        print(f"   ❌ Job2 #{job2.id} cambió inesperadamente a: {job2.status}")
    
    # 8. Probar lógica de filtrado para print process
    print("\n7️⃣ Verificando filtrado de items CANCELED en print process...")
    
    # Simular cómo se obtienen items para imprimir (excluyendo CANCELED)
    active_items = order.orderitem_set.exclude(status='CANCELED')
    canceled_items = order.orderitem_set.filter(status='CANCELED')
    
    print(f"   📊 Total items en orden: {order.orderitem_set.count()}")
    print(f"   ✅ Items activos (no CANCELED): {active_items.count()}")
    print(f"   🚫 Items cancelados: {canceled_items.count()}")
    
    for item in active_items:
        print(f"   🍽️  Activo: Item #{item.id} - {item.status}")
    
    for item in canceled_items:
        print(f"   ❌ Cancelado: Item #{item.id} - {item.status}")
    
    # 9. Resultado final
    print("\n" + "=" * 60)
    print("🎯 RESULTADO FINAL:")
    
    success_count = 0
    
    # Test 1: Item1 cancelado
    if item1.status == 'CANCELED':
        print("   ✅ [PASS] Item1 se canceló correctamente")
        success_count += 1
    else:
        print(f"   ❌ [FAIL] Item1 no se canceló (Estado: {item1.status})")
    
    # Test 2: Job1 cancelado automáticamente
    if job1.status == 'cancelled':
        print("   ✅ [PASS] Print job del item cancelado se canceló automáticamente")
        success_count += 1
    else:
        print(f"   ❌ [FAIL] Print job no se canceló (Estado: {job1.status})")
    
    # Test 3: Job2 sin afectar
    if job2.status == 'failed':
        print("   ✅ [PASS] Print job del item activo no se afectó")
        success_count += 1
    else:
        print(f"   ❌ [FAIL] Print job del item activo cambió inesperadamente")
    
    # Test 4: Filtrado correcto
    if active_items.count() == 1 and canceled_items.count() == 1:
        print("   ✅ [PASS] Filtrado de items funciona correctamente")
        success_count += 1
    else:
        print("   ❌ [FAIL] Filtrado de items no funciona")
    
    print(f"\n🏆 TESTS PASADOS: {success_count}/4")
    
    if success_count == 4:
        print("🎉 TODOS LOS TESTS PASARON - FLUJO CANCELED ITEMS FUNCIONA CORRECTAMENTE! 🎉")
    else:
        print("❌ ALGUNOS TESTS FALLARON - REVISAR IMPLEMENTACIÓN")
    
    return success_count == 4

if __name__ == "__main__":
    test_canceled_items_workflow()