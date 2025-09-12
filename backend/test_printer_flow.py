#!/usr/bin/env python3
"""
Script para probar el flujo completo de impresión usando Django shell
Funciona sin autenticación, directamente con el ORM
"""
import os
import sys
import django

# Configurar Django
sys.path.append('/Users/guillermosotozuniga/restaurant-web/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from operation.models import PrinterConfig, PrintQueue, Order, OrderItem
from inventory.models import Recipe, Group
from config.models import Table, Container
from decimal import Decimal

def test_printer_flow():
    print("🚀 Probando flujo completo de impresión\n")
    
    print("1. 🖨️  Creando impresora de prueba...")
    printer = PrinterConfig.objects.create(
        name='Impresora Prueba',
        usb_port='/dev/usb/lp0',
        description='Impresora de prueba para testing',
        is_active=True,
        baud_rate=9600,
        paper_width_mm=80
    )
    print(f"   ✅ Impresora creada: {printer.name}")
    
    print("\n2. 🍽️  Creando receta con impresora asignada...")
    group, _ = Group.objects.get_or_create(
        name='Platos de Prueba',
        defaults={'description': 'Grupo para testing'}
    )
    
    recipe = Recipe.objects.create(
        name='Plato de Prueba',
        description='Plato para testing de impresión',
        group=group,
        printer=printer,  # Asignar impresora
        price=Decimal('15.50'),
        is_active=True,
        is_available=True
    )
    print(f"   ✅ Receta creada: {recipe.name} -> Impresora: {printer.name}")
    
    print("\n3. 📝 Creando orden y OrderItem...")
    table, _ = Table.objects.get_or_create(
        name='Mesa Prueba',
        defaults={'description': 'Mesa para testing', 'capacity': 4}
    )
    
    container, _ = Container.objects.get_or_create(
        name='Plato Prueba',
        defaults={'description': 'Contenedor para testing', 'price': Decimal('1.50')}
    )
    
    order = Order.objects.create(
        table=table,
        customer_name='Cliente Prueba',
        party_size=2,
        status='CONFIRMED'
    )
    print(f"   ✅ Orden creada: #{order.id}")
    
    print("\n4. 🎯 Creando OrderItem (esto debe activar impresión automática)...")
    order_item = OrderItem.objects.create(
        order=order,
        recipe=recipe,
        container=container,
        quantity=1,
        status='CREATED',  # Esto debe disparar el trigger automático
        unit_price=recipe.price,
        container_price=container.price,
        total_price=recipe.price,
        total_with_container=recipe.price + container.price
    )
    print(f"   ✅ OrderItem creado: {order_item.recipe.name} (Status: {order_item.status})")
    
    print("\n5. 📋 Verificando cola de impresión...")
    print_jobs = PrintQueue.objects.filter(order_item=order_item)
    
    if print_jobs.exists():
        for job in print_jobs:
            print(f"   🖨️  ✅ Trabajo de impresión creado automáticamente!")
            print(f"        ID: {job.id}")
            print(f"        Impresora: {job.printer.name}")
            print(f"        Estado: {job.status}")
            print(f"        Item: {job.order_item.recipe.name}")
            print(f"        Creado: {job.created_at}")
            print(f"        Intentos: {job.attempts}")
    else:
        print("   ⚠️  No se creó trabajo de impresión automáticamente")
        print("      (Puede indicar problema en el trigger del modelo)")
    
    print(f"\n📊 Resumen:")
    print(f"   • Impresoras: {PrinterConfig.objects.count()}")
    print(f"   • Recetas con impresora: {Recipe.objects.filter(printer__isnull=False).count()}")
    print(f"   • Órdenes: {Order.objects.count()}")
    print(f"   • OrderItems: {OrderItem.objects.count()}")
    print(f"   • Trabajos en cola: {PrintQueue.objects.count()}")
    
    print(f"\n🔍 Para continuar probando:")
    print(f"   1. Ve a http://localhost:5173")
    print(f"   2. Inicia sesión y navega a Admin → Impresoras")
    print(f"   3. Deberías ver la impresora '{printer.name}' en la lista")
    print(f"   4. Ve a la pestaña 'Cola' para ver el trabajo de impresión")
    print(f"   5. Crea más OrderItems para ver más impresiones automáticas")

if __name__ == '__main__':
    try:
        test_printer_flow()
        print("\n✅ Prueba completada exitosamente!")
    except Exception as e:
        print(f"\n❌ Error en la prueba: {e}")
        import traceback
        traceback.print_exc()