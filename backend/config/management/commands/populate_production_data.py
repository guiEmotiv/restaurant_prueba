from django.core.management.base import BaseCommand
from django.db import transaction
from config.models import Unit, Zone, Table, Container
from inventory.models import Group, Ingredient, Recipe, RecipeItem
from operation.models import Order, OrderItem

class Command(BaseCommand):
    help = 'Populate production database with real restaurant data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force creation even if data exists',
        )

    def handle(self, *args, **options):
        force = options['force']
        
        self.stdout.write("🔍 Checking current database state...")
        
        # Check current counts
        units_count = Unit.objects.count()
        zones_count = Zone.objects.count() 
        tables_count = Table.objects.count()
        groups_count = Group.objects.count()
        ingredients_count = Ingredient.objects.count()
        recipes_count = Recipe.objects.count()
        orders_count = Order.objects.count()
        
        self.stdout.write(f"Current data counts:")
        self.stdout.write(f"  Units: {units_count}")
        self.stdout.write(f"  Zones: {zones_count}")
        self.stdout.write(f"  Tables: {tables_count}")
        self.stdout.write(f"  Groups: {groups_count}")
        self.stdout.write(f"  Ingredients: {ingredients_count}")
        self.stdout.write(f"  Recipes: {recipes_count}")
        self.stdout.write(f"  Orders: {orders_count}")
        
        if not force and (units_count > 0 or zones_count > 0):
            self.stdout.write(
                self.style.WARNING(
                    "Database already has data. Use --force to recreate."
                )
            )
            return
            
        with transaction.atomic():
            if force:
                self.stdout.write("🗑️ Clearing existing data...")
                # Clear in dependency order
                OrderItem.objects.all().delete()
                Order.objects.all().delete()
                RecipeItem.objects.all().delete()
                Recipe.objects.all().delete()
                Ingredient.objects.all().delete()
                Group.objects.all().delete()
                Table.objects.all().delete()
                Zone.objects.all().delete()
                Container.objects.all().delete()
                Unit.objects.all().delete()
            
            self.stdout.write("📦 Creating units...")
            units = [
                Unit.objects.create(name="Kilogramo"),
                Unit.objects.create(name="Litro"),
                Unit.objects.create(name="Unidad"),
                Unit.objects.create(name="Gramo"),
                Unit.objects.create(name="Mililitro"),
                Unit.objects.create(name="Cucharada"),
                Unit.objects.create(name="Taza"),
            ]
            self.stdout.write(f"✅ Created {len(units)} units")
            
            self.stdout.write("🏢 Creating zones...")
            zones = [
                Zone.objects.create(name="Salón Principal"),
                Zone.objects.create(name="Terraza"),
                Zone.objects.create(name="Barra"),
                Zone.objects.create(name="VIP"),
            ]
            self.stdout.write(f"✅ Created {len(zones)} zones")
            
            self.stdout.write("🪑 Creating tables...")
            tables = []
            # Salón Principal (20 mesas)
            for i in range(1, 21):
                table = Table.objects.create(
                    table_number=f"J{i:02d}",
                    zone=zones[0]
                )
                tables.append(table)
            
            # Terraza (10 mesas)
            for i in range(1, 11):
                table = Table.objects.create(
                    table_number=f"T{i:02d}",
                    zone=zones[1]
                )
                tables.append(table)
            
            # Barra (8 mesas)
            for i in range(1, 9):
                table = Table.objects.create(
                    table_number=f"B{i:02d}",
                    zone=zones[2]
                )
                tables.append(table)
            
            # VIP (5 mesas)
            for i in range(1, 6):
                table = Table.objects.create(
                    table_number=f"V{i:02d}",
                    zone=zones[3]
                )
                tables.append(table)
            
            self.stdout.write(f"✅ Created {len(tables)} tables")
            
            self.stdout.write("📦 Creating containers...")
            containers = [
                Container.objects.create(
                    name="Envase Pequeño",
                    price=1.50,
                    description="Para porciones individuales"
                ),
                Container.objects.create(
                    name="Envase Mediano", 
                    price=2.00,
                    description="Para porciones familiares"
                ),
                Container.objects.create(
                    name="Envase Grande",
                    price=2.50,
                    description="Para porciones grandes"
                ),
            ]
            self.stdout.write(f"✅ Created {len(containers)} containers")
            
            self.stdout.write("🏷️ Creating ingredient groups...")
            groups = [
                Group.objects.create(name="Carnes"),
                Group.objects.create(name="Aves"),
                Group.objects.create(name="Mariscos"),
                Group.objects.create(name="Verduras"),
                Group.objects.create(name="Condimentos"),
                Group.objects.create(name="Lácteos"),
                Group.objects.create(name="Granos"),
                Group.objects.create(name="Bebidas"),
                Group.objects.create(name="Postres"),
                Group.objects.create(name="Entradas"),
                Group.objects.create(name="Platos Principales"),
                Group.objects.create(name="Acompañamientos"),
            ]
            self.stdout.write(f"✅ Created {len(groups)} groups")
            
            self.stdout.write("🥕 Creating ingredients...")
            # Get units by abbreviation for easier reference
            kg = units[0]  # kg
            lt = units[1]  # lt
            un = units[2]  # un
            g = units[3]   # g
            ml = units[4]  # ml
            
            ingredients_data = [
                # Carnes
                ("Carne de res", kg, groups[0], 25.00, 10.0),
                ("Carne de cerdo", kg, groups[0], 22.00, 8.0),
                ("Cordero", kg, groups[0], 35.00, 5.0),
                
                # Aves
                ("Pollo entero", kg, groups[1], 12.00, 15.0),
                ("Pechuga de pollo", kg, groups[1], 18.00, 12.0),
                ("Muslos de pollo", kg, groups[1], 10.00, 10.0),
                
                # Mariscos
                ("Salmón", kg, groups[2], 45.00, 8.0),
                ("Camarones", kg, groups[2], 40.00, 6.0),
                ("Pescado corvina", kg, groups[2], 25.00, 12.0),
                
                # Verduras
                ("Cebolla", kg, groups[3], 3.00, 25.0),
                ("Tomate", kg, groups[3], 4.00, 20.0),
                ("Ajo", kg, groups[3], 15.00, 5.0),
                ("Pimentón", kg, groups[3], 6.00, 8.0),
                ("Zanahoria", kg, groups[3], 2.50, 15.0),
                
                # Condimentos
                ("Sal", kg, groups[4], 1.50, 10.0),
                ("Pimienta negra", g, groups[4], 0.08, 500.0),
                ("Comino", g, groups[4], 0.12, 300.0),
                ("Orégano", g, groups[4], 0.10, 200.0),
                
                # Lácteos
                ("Queso fresco", kg, groups[5], 18.00, 5.0),
                ("Leche", lt, groups[5], 4.50, 20.0),
                ("Mantequilla", kg, groups[5], 12.00, 3.0),
                
                # Granos
                ("Arroz", kg, groups[6], 3.50, 50.0),
                ("Quinua", kg, groups[6], 8.00, 20.0),
                ("Frijoles", kg, groups[6], 5.00, 25.0),
            ]
            
            ingredients = []
            for name, unit, category, unit_price, stock in ingredients_data:
                ingredient = Ingredient.objects.create(
                    name=name,
                    unit=unit,
                    unit_price=unit_price,
                    current_stock=stock,
                    is_active=True
                )
                ingredients.append(ingredient)
            
            self.stdout.write(f"✅ Created {len(ingredients)} ingredients")
            
            self.stdout.write("🍽️ Creating recipes...")
            recipes_data = [
                # Platos Principales
                {
                    'name': 'Lomo Saltado',
                    'group': groups[10],  # Platos Principales
                    'price': 28.00,
                    'preparation_time': 25,
                    'ingredients': [
                        (ingredients[0], 0.25),  # Carne de res
                        (ingredients[9], 0.10),   # Cebolla
                        (ingredients[10], 0.05),  # Tomate
                        (ingredients[22], 0.15),  # Arroz
                    ]
                },
                {
                    'name': 'Ají de Gallina',
                    'group': groups[10],
                    'price': 24.00,
                    'preparation_time': 30,
                    'ingredients': [
                        (ingredients[4], 0.20),   # Pechuga de pollo
                        (ingredients[19], 0.10),  # Queso fresco
                        (ingredients[22], 0.15),  # Arroz
                    ]
                },
                {
                    'name': 'Ceviche de Pescado',
                    'group': groups[10],
                    'price': 32.00,
                    'preparation_time': 20,
                    'ingredients': [
                        (ingredients[8], 0.25),   # Pescado corvina
                        (ingredients[9], 0.05),   # Cebolla
                        (ingredients[11], 0.02),  # Ajo
                    ]
                },
                
                # Entradas
                {
                    'name': 'Papa a la Huancaína',
                    'group': groups[9],  # Entradas
                    'price': 15.00,
                    'preparation_time': 15,
                    'ingredients': [
                        (ingredients[19], 0.05),  # Queso fresco
                        (ingredients[20], 0.05),  # Leche
                    ]
                },
                {
                    'name': 'Anticuchos',
                    'group': groups[9],
                    'price': 18.00,
                    'preparation_time': 20,
                    'ingredients': [
                        (ingredients[0], 0.15),   # Carne de res
                        (ingredients[11], 0.01),  # Ajo
                    ]
                },
                
                # Bebidas
                {
                    'name': 'Chicha Morada',
                    'group': groups[7],  # Bebidas
                    'price': 8.00,
                    'preparation_time': 5,
                    'ingredients': []  # Sin ingredientes específicos por simplicidad
                },
                {
                    'name': 'Pisco Sour',
                    'group': groups[7],
                    'price': 18.00,
                    'preparation_time': 5,
                    'ingredients': []
                },
            ]
            
            recipes = []
            for recipe_data in recipes_data:
                recipe = Recipe.objects.create(
                    name=recipe_data['name'],
                    group=recipe_data['group'],
                    base_price=recipe_data['price'],
                    preparation_time=recipe_data['preparation_time'],
                    is_active=True,
                    is_available=True
                )
                
                # Create recipe items
                for ingredient, quantity in recipe_data['ingredients']:
                    RecipeItem.objects.create(
                        recipe=recipe,
                        ingredient=ingredient,
                        quantity=quantity
                    )
                
                recipes.append(recipe)
            
            self.stdout.write(f"✅ Created {len(recipes)} recipes")
        
        # Final count
        self.stdout.write("\n🎉 Production data populated successfully!")
        self.stdout.write("Final counts:")
        self.stdout.write(f"  Units: {Unit.objects.count()}")
        self.stdout.write(f"  Zones: {Zone.objects.count()}")
        self.stdout.write(f"  Tables: {Table.objects.count()}")
        self.stdout.write(f"  Groups: {Group.objects.count()}")
        self.stdout.write(f"  Ingredients: {Ingredient.objects.count()}")
        self.stdout.write(f"  Recipes: {Recipe.objects.count()}")
        self.stdout.write(f"  Containers: {Container.objects.count()}")
        
        self.stdout.write(self.style.SUCCESS("\n✨ Database is ready for production use!"))