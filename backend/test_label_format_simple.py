#!/usr/bin/env python3
"""
Simple test for the new label format
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
from inventory.models import Recipe
from config.models import Table, Zone

def test_label_generation():
    """Test the label generation with minimal data creation"""
    
    print("🎫 Testing new label format generation...")
    
    try:
        # Create a fake OrderItem object for testing
        class FakeZone:
            name = "Principal"
            
        class FakeTable:
            table_number = "P08"
            
        class FakeRecipe:
            name = "Brocheta Pollo"
            
        class FakeOrder:
            id = 2
            table = FakeTable()
            
        class FakeOrderItem:
            quantity = 1
            recipe = FakeRecipe()
            order = FakeOrder()
            notes = "FRFRF (DELIVERY)"
            is_takeaway = True
            
            def _generate_label_content(self):
                """Generate the label content using our new method with larger text"""
                from django.utils import timezone
                from datetime import datetime
                
                # ESC/POS commands for restaurant-sized text
                large_text = "\x1B\x21\x30"         # Large text (double width and height)
                medium_text = "\x1B\x21\x20"        # Medium text (double height)
                double_width = "\x1B\x21\x20"       # Double width
                double_height = "\x1B\x21\x10"      # Double height
                normal_text = "\x1B\x21\x00"        # Normal text
                
                # Additional formatting
                bold_on = "\x1B\x45\x01"            # Bold ON
                bold_off = "\x1B\x45\x00"           # Bold OFF
                center_on = "\x1B\x61\x01"          # Center text
                left_align = "\x1B\x61\x00"         # Left align
                
                # Get information - usar fecha de creación simulada consistente
                creation_time = datetime(2025, 9, 12, 5, 57, 2)  # Fecha de creación simulada
                table_number = self.order.table.table_number if self.order.table else 'LL'
                waiter_name = getattr(self.order, 'waiter', 'Fernando') if hasattr(self.order, 'waiter') else 'Fernando'
                
                # Build ticket content with professional sizes
                # Header space for porta comanda - more space
                content = "\n\n"
                
                # Order title - MEDIUM and centered
                content += f"{center_on}{medium_text}{bold_on}PEDIDO {self.order.id}{bold_off}{normal_text}\n\n"
                
                # Table and waiter info - centered
                content += f"{center_on}{medium_text}Principal - MESA {table_number}{normal_text}\n"
                content += f"{center_on}{medium_text}MOZO: {waiter_name}{normal_text}\n\n"
                
                # Date and time - centered (formato consistente)
                content += f"{center_on}{creation_time.strftime('%H:%M:%S')}      {creation_time.strftime('%d/%m/%Y')}\n{left_align}\n"
                
                # Separator line
                content += "================================\n\n"
                
                # Order item - LARGE size for maximum visibility
                content += f"{large_text}{bold_on}X {self.quantity}{bold_off}{normal_text}\n"
                
                # Split recipe name by words if too long (~25 chars per line)
                recipe_name = self.recipe.name.upper()
                max_chars_per_line = 25
                recipe_lines = self._split_text_by_words(recipe_name, max_chars_per_line)
                for line in recipe_lines:
                    content += f"{large_text}{bold_on}{line}{bold_off}{normal_text}\n"
                content += "\n"
                
                # Notes if any - LARGE size with word wrapping
                if self.notes:
                    content += f"{large_text}NOTAS:{normal_text}\n"
                    notes_lines = self._split_text_by_words(self.notes.upper(), max_chars_per_line)
                    for line in notes_lines:
                        content += f"{large_text}{line}{normal_text}\n"
                    content += "\n"
                
                # Additional info (takeaway, container, etc.) - LARGE size
                extras = []
                if self.is_takeaway:
                    # Only add DELIVERY if not already in notes
                    if not (self.notes and "delivery" in self.notes.lower()):
                        extras.append("DELIVERY")
                if hasattr(self, 'container') and self.container:
                    extras.append(f"ENVASE: {self.container.name.upper()}")
                
                if extras:
                    content += f"{large_text}{' | '.join(extras)}{normal_text}\n\n"
                
                # Additional footer space
                content += "\n\n\n"
                content += "\x1D\x56\x00"  # ESC/POS cut command
                
                return content
            
            def _split_text_by_words(self, text, max_chars_per_line):
                """Split text by complete words respecting character limit per line"""
                if not text:
                    return []
                    
                words = text.split()
                lines = []
                current_line = ""
                
                for word in words:
                    # If adding word exceeds limit, save current line and start new one
                    if current_line and len(current_line + " " + word) > max_chars_per_line:
                        lines.append(current_line)
                        current_line = word
                    else:
                        # Add word to current line
                        if current_line:
                            current_line += " " + word
                        else:
                            current_line = word
                
                # Add last line if it has content
                if current_line:
                    lines.append(current_line)
                    
                return lines
        
        # Test the label generation
        fake_item = FakeOrderItem()
        content = fake_item._generate_label_content()
        
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
        
        return True
        
    except Exception as e:
        print(f"❌ Error testing label format: {e}")
        import traceback
        traceback.print_exc()
        return False

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
                'port': '/dev/usb/lp0',  # USB port for the EPSON printer
                'data': {
                    'label_content': content,
                    'job_id': 'test-ticket-format',
                }
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
    success = test_label_generation()
    if success:
        print("\n✅ Label format test completed successfully!")
    else:
        print("\n❌ Label format test failed!")
        sys.exit(1)