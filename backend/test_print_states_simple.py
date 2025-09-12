#!/usr/bin/env python3
"""
Script simple para crear OrderItems con estados de impresión para Order #1
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

def test_print_states():
    """Crear test simple con estados de impresión"""
    print("🎯 Creando test simple de estados de impresión...")
    
    try:
        # Obtener orden #1
        order = Order.objects.get(id=1)
        print(f"  ✅ Order: #{order.id} - {order.customer_name}")
        
        # Crear impresora simple
        printer, created = PrinterConfig.objects.get_or_create(
            name='Panel Test Printer',
            defaults={
                'usb_port': '/dev/panel/test',
                'is_active': True,
                'baud_rate': 9600,
                'paper_width_mm': 80
            }
        )
        print(f"  {'✅ Creada' if created else '🔄 Ya existe'}: {printer.name}")
        
        # Usar una receta existente o crear una simple
        recipe = Recipe.objects.first()
        if not recipe:
            print("  ❌ No hay recetas disponibles")
            return
            
        print(f"  📝 Usando receta: {recipe.name}")
        
        # Limpiar OrderItems anteriores
        existing_items = order.orderitem_set.all()
        PrintQueue.objects.filter(order_item__in=existing_items).delete()
        existing_items.delete()
        print("  🗑️  Items anteriores eliminados")
        
        # Crear 4 OrderItems simples con diferentes estados
        estados = [
            ('pending', 'Pendiente', 'texto amarillo'),
            ('in_progress', 'Imprimiendo', 'texto azul'), 
            ('printed', 'Impreso', 'texto verde'),
            ('failed', 'Error - Reintentar', 'botón rojo clicable')
        ]
        
        items_creados = []
        
        for i, (estado, descripcion, tipo) in enumerate(estados):
            # Crear OrderItem
            item = OrderItem.objects.create(
                order=order,
                recipe=recipe,
                quantity=1,
                status='CREATED',
                unit_price=Decimal('15.00'),
                total_price=Decimal('15.00'),
                total_with_container=Decimal('15.00')
            )
            
            # Crear trabajo de impresión
            print_job = PrintQueue.objects.create(
                printer=printer,
                order_item=item,
                status=estado,
                attempts=1 if estado != 'failed' else 3,
                error_message=f'Error de test para panel - Item {i+1}' if estado == 'failed' else None
            )
            
            items_creados.append(item)
            print(f"    ✅ Item {i+1}: {descripcion} ({tipo})")
        
        # Actualizar total
        order.total = Decimal('60.00')  # 4 items x 15.00
        order.save()
        
        print(f"\n✅ Test creado exitosamente!")
        print(f"   • Order #1 con 4 OrderItems")
        print(f"   • 4 estados diferentes de impresión")
        
        print(f"\n🎯 INSTRUCCIONES PARA PROBAR:")
        print(f"   1. Ve a → http://localhost:5173")
        print(f"   2. Navega a → Gestión de Pedidos")
        print(f"   3. Busca → Order #1: {order.customer_name}")
        print(f"   4. Haz clic en la orden para abrir el panel lateral")
        print(f"   5. En el panel lateral verás:")
        print(f"      • Item 1: 'Pendiente' (texto amarillo)")
        print(f"      • Item 2: 'Imprimiendo' (texto azul)")
        print(f"      • Item 3: 'Impreso' (texto verde)")
        print(f"      • Item 4: 'Error - Reintentar' (botón rojo)")
        print(f"   6. Prueba el botón 'Consultar Estado de Impresión'")
        print(f"   7. Haz clic en 'Error - Reintentar' del último item")
        
        print(f"\n✨ ¡El panel lateral está listo para probar!")
        
    except Exception as e:
        print(f"  ❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    print("🚀 Test simple de estados de impresión\n")
    test_print_states()