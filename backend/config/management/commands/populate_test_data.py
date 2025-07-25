from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction
from config.models import Unit, Zone, Table
from inventory.models import Group, Ingredient, Recipe, RecipeItem
from operation.models import Order, OrderItem, Payment


class Command(BaseCommand):
    help = 'Clean and populate database with comprehensive test data for restaurant management'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clean-only',
            action='store_true',
            help='Only clean existing data without populating new data',
        )
        parser.add_argument(
            '--no-clean',
            action='store_true',
            help='Skip cleaning and only add new data',
        )

    def handle(self, *args, **options):
        if not options['no_clean']:
            self.clean_data()
        
        if not options['clean_only']:
            self.populate_data()

    @transaction.atomic
    def clean_data(self):
        self.stdout.write(self.style.WARNING('🧹 Cleaning existing data...'))
        
        # Clean in reverse dependency order to avoid foreign key constraints
        OrderItem.objects.all().delete()
        Order.objects.all().delete()
        Payment.objects.all().delete()
        RecipeItem.objects.all().delete()
        Recipe.objects.all().delete()
        Ingredient.objects.all().delete()
        Group.objects.all().delete()
        Table.objects.all().delete()
        Zone.objects.all().delete()
        Unit.objects.all().delete()
        
        # Keep superuser but clean other users
        User.objects.filter(is_superuser=False).delete()
        
        self.stdout.write(self.style.SUCCESS('✅ Data cleaned successfully!'))

    @transaction.atomic
    def populate_data(self):
        self.stdout.write(self.style.SUCCESS('🌱 Populating fresh test data...'))
        
        # Create superuser if it doesn't exist
        if not User.objects.filter(username='admin').exists():
            User.objects.create_superuser('admin', 'admin@restaurante.com', 'admin123')
            self.stdout.write(self.style.SUCCESS('👤 Created superuser: admin/admin123'))
        
        
        # Create units
        self.stdout.write('⚖️ Creating units...')
        units_data = [
            'kg', 'g', 'litros', 'ml', 'unidades', 'tazas', 'cucharadas', 'cucharaditas', 'porciones'
        ]
        
        created_units = {}
        for name in units_data:
            unit, _ = Unit.objects.get_or_create(name=name)
            created_units[name] = unit
        
        # Create zones
        self.stdout.write('🏢 Creating zones...')
        zones_data = [
            'Salón Principal',
            'Terraza', 
            'Área VIP',
            'Bar',
            'Zona Familiar'
        ]
        
        created_zones = {}
        for name in zones_data:
            zone, _ = Zone.objects.get_or_create(name=name)
            created_zones[name] = zone
        
        # Create tables
        self.stdout.write('🪑 Creating tables...')
        tables_config = [
            ('Salón Principal', range(1, 13)),  # Tables 1-12
            ('Terraza', range(13, 19)),         # Tables 13-18
            ('Área VIP', range(19, 23)),        # Tables 19-22
            ('Bar', range(23, 27)),             # Tables 23-26
            ('Zona Familiar', range(27, 31)),   # Tables 27-30
        ]
        
        for zone_name, table_range in tables_config:
            zone = created_zones[zone_name]
            for table_num in table_range:
                Table.objects.get_or_create(
                    table_number=str(table_num),
                    zone=zone
                )
        
        # Create groups
        self.stdout.write('🍽️ Creating recipe groups...')
        groups_data = [
            'Entradas',
            'Sopas y Cremas', 
            'Ensaladas',
            'Platos Principales',
            'Carnes a la Parrilla',
            'Pescados y Mariscos',
            'Pasta y Risottos',
            'Postres',
            'Bebidas Calientes',
            'Bebidas Frías',
            'Jugos Naturales',
            'Cócteles'
        ]
        
        created_groups = {}
        for name in groups_data:
            group, _ = Group.objects.get_or_create(name=name)
            created_groups[name] = group
        
        # Create ingredients
        self.stdout.write('🥕 Creating ingredients...')
        ingredients_data = [
            # Carnes
            ('Lomo de res', 'Carnes', 'kg', 35.00, 8.5),
            ('Pechuga de pollo', 'Aves', 'kg', 18.00, 12.0),
            ('Muslos de pollo', 'Aves', 'kg', 12.00, 15.0),
            ('Cerdo', 'Carnes', 'kg', 22.00, 6.0),
            ('Pescado corvina', 'Pescados y Mariscos', 'kg', 28.00, 4.5),
            ('Camarones', 'Pescados y Mariscos', 'kg', 45.00, 2.0),
            
            # Verduras
            ('Cebolla roja', 'Verduras', 'kg', 3.50, 25.0),
            ('Tomate', 'Verduras', 'kg', 4.00, 20.0),
            ('Lechuga', 'Verduras', 'unidades', 2.50, 15.0),
            ('Zanahoria', 'Verduras', 'kg', 2.80, 18.0),
            ('Papa amarilla', 'Verduras', 'kg', 3.20, 30.0),
            ('Ají amarillo', 'Verduras', 'kg', 8.00, 3.0),
            ('Rocoto', 'Verduras', 'kg', 6.50, 2.5),
            ('Apio', 'Verduras', 'kg', 4.50, 8.0),
            ('Brócoli', 'Verduras', 'kg', 5.00, 6.0),
            
            # Granos y cereales
            ('Arroz', 'Granos y Cereales', 'kg', 4.50, 50.0),
            ('Quinua', 'Granos y Cereales', 'kg', 12.00, 10.0),
            ('Pasta espagueti', 'Granos y Cereales', 'kg', 6.00, 15.0),
            ('Harina de trigo', 'Granos y Cereales', 'kg', 3.80, 20.0),
            
            # Lácteos
            ('Leche evaporada', 'Lácteos', 'unidades', 4.20, 24.0),
            ('Queso fresco', 'Lácteos', 'kg', 18.00, 5.0),
            ('Mantequilla', 'Lácteos', 'kg', 22.00, 3.0),
            ('Crema de leche', 'Lácteos', 'litros', 12.00, 4.0),
            
            # Condimentos
            ('Sal', 'Condimentos y Especias', 'kg', 2.00, 10.0),
            ('Pimienta', 'Condimentos y Especias', 'g', 0.08, 500.0),
            ('Comino', 'Condimentos y Especias', 'g', 0.12, 300.0),
            ('Ajo', 'Condimentos y Especias', 'kg', 8.00, 5.0),
            ('Culantro', 'Condimentos y Especias', 'kg', 6.00, 3.0),
            ('Orégano', 'Condimentos y Especias', 'g', 0.15, 200.0),
            
            # Aceites
            ('Aceite vegetal', 'Aceites y Vinagres', 'litros', 8.50, 8.0),
            ('Aceite de oliva', 'Aceites y Vinagres', 'litros', 25.00, 2.0),
            ('Vinagre blanco', 'Aceites y Vinagres', 'litros', 4.00, 4.0),
            
            # Bebidas
            ('Agua mineral', 'Bebidas', 'unidades', 2.50, 48.0),
            ('Coca Cola', 'Bebidas', 'unidades', 3.50, 36.0),
            ('Inca Kola', 'Bebidas', 'unidades', 3.50, 24.0),
            ('Cerveza', 'Bebidas', 'unidades', 5.50, 30.0),
            ('Café molido', 'Bebidas', 'kg', 28.00, 2.0),
            
            # Frutas
            ('Limón', 'Frutas', 'kg', 5.00, 12.0),
            ('Naranja', 'Frutas', 'kg', 4.00, 15.0),
            ('Mango', 'Frutas', 'kg', 6.50, 8.0),
            ('Palta', 'Frutas', 'kg', 8.00, 6.0),
        ]
        
        created_ingredients = {}
        for name, category_name, unit_name, price, stock in ingredients_data:
            ingredient, _ = Ingredient.objects.get_or_create(
                name=name,
                defaults={
                    'unit': created_units[unit_name],
                    'unit_price': price,
                    'current_stock': stock,
                    'is_active': True
                }
            )
            created_ingredients[name] = ingredient
        
        # Create recipes
        self.stdout.write('👨‍🍳 Creating recipes...')
        recipes_data = [
            # Entradas
            ('Palta Rellena', 'Entradas', 15.00, 8, [
                ('Palta', 0.5), ('Pechuga de pollo', 0.1), ('Sal', 1.0)
            ]),
            ('Causa Limeña', 'Entradas', 22.00, 20, [
                ('Papa amarilla', 0.4), ('Limón', 0.05), ('Ají amarillo', 0.02), ('Pechuga de pollo', 0.15)
            ]),
            
            # Sopas
            ('Sopa Criolla', 'Sopas y Cremas', 16.00, 25, [
                ('Lomo de res', 0.15), ('Pasta espagueti', 0.1), ('Cebolla roja', 0.08), ('Tomate', 0.1), ('Leche evaporada', 0.1)
            ]),
            ('Chupe de Camarones', 'Sopas y Cremas', 35.00, 30, [
                ('Camarones', 0.2), ('Papa amarilla', 0.3), ('Queso fresco', 0.1), ('Leche evaporada', 0.15)
            ]),
            
            # Ensaladas
            ('Ensalada César', 'Ensaladas', 20.00, 10, [
                ('Lechuga', 0.2), ('Pechuga de pollo', 0.15), ('Queso fresco', 0.05)
            ]),
            ('Ensalada Rusa', 'Ensaladas', 14.00, 15, [
                ('Papa amarilla', 0.25), ('Zanahoria', 0.1)
            ]),
            
            # Platos Principales
            ('Arroz con Pollo', 'Platos Principales', 25.00, 25, [
                ('Arroz', 0.25), ('Pechuga de pollo', 0.2), ('Cebolla roja', 0.08), ('Ají amarillo', 0.02), ('Culantro', 0.01)
            ]),
            ('Lomo Saltado', 'Carnes a la Parrilla', 32.00, 20, [
                ('Lomo de res', 0.25), ('Papa amarilla', 0.2), ('Cebolla roja', 0.1), ('Tomate', 0.1)
            ]),
            ('Ají de Gallina', 'Platos Principales', 28.00, 30, [
                ('Pechuga de pollo', 0.2), ('Ají amarillo', 0.03), ('Leche evaporada', 0.15)
            ]),
            ('Pescado a la Plancha', 'Pescados y Mariscos', 30.00, 15, [
                ('Pescado corvina', 0.25), ('Limón', 0.05), ('Sal', 2.0), ('Aceite de oliva', 0.02)
            ]),
            
            # Pasta
            ('Fetuccine Alfredo', 'Pasta y Risottos', 24.00, 18, [
                ('Pasta espagueti', 0.15), ('Crema de leche', 0.12), ('Queso fresco', 0.08), ('Mantequilla', 0.03)
            ]),
            ('Spaguetti Bolognesa', 'Pasta y Risottos', 26.00, 25, [
                ('Pasta espagueti', 0.15), ('Lomo de res', 0.15), ('Tomate', 0.12), ('Cebolla roja', 0.06), ('Zanahoria', 0.05)
            ]),
            
            # Bebidas
            ('Limonada', 'Bebidas Frías', 6.00, 5, [
                ('Limón', 0.08), ('Agua mineral', 1.0)
            ]),
            ('Café Americano', 'Bebidas Calientes', 5.00, 3, [
                ('Café molido', 0.02), ('Agua mineral', 1.0)
            ]),
            
            # Bebidas simples
            ('Coca Cola 500ml', 'Bebidas Frías', 5.50, 1, [('Coca Cola', 1.0)]),
            ('Inca Kola 500ml', 'Bebidas Frías', 5.50, 1, [('Inca Kola', 1.0)]),
            ('Agua Mineral', 'Bebidas Frías', 4.00, 1, [('Agua mineral', 1.0)]),
            ('Cerveza Pilsen', 'Bebidas Frías', 8.50, 1, [('Cerveza', 1.0)]),
        ]
        
        for recipe_name, group_name, price, prep_time, ingredients_list in recipes_data:
            recipe, created = Recipe.objects.get_or_create(
                name=recipe_name,
                defaults={
                    'group': created_groups[group_name],
                    'base_price': price,
                    'is_available': True,
                    'preparation_time': prep_time,
                }
            )
            
            if created:
                # Create recipe items
                for ingredient_name, quantity in ingredients_list:
                    if ingredient_name in created_ingredients:
                        RecipeItem.objects.create(
                            recipe=recipe,
                            ingredient=created_ingredients[ingredient_name],
                            quantity=quantity
                        )
        
        self.stdout.write(self.style.SUCCESS('🎉 Successfully populated comprehensive test data!'))
        
        # Print detailed summary
        self.stdout.write(self.style.SUCCESS('\n📊 Database Summary:'))
        self.stdout.write(f'👤 Users: {User.objects.count()}')
        self.stdout.write(f'📂 Categories: {Category.objects.count()}')
        self.stdout.write(f'⚖️  Units: {Unit.objects.count()}')  
        self.stdout.write(f'🏢 Zones: {Zone.objects.count()}')
        self.stdout.write(f'🪑 Tables: {Table.objects.count()}')
        self.stdout.write(f'🍽️  Groups: {Group.objects.count()}')
        self.stdout.write(f'🥕 Ingredients: {Ingredient.objects.count()}')
        self.stdout.write(f'👨‍🍳 Recipes: {Recipe.objects.count()}')
        self.stdout.write(f'🥘 Recipe Items: {RecipeItem.objects.count()}')
        
        self.stdout.write(self.style.SUCCESS('\n✨ Ready to test the restaurant management system!'))
        self.stdout.write('🔐 Login with: admin / admin123')