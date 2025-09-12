#!/usr/bin/env python3
"""
Script simple para agregar trabajos de impresión a Order #1 existente
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

def add_print_jobs_to_order1():
    """Agregar trabajos de impresión con diferentes estados a Order #1"""
    print("🖨️  Agregando trabajos de impresión a Order #1...")
    
    try:
        # Obtener Order #1
        order = Order.objects.get(id=1)
        print(f"  ✅ Order encontrada: #{order.id} - {order.customer_name}")
        
        # Obtener o crear impresora
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
        
        # Obtener OrderItems
        order_items = list(order.orderitem_set.all())
        if not order_items:
            print("  ❌ No hay OrderItems en esta orden")
            return
            
        print(f"  📝 Encontrados {len(order_items)} OrderItems")
        
        # Eliminar trabajos existentes
        PrintQueue.objects.filter(order_item__in=order_items).delete()
        print("  🗑️  Trabajos de impresión anteriores eliminados")
        
        # Estados de prueba
        estados = ['pending', 'in_progress', 'printed', 'failed']
        
        # Crear trabajos con diferentes estados
        for i, item in enumerate(order_items[:4]):  # Solo primeros 4 items
            estado = estados[i] if i < len(estados) else 'pending'
            
            print_job = PrintQueue.objects.create(
                printer=printer,
                order_item=item,
                status=estado,
                attempts=1 if estado != 'failed' else 3,
                error_message=f'Error de prueba - Panel lateral test' if estado == 'failed' else None
            )
            
            print(f"    🖨️  {item.recipe.name}: {estado}")
        
        print(f"\n✅ Trabajos de impresión creados exitosamente!")
        print(f"\n🎯 Para probar:")
        print(f"   1. Ve a http://localhost:5173")
        print(f"   2. Abre Gestión de Pedidos")
        print(f"   3. Busca Order #1: {order.customer_name}")
        print(f"   4. Abre el panel lateral")
        print(f"   5. Verifica los estados:")
        print(f"      • 'Pendiente' (texto amarillo)")
        print(f"      • 'Imprimiendo' (texto azul)")
        print(f"      • 'Impreso' (texto verde)")
        print(f"      • 'Error - Reintentar' (botón rojo clicable)")
        print(f"   6. Prueba el botón 'Consultar Estado de Impresión'")
            
    except Order.DoesNotExist:
        print("  ❌ Order #1 no existe")
    except Exception as e:
        print(f"  ❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    print("🚀 Agregando estados de impresión a Order #1\n")
    add_print_jobs_to_order1()