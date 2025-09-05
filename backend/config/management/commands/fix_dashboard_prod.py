from django.core.management.base import BaseCommand
from django.db import connection
from django.core.management import call_command


class Command(BaseCommand):
    help = 'Fix dashboard issues in production'

    def handle(self, *args, **options):
        self.stdout.write("🔧 FIXING DASHBOARD IN PRODUCTION")
        self.stdout.write("=" * 50)
        
        # Step 1: Run migrations
        self.stdout.write("1️⃣ Running migrations...")
        try:
            call_command('migrate', verbosity=1)
            self.stdout.write("✅ Migrations completed")
        except Exception as e:
            self.stdout.write(f"❌ Migration failed: {e}")
        
        # Step 2: Check and fix dashboard_operativo_view
        self.stdout.write("\n2️⃣ Fixing dashboard_operativo_view...")
        
        cursor = connection.cursor()
        
        # Drop existing view
        try:
            cursor.execute("DROP VIEW IF EXISTS dashboard_operativo_view")
            self.stdout.write("🗑️ Dropped existing view")
        except Exception as e:
            self.stdout.write(f"⚠️ Drop view warning: {e}")
        
        # Create corrected view
        try:
            cursor.execute("""
                CREATE VIEW dashboard_operativo_view AS
                SELECT DISTINCT
                    o.id as order_id,
                    o.total as order_total,
                    o.status as order_status,
                    CASE 
                        WHEN o.waiter = '' OR o.waiter IS NULL THEN 'Sin Asignar'
                        ELSE o.waiter
                    END as waiter,
                    DATE(o.created_at) as operational_date,
                    oi.id as item_id,
                    oi.quantity,
                    oi.unit_price,
                    oi.total_price,
                    CASE 
                        WHEN oi.is_takeaway = 1 AND r.container_price > 0 
                        THEN oi.total_price + (r.container_price * oi.quantity)
                        ELSE oi.total_price
                    END as total_with_container,
                    oi.status as item_status,
                    oi.is_takeaway,
                    r.name as recipe_name,
                    g.name as category_name,
                    g.id as category_id,
                    p.method as payment_method,
                    p.amount as payment_amount
                FROM "order" o
                LEFT JOIN order_item oi ON o.id = oi.order_id
                LEFT JOIN recipe r ON oi.recipe_id = r.id
                LEFT JOIN "group" g ON r.group_id = g.id
                LEFT JOIN payment p ON o.id = p.order_id
                WHERE (o.status IN ('PAID', 'PENDING', 'IN_PREPARATION', 'COMPLETED') OR o.status IS NULL)
                ORDER BY o.created_at DESC, o.id DESC, oi.id
            """)
            self.stdout.write("✅ Created corrected dashboard_operativo_view")
            
        except Exception as e:
            self.stdout.write(f"❌ View creation failed: {e}")
            return
        
        # Step 3: Test the view
        self.stdout.write("\n3️⃣ Testing the view...")
        try:
            cursor.execute("SELECT COUNT(*) FROM dashboard_operativo_view")
            count = cursor.fetchone()[0]
            self.stdout.write(f"✅ View working: {count} records")
            
            if count > 0:
                cursor.execute("SELECT order_id, recipe_name, total_with_container FROM dashboard_operativo_view LIMIT 3")
                samples = cursor.fetchall()
                self.stdout.write("📋 Sample data:")
                for sample in samples:
                    self.stdout.write(f"   Order {sample[0]}: {sample[1]} - ${sample[2]}")
            else:
                self.stdout.write("⚠️ No data found - you may need to create test orders")
                
        except Exception as e:
            self.stdout.write(f"❌ View test failed: {e}")
        
        # Step 4: Create sample data if empty
        if count == 0:
            self.stdout.write("\n4️⃣ Creating sample data...")
            try:
                from inventory.models import Recipe, Group
                from operation.models import Order, OrderItem
                from django.utils import timezone
                
                # Create group if doesn't exist
                group, created = Group.objects.get_or_create(
                    name="Platos de Prueba",
                    defaults={'description': 'Grupo de prueba para dashboard'}
                )
                self.stdout.write(f"{'✅ Created' if created else '✅ Found'} group: {group.name}")
                
                # Create recipe if doesn't exist
                recipe, created = Recipe.objects.get_or_create(
                    name="Plato de Prueba Dashboard",
                    defaults={
                        'group': group,
                        'base_price': 25.00,
                        'is_available': True,
                        'preparation_time': 15
                    }
                )
                self.stdout.write(f"{'✅ Created' if created else '✅ Found'} recipe: {recipe.name}")
                
                # Create order
                order = Order.objects.create(
                    total=25.00,
                    status='PAID',
                    waiter='Mesero Dashboard'
                )
                self.stdout.write(f"✅ Created order: #{order.id}")
                
                # Create order item
                order_item = OrderItem.objects.create(
                    order=order,
                    recipe=recipe,
                    quantity=1,
                    unit_price=25.00,
                    total_price=25.00,
                    status='PAID'
                )
                self.stdout.write(f"✅ Created order item: {order_item.recipe.name}")
                
                # Test view again
                cursor.execute("SELECT COUNT(*) FROM dashboard_operativo_view")
                new_count = cursor.fetchone()[0]
                self.stdout.write(f"✅ View now has {new_count} records")
                
            except Exception as e:
                self.stdout.write(f"❌ Sample data creation failed: {e}")
        
        cursor.close()
        self.stdout.write("\n🎉 Dashboard fix completed!")
        self.stdout.write("🌐 Try accessing the dashboard at: https://www.xn--elfogndedonsoto-zrb.com/")