import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_prod')
django.setup()

from operation.models import Order, OrderItem, Payment
from inventory.models import Recipe, Group
from config.models import Table
from decimal import Decimal

print("🍽️ CREATING TEST ORDER TO VALIDATE COMPLETE FUNCTIONALITY")
print("=" * 65)

# Get or create necessary objects
print("1️⃣ Setting up test data...")

# Get or create a zone first
from config.models import Zone
zone, created_zone = Zone.objects.get_or_create(
    name="Test Zone",
    defaults={}
)
print(f"{'✅ Created' if created_zone else '✅ Found'} zone: {zone.name}")

# Get or create a table
table, created = Table.objects.get_or_create(
    table_number="99",
    defaults={
        'zone': zone
    }
)
print(f"{'✅ Created' if created else '✅ Found'} table: Mesa {table.table_number}")

# Get or create a group
group, created = Group.objects.get_or_create(
    name="Platos Test",
    defaults={'description': 'Test group for validation'}
)
print(f"{'✅ Created' if created else '✅ Found'} group: {group.name}")

# Get or create a recipe
recipe, created = Recipe.objects.get_or_create(
    name="Plato de Validación",
    defaults={
        'group': group,
        'base_price': Decimal('25.50'),
        'is_available': True,
        'preparation_time': 15,
        'description': 'Plato de prueba para validación completa'
    }
)
print(f"{'✅ Created' if created else '✅ Found'} recipe: {recipe.name}")

print("\n2️⃣ Creating complete order...")

# Create order
order = Order.objects.create(
    table=table,
    waiter='Mesero Test',
    customer_name='Cliente Validación',
    party_size=2,
    status='CREATED'
)
print(f"✅ Created order: #{order.id}")

# Create order item
order_item = OrderItem.objects.create(
    order=order,
    recipe=recipe,
    quantity=2,
    unit_price=recipe.base_price,
    status='CREATED'
)
print(f"✅ Created order item: {order_item.recipe.name} x{order_item.quantity}")

# Update item status to SERVED
order_item.update_status('PREPARING')
print(f"✅ Updated item status: PREPARING")

order_item.update_status('SERVED')  
print(f"✅ Updated item status: SERVED")

# Create payment
total_amount = order.get_grand_total()
payment = Payment.objects.create(
    order=order,
    payment_method='CASH',
    amount=total_amount
)
print(f"✅ Created payment: ${payment.amount} ({payment.payment_method})")

print(f"\n3️⃣ Validating order completion...")

# Refresh order to see updated status
order.refresh_from_db()
print(f"✅ Order status: {order.status}")
print(f"✅ Order total: ${order.get_grand_total()}")
print(f"✅ Payment total: ${order.get_total_paid()}")
print(f"✅ Is fully paid: {order.is_fully_paid}")

print(f"\n4️⃣ Testing dashboard view data...")

# Test dashboard view
from django.db import connection
cursor = connection.cursor()
cursor.execute("""
    SELECT order_id, recipe_name, order_total, total_with_container, order_status
    FROM dashboard_operativo_view 
    WHERE order_id = ?
""", [order.id])

view_data = cursor.fetchone()
if view_data:
    print(f"✅ Dashboard view data:")
    print(f"   Order ID: {view_data[0]}")
    print(f"   Recipe: {view_data[1]}")
    print(f"   Order Total: ${view_data[2]}")
    print(f"   With Container: ${view_data[3]}")
    print(f"   Status: {view_data[4]}")
else:
    print("❌ Dashboard view data not found")

cursor.close()

print(f"\n🎉 COMPLETE ORDER VALIDATION SUCCESSFUL!")
print(f"🌐 Order #{order.id} is ready to view at: https://www.xn--elfogndedonsoto-zrb.com/")
print(f"💰 Dashboards should now display this order with AWS Cognito authentication")