from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction, connection
from config.models import Unit, Zone, Table
from inventory.models import Group, Ingredient, Recipe, RecipeItem
from operation.models import Order, OrderItem, Payment


class Command(BaseCommand):
    help = 'Clean all data from database and reset auto-increment counters'

    def add_arguments(self, parser):
        parser.add_argument(
            '--keep-superuser',
            action='store_true',
            help='Keep superuser accounts when cleaning',
        )
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Skip confirmation prompt - USE WITH CAUTION',
        )

    def handle(self, *args, **options):
        if not options['confirm']:
            self.stdout.write(
                self.style.WARNING('⚠️  This will DELETE ALL DATA from the database!')
            )
            self.stdout.write('This action cannot be undone.')
            
            confirm = input('\nType "YES" to confirm deletion: ')
            if confirm != 'YES':
                self.stdout.write(self.style.ERROR('❌ Operation cancelled'))
                return

        self.clean_database(keep_superuser=options['keep_superuser'])

    @transaction.atomic
    def clean_database(self, keep_superuser=False):
        self.stdout.write(self.style.WARNING('🧹 Starting database cleanup...'))
        
        # Track deletion counts
        deletion_counts = {}
        
        # Clean in reverse dependency order to avoid foreign key constraints
        models_to_clean = [
            ('Payments', Payment),
            ('Order Items', OrderItem), 
            ('Orders', Order),
            ('Recipe Items', RecipeItem),
            ('Recipes', Recipe),
            ('Ingredients', Ingredient),
            ('Groups', Group),
            ('Tables', Table),
            ('Zones', Zone),
            ('Units', Unit),
        ]
        
        for model_name, model_class in models_to_clean:
            count = model_class.objects.count()
            if count > 0:
                model_class.objects.all().delete()
                deletion_counts[model_name] = count
                self.stdout.write(f'  ✅ Deleted {count} {model_name}')
        
        # Handle users separately
        if keep_superuser:
            user_count = User.objects.filter(is_superuser=False).count()
            if user_count > 0:
                User.objects.filter(is_superuser=False).delete()
                deletion_counts['Regular Users'] = user_count
                self.stdout.write(f'  ✅ Deleted {user_count} Regular Users (kept superusers)')
        else:
            user_count = User.objects.count()
            if user_count > 0:
                User.objects.all().delete()
                deletion_counts['All Users'] = user_count
                self.stdout.write(f'  ✅ Deleted {user_count} All Users')
        
        # Reset auto-increment counters for SQLite
        self.reset_sqlite_sequences()
        
        self.stdout.write(self.style.SUCCESS('\n🎉 Database cleanup completed successfully!'))
        
        if deletion_counts:
            self.stdout.write(self.style.SUCCESS('\n📊 Deletion Summary:'))
            for model_name, count in deletion_counts.items():
                self.stdout.write(f'  • {model_name}: {count}')
        else:
            self.stdout.write(self.style.SUCCESS('\n✨ Database was already clean!'))
        
        self.stdout.write(self.style.SUCCESS('\n🔄 Auto-increment counters have been reset'))
        self.stdout.write(self.style.SUCCESS('🚀 Database is ready for fresh data'))

    def reset_sqlite_sequences(self):
        """Reset SQLite auto-increment sequences"""
        try:
            with connection.cursor() as cursor:
                # Get all tables that have auto-increment columns
                cursor.execute("""
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name NOT LIKE 'sqlite_%'
                """)
                
                tables = [row[0] for row in cursor.fetchall()]
                
                # Reset sequence for each table
                for table in tables:
                    cursor.execute(f"DELETE FROM sqlite_sequence WHERE name='{table}'")
                
                self.stdout.write('  ✅ SQLite sequences reset')
                
        except Exception as e:
            self.stdout.write(
                self.style.WARNING(f'  ⚠️  Could not reset sequences: {str(e)}')
            )
            self.stdout.write('  (This is normal if using a different database)')