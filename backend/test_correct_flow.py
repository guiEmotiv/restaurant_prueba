#!/usr/bin/env python3
"""
Prueba del flujo correcto:
1. Crear orden → PrintQueue automático 
2. Worker procesa PrintQueue
3. send_to_kitchen consulta estado, NO imprime
"""
import os
import sys
import django

# Configurar Django
sys.path.append('/Users/guillermosotozuniga/restaurant-web/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from operation.models import PrinterConfig, PrintQueue, Order, OrderItem
from inventory.models import Recipe
from config.models import Table, Container

def test_correct_flow():
    print("🎯 PROBANDO FLUJO CORRECTO\n")
    
    print("1. Crear orden nueva...")
    
    # Obtener datos existentes
    printer = PrinterConfig.objects.first()
    recipe = Recipe.objects.filter(printer__isnull=False).first()
    table = Table.objects.first()
    container = Container.objects.first()
    
    if not printer or not recipe:
        print("❌ Falta impresora o receta con impresora asignada")
        return
        
    # Crear orden
    order = Order.objects.create(
        table=table,
        customer_name='Test Flujo',
        party_size=2,
        status='CREATED'
    )
    print(f"   ✅ Orden creada: #{order.id}")
    
    # Crear OrderItem (DEBE crear PrintQueue automáticamente)
    order_item = OrderItem.objects.create(
        order=order,
        recipe=recipe,
        container=container,
        quantity=1,
        status='CREATED',
        unit_price=recipe.base_price,
        container_price=container.price,
        total_price=recipe.base_price + container.price
    )
    print(f"   ✅ OrderItem creado: #{order_item.id}")
    
    # Verificar PrintQueue automático
    print_jobs = PrintQueue.objects.filter(order_item=order_item)
    
    if print_jobs.exists():
        print("   ✅ PrintQueue creado automáticamente!")
        for job in print_jobs:
            print(f"      ID: {job.id}, Estado: {job.status}, Impresora: {job.printer.name}")
            
        print("\n2. Simulando que 'send_to_kitchen' consulta estado...")
        
        # Esto es lo que send_to_kitchen DEBERÍA hacer:
        latest_job = print_jobs.first()
        print(f"   📋 Estado actual del PrintQueue: {latest_job.status}")
        
        if latest_job.status == 'printed':
            print("   ✅ Ya está impreso → Cambiar OrderItem a PREPARING")
            order_item.status = 'PREPARING'
            order_item.save()
            print("   ✅ OrderItem cambiado a PREPARING")
            print("   ✅ Frontend debe SALIR de la vista")
        else:
            print(f"   ⏳ Aún no impreso (estado: {latest_job.status})")
            print("   ⚠️  Frontend debe QUEDARSE en la vista")
            print("   🔄 Permitir REINTENTAR hasta que esté impreso")
            
    else:
        print("   ❌ ERROR: PrintQueue NO se creó automáticamente")
        print("   🐛 Revisar trigger en OrderItem.save()")
        
    print(f"\n📊 Resumen del test:")
    print(f"   Orders: {Order.objects.count()}")
    print(f"   OrderItems: {OrderItem.objects.count()}")
    print(f"   PrintQueue: {PrintQueue.objects.count()}")

if __name__ == '__main__':
    test_correct_flow()