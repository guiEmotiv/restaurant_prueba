import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_prod')
django.setup()

from operation.models import Order, OrderItem, Payment
from django.db import connection

print("🔍 ANÁLISIS DETALLADO DE DATOS REALES EN PRODUCCIÓN")
print("=" * 60)

# Revisar órdenes reales
print("1️⃣ ÓRDENES EN LA BASE DE DATOS:")
orders = Order.objects.all().order_by('id')
for order in orders:
    print(f"   Order #{order.id}: Mesa {order.table.table_number} - ${order.total_amount} - {order.status} - {order.created_at.date()}")

# Revisar items de órdenes
print(f"\n2️⃣ ITEMS DE ÓRDENES:")
items = OrderItem.objects.all().order_by('order_id', 'id')
for item in items:
    print(f"   Item #{item.id}: Order #{item.order.id} - {item.recipe.name} x{item.quantity} = ${item.total_price} - {item.status}")

# Revisar pagos
print(f"\n3️⃣ PAGOS:")
payments = Payment.objects.all().order_by('order_id', 'id')
for payment in payments:
    print(f"   Payment #{payment.id}: Order #{payment.order.id} - ${payment.amount} ({payment.payment_method})")

# Revisar la vista directamente en SQL
print(f"\n4️⃣ DATOS RAW DE LA VISTA dashboard_operativo_view:")
cursor = connection.cursor()
cursor.execute("""
    SELECT order_id, recipe_name, quantity, order_total, total_with_container, 
           order_status, operational_date, payment_method, payment_amount
    FROM dashboard_operativo_view 
    ORDER BY order_id, item_id
""")
raw_data = cursor.fetchall()
for i, data in enumerate(raw_data, 1):
    payment_info = f"{data[7]}:${data[8]}" if data[7] and data[8] else "No payment"
    print(f"   {i}. Order #{data[0]} - {data[1]} x{data[2]} - Order:${data[3]} Item:${data[4]} - {data[5]} - {data[6]} - {payment_info}")

# Verificar si hay problemas con JOINs
print(f"\n5️⃣ ANÁLISIS DE JOINS:")
cursor.execute("""
    SELECT o.id, COUNT(DISTINCT oi.id) as items_count, COUNT(DISTINCT p.id) as payments_count
    FROM "order" o
    LEFT JOIN order_item oi ON o.id = oi.order_id
    LEFT JOIN payment p ON o.id = p.order_id
    GROUP BY o.id
    ORDER BY o.id
""")
join_analysis = cursor.fetchall()
for data in join_analysis:
    print(f"   Order #{data[0]}: {data[1]} items, {data[2]} payments")

# Identificar por qué hay 4 registros en la vista con solo 3 items
print(f"\n6️⃣ INVESTIGANDO DUPLICACIÓN EN LA VISTA:")
cursor.execute("""
    SELECT o.id as order_id, oi.id as item_id, p.id as payment_id,
           o.total_amount, oi.total_price, p.amount, p.payment_method
    FROM "order" o
    LEFT JOIN order_item oi ON o.id = oi.order_id
    LEFT JOIN payment p ON o.id = p.order_id
    ORDER BY o.id, oi.id, p.id
""")
join_detail = cursor.fetchall()
print(f"   Detalle de JOIN (Order-Item-Payment):")
for data in join_detail:
    payment_info = f"Payment#{data[2]}:{data[6]}${data[5]}" if data[2] else "No payment"
    print(f"     Order#{data[0]} + Item#{data[1]}(${data[4]}) + {payment_info} -> Order total:${data[3]}")

cursor.close()
print(f"\n📊 DIAGNÓSTICO COMPLETADO")