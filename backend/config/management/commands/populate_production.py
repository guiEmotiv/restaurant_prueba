from django.core.management.base import BaseCommand
from django.db import transaction
from config.models import Unit, Zone, Table, Container
from inventory.models import Group, Ingredient, Recipe, RecipeItem
from operation.models import Order, OrderItem, Payment, PaymentItem, ContainerSale
from django.utils import timezone
from decimal import Decimal

class Command(BaseCommand):
    help = 'Poblar la base de datos con datos de prueba para producción'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clean',
            action='store_true',
            help='Limpiar la base de datos antes de poblar',
        )

    def handle(self, *args, **options):
        if options['clean']:
            self.stdout.write('🗑️  Limpiando base de datos...')
            self.clean_database()
            self.stdout.write(self.style.SUCCESS('✅ Base de datos limpiada'))

        self.stdout.write('🌱 Poblando base de datos con datos de prueba...')
        
        with transaction.atomic():
            self.create_units()
            self.create_zones()
            self.create_tables()
            self.create_containers()
            self.create_groups()
            self.create_ingredients()
            self.create_recipes()
            self.create_orders()
            
        self.stdout.write(self.style.SUCCESS('✅ Base de datos poblada exitosamente!'))
        self.show_summary()

    def clean_database(self):
        # Limpiar en orden inverso de dependencias
        ContainerSale.objects.all().delete()
        PaymentItem.objects.all().delete()
        Payment.objects.all().delete()
        OrderItem.objects.all().delete()
        Order.objects.all().delete()
        RecipeItem.objects.all().delete()
        Recipe.objects.all().delete()
        Ingredient.objects.all().delete()
        Group.objects.all().delete()
        Container.objects.all().delete()
        Table.objects.all().delete()
        Zone.objects.all().delete()
        Unit.objects.all().delete()

    def create_units(self):
        units = [
            ('kg', 'kilogramos'),
            ('g', 'gramos'),
            ('litros', 'litros'),
            ('ml', 'mililitros'),
            ('unidades', 'unidades'),
            ('porciones', 'porciones'),
            ('cucharadas', 'cucharadas'),
            ('tazas', 'tazas'),
        ]
        for name, _ in units:
            Unit.objects.create(name=name)
        self.stdout.write('✅ Unidades creadas')

    def create_zones(self):
        zones = ['Terraza Principal', 'Salón Interior', 'Área VIP', 'Barra', 'Jardín']
        for name in zones:
            Zone.objects.create(name=name)
        self.stdout.write('✅ Zonas creadas')

    def create_tables(self):
        zone_tables = {
            'Terraza Principal': ['T01', 'T02', 'T03', 'T04', 'T05'],
            'Salón Interior': ['S01', 'S02', 'S03', 'S04'],
            'Área VIP': ['V01', 'V02'],
            'Barra': ['B01', 'B02'],
            'Jardín': ['J01', 'J02'],
        }
        
        for zone_name, tables in zone_tables.items():
            zone = Zone.objects.get(name=zone_name)
            for table_number in tables:
                Table.objects.create(zone=zone, table_number=table_number)
        self.stdout.write('✅ Mesas creadas')

    def create_containers(self):
        containers = [
            ('Bandeja Pequeña', 'Bandeja biodegradable 500ml', 2.50, 100),
            ('Bandeja Grande', 'Bandeja biodegradable 1L', 3.50, 80),
            ('Vaso Térmico', 'Vaso para bebidas calientes 400ml', 1.50, 150),
            ('Botella Plástica', 'Botella para bebidas frías 500ml', 1.00, 200),
        ]
        for name, desc, price, stock in containers:
            Container.objects.create(
                name=name,
                description=desc,
                price=Decimal(str(price)),
                stock=stock,
                is_active=True
            )
        self.stdout.write('✅ Envases creados')

    def create_groups(self):
        groups = ['Carnes', 'Verduras', 'Bebidas', 'Condimentos', 'Lácteos', 'Cereales', 'Postres']
        for name in groups:
            Group.objects.create(name=name)
        self.stdout.write('✅ Grupos creados')

    def create_ingredients(self):
        ingredients_data = [
            # (nombre, grupo, unidad, stock_actual, stock_min, costo_unitario)
            ('Lomo de Res', 'Carnes', 'kg', 25.5, 5.0, 35.00),
            ('Pollo Entero', 'Carnes', 'unidades', 15, 3, 12.50),
            ('Chorizo Parrillero', 'Carnes', 'kg', 8.0, 2.0, 18.00),
            ('Costillas de Cerdo', 'Carnes', 'kg', 12.0, 3.0, 22.00),
            ('Papa Amarilla', 'Verduras', 'kg', 50.0, 10.0, 2.50),
            ('Cebolla Roja', 'Verduras', 'kg', 20.0, 5.0, 3.00),
            ('Tomate', 'Verduras', 'kg', 15.0, 3.0, 4.00),
            ('Lechuga', 'Verduras', 'unidades', 20, 5, 1.50),
            ('Coca Cola', 'Bebidas', 'litros', 48.0, 12.0, 2.80),
            ('Cerveza Pilsen', 'Bebidas', 'unidades', 100, 24, 4.50),
            ('Agua Mineral', 'Bebidas', 'unidades', 80, 20, 1.20),
            ('Sal', 'Condimentos', 'kg', 5.0, 1.0, 2.00),
            ('Pimienta', 'Condimentos', 'kg', 2.0, 0.5, 8.00),
            ('Ají Amarillo', 'Condimentos', 'kg', 3.0, 0.5, 12.00),
            ('Queso Fresco', 'Lácteos', 'kg', 8.0, 2.0, 15.00),
            ('Arroz Blanco', 'Cereales', 'kg', 25.0, 5.0, 3.50),
        ]
        
        for name, group_name, unit_name, stock, min_stock, cost in ingredients_data:
            unit = Unit.objects.get(name=unit_name)
            Ingredient.objects.create(
                name=name,
                unit=unit,
                current_stock=Decimal(str(stock)),
                unit_price=Decimal(str(cost)),
                is_active=True
            )
        self.stdout.write('✅ Ingredientes creados')

    def create_recipes(self):
        recipes_data = [
            ('Parrillada Mixta', 'Carnes', 45.00, 150.0),
            ('Lomo Saltado', 'Carnes', 28.00, 140.0),
            ('Pollo a la Brasa', 'Carnes', 25.00, 120.0),
            ('Costillas BBQ', 'Carnes', 32.00, 130.0),
            ('Coca Cola Personal', 'Bebidas', 5.00, 80.0),
            ('Cerveza Pilsen', 'Bebidas', 8.00, 60.0),
            ('Agua Mineral', 'Bebidas', 3.50, 70.0),
            ('Papas Fritas', 'Verduras', 8.00, 200.0),
            ('Ensalada Mixta', 'Verduras', 12.00, 150.0),
            ('Arroz Chaufa', 'Cereales', 15.00, 180.0),
        ]
        
        for name, group_name, price, profit in recipes_data:
            group = Group.objects.get(name=group_name)
            recipe = Recipe.objects.create(
                name=name,
                group=group,
                base_price=Decimal(str(price)),
                profit_percentage=Decimal(str(profit)),
                is_active=True,
                version=1
            )
            
            # Agregar algunos ingredientes a las recetas principales
            if name == 'Parrillada Mixta':
                RecipeItem.objects.create(
                    recipe=recipe,
                    ingredient=Ingredient.objects.get(name='Lomo de Res'),
                    quantity=Decimal('0.3')
                )
                RecipeItem.objects.create(
                    recipe=recipe,
                    ingredient=Ingredient.objects.get(name='Chorizo Parrillero'),
                    quantity=Decimal('0.2')
                )
                RecipeItem.objects.create(
                    recipe=recipe,
                    ingredient=Ingredient.objects.get(name='Papa Amarilla'),
                    quantity=Decimal('0.3')
                )
            elif name == 'Lomo Saltado':
                RecipeItem.objects.create(
                    recipe=recipe,
                    ingredient=Ingredient.objects.get(name='Lomo de Res'),
                    quantity=Decimal('0.25')
                )
                RecipeItem.objects.create(
                    recipe=recipe,
                    ingredient=Ingredient.objects.get(name='Cebolla Roja'),
                    quantity=Decimal('0.1')
                )
                RecipeItem.objects.create(
                    recipe=recipe,
                    ingredient=Ingredient.objects.get(name='Tomate'),
                    quantity=Decimal('0.15')
                )
                
        self.stdout.write('✅ Recetas creadas con ingredientes')

    def create_orders(self):
        # Crear algunas órdenes de ejemplo
        tables = Table.objects.all()[:5]
        recipes = Recipe.objects.all()
        
        for i, table in enumerate(tables):
            if i < 4:  # Primeras 4 órdenes pagadas
                order = Order.objects.create(
                    table=table,
                    waiter='admin' if i % 2 == 0 else 'mesero01',
                    status='PAID',
                    total_amount=Decimal('0'),
                    paid_at=timezone.now()
                )
                
                # Agregar items
                for j in range(2):
                    recipe = recipes[i * 2 + j]
                    OrderItem.objects.create(
                        order=order,
                        recipe=recipe,
                        quantity=1,
                        unit_price=recipe.base_price,
                        total_price=recipe.base_price,
                        status='SERVED'
                    )
                
                # Calcular total
                order.calculate_total()
                
                # Crear pago
                Payment.objects.create(
                    order=order,
                    payment_method='CASH' if i % 2 == 0 else 'CARD',
                    amount=order.total_amount,
                    payer_name=f'Cliente Mesa {table.table_number}'
                )
            else:  # Última orden pendiente
                order = Order.objects.create(
                    table=table,
                    waiter='mesero01',
                    status='CREATED',
                    total_amount=Decimal('0')
                )
                
                OrderItem.objects.create(
                    order=order,
                    recipe=recipes[0],
                    quantity=1,
                    unit_price=recipes[0].base_price,
                    total_price=recipes[0].base_price,
                    status='CREATED'
                )
                
                order.calculate_total()
                
        self.stdout.write('✅ Órdenes y pagos creados')

    def show_summary(self):
        self.stdout.write('\n📊 RESUMEN DE DATOS INSERTADOS:')
        self.stdout.write(f'   • {Unit.objects.count()} unidades de medida')
        self.stdout.write(f'   • {Zone.objects.count()} zonas')
        self.stdout.write(f'   • {Table.objects.count()} mesas')
        self.stdout.write(f'   • {Container.objects.count()} tipos de envases')
        self.stdout.write(f'   • {Group.objects.count()} grupos de ingredientes')
        self.stdout.write(f'   • {Ingredient.objects.count()} ingredientes')
        self.stdout.write(f'   • {Recipe.objects.count()} recetas')
        self.stdout.write(f'   • {Order.objects.count()} órdenes ({Order.objects.filter(status="PAID").count()} pagadas)')
        self.stdout.write(f'   • {Payment.objects.count()} pagos procesados')
        self.stdout.write('\n🎯 La aplicación está lista con datos de prueba!')