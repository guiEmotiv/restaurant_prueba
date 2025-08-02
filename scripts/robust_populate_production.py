#!/usr/bin/env python3
"""
Script robusto para poblar la base de datos de producción
Basado en análisis profundo de los modelos Django reales
"""
import os
import sys
import django
from decimal import Decimal

# Configurar entorno Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_ec2')
django.setup()

from django.db import transaction
from config.models import Unit, Zone, Table, Container
from inventory.models import Group, Ingredient, Recipe, RecipeItem
from operation.models import Order, OrderItem, Payment, PaymentItem
from django.utils import timezone

class RobustPopulator:
    """Poblador robusto basado en esquema real de Django"""
    
    def __init__(self):
        self.created_objects = {}
    
    def clean_database(self):
        """Limpia la base de datos en orden correcto"""
        print("🗑️  Limpiando base de datos...")
        
        # Orden correcto de limpieza (dependencias inversas)
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
        
        print("✅ Base de datos limpiada")
    
    def create_units(self):
        """Crear unidades de medida"""
        units_data = [
            'kg', 'g', 'litros', 'ml', 'unidades', 'porciones', 'cucharadas', 'tazas'
        ]
        
        units = []
        for name in units_data:
            unit = Unit.objects.create(name=name)
            units.append(unit)
        
        self.created_objects['units'] = {unit.name: unit for unit in units}
        print("✅ Unidades creadas")
    
    def create_zones(self):
        """Crear zonas del restaurante"""
        zones_data = ['Terraza Principal', 'Salón Interior', 'Área VIP', 'Barra', 'Jardín']
        
        zones = []
        for name in zones_data:
            zone = Zone.objects.create(name=name)
            zones.append(zone)
        
        self.created_objects['zones'] = {zone.name: zone for zone in zones}
        print("✅ Zonas creadas")
    
    def create_tables(self):
        """Crear mesas distribuidas por zonas"""
        zone_tables = {
            'Terraza Principal': ['T01', 'T02', 'T03', 'T04', 'T05'],
            'Salón Interior': ['S01', 'S02', 'S03', 'S04'],
            'Área VIP': ['V01', 'V02'],
            'Barra': ['B01', 'B02'],
            'Jardín': ['J01', 'J02'],
        }
        
        tables = []
        for zone_name, table_numbers in zone_tables.items():
            zone = self.created_objects['zones'][zone_name]
            for table_number in table_numbers:
                table = Table.objects.create(zone=zone, table_number=table_number)
                tables.append(table)
        
        print("✅ Mesas creadas")
    
    def create_containers(self):
        """Crear envases para delivery"""
        containers_data = [
            ('Bandeja Pequeña', 'Bandeja biodegradable 500ml', 2.50, 100),
            ('Bandeja Grande', 'Bandeja biodegradable 1L', 3.50, 80),
            ('Vaso Térmico', 'Vaso para bebidas calientes 400ml', 1.50, 150),
            ('Botella Plástica', 'Botella para bebidas frías 500ml', 1.00, 200),
        ]
        
        containers = []
        for name, desc, price, stock in containers_data:
            container = Container.objects.create(
                name=name,
                description=desc,
                price=Decimal(str(price)),
                stock=stock,
                is_active=True
            )
            containers.append(container)
        
        print("✅ Envases creados")
    
    def create_groups(self):
        """Crear grupos de recetas"""
        groups_data = ['Carnes', 'Verduras', 'Bebidas', 'Condimentos', 'Lácteos', 'Cereales', 'Postres']
        
        groups = []
        for name in groups_data:
            group = Group.objects.create(name=name)
            groups.append(group)
        
        self.created_objects['groups'] = {group.name: group for group in groups}
        print("✅ Grupos creados")
    
    def create_ingredients(self):
        """Crear ingredientes con campos correctos del modelo"""
        ingredients_data = [
            # (nombre, unidad, stock_actual, precio_unitario)
            ('Lomo de Res', 'kg', 25.5, 35.00),
            ('Pollo Entero', 'unidades', 15, 12.50),
            ('Chorizo Parrillero', 'kg', 8.0, 18.00),
            ('Costillas de Cerdo', 'kg', 12.0, 22.00),
            ('Papa Amarilla', 'kg', 50.0, 2.50),
            ('Cebolla Roja', 'kg', 20.0, 3.00),
            ('Tomate', 'kg', 15.0, 4.00),
            ('Lechuga', 'unidades', 20, 1.50),
            ('Coca Cola', 'litros', 48.0, 2.80),
            ('Cerveza Pilsen', 'unidades', 100, 4.50),
            ('Agua Mineral', 'unidades', 80, 1.20),
            ('Sal', 'kg', 5.0, 2.00),
            ('Pimienta', 'kg', 2.0, 8.00),
            ('Ají Amarillo', 'kg', 3.0, 12.00),
            ('Queso Fresco', 'kg', 8.0, 15.00),
            ('Arroz Blanco', 'kg', 25.0, 3.50),
        ]
        
        ingredients = []
        for name, unit_name, stock, price in ingredients_data:
            unit = self.created_objects['units'][unit_name]
            ingredient = Ingredient.objects.create(
                name=name,
                unit=unit,
                current_stock=Decimal(str(stock)),
                unit_price=Decimal(str(price)),
                is_active=True
            )
            ingredients.append(ingredient)
        
        self.created_objects['ingredients'] = {ing.name: ing for ing in ingredients}
        print("✅ Ingredientes creados")
    
    def create_recipes(self):
        """Crear recetas con TODOS los campos obligatorios"""
        recipes_data = [
            # (nombre, grupo, precio_base, profit_percentage, tiempo_preparacion, version)
            ('Parrillada Mixta', 'Carnes', 45.00, 150.0, 25, '1.0'),
            ('Lomo Saltado', 'Carnes', 28.00, 140.0, 15, '1.0'),
            ('Pollo a la Brasa', 'Carnes', 25.00, 120.0, 30, '1.0'),
            ('Costillas BBQ', 'Carnes', 32.00, 130.0, 20, '1.0'),
            ('Coca Cola Personal', 'Bebidas', 5.00, 80.0, 2, '1.0'),
            ('Cerveza Pilsen', 'Bebidas', 8.00, 60.0, 2, '1.0'),
            ('Agua Mineral', 'Bebidas', 3.50, 70.0, 1, '1.0'),
            ('Papas Fritas', 'Verduras', 8.00, 200.0, 10, '1.0'),
            ('Ensalada Mixta', 'Verduras', 12.00, 150.0, 8, '1.0'),
            ('Arroz Chaufa', 'Cereales', 15.00, 180.0, 12, '1.0'),
        ]
        
        recipes = []
        for name, group_name, price, profit, prep_time, version in recipes_data:
            group = self.created_objects['groups'][group_name]
            
            # Crear receta con TODOS los campos obligatorios
            recipe = Recipe.objects.create(
                name=name,
                group=group,
                version=version,
                base_price=Decimal(str(price)),
                profit_percentage=Decimal(str(profit)),
                is_available=True,
                is_active=True,
                preparation_time=prep_time  # CAMPO OBLIGATORIO
            )
            recipes.append(recipe)
        
        self.created_objects['recipes'] = {recipe.name: recipe for recipe in recipes}
        print("✅ Recetas creadas")
    
    def create_recipe_items(self):
        """Crear items de recetas (ingredientes por receta)"""
        recipe_ingredients = [
            ('Parrillada Mixta', [
                ('Lomo de Res', 0.3),
                ('Chorizo Parrillero', 0.2),
                ('Papa Amarilla', 0.3)
            ]),
            ('Lomo Saltado', [
                ('Lomo de Res', 0.25),
                ('Papa Amarilla', 0.2),
                ('Cebolla Roja', 0.1)
            ]),
            ('Coca Cola Personal', [
                ('Coca Cola', 0.5)
            ])
        ]
        
        for recipe_name, ingredients in recipe_ingredients:
            recipe = self.created_objects['recipes'][recipe_name]
            for ingredient_name, quantity in ingredients:
                ingredient = self.created_objects['ingredients'][ingredient_name]
                RecipeItem.objects.create(
                    recipe=recipe,
                    ingredient=ingredient,
                    quantity=Decimal(str(quantity))
                )
        
        print("✅ Items de recetas creados")
    
    def create_sample_orders(self):
        """Crear órdenes de ejemplo"""
        tables = Table.objects.all()[:3]  # Primeras 3 mesas
        recipes = list(self.created_objects['recipes'].values())[:3]  # Primeras 3 recetas
        
        for i, table in enumerate(tables):
            order = Order.objects.create(
                table=table,
                waiter='admin' if i % 2 == 0 else 'mesero01',
                status='CREATED',
                total_amount=Decimal('0')
            )
            
            # Agregar items
            recipe = recipes[i]
            OrderItem.objects.create(
                order=order,
                recipe=recipe,
                quantity=1,
                unit_price=recipe.base_price,
                total_price=recipe.base_price,
                status='CREATED',
                notes='',
                is_takeaway=False,
                has_taper=False
            )
            
            # Calcular total
            order.total_amount = recipe.base_price
            order.save()
        
        print("✅ Órdenes de ejemplo creadas")
    
    def populate(self):
        """Ejecutar población completa"""
        print("🌱 INICIANDO POBLACIÓN ROBUSTA DE BASE DE DATOS")
        print("=" * 60)
        
        with transaction.atomic():
            self.clean_database()
            self.create_units()
            self.create_zones()
            self.create_tables()
            self.create_containers()
            self.create_groups()
            self.create_ingredients()
            self.create_recipes()
            self.create_recipe_items()
            self.create_sample_orders()
        
        print("=" * 60)
        print("✅ POBLACIÓN COMPLETADA EXITOSAMENTE")
        self.show_summary()
    
    def show_summary(self):
        """Mostrar resumen de datos creados"""
        print("\n📊 RESUMEN DE DATOS CREADOS:")
        print(f"   • Unidades: {Unit.objects.count()}")
        print(f"   • Zonas: {Zone.objects.count()}")
        print(f"   • Mesas: {Table.objects.count()}")
        print(f"   • Envases: {Container.objects.count()}")
        print(f"   • Grupos: {Group.objects.count()}")
        print(f"   • Ingredientes: {Ingredient.objects.count()}")
        print(f"   • Recetas: {Recipe.objects.count()}")
        print(f"   • Items de recetas: {RecipeItem.objects.count()}")
        print(f"   • Órdenes: {Order.objects.count()}")
        print(f"   • Items de órdenes: {OrderItem.objects.count()}")

if __name__ == "__main__":
    populator = RobustPopulator()
    populator.populate()