#!/usr/bin/env python3
"""
Test script para verificar el nuevo formato de tickets
"""
import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from operation.models import Order, OrderItem, PrintQueue
from inventory.models import Recipe
from config.models import Table

def test_ticket_format():
    """Test the new ticket format generation"""
    
    print("🎫 Testing new ticket format...")
    
    # Find an existing order item or create test data
    try:
        order_item = OrderItem.objects.select_related('order', 'recipe', 'order__table').first()
        if not order_item:
            print("❌ No OrderItems found in database")
            return
            
        print(f"📋 Testing with OrderItem #{order_item.id}")
        print(f"   • Order: #{order_item.order.id}")
        print(f"   • Recipe: {order_item.recipe.name}")
        print(f"   • Quantity: {order_item.quantity}")
        print(f"   • Table: {order_item.order.table.table_number if order_item.order.table else 'N/A'}")
        print(f"   • Notes: {order_item.notes or 'None'}")
        print(f"   • Takeaway: {order_item.is_takeaway}")
        
        # Generate label content
        content = order_item._generate_label_content()
        
        print("\n" + "="*50)
        print("🎫 GENERATED TICKET CONTENT:")
        print("="*50)
        
        # Display content with visible control characters
        display_content = content
        display_content = display_content.replace('\x1B\x61\x01', '[CENTER_ON]')
        display_content = display_content.replace('\x1B\x61\x00', '[LEFT_ALIGN]')
        display_content = display_content.replace('\x1B\x45\x01', '[BOLD_ON]')
        display_content = display_content.replace('\x1B\x45\x00', '[BOLD_OFF]')
        display_content = display_content.replace('\x1D\x56\x00', '[CUT]')
        
        print(display_content)
        print("="*50)
        
        # Save raw content for testing
        with open('test_ticket_raw.txt', 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"✅ Raw ticket content saved to 'test_ticket_raw.txt'")
        print(f"📏 Content length: {len(content)} characters")
        
        # Test with RPI4 printer if configured
        test_rpi4_print(content)
        
    except Exception as e:
        print(f"❌ Error testing ticket format: {e}")
        import traceback
        traceback.print_exc()

def test_rpi4_print(content):
    """Test printing to RPI4 printer"""
    
    print("\n🖨️  Testing RPI4 printer connection...")
    
    try:
        import requests
        
        # Check if RPI4_HTTP_HOST and RPI4_HTTP_PORT environment variables are set
        rpi4_host = os.environ.get('RPI4_HTTP_HOST', 'raspberrypi.local')
        rpi4_port = os.environ.get('RPI4_HTTP_PORT', '3001')
        
        print(f"   • Target: {rpi4_host}:{rpi4_port}")
        
        # Test connection
        url = f"http://{rpi4_host}:{rpi4_port}/health"
        response = requests.get(url, timeout=3)
        
        if response.status_code == 200:
            print("✅ RPI4 printer server is online")
            
            # Send test print
            print_url = f"http://{rpi4_host}:{rpi4_port}/print"
            print_data = {
                'content': content,
                'printer_name': 'default'
            }
            
            print("📤 Sending test print...")
            print_response = requests.post(print_url, json=print_data, timeout=10)
            
            if print_response.status_code == 200:
                print("✅ Test print sent successfully!")
                print(f"   Response: {print_response.json()}")
            else:
                print(f"❌ Print failed: {print_response.status_code}")
                print(f"   Response: {print_response.text}")
        else:
            print(f"❌ RPI4 server not responding: {response.status_code}")
            
    except requests.exceptions.ConnectTimeout:
        print(f"⚠️  RPI4 printer server not reachable at {rpi4_host}:{rpi4_port}")
    except requests.exceptions.RequestException as e:
        print(f"⚠️  Network error: {e}")
    except Exception as e:
        print(f"❌ Error testing RPI4 printer: {e}")

if __name__ == "__main__":
    test_ticket_format()