#!/usr/bin/env python3
"""
Script para crear Order #1 completa con múltiples OrderItems y estados de impresión
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
from inventory.models import Recipe
from decimal import Decimal

def create_complete_test():
    """Crear Order #1 completa con diferentes estados"""
    print("🎯 Creando Order #1 completa para prueba del panel lateral...")
    
    try:
        # Obtener o crear orden #1
        order = Order.objects.get(id=1)
        print(f"  ✅ Order encontrada: #{order.id} - {order.customer_name}")
        
        # Crear impresora
        printer, created = PrinterConfig.objects.get_or_create(
            name='Test Printer Panel',
            defaults={
                'usb_port': '/dev/test/panel',
                'is_active': True,
                'baud_rate': 9600,
                'paper_width_mm': 80,
                'description': 'Impresora de prueba para panel lateral'
            }
        )
        print(f"  {'✅ Creada' if created else '🔄 Ya existe'}: {printer.name}")
        
        # Obtener recetas existentes
        recipes = list(Recipe.objects.all()[:4])
        if len(recipes) < 4:
            print("  ❌ No hay suficientes recetas. Creando recetas de prueba...")
            return
            
        print(f"  📝 Usando recetas: {[r.name for r in recipes]}")
        
        # Eliminar OrderItems existentes y sus trabajos de impresión
        existing_items = order.orderitem_set.all()
        PrintQueue.objects.filter(order_item__in=existing_items).delete()
        existing_items.delete()
        print("  🗑️  OrderItems anteriores eliminados")
        
        # Crear 4 OrderItems nuevos
        new_items = []
        estados = ['pending', 'in_progress', 'printed', 'failed']
        
        for i, recipe in enumerate(recipes):
            # Crear OrderItem
            item = OrderItem.objects.create(
                order=order,
                recipe=recipe,
                quantity=1,
                status='CREATED',
                unit_price=recipe.base_price if hasattr(recipe, 'base_price') else Decimal('15.00'),
                total_price=recipe.base_price if hasattr(recipe, 'base_price') else Decimal('15.00'),
                total_with_container=recipe.base_price if hasattr(recipe, 'base_price') else Decimal('15.00')
            )
            new_items.append(item)
            
            # Crear trabajo de impresión con estado específico
            estado = estados[i]
            print_job = PrintQueue.objects.create(
                printer=printer,
                order_item=item,
                status=estado,
                attempts=1 if estado != 'failed' else 3,
                error_message=f'Error de prueba para panel lateral - Item {i+1}' if estado == 'failed' else None
            )
            
            print(f"    ✅ Item {i+1}: {recipe.name} -> Estado: {estado}")
        
        # Actualizar total de la orden
        total = sum(item.total_with_container for item in new_items)
        order.total = total
        order.save()
        print(f"  💰 Total actualizado: S/ {total}")
        
        print(f"\n✅ Order #1 creada exitosamente con {len(new_items)} items!")
        print(f"\n📊 Estados de impresión creados:")
        print(f"   • Item 1: 'Pendiente' (texto amarillo)")
        print(f"   • Item 2: 'Imprimiendo' (texto azul)")
        print(f"   • Item 3: 'Impreso' (texto verde)")
        print(f"   • Item 4: 'Error - Reintentar' (botón rojo clicable)")
        
        print(f"\n🎯 Para probar:")
        print(f"   1. Ve a http://localhost:5173")
        print(f"   2. Abre Gestión de Pedidos")
        print(f"   3. Busca Order #1: {order.customer_name}")
        print(f"   4. Abre el panel lateral (clic en la orden)")
        print(f"   5. Verifica los 4 estados diferentes en cada OrderItem")
        print(f"   6. Prueba el botón 'Consultar Estado de Impresión' (debajo del total)")
        print(f"   7. Prueba el botón 'Error - Reintentar' del último item")
        
    except Order.DoesNotExist:
        print("  ❌ Order #1 no existe")
    except Exception as e:
        print(f"  ❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    print("🚀 Creando prueba completa del panel lateral\n")
    create_complete_test()