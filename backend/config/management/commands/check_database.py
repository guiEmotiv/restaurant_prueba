from django.core.management.base import BaseCommand
from django.db import connection
from django.conf import settings
import os
from config.models import Unit, Zone, Table, Container
from inventory.models import Group, Ingredient, Recipe
from operation.models import Order, OrderItem

class Command(BaseCommand):
    help = 'Check database connection and current data state'

    def handle(self, *args, **options):
        self.stdout.write("🔍 DATABASE DIAGNOSTICS")
        self.stdout.write("=" * 50)
        
        # Database configuration
        self.stdout.write(f"📂 Database Configuration:")
        db_config = settings.DATABASES['default']
        self.stdout.write(f"  Engine: {db_config['ENGINE']}")
        self.stdout.write(f"  Name: {db_config['NAME']}")
        
        # Check if database file exists
        db_path = db_config['NAME']
        if os.path.exists(db_path):
            file_size = os.path.getsize(db_path) / 1024  # KB
            self.stdout.write(f"  File exists: ✅ ({file_size:.1f} KB)")
        else:
            self.stdout.write(f"  File exists: ❌")
            
        # Test connection
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                self.stdout.write(f"  Connection: ✅")
        except Exception as e:
            self.stdout.write(f"  Connection: ❌ {e}")
            return
            
        # Check tables exist
        self.stdout.write(f"\n📋 Database Tables:")
        try:
            tables = connection.introspection.table_names()
            self.stdout.write(f"  Total tables: {len(tables)}")
            
            # Check specific app tables
            config_tables = [t for t in tables if t.startswith('config_')]
            inventory_tables = [t for t in tables if t.startswith('inventory_')]
            operation_tables = [t for t in tables if t.startswith('operation_')]
            
            self.stdout.write(f"  Config tables: {len(config_tables)}")
            self.stdout.write(f"  Inventory tables: {len(inventory_tables)}")
            self.stdout.write(f"  Operation tables: {len(operation_tables)}")
            
        except Exception as e:
            self.stdout.write(f"  Error checking tables: {e}")
            
        # Check data counts
        self.stdout.write(f"\n📊 Data Counts:")
        try:
            models_to_check = [
                ('Units', Unit),
                ('Zones', Zone), 
                ('Tables', Table),
                ('Containers', Container),
                ('Groups', Group),
                ('Ingredients', Ingredient),
                ('Recipes', Recipe),
                ('Orders', Order),
                ('Order Items', OrderItem),
            ]
            
            for name, model in models_to_check:
                try:
                    count = model.objects.count()
                    status = "✅" if count > 0 else "⚠️"
                    self.stdout.write(f"  {name}: {status} {count}")
                except Exception as e:
                    self.stdout.write(f"  {name}: ❌ Error: {e}")
                    
        except Exception as e:
            self.stdout.write(f"Error checking data: {e}")
            
        # Sample data check
        self.stdout.write(f"\n🔍 Sample Data:")
        try:
            # Show first few zones
            zones = Zone.objects.all()[:3]
            for zone in zones:
                tables_count = zone.table_set.count()
                self.stdout.write(f"  Zone '{zone.name}': {tables_count} tables")
                
            # Show first few recipes
            recipes = Recipe.objects.all()[:3]
            for recipe in recipes:
                self.stdout.write(f"  Recipe '{recipe.name}': ${recipe.price}")
                
        except Exception as e:
            self.stdout.write(f"Error checking sample data: {e}")
            
        # Environment info
        self.stdout.write(f"\n🌍 Environment:")
        self.stdout.write(f"  DJANGO_SETTINGS_MODULE: {os.getenv('DJANGO_SETTINGS_MODULE', 'not set')}")
        self.stdout.write(f"  DATABASE_NAME: {os.getenv('DATABASE_NAME', 'not set')}")
        self.stdout.write(f"  DATABASE_PATH: {os.getenv('DATABASE_PATH', 'not set')}")
        
        self.stdout.write(f"\n" + "=" * 50)
        self.stdout.write("🎯 RECOMMENDATIONS:")
        
        total_records = sum([
            Unit.objects.count(),
            Zone.objects.count(), 
            Table.objects.count(),
            Group.objects.count(),
            Recipe.objects.count()
        ])
        
        if total_records == 0:
            self.stdout.write("❌ Database is empty. Run: python manage.py populate_production_data")
        elif total_records < 50:
            self.stdout.write("⚠️ Database has minimal data. Consider running: python manage.py populate_production_data --force")
        else:
            self.stdout.write("✅ Database appears to have sufficient data")
            
        self.stdout.write("📝 To populate with production data: python manage.py populate_production_data --force")