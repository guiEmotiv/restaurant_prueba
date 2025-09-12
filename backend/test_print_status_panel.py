#!/usr/bin/env python3
"""
Script para crear prueba específica del panel lateral con estados de impresión
Crea trabajos de impresión con diferentes estados para Order #1
"""
import os
import sys
import django

# Configurar Django
sys.path.append('/Users/guillermosotozuniga/restaurant-web/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import transaction
from operation.models import PrinterConfig, PrintQueue, Order, OrderItem
from inventory.models import Recipe, Group
from config.models import Table, Container
from decimal import Decimal
import uuid

def get_or_create_test_data():
    """Obtener o crear datos básicos necesarios"""
    print("🔧 Preparando datos básicos...")
    
    # Crear impresora
    printer, created = PrinterConfig.objects.get_or_create(
        name='Test Printer',
        defaults={
            'usb_port': '/dev/test',
            'is_active': True,
            'baud_rate': 9600,
            'paper_width_mm': 80,
            'description': 'Impresora de prueba para panel lateral'
        }
    )
    print(f"  {'✅ Creada' if created else '🔄 Ya existe'}: Impresora {printer.name}")
    
    # Crear grupo y recetas
    group, _ = Group.objects.get_or_create(
        name='Pruebas Panel',
        defaults={}
    )
    
    recipes = []
    recipe_names = ['Plato Test 1', 'Plato Test 2', 'Plato Test 3', 'Plato Test 4']
    for name in recipe_names:
        recipe, created = Recipe.objects.get_or_create(
            name=name,
            defaults={
                'group': group,
                'printer': printer,
                'base_price': Decimal('15.00'),
                'preparation_time': 15,
                'is_active': True,
                'is_available': True,
            }
        )
        recipes.append(recipe)
        print(f"  {'✅ Creada' if created else '🔄 Ya existe'}: Receta {recipe.name}")
    
    # Crear mesa y contenedor
    table, _ = Table.objects.get_or_create(
        table_number='TEST-1',
        defaults={}
    )
    
    container, _ = Container.objects.get_or_create(
        name='Envase Test',
        defaults={'price': Decimal('1.50')}
    )
    
    return printer, recipes, table, container

def create_order_with_print_jobs():
    """Crear Order #1 con diferentes estados de impresión"""
    print("📝 Creando Order #1 con trabajos de impresión...")
    
    printer, recipes, table, container = get_or_create_test_data()
    
    # Eliminar order #1 existente si existe
    Order.objects.filter(id=1).delete()
    
    # Crear Order #1
    order = Order.objects.create(
        id=1,
        table=table,
        customer_name='Cliente Panel Test',
        party_size=2,
        status='CONFIRMED',
        total=Decimal('0.00')
    )
    
    print(f"  ✅ Orden creada: #{order.id} - {order.customer_name}")
    
    # Crear OrderItems con diferentes estados de impresión
    order_items = []
    print_statuses = ['pending', 'in_progress', 'printed', 'failed']
    
    for i, (recipe, print_status) in enumerate(zip(recipes, print_statuses)):
        # Crear OrderItem
        item = OrderItem.objects.create(
            order=order,
            recipe=recipe,
            container=container,
            quantity=1,
            status='CREATED',
            unit_price=recipe.base_price,
            container_price=container.price,
            total_price=recipe.base_price,
            total_with_container=recipe.base_price + container.price
        )
        
        order_items.append(item)
        
        # Crear trabajo de impresión con estado específico
        print_job = PrintQueue.objects.create(
            printer=printer,
            order_item=item,
            status=print_status,
            attempts=1 if print_status != 'failed' else 3,
            error_message='Error de prueba para el panel lateral' if print_status == 'failed' else None
        )
        
        print(f"    ✅ Item: {recipe.name} -> Estado de impresión: {print_status}")
    
    # Actualizar total de la orden
    total = sum(item.total_with_container for item in order_items)
    order.total = total
    order.save()
    
    print(f"  💰 Total de la orden: S/ {total}")
    return order, order_items

def verify_print_jobs():
    """Verificar los trabajos de impresión creados"""
    print("🔍 Verificando trabajos de impresión creados...")
    
    order = Order.objects.get(id=1)
    items = order.items.all()
    
    for item in items:
        jobs = PrintQueue.objects.filter(order_item=item).order_by('-created_at')
        if jobs.exists():
            job = jobs.first()
            print(f"  🖨️  {item.recipe.name}: {job.status}")
        else:
            print(f"  ❌ {item.recipe.name}: Sin trabajo de impresión")

def main():
    """Ejecutar prueba completa"""
    print("🚀 Creando prueba del panel lateral - Order #1\n")
    
    try:
        with transaction.atomic():
            # 1. Crear order con diferentes estados
            order, order_items = create_order_with_print_jobs()
            print()
            
            # 2. Verificar trabajos creados
            verify_print_jobs()
            
            print(f"\n✅ Prueba creada exitosamente!")
            print(f"\n📊 Resumen:")
            print(f"   • Order #{order.id} con {len(order_items)} items")
            print(f"   • 4 trabajos de impresión con estados diferentes")
            print(f"   • Estados: Pendiente, Imprimiendo, Impreso, Error")
            
            print(f"\n🎯 Para probar:")
            print(f"   1. Ve a http://localhost:5173")
            print(f"   2. Abre la vista de Gestión de Pedidos") 
            print(f"   3. Busca la Order #{order.id}")
            print(f"   4. Abre el panel lateral")
            print(f"   5. Verifica los estados de impresión en cada OrderItem")
            print(f"   6. Prueba el botón 'Consultar Estado de Impresión'")
            print(f"   7. Prueba el botón 'Error - Reintentar' del último item")
            
    except Exception as e:
        print(f"❌ Error creando prueba: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()