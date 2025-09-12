#!/usr/bin/env python3
"""
Script final - Solo crear trabajos de impresión para OrderItems existentes
"""
import os
import sys
import django

# Configurar Django
sys.path.append('/Users/guillermosotozuniga/restaurant-web/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from operation.models import PrinterConfig, PrintQueue, Order, OrderItem

def create_print_jobs():
    """Crear trabajos de impresión para OrderItems existentes"""
    print("🎯 Creando trabajos de impresión para Order #1...")
    
    try:
        # Obtener orden #1
        order = Order.objects.get(id=1)
        print(f"  ✅ Order: #{order.id} - {order.customer_name}")
        
        # Obtener OrderItems existentes
        items = list(order.orderitem_set.all())
        print(f"  📝 OrderItems encontrados: {len(items)}")
        
        if not items:
            print("  ❌ No hay OrderItems en esta orden")
            return
            
        # Crear impresora
        printer, created = PrinterConfig.objects.get_or_create(
            name='Panel Test Simple',
            defaults={
                'usb_port': '/dev/simple',
                'is_active': True,
                'baud_rate': 9600,
                'paper_width_mm': 80
            }
        )
        print(f"  {'✅ Creada' if created else '🔄 Ya existe'}: {printer.name}")
        
        # Limpiar trabajos anteriores
        PrintQueue.objects.filter(order_item__in=items).delete()
        print("  🗑️  Trabajos anteriores eliminados")
        
        # Estados para asignar
        estados = ['pending', 'in_progress', 'printed', 'failed']
        
        # Crear trabajos de impresión
        for i, item in enumerate(items):
            estado = estados[i % len(estados)]  # Ciclar si hay más items que estados
            
            print_job = PrintQueue.objects.create(
                printer=printer,
                order_item=item,
                status=estado,
                attempts=1 if estado != 'failed' else 3,
                error_message=f'Test error - Panel lateral' if estado == 'failed' else None
            )
            
            print(f"    🖨️  OrderItem #{item.id}: {estado}")
        
        print(f"\n✅ ¡Trabajos de impresión creados exitosamente!")
        
        print(f"\n🎯 AHORA PUEDES PROBAR:")
        print(f"   1. Ve a: http://localhost:5173")
        print(f"   2. Gestión de Pedidos")
        print(f"   3. Busca Order #1: {order.customer_name}")
        print(f"   4. Abre el panel lateral")
        print(f"   5. Verás los estados de impresión:")
        
        # Mostrar estados que se crearon
        for i, item in enumerate(items):
            estado = estados[i % len(estados)]
            if estado == 'pending':
                print(f"      • Item {i+1}: 'Pendiente' (texto amarillo)")
            elif estado == 'in_progress':
                print(f"      • Item {i+1}: 'Imprimiendo' (texto azul)")
            elif estado == 'printed':
                print(f"      • Item {i+1}: 'Impreso' (texto verde)")
            elif estado == 'failed':
                print(f"      • Item {i+1}: 'Error - Reintentar' (botón rojo)")
        
        print(f"   6. Prueba 'Consultar Estado de Impresión'")
        
    except Order.DoesNotExist:
        print("  ❌ Order #1 no existe")
    except Exception as e:
        print(f"  ❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    print("🚀 Test final del panel lateral\n")
    create_print_jobs()