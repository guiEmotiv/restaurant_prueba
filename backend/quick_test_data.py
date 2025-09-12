#!/usr/bin/env python3
"""
Quick script to create test data for panel lateral testing
"""
import os
import sys
import django

# Configure Django
sys.path.append('/Users/guillermosotozuniga/restaurant-web/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from operation.models import PrinterConfig, PrintQueue, Order, OrderItem
from inventory.models import Recipe
from decimal import Decimal

def create_test_data():
    """Create simple test data for panel lateral"""
    print("🎯 Creating quick test data for panel lateral...")
    
    try:
        # Get Order #1
        order = Order.objects.get(id=1)
        print(f"  ✅ Order: #{order.id} - {order.customer_name}")
        
        # Get existing printer or use first available
        printer = PrinterConfig.objects.first()
        if not printer:
            printer = PrinterConfig.objects.create(
                name='Test Panel Printer',
                usb_port='/dev/unique/test/panel',
                is_active=True,
                baud_rate=9600,
                paper_width_mm=80
            )
            created = True
        else:
            created = False
        print(f"  {'✅ Created' if created else '🔄 Already exists'}: {printer.name}")
        
        # Get first recipe
        recipe = Recipe.objects.first()
        if not recipe:
            print("  ❌ No recipes found")
            return
            
        print(f"  📝 Using recipe: {recipe.name}")
        
        # Clean existing order items and print jobs
        existing_items = order.orderitem_set.all()
        PrintQueue.objects.filter(order_item__in=existing_items).delete()
        existing_items.delete()
        print("  🗑️  Previous items deleted")
        
        # Create 4 simple OrderItems with different print states
        states = ['pending', 'in_progress', 'printed', 'failed']
        
        for i, state in enumerate(states):
            # Create OrderItem with correct field names
            item = OrderItem.objects.create(
                order=order,
                recipe=recipe,
                quantity=1,
                status='CREATED',
                unit_price=Decimal('15.00'),
                total_price=Decimal('15.00')
            )
            
            # Create print job
            print_job = PrintQueue.objects.create(
                printer=printer,
                order_item=item,
                status=state,
                attempts=1 if state != 'failed' else 3,
                error_message=f'Test error for panel - Item {i+1}' if state == 'failed' else None
            )
            
            print(f"    ✅ Item {i+1}: {recipe.name} -> {state}")
        
        # Update order total
        order.total = Decimal('60.00')  # 4 items x 15.00
        order.save()
        
        print(f"\n✅ Test data created successfully!")
        print(f"   • Order #1 with 4 OrderItems")
        print(f"   • 4 different print states")
        print(f"\n🎯 To test:")
        print(f"   1. Go to → http://localhost:5173")
        print(f"   2. Navigate to → Order Management")
        print(f"   3. Find → Order #1: {order.customer_name}")
        print(f"   4. Open the lateral panel")
        print(f"   5. Check the print status indicators")
        
    except Order.DoesNotExist:
        print("  ❌ Order #1 does not exist")
    except Exception as e:
        print(f"  ❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    create_test_data()