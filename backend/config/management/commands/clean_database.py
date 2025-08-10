from django.core.management.base import BaseCommand
from django.db import transaction
from config.models import Unit, Zone, Table, Container
from inventory.models import Group, Ingredient, Recipe, RecipeItem
from operation.models import Order, OrderItem, OrderItemIngredient, Payment

class Command(BaseCommand):
    help = 'Clean all data from database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirm deletion of all data',
        )

    def handle(self, *args, **options):
        if not options['confirm']:
            self.stdout.write(
                self.style.WARNING(
                    "⚠️ This will DELETE ALL DATA from the database!\n"
                    "Use --confirm to proceed."
                )
            )
            return
            
        self.stdout.write("🗑️ Cleaning database...")
        
        # Check current counts
        self.stdout.write("Current data counts:")
        models_to_clean = [
            ('OrderItemIngredient', OrderItemIngredient),
            ('OrderItem', OrderItem),
            ('Order', Order),
            ('Payment', Payment),
            ('RecipeItem', RecipeItem),
            ('Recipe', Recipe),
            ('Ingredient', Ingredient),
            ('Group', Group),
            ('Table', Table),
            ('Zone', Zone),
            ('Container', Container),
            ('Unit', Unit),
        ]
        
        for name, model in models_to_clean:
            count = model.objects.count()
            self.stdout.write(f"  {name}: {count}")
        
        # Delete in dependency order
        with transaction.atomic():
            for name, model in models_to_clean:
                count_before = model.objects.count()
                model.objects.all().delete()
                self.stdout.write(f"🗑️ Deleted {count_before} {name} records")
        
        self.stdout.write(
            self.style.SUCCESS("✅ Database cleaned successfully!")
        )