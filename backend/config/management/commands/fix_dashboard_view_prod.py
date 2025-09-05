from django.core.management.base import BaseCommand
from django.db import connection

class Command(BaseCommand):
    help = 'Fix dashboard_operativo_view with correct column names in production'

    def handle(self, *args, **options):
        self.stdout.write("🔧 FIXING DASHBOARD VIEW WITH CORRECT COLUMNS")
        self.stdout.write("=" * 55)
        
        cursor = connection.cursor()
        
        # Step 1: Drop existing view
        self.stdout.write("1️⃣ Dropping existing view...")
        try:
            cursor.execute("DROP VIEW IF EXISTS dashboard_operativo_view")
            self.stdout.write("✅ Dropped existing view")
        except Exception as e:
            self.stdout.write(f"⚠️ Drop view warning: {e}")
        
        # Step 2: Create corrected view with proper column names
        self.stdout.write("\n2️⃣ Creating corrected view with proper columns...")
        try:
            cursor.execute("""
                CREATE VIEW dashboard_operativo_view AS
                SELECT DISTINCT
                    o.id as order_id,
                    o.total_amount as order_total,
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
                        WHEN oi.is_takeaway = 1 AND oi.container_price > 0 
                        THEN oi.total_price + (oi.container_price * oi.quantity)
                        ELSE oi.total_price
                    END as total_with_container,
                    oi.status as item_status,
                    oi.is_takeaway,
                    r.name as recipe_name,
                    g.name as category_name,
                    g.id as category_id,
                    p.payment_method as payment_method,
                    p.amount as payment_amount
                FROM "order" o
                LEFT JOIN order_item oi ON o.id = oi.order_id
                LEFT JOIN recipe r ON oi.recipe_id = r.id
                LEFT JOIN "group" g ON r.group_id = g.id
                LEFT JOIN payment p ON o.id = p.order_id
                WHERE (o.status IN ('PAID', 'PREPARING', 'SERVED', 'CREATED') OR o.status IS NULL)
                ORDER BY o.created_at DESC, o.id DESC, oi.id
            """)
            self.stdout.write("✅ Created corrected dashboard_operativo_view with proper columns")
            
        except Exception as e:
            self.stdout.write(f"❌ View creation failed: {e}")
            return
        
        # Step 3: Test the corrected view
        self.stdout.write("\n3️⃣ Testing the corrected view...")
        try:
            cursor.execute("SELECT COUNT(*) FROM dashboard_operativo_view")
            count = cursor.fetchone()[0]
            self.stdout.write(f"✅ View working: {count} records")
            
            if count > 0:
                cursor.execute("SELECT order_id, recipe_name, order_total, total_with_container FROM dashboard_operativo_view LIMIT 3")
                samples = cursor.fetchall()
                self.stdout.write("📋 Sample data:")
                for sample in samples:
                    self.stdout.write(f"   Order {sample[0]}: {sample[1]} - Order Total: ${sample[2]}, With Container: ${sample[3]}")
            else:
                self.stdout.write("⚠️ No data found - check if orders exist in database")
                
        except Exception as e:
            self.stdout.write(f"❌ View test failed: {e}")
        
        # Step 4: Test specific queries that dashboard uses
        self.stdout.write("\n4️⃣ Testing dashboard-specific queries...")
        try:
            # Test operational dashboard query
            cursor.execute("""
                SELECT order_id, recipe_name, quantity, total_with_container, order_status
                FROM dashboard_operativo_view 
                WHERE operational_date = DATE('now', 'localtime')
                LIMIT 5
            """)
            today_orders = cursor.fetchall()
            self.stdout.write(f"✅ Today's orders: {len(today_orders)}")
            
            # Test financial dashboard query
            cursor.execute("""
                SELECT operational_date, 
                       SUM(total_with_container) as daily_total,
                       COUNT(DISTINCT order_id) as order_count
                FROM dashboard_operativo_view 
                WHERE order_status = 'PAID'
                GROUP BY operational_date
                ORDER BY operational_date DESC
                LIMIT 3
            """)
            financial_data = cursor.fetchall()
            self.stdout.write(f"✅ Financial data samples: {len(financial_data)}")
            for data in financial_data:
                self.stdout.write(f"   {data[0]}: ${data[1]} ({data[2]} orders)")
                
        except Exception as e:
            self.stdout.write(f"❌ Dashboard query test failed: {e}")
        
        cursor.close()
        self.stdout.write("\n🎉 Dashboard view fix completed!")
        self.stdout.write("🌐 Dashboard should now work at: https://www.xn--elfogndedonsoto-zrb.com/")