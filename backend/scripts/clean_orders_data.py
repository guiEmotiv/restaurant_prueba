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
from django.db import transaction, models
from datetime import datetime

# Configurar Django si se ejecuta como script independiente
try:
    from operation.models import Order, OrderItem, OrderItemIngredient, Payment, PaymentItem
except ImportError:
    # Solo configurar Django si no está ya configurado
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
        print("\n" + "⚠️ " * 20)
        print("ADVERTENCIA: Esta acción es IRREVERSIBLE")
        print("⚠️ " * 20)
        print("\nSe eliminarán TODOS los siguientes datos:")
        print("📝 TODOS los pedidos CREADOS")
        print("🍽️  TODOS los pedidos ENTREGADOS") 
        print("💰 TODOS los pedidos PAGADOS")
        print("🗂️  TODOS los pagos y transacciones")
        print("📋 TODOS los items de órdenes")
        print("🔧 TODAS las personalizaciones")
        print("\n💡 Esto te permitirá modificar recetas sin restricciones de integridad referencial.")
        print()
        
        confirmation = input("¿Está ABSOLUTAMENTE seguro? (escriba 'SI ELIMINAR' para confirmar): ")
        
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
    
    print("\n📋 RESUMEN DE ÓRDENES ACTUALES:")
    print("-" * 50)
    
    total_orders = Order.objects.count()
    if total_orders == 0:
        print("  No hay órdenes en la base de datos")
        return
        
    print(f"Total de órdenes: {total_orders}")
    print("\nPor estado:")
    
    # Contadores por estado
    created_count = Order.objects.filter(status='CREATED').count()
    served_count = Order.objects.filter(status='SERVED').count()  
    paid_count = Order.objects.filter(status='PAID').count()
    
    if created_count > 0:
        print(f"  📝 Pedidos CREADOS: {created_count}")
    if served_count > 0:
        print(f"  🍽️  Pedidos ENTREGADOS: {served_count}")
    if paid_count > 0:
        print(f"  💰 Pedidos PAGADOS: {paid_count}")
    
    # Información adicional
    total_items = OrderItem.objects.count()
    total_payments = Payment.objects.count()
    total_revenue = Order.objects.filter(status='PAID').aggregate(
        total=models.Sum('total_amount')
    )['total'] or 0
    
    print(f"\nDatos relacionados:")
    print(f"  - Items de órdenes: {total_items}")
    print(f"  - Pagos registrados: {total_payments}")
    if total_revenue > 0:
        print(f"  - Ingresos totales: S/ {total_revenue:.2f}")
    
    # Mostrar órdenes recientes
    recent_orders = Order.objects.order_by('-created_at')[:5]
    if recent_orders:
        print("\nÚltimas 5 órdenes:")
        for order in recent_orders:
            status_emoji = {
                'CREATED': '📝',
                'SERVED': '🍽️',
                'PAID': '💰'
            }.get(order.status, '❓')
            
            print(f"  {status_emoji} Orden #{order.id}: Mesa {order.table.table_number}, "
                  f"Total: S/{order.total_amount:.2f}, Estado: {order.get_status_display()}")


if __name__ == "__main__":
    # Mostrar resumen antes de proceder
    get_orders_summary()
    
    # Ejecutar limpieza
    clean_orders_data()