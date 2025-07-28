#!/usr/bin/env python3
"""
Script simple para eliminar todos los datos de órdenes usando SQL directo.
Funciona sin necesidad de management commands.

Uso en EC2:
docker-compose -f docker-compose.ec2.yml exec -T web python -c "$(cat backend/scripts/clean_orders_sql.py)"
"""

import os
import sys
import django

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection, transaction
from operation.models import Order, OrderItem, OrderItemIngredient, Payment, PaymentItem

def clean_orders_data():
    """Elimina todos los datos relacionados con órdenes usando SQL directo."""
    
    print("=" * 70)
    print("LIMPIEZA DE DATOS DE ÓRDENES - EC2")
    print("=" * 70)
    
    # Obtener conteos antes de eliminar
    with connection.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) FROM order_table")
        orders_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM order_item")
        items_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM payment")
        payments_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM payment_item")
        payment_items_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM order_item_ingredient")
        ingredients_count = cursor.fetchone()[0]
    
    print(f"Datos actuales en la base de datos:")
    print(f"  - Órdenes: {orders_count}")
    print(f"  - Items de órdenes: {items_count}")
    print(f"  - Ingredientes personalizados: {ingredients_count}")
    print(f"  - Pagos: {payments_count}")
    print(f"  - Items de pagos: {payment_items_count}")
    print()
    
    if orders_count == 0 and items_count == 0 and payments_count == 0:
        print("✅ No hay datos de órdenes para eliminar. La base de datos ya está limpia.")
        return
    
    print("⚠️  ADVERTENCIA: Esta acción es IRREVERSIBLE ⚠️")
    print("Se eliminarán TODOS los datos de:")
    print("📝 TODOS los pedidos CREADOS")
    print("🍽️  TODOS los pedidos ENTREGADOS") 
    print("💰 TODOS los pedidos PAGADOS")
    print("🗂️  TODOS los pagos y transacciones")
    print("📋 TODOS los items de órdenes")
    print("🔧 TODAS las personalizaciones")
    print()
    
    # Auto-confirmar para EC2 (sin input interactivo)
    print("🤖 Ejecutando limpieza automática en EC2...")
    print()
    
    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                # Eliminar en orden para respetar las restricciones de FK
                
                # 1. Items de pago
                cursor.execute("DELETE FROM payment_item")
                deleted_payment_items = cursor.rowcount
                print(f"  ✓ Items de pagos eliminados: {deleted_payment_items}")
                
                # 2. Pagos
                cursor.execute("DELETE FROM payment")
                deleted_payments = cursor.rowcount
                print(f"  ✓ Pagos eliminados: {deleted_payments}")
                
                # 3. Ingredientes personalizados
                cursor.execute("DELETE FROM order_item_ingredient")
                deleted_ingredients = cursor.rowcount
                print(f"  ✓ Ingredientes personalizados eliminados: {deleted_ingredients}")
                
                # 4. Items de órdenes
                cursor.execute("DELETE FROM order_item")
                deleted_items = cursor.rowcount
                print(f"  ✓ Items de órdenes eliminados: {deleted_items}")
                
                # 5. Órdenes
                cursor.execute("DELETE FROM order_table")
                deleted_orders = cursor.rowcount
                print(f"  ✓ Órdenes eliminadas: {deleted_orders}")
                
                # Reset de secuencias (IDs)
                cursor.execute("DELETE FROM sqlite_sequence WHERE name IN ('order_table', 'order_item', 'payment', 'payment_item', 'order_item_ingredient')")
                
        print("\n✅ Limpieza completada exitosamente.")
        print(f"\nResumen total:")
        print(f"  - Órdenes eliminadas: {deleted_orders}")
        print(f"  - Items eliminados: {deleted_items}")
        print(f"  - Pagos eliminados: {deleted_payments}")
        print(f"  - Items de pago eliminados: {deleted_payment_items}")
        print(f"  - Ingredientes personalizados eliminados: {deleted_ingredients}")
        
    except Exception as e:
        print(f"\n❌ Error durante la eliminación: {str(e)}")
        print("No se eliminó ningún dato debido al error.")
    
    print("\n" + "=" * 70)

if __name__ == "__main__":
    clean_orders_data()