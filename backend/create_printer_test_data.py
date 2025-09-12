#!/usr/bin/env python3
"""
Script para crear datos de prueba del sistema de impresión
Crea impresoras, asigna a recetas y prueba el flujo completo
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

def create_test_printers():
    """Crear impresoras de prueba"""
    print("🖨️  Creando impresoras de prueba...")
    
    printers_data = [
        {
            'name': 'Impresora Cocina Principal',
            'usb_port': '/dev/usb/lp0',
            'is_active': True,
            'baud_rate': 9600,
            'paper_width_mm': 80,
            'description': 'Impresora principal para cocina'
        },
        {
            'name': 'Impresora Bebidas',
            'usb_port': '/dev/usb/lp1', 
            'is_active': True,
            'baud_rate': 9600,
            'paper_width_mm': 58,
            'description': 'Impresora para bebidas'
        },
        {
            'name': 'Impresora Backup',
            'usb_port': '/dev/ttyUSB0',
            'is_active': False,
            'baud_rate': 9600,
            'paper_width_mm': 80,
            'description': 'Impresora backup'
        }
    ]
    
    created_printers = []
    for printer_data in printers_data:
        printer, created = PrinterConfig.objects.get_or_create(
            name=printer_data['name'],
            defaults=printer_data
        )
        created_printers.append(printer)
        print(f"  {'✅ Creada' if created else '🔄 Ya existe'}: {printer.name} ({printer.usb_port})")
    
    return created_printers

def create_test_recipes_with_printers(printers):
    """Crear recetas y asignarlas a impresoras"""
    print("🍽️  Creando recetas con impresoras asignadas...")
    
    # Obtener o crear grupo
    group, _ = Group.objects.get_or_create(
        name='Platos Principales',
        defaults={}
    )
    
    recipes_data = [
        {
            'name': 'Pollo a la Brasa',
            'printer': printers[0],  # Cocina Principal
            'price': Decimal('25.90'),
        },
        {
            'name': 'Lomo Saltado',
            'printer': printers[0],  # Cocina Principal
            'price': Decimal('22.50'),
        },
        {
            'name': 'Chicha Morada',
            'printer': printers[1],  # Bebidas
            'price': Decimal('8.00'),
        },
        {
            'name': 'Pisco Sour',
            'printer': printers[1],  # Bebidas  
            'price': Decimal('15.00'),
        }
    ]
    
    created_recipes = []
    for recipe_data in recipes_data:
        recipe, created = Recipe.objects.get_or_create(
            name=recipe_data['name'],
            defaults={
                'group': group,
                'printer': recipe_data['printer'],
                'price': recipe_data['price'],
                'is_active': True,
                'is_available': True,
            }
        )
        created_recipes.append(recipe)
        print(f"  {'✅ Creada' if created else '🔄 Ya existe'}: {recipe.name} -> {recipe_data['printer'].name}")
    
    return created_recipes

def create_test_order_and_items(recipes):
    """Crear orden de prueba con items para activar la impresión automática"""
    print("📝 Creando orden de prueba...")
    
    # Obtener o crear mesa
    table, _ = Table.objects.get_or_create(
        name='Mesa 1',
        defaults={'capacity': 4}
    )
    
    # Obtener o crear contenedor
    container, _ = Container.objects.get_or_create(
        name='Plato Grande',
        defaults={'price': Decimal('2.00')}
    )
    
    # Crear orden
    order = Order.objects.create(
        table=table,
        customer_name='Cliente de Prueba',
        party_size=2,
        status='CONFIRMED',
        total=Decimal('0.00')  # Se calculará después
    )
    
    print(f"  ✅ Orden creada: #{order.id} - {order.customer_name}")
    
    # Crear OrderItems (esto debería trigger la impresión automática)
    total = Decimal('0.00')
    order_items = []
    
    items_data = [
        {'recipe': recipes[0], 'quantity': 1},  # Pollo a la Brasa -> Cocina Principal
        {'recipe': recipes[1], 'quantity': 1},  # Lomo Saltado -> Cocina Principal  
        {'recipe': recipes[2], 'quantity': 2},  # Chicha Morada -> Bebidas
        {'recipe': recipes[3], 'quantity': 1},  # Pisco Sour -> Bebidas
    ]
    
    for item_data in items_data:
        recipe = item_data['recipe']
        quantity = item_data['quantity']
        
        item = OrderItem.objects.create(
            order=order,
            recipe=recipe,
            container=container,
            quantity=quantity,
            status='CREATED',  # Esto debería trigger la impresión automática
            unit_price=recipe.price,
            container_price=container.price,
            total_price=recipe.price * quantity,
            total_with_container=(recipe.price + container.price) * quantity
        )
        
        order_items.append(item)
        total += item.total_with_container
        
        print(f"    ✅ Item: {quantity}x {recipe.name} -> Impresora: {recipe.printer.name}")
        print(f"       Status: {item.status} (debería activar impresión automática)")
    
    # Actualizar total de la orden
    order.total = total
    order.save()
    
    print(f"  💰 Total de la orden: S/ {total}")
    return order, order_items

def check_print_queue():
    """Verificar la cola de impresión"""
    print("📋 Verificando cola de impresión...")
    
    jobs = PrintQueue.objects.all().order_by('-created_at')
    
    if not jobs.exists():
        print("  ⚠️  No hay trabajos en la cola de impresión")
        print("     (Esto podría indicar un problema con el trigger automático)")
        return
    
    for job in jobs:
        print(f"  🖨️  Trabajo #{job.id}: {job.printer.name}")
        print(f"      Estado: {job.status}")
        print(f"      Orden: {job.order_item.order.id} - Item: {job.order_item.recipe.name}")
        print(f"      Creado: {job.created_at}")
        print(f"      Intentos: {job.attempts}")
        if job.error_message:
            print(f"      Error: {job.error_message}")
        print()

def main():
    """Ejecutar todo el flujo de prueba"""
    print("🚀 Iniciando creación de datos de prueba del sistema de impresión\n")
    
    try:
        with transaction.atomic():
            # 1. Crear impresoras
            printers = create_test_printers()
            print()
            
            # 2. Crear recetas con impresoras asignadas
            recipes = create_test_recipes_with_printers(printers)
            print()
            
            # 3. Crear orden con items (debería activar impresión automática)
            order, order_items = create_test_order_and_items(recipes)
            print()
            
            # 4. Verificar cola de impresión
            check_print_queue()
            
            print("✅ Datos de prueba creados exitosamente!")
            print("\n📊 Resumen:")
            print(f"   • {len(printers)} impresoras configuradas")
            print(f"   • {len(recipes)} recetas con impresoras asignadas")  
            print(f"   • 1 orden de prueba con {len(order_items)} items")
            print(f"   • {PrintQueue.objects.count()} trabajos en cola de impresión")
            
            print("\n🔍 Para probar:")
            print("   1. Ve a http://localhost:5173 y navega a Admin -> Impresoras")
            print("   2. Verifica que las impresoras aparezcan en la interfaz")
            print("   3. Revisa la cola de impresión")
            print("   4. Prueba crear más OrderItems para ver impresión automática")
            
    except Exception as e:
        print(f"❌ Error creando datos de prueba: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()