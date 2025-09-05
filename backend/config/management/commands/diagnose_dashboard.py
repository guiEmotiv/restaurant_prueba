from django.core.management.base import BaseCommand
from django.db import connection
from operation.models import Order, OrderItem
from inventory.models import Recipe, Group
from config.models import Table


class Command(BaseCommand):
    help = 'Diagnose dashboard issues in production'

    def handle(self, *args, **options):
        self.stdout.write("🔍 DASHBOARD DIAGNOSTIC REPORT")
        self.stdout.write("=" * 50)
        
        # Check database connection
        try:
            cursor = connection.cursor()
            self.stdout.write("✅ Database connection: OK")
        except Exception as e:
            self.stdout.write(f"❌ Database connection failed: {e}")
            return
        
        # Check if dashboard_operativo_view exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='view' AND name='dashboard_operativo_view'")
        view_exists = cursor.fetchone()
        
        if view_exists:
            self.stdout.write("✅ dashboard_operativo_view: EXISTS")
            
            try:
                cursor.execute("SELECT COUNT(*) FROM dashboard_operativo_view")
                view_count = cursor.fetchone()[0]
                self.stdout.write(f"📊 View record count: {view_count}")
                
                if view_count > 0:
                    cursor.execute("SELECT * FROM dashboard_operativo_view LIMIT 1")
                    sample = cursor.fetchone()
                    self.stdout.write(f"📋 Sample data columns: {len(sample) if sample else 0}")
                    
            except Exception as e:
                self.stdout.write(f"❌ View query error: {e}")
        else:
            self.stdout.write("❌ dashboard_operativo_view: NOT FOUND")
        
        # Check main tables
        tables_to_check = [
            ('order', Order),
            ('recipe', Recipe), 
            ('group', Group),
            ('table', Table)
        ]
        
        self.stdout.write("\n📋 TABLE STATUS:")
        for table_name, model_class in tables_to_check:
            try:
                count = model_class.objects.count()
                self.stdout.write(f"✅ {table_name}: {count} records")
                
                if count > 0 and table_name == 'order':
                    paid_orders = Order.objects.filter(status='PAID').count()
                    self.stdout.write(f"   💰 PAID orders: {paid_orders}")
                    
            except Exception as e:
                self.stdout.write(f"❌ {table_name}: Error - {e}")
        
        # Check migrations
        self.stdout.write("\n🔧 MIGRATION STATUS:")
        try:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='django_migrations'")
            if cursor.fetchone():
                cursor.execute("SELECT app, name FROM django_migrations WHERE app='operation' ORDER BY id DESC LIMIT 5")
                migrations = cursor.fetchall()
                self.stdout.write("📦 Last 5 operation migrations:")
                for app, name in migrations:
                    self.stdout.write(f"   - {name}")
            else:
                self.stdout.write("❌ django_migrations table not found")
                
        except Exception as e:
            self.stdout.write(f"❌ Migration check error: {e}")
        
        # Test view creation manually
        self.stdout.write("\n🛠️  MANUAL VIEW TEST:")
        try:
            # Try to create the view manually
            cursor.execute("DROP VIEW IF EXISTS test_dashboard_view")
            cursor.execute("""
                CREATE VIEW test_dashboard_view AS
                SELECT DISTINCT
                    o.id as order_id,
                    o.total as order_total,
                    o.status as order_status,
                    DATE(o.created_at) as operational_date
                FROM "order" o
                LIMIT 10
            """)
            
            cursor.execute("SELECT COUNT(*) FROM test_dashboard_view")
            test_count = cursor.fetchone()[0]
            self.stdout.write(f"✅ Manual view test: {test_count} records")
            
            cursor.execute("DROP VIEW IF EXISTS test_dashboard_view")
            
        except Exception as e:
            self.stdout.write(f"❌ Manual view test failed: {e}")
        
        cursor.close()
        self.stdout.write("\n🏁 Diagnostic complete!")