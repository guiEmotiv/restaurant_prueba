from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.db import connection

class Command(BaseCommand):
    help = 'Ensure database is ready with migrations and data'

    def handle(self, *args, **options):
        self.stdout.write("🔧 Ensuring database is ready...")
        
        # Run migrations
        self.stdout.write("📦 Running migrations...")
        call_command('migrate', verbosity=0)
        
        # Check if we need to populate data
        self.stdout.write("🔍 Checking data state...")
        call_command('check_database')
        
        # Clean and populate if needed
        from config.models import Zone, Table
        
        total_records = Zone.objects.count() + Table.objects.count()
        
        if total_records < 10:
            self.stdout.write("🗑️ Cleaning old data...")
            call_command('clean_database', confirm=True)
            
            self.stdout.write("📊 Populating fresh data...")
            call_command('populate_production_data')
        else:
            self.stdout.write("✅ Database already has sufficient data")
            
        self.stdout.write(
            self.style.SUCCESS("✅ Database is ready!")
        )