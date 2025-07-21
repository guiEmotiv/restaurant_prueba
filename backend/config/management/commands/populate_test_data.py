from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from config.models import Category, Unit, Zone, Table
from inventory.models import Group, Ingredient, Recipe, RecipeItem


class Command(BaseCommand):
    help = 'Populate database with test data for development and debugging'

    def handle(self, *args, **options):
        self.stdout.write('Populating test data...')
        
        # Create superuser
        if not User.objects.filter(username='admin').exists():
            User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
            self.stdout.write(self.style.SUCCESS('Created superuser: admin/admin123'))
        
        # Create categories
        food_category, _ = Category.objects.get_or_create(name='Comida')
        beverage_category, _ = Category.objects.get_or_create(name='Bebida')
        
        # Create units
        kg_unit, _ = Unit.objects.get_or_create(name='Kilogramo', symbol='kg')
        liter_unit, _ = Unit.objects.get_or_create(name='Litro', symbol='L')
        piece_unit, _ = Unit.objects.get_or_create(name='Unidad', symbol='un')
        gram_unit, _ = Unit.objects.get_or_create(name='Gramo', symbol='g')
        
        # Create zones
        main_zone, _ = Zone.objects.get_or_create(name='Zona Principal')
        terrace_zone, _ = Zone.objects.get_or_create(name='Terraza')
        
        # Create tables
        for i in range(1, 6):
            Table.objects.get_or_create(
                table_number=f'Mesa {i}',
                zone=main_zone if i <= 3 else terrace_zone,
                defaults={'capacity': 4}
            )
        
        # Create groups
        main_group, _ = Group.objects.get_or_create(name='Platos Principales')
        appetizer_group, _ = Group.objects.get_or_create(name='Entradas')
        
        # Create ingredients
        ingredients_data = [
            ('Arroz', food_category, kg_unit, 5.00, 10.00),
            ('Pollo', food_category, kg_unit, 15.00, 5.00),
            ('Tomate', food_category, kg_unit, 3.00, 8.00),
            ('Cebolla', food_category, kg_unit, 2.50, 6.00),
            ('Aceite', food_category, liter_unit, 8.00, 2.00),
            ('Sal', food_category, gram_unit, 0.01, 1000.00),
            ('Coca Cola', beverage_category, piece_unit, 3.00, 20.00),
        ]
        
        created_ingredients = {}
        for name, category, unit, price, stock in ingredients_data:
            ingredient, _ = Ingredient.objects.get_or_create(
                name=name,
                defaults={
                    'category': category,
                    'unit': unit,
                    'unit_price': price,
                    'current_stock': stock,
                    'is_active': True
                }
            )
            created_ingredients[name] = ingredient
        
        # Create recipes
        recipes_data = [
            ('Arroz con Pollo', main_group, 18.00, 15, [
                ('Arroz', 0.25),
                ('Pollo', 0.15),
                ('Tomate', 0.05),
                ('Cebolla', 0.03),
                ('Aceite', 0.02),
                ('Sal', 2.00),
            ]),
            ('Ensalada Simple', appetizer_group, 8.00, 5, [
                ('Tomate', 0.10),
                ('Cebolla', 0.05),
                ('Aceite', 0.01),
                ('Sal', 1.00),
            ]),
            ('Coca Cola', None, 3.50, 1, [
                ('Coca Cola', 1.00),
            ]),
        ]
        
        for recipe_name, group, price, prep_time, ingredients in recipes_data:
            recipe, created = Recipe.objects.get_or_create(
                name=recipe_name,
                defaults={
                    'group': group,
                    'base_price': price,
                    'is_available': True,
                    'preparation_time': prep_time,
                }
            )
            
            if created:
                # Create recipe items
                for ingredient_name, quantity in ingredients:
                    ingredient = created_ingredients[ingredient_name]
                    RecipeItem.objects.create(
                        recipe=recipe,
                        ingredient=ingredient,
                        quantity=quantity
                    )
        
        self.stdout.write(self.style.SUCCESS('Successfully populated test data!'))
        
        # Print summary
        self.stdout.write('\nSummary:')
        self.stdout.write(f'- Categories: {Category.objects.count()}')
        self.stdout.write(f'- Units: {Unit.objects.count()}')
        self.stdout.write(f'- Zones: {Zone.objects.count()}')
        self.stdout.write(f'- Tables: {Table.objects.count()}')
        self.stdout.write(f'- Groups: {Group.objects.count()}')
        self.stdout.write(f'- Ingredients: {Ingredient.objects.count()}')
        self.stdout.write(f'- Recipes: {Recipe.objects.count()}')
        self.stdout.write(f'- Recipe Items: {RecipeItem.objects.count()}')