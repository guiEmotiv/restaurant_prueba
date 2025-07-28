#!/usr/bin/env python3
"""
Script para eliminar datos de pedidos (órdenes) de la base de datos.
Esto permite modificar recetas sin restricciones de integridad referencial.

ADVERTENCIA: Este script elimina permanentemente datos de:
- Pagos (Payment, PaymentItem)
- Items de órdenes (OrderItem, OrderItemIngredient)
- Órdenes (Order)

Uso:
    python manage.py shell < scripts/clean_orders_data.py
    o
    python scripts/clean_orders_data.py (desde el directorio backend)
"""

import os
import sys
import django
from django.db import transaction
from datetime import datetime

# Configurar Django si se ejecuta como script independiente
if __name__ == "__main__":
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    django.setup()

from operation.models import Order, OrderItem, OrderItemIngredient, Payment, PaymentItem


def clean_orders_data():
    """Elimina todos los datos relacionados con órdenes."""
    
    print("=" * 70)
    print("LIMPIEZA DE DATOS DE ÓRDENES")
    print("=" * 70)
    print(f"Fecha y hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Obtener conteos antes de eliminar
    counts = {
        'orders': Order.objects.count(),
        'order_items': OrderItem.objects.count(),
        'order_item_ingredients': OrderItemIngredient.objects.count(),
        'payments': Payment.objects.count(),
        'payment_items': PaymentItem.objects.count(),
    }
    
    print("Datos actuales en la base de datos:")
    print(f"  - Órdenes: {counts['orders']}")
    print(f"  - Items de órdenes: {counts['order_items']}")
    print(f"  - Ingredientes personalizados: {counts['order_item_ingredients']}")
    print(f"  - Pagos: {counts['payments']}")
    print(f"  - Items de pagos: {counts['payment_items']}")
    print()
    
    if any(count > 0 for count in counts.values()):
        # Confirmación del usuario
        print("⚠️  ADVERTENCIA: Esta acción es IRREVERSIBLE ⚠️")
        print("Se eliminarán TODOS los datos de órdenes, pagos y registros relacionados.")
        print()
        
        confirmation = input("¿Está seguro que desea continuar? (escriba 'SI ELIMINAR' para confirmar): ")
        
        if confirmation != "SI ELIMINAR":
            print("\n❌ Operación cancelada. No se eliminó ningún dato.")
            return
        
        print("\nEliminando datos...")
        
        try:
            with transaction.atomic():
                # Eliminar en orden para respetar las restricciones de FK
                # 1. Primero los items de pago
                deleted_payment_items = PaymentItem.objects.all().delete()
                print(f"  ✓ Items de pagos eliminados: {deleted_payment_items[0]}")
                
                # 2. Luego los pagos
                deleted_payments = Payment.objects.all().delete()
                print(f"  ✓ Pagos eliminados: {deleted_payments[0]}")
                
                # 3. Ingredientes personalizados de items
                deleted_ingredients = OrderItemIngredient.objects.all().delete()
                print(f"  ✓ Ingredientes personalizados eliminados: {deleted_ingredients[0]}")
                
                # 4. Items de órdenes
                deleted_items = OrderItem.objects.all().delete()
                print(f"  ✓ Items de órdenes eliminados: {deleted_items[0]}")
                
                # 5. Finalmente las órdenes
                deleted_orders = Order.objects.all().delete()
                print(f"  ✓ Órdenes eliminadas: {deleted_orders[0]}")
                
                print("\n✅ Limpieza completada exitosamente.")
                
                # Mostrar resumen
                print("\nResumen de eliminación:")
                for model, details in deleted_orders[1].items():
                    if details > 0:
                        print(f"  - {model}: {details}")
                        
        except Exception as e:
            print(f"\n❌ Error durante la eliminación: {str(e)}")
            print("No se eliminó ningún dato debido al error.")
            
    else:
        print("✅ No hay datos de órdenes para eliminar. La base de datos ya está limpia.")
    
    print("\n" + "=" * 70)


def get_orders_summary():
    """Muestra un resumen de las órdenes actuales antes de eliminar."""
    
    print("\nResumen de órdenes por estado:")
    for status, label in Order.STATUS_CHOICES:
        count = Order.objects.filter(status=status).count()
        if count > 0:
            print(f"  - {label}: {count}")
    
    # Mostrar órdenes recientes
    recent_orders = Order.objects.order_by('-created_at')[:5]
    if recent_orders:
        print("\nÚltimas 5 órdenes:")
        for order in recent_orders:
            print(f"  - Orden #{order.id}: Mesa {order.table.table_number}, "
                  f"Total: S/{order.total_amount}, Estado: {order.get_status_display()}")


if __name__ == "__main__":
    # Mostrar resumen antes de proceder
    get_orders_summary()
    
    # Ejecutar limpieza
    clean_orders_data()