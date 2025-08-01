"""
Management command para poblar la base de datos con datos del restaurante
Uso: python3 manage.py populate_database
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from decimal import Decimal
import datetime

# Importar modelos
from config.models import Unit, Zone, Table, Container, RestaurantOperationalConfig
from inventory.models import Group, Ingredient, Recipe, RecipeItem


class Command(BaseCommand):
    help = 'Puebla la base de datos con datos reales del restaurante'

    def handle(self, *args, **options):
        self.stdout.write("🍽️ Poblando base de datos del restaurante...")
        
        with transaction.atomic():
            # Unidades de medida
            self.stdout.write("📏 Creando unidades de medida...")
            units_data = [
                ('kg', 'Kilogramos'),
                ('gr', 'Gramos'), 
                ('litros', 'Litros'),
                ('ml', 'Mililitros'),
                ('unidades', 'Unidades'),
                ('tazas', 'Tazas'),
                ('cucharadas', 'Cucharadas'),
                ('cucharaditas', 'Cucharaditas'),
                ('porciones', 'Porciones')
            ]
            
            for name, desc in units_data:
                Unit.objects.get_or_create(name=name)
            
            # Obtener unidades para usar en ingredientes
            kg = Unit.objects.get(name='kg')
            gr = Unit.objects.get(name='gr')
            litros = Unit.objects.get(name='litros')
            unidades = Unit.objects.get(name='unidades')
            
            # Zonas del restaurante
            self.stdout.write("🏢 Creando zonas...")
            zones_data = [
                'Salón Principal',
                'Terraza', 
                'Área VIP',
                'Bar',
                'Zona Familiar'
            ]
            
            zones = {}
            for zone_name in zones_data:
                zone, created = Zone.objects.get_or_create(name=zone_name)
                zones[zone_name] = zone
            
            # Mesas del restaurante
            self.stdout.write("🪑 Creando mesas...")
            table_distribution = {
                'Salón Principal': list(range(1, 13)),  # 12 mesas (1-12)
                'Terraza': list(range(13, 19)),         # 6 mesas (13-18)
                'Área VIP': list(range(19, 23)),        # 4 mesas (19-22)
                'Bar': list(range(23, 27)),             # 4 mesas (23-26)
                'Zona Familiar': list(range(27, 31)),   # 4 mesas (27-30)
            }
            
            for zone_name, table_numbers in table_distribution.items():
                zone = zones[zone_name]
                for table_num in table_numbers:
                    Table.objects.get_or_create(
                        table_number=str(table_num),
                        defaults={'zone': zone}
                    )
            
            # Envases
            self.stdout.write("📦 Creando envases...")
            containers_data = [
                ('Envase Pequeño', 'Para entradas y postres', Decimal('1.50'), 100),
                ('Envase Mediano', 'Para platos principales', Decimal('2.00'), 80),
                ('Envase Grande', 'Para porciones familiares', Decimal('2.50'), 50),
                ('Vaso Bebidas', 'Para jugos y bebidas', Decimal('0.80'), 200),
            ]
            
            for name, desc, price, stock in containers_data:
                Container.objects.get_or_create(
                    name=name,
                    defaults={
                        'description': desc,
                        'price': price,
                        'stock': stock
                    }
                )
            
            # Grupos de recetas
            self.stdout.write("🏷️ Creando grupos de recetas...")
            groups_data = [
                'Entradas', 'Sopas y Cremas', 'Ensaladas', 'Platos Principales',
                'Carnes a la Parrilla', 'Pescados y Mariscos', 'Pasta y Risottos',
                'Postres', 'Bebidas Calientes', 'Bebidas Frías', 'Jugos Naturales', 'Cócteles'
            ]
            
            groups = {}
            for group_name in groups_data:
                group, created = Group.objects.get_or_create(name=group_name)
                groups[group_name] = group
            
            # Ingredientes
            self.stdout.write("🥘 Creando ingredientes...")
            ingredients_data = [
                # (nombre, precio_unitario, stock_actual, unidad)
                ('Lomo de res', Decimal('35'), Decimal('8.5'), kg),
                ('Pechuga de pollo', Decimal('18'), Decimal('12'), kg),
                ('Muslos de pollo', Decimal('12'), Decimal('15'), kg),
                ('Cerdo', Decimal('22'), Decimal('6'), kg),
                ('Pescado corvina', Decimal('28'), Decimal('4.5'), kg),
                ('Camarones', Decimal('45'), Decimal('2'), kg),
                ('Cebolla roja', Decimal('3.5'), Decimal('25'), kg),
                ('Tomate', Decimal('4'), Decimal('20'), kg),
                ('Lechuga', Decimal('2.5'), Decimal('15'), unidades),
                ('Zanahoria', Decimal('2.8'), Decimal('18'), kg),
                ('Papa amarilla', Decimal('3.2'), Decimal('30'), kg),
                ('Ají amarillo', Decimal('8'), Decimal('3'), kg),
                ('Rocoto', Decimal('6.5'), Decimal('2.5'), kg),
                ('Apio', Decimal('4.5'), Decimal('8'), kg),
                ('Brócoli', Decimal('5'), Decimal('6'), kg),
                ('Arroz', Decimal('4.5'), Decimal('50'), kg),
                ('Quinua', Decimal('12'), Decimal('10'), kg),
                ('Pasta espagueti', Decimal('6'), Decimal('15'), kg),
                ('Harina de trigo', Decimal('3.8'), Decimal('20'), kg),
                ('Leche evaporada', Decimal('4.2'), Decimal('24'), unidades),
                ('Queso fresco', Decimal('18'), Decimal('5'), kg),
                ('Mantequilla', Decimal('22'), Decimal('3'), kg),
                ('Crema de leche', Decimal('12'), Decimal('4'), litros),
                ('Sal', Decimal('2'), Decimal('10'), kg),
                ('Pimienta', Decimal('0.08'), Decimal('500'), gr),
                ('Comino', Decimal('0.12'), Decimal('300'), gr),
                ('Ajo', Decimal('8'), Decimal('5'), kg),
                ('Culantro', Decimal('6'), Decimal('3'), kg),
                ('Orégano', Decimal('0.15'), Decimal('200'), gr),
                ('Aceite vegetal', Decimal('8.5'), Decimal('8'), litros),
                ('Aceite de oliva', Decimal('25'), Decimal('2'), litros),
                ('Vinagre blanco', Decimal('4'), Decimal('4'), litros),
                ('Agua mineral', Decimal('2.5'), Decimal('48'), unidades),
                ('Coca Cola', Decimal('3.5'), Decimal('36'), unidades),
                ('Inca Kola', Decimal('3.5'), Decimal('24'), unidades),
                ('Cerveza', Decimal('5.5'), Decimal('30'), unidades),
                ('Café molido', Decimal('28'), Decimal('2'), kg),
                ('Limón', Decimal('5'), Decimal('12'), kg),
                ('Naranja', Decimal('4'), Decimal('15'), kg),
                ('Mango', Decimal('6.5'), Decimal('8'), kg),
                ('Palta', Decimal('8'), Decimal('6'), kg),
            ]
            
            ingredients = {}
            for name, price, stock, unit in ingredients_data:
                ingredient, created = Ingredient.objects.get_or_create(
                    name=name,
                    defaults={
                        'unit_price': price,
                        'current_stock': stock,
                        'unit': unit
                    }
                )
                ingredients[name] = ingredient
            
            # Recetas
            self.stdout.write("🍽️ Creando recetas...")
            recipes_data = [
                # (nombre, grupo, precio_base, tiempo_preparacion, ingredientes)
                ('Palta Rellena', 'Entradas', Decimal('7.8'), 8, [
                    ('Palta', Decimal('0.5')),
                    ('Pechuga de pollo', Decimal('0.1')),
                    ('Sal', Decimal('1')),
                ]),
                ('Causa Limeña', 'Entradas', Decimal('4.39'), 20, [
                    ('Papa amarilla', Decimal('0.4')),
                    ('Limón', Decimal('0.05')),
                    ('Ají amarillo', Decimal('0.02')),
                    ('Pechuga de pollo', Decimal('0.15')),
                ]),
                ('Lomo Saltado', 'Carnes a la Parrilla', Decimal('10.14'), 20, [
                    ('Lomo de res', Decimal('0.25')),
                    ('Papa amarilla', Decimal('0.2')),
                    ('Cebolla roja', Decimal('0.1')),
                    ('Tomate', Decimal('0.1')),
                ]),
                ('Arroz con Pollo', 'Platos Principales', Decimal('5.22'), 25, [
                    ('Arroz', Decimal('0.25')),
                    ('Pechuga de pollo', Decimal('0.2')),
                    ('Cebolla roja', Decimal('0.08')),
                    ('Ají amarillo', Decimal('0.02')),
                    ('Culantro', Decimal('0.01')),
                ]),
                ('Limonada', 'Bebidas Frías', Decimal('2.9'), 5, [
                    ('Limón', Decimal('0.08')),
                    ('Agua mineral', Decimal('1')),
                ]),
                ('Café Americano', 'Bebidas Calientes', Decimal('3.06'), 3, [
                    ('Café molido', Decimal('0.02')),
                    ('Agua mineral', Decimal('1')),
                ]),
                ('Coca Cola 500ml', 'Bebidas Frías', Decimal('3.5'), 1, [
                    ('Coca Cola', Decimal('1')),
                ]),
                ('Cerveza Pilsen', 'Bebidas Frías', Decimal('5.5'), 1, [
                    ('Cerveza', Decimal('1')),
                ]),
            ]
            
            for recipe_name, group_name, price, prep_time, recipe_ingredients in recipes_data:
                group = groups[group_name]
                recipe, created = Recipe.objects.get_or_create(
                    name=recipe_name,
                    version='1.0',
                    defaults={
                        'group': group,
                        'base_price': price,
                        'preparation_time': prep_time,
                        'profit_percentage': Decimal('0')
                    }
                )
                
                # Crear items de receta
                if created:
                    for ingredient_name, quantity in recipe_ingredients:
                        ingredient = ingredients[ingredient_name]
                        RecipeItem.objects.create(
                            recipe=recipe,
                            ingredient=ingredient,
                            quantity=quantity
                        )
            
            # Configuración operativa
            self.stdout.write("⚙️ Creando configuración operativa...")
            RestaurantOperationalConfig.objects.get_or_create(
                name='El Fogón de Don Soto',
                defaults={
                    'opening_time': datetime.time(18, 0),
                    'closing_time': datetime.time(2, 0),
                    'operational_cutoff_time': datetime.time(5, 0),
                    'is_active': True
                }
            )
        
        # Contar registros creados
        self.stdout.write("📊 Verificando datos creados...")
        counts = {
            'Unidades': Unit.objects.count(),
            'Zonas': Zone.objects.count(),
            'Mesas': Table.objects.count(),
            'Envases': Container.objects.count(),
            'Grupos': Group.objects.count(),
            'Ingredientes': Ingredient.objects.count(),
            'Recetas': Recipe.objects.count(),
            'Items de recetas': RecipeItem.objects.count(),
        }
        
        total = sum(counts.values())
        for item, count in counts.items():
            self.stdout.write(f'✓ {item}: {count}')
        
        self.stdout.write(
            self.style.SUCCESS(f'🎉 ¡Base de datos poblada exitosamente con {total} registros!')
        )