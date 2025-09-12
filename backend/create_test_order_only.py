#!/usr/bin/env python3
"""
Script to create a simple test order for ticket format testing
"""
import os
import sys
import django
from decimal import Decimal

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from operation.models import Order, OrderItem
from inventory.models import Recipe, Group, Ingredient, Unit
from config.models import Table, Zone

def create_test_order():
    """Create a simple test order"""
    
    print("🎯 Creating test order for ticket format testing...")
    
    try:
        # Create basic config data
        zone, _ = Zone.objects.get_or_create(name="Principal")
        
        table, _ = Table.objects.get_or_create(
            table_number="P08",
            defaults={'zone': zone}
        )
        
        # Create ingredient and units
        unit, _ = Unit.objects.get_or_create(name="unidad")
        
        ingredient, _ = Ingredient.objects.get_or_create(
            name="Pollo",
            defaults={
                'unit': unit,
                'cost_per_unit': Decimal('10.00'),
                'stock_quantity': Decimal('100.00'),
                'is_active': True
            }
        )
        
        # Create recipe group
        group, _ = Group.objects.get_or_create(
            name="Brochetas",
            defaults={'display_order': 1, 'is_active': True}
        )
        
        # Create recipe
        recipe, _ = Recipe.objects.get_or_create(
            name="Brocheta Pollo",
            defaults={
                'group': group,
                'base_cost': Decimal('12.00'),
                'base_price': Decimal('18.00'),
                'profit_percentage': Decimal('50.00'),
                'is_active': True,
                'version': 1
            }
        )
        
        # Create order
        order = Order.objects.create(
            table=table,
            customer_name="Fernando",
            party_size=2,
            total_amount=Decimal('18.00'),
            status='CREATED'
        )
        
        # Add waiter field to order if it doesn't exist
        if not hasattr(order, 'waiter'):
            # We'll handle this in the _generate_label_content method
            pass
        
        # Create order item
        order_item = OrderItem.objects.create(
            order=order,
            recipe=recipe,
            quantity=1,
            unit_price=Decimal('18.00'),
            total_price=Decimal('18.00'),
            notes="FRFRF (DELIVERY)",
            is_takeaway=True,
            status='CREATED'
        )
        
        print(f"✅ Test order created successfully!")
        print(f"   • Order #{order.id}")
        print(f"   • Table: {table.table_number}")
        print(f"   • Recipe: {recipe.name}")
        print(f"   • OrderItem: #{order_item.id}")
        
        return order_item
        
    except Exception as e:
        print(f"❌ Error creating test order: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    create_test_order()