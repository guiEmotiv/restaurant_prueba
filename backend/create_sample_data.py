#!/usr/bin/env python3
"""
Script para crear datos de prueba en la base de datos
"""

import os
import django
from decimal import Decimal

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from config.models import Unit, Zone, Table
from inventory.models import Ingredient, Recipe, RecipeItem
from operation.models import Order, OrderItem


def create_sample_data():
    print("🚀 Creando datos de prueba...")
    
    # Limpiar datos existentes
    Order.objects.all().delete()
    Recipe.objects.all().delete()
    Ingredient.objects.all().delete()
    Table.objects.all().delete()
    Zone.objects.all().delete()
    Unit.objects.all().delete()
    
    
    # Crear unidades
    units = [
        Unit.objects.create(name="Kilogramo"),
        Unit.objects.create(name="Litro"),
        Unit.objects.create(name="Unidades"),
        Unit.objects.create(name="Gramos"),
    ]
    print(f"✅ Creadas {len(units)} unidades")
    
    # Crear zonas
    zones = [
        Zone.objects.create(name="Terraza"),
        Zone.objects.create(name="Salón Principal"),
        Zone.objects.create(name="Área VIP"),
        Zone.objects.create(name="Bar"),
    ]
    print(f"✅ Creadas {len(zones)} zonas")
    
    # Crear mesas
    tables = []
    table_numbers = ["T-01", "T-02", "T-03", "S-01", "S-02", "S-03", "S-04", "V-01", "B-01", "B-02"]
    zone_assignments = [0, 0, 0, 1, 1, 1, 1, 2, 3, 3]  # Índices de zonas
    
    for i, table_num in enumerate(table_numbers):
        table = Table.objects.create(
            zone=zones[zone_assignments[i]],
            table_number=table_num
        )
        tables.append(table)
    print(f"✅ Creadas {len(tables)} mesas")
    
    # Crear ingredientes
    ingredients_data = [
        ("Tomate", units[0], "4.50", "15.00"),
        ("Cebolla", units[0], "3.20", "12.00"),
        ("Lechuga", units[0], "2.80", "8.00"),
        ("Pimiento", units[0], "5.00", "6.00"),
        ("Pollo", units[0], "18.00", "10.00"),
        ("Carne de Res", units[0], "25.00", "8.00"),
        ("Pescado", units[0], "22.00", "5.00"),
        ("Queso", units[0], "15.00", "3.00"),
        ("Leche", units[1], "4.00", "10.00"),
        ("Sal", units[3], "0.05", "1000.00"),
        ("Pimienta", units[3], "0.15", "500.00"),
        ("Aceite", units[1], "8.00", "5.00"),
        ("Coca Cola", units[2], "2.50", "50.00"),
        ("Agua", units[2], "1.50", "100.00"),
    ]
    
    ingredients = []
    for name, unit, price, stock in ingredients_data:
        ingredient = Ingredient.objects.create(
            unit=unit,
            name=name,
            unit_price=Decimal(price),
            current_stock=Decimal(stock)
        )
        ingredients.append(ingredient)
    print(f"✅ Creados {len(ingredients)} ingredientes")
    
    # Crear recetas
    recipes_data = [
        {
            "name": "Ensalada César",
            "preparation_time": 10,
            "ingredients": [
                (ingredients[2], "0.2"),  # Lechuga
                (ingredients[7], "0.1"),  # Queso
                (ingredients[9], "0.01"), # Sal
                (ingredients[11], "0.05"), # Aceite
            ]
        },
        {
            "name": "Pollo a la Plancha",
            "preparation_time": 25,
            "ingredients": [
                (ingredients[4], "0.3"),  # Pollo
                (ingredients[9], "0.01"), # Sal
                (ingredients[10], "0.005"), # Pimienta
                (ingredients[11], "0.02"), # Aceite
            ]
        },
        {
            "name": "Hamburguesa Clásica",
            "preparation_time": 15,
            "ingredients": [
                (ingredients[5], "0.2"),  # Carne
                (ingredients[0], "0.1"),  # Tomate
                (ingredients[1], "0.05"), # Cebolla
                (ingredients[2], "0.05"), # Lechuga
                (ingredients[7], "0.05"), # Queso
            ]
        },
        {
            "name": "Pescado al Vapor",
            "preparation_time": 20,
            "ingredients": [
                (ingredients[6], "0.25"), # Pescado
                (ingredients[3], "0.1"),  # Pimiento
                (ingredients[9], "0.01"), # Sal
                (ingredients[11], "0.02"), # Aceite
            ]
        },
    ]
    
    recipes = []
    for recipe_data in recipes_data:
        recipe = Recipe.objects.create(
            name=recipe_data["name"],
            base_price=Decimal("0.01"),  # Se calculará automáticamente
            preparation_time=recipe_data["preparation_time"]
        )
        
        # Agregar ingredientes a la receta
        for ingredient, quantity in recipe_data["ingredients"]:
            RecipeItem.objects.create(
                recipe=recipe,
                ingredient=ingredient,
                quantity=Decimal(quantity)
            )
        
        # Actualizar precio base
        recipe.update_base_price()
        recipes.append(recipe)
    
    print(f"✅ Creadas {len(recipes)} recetas")
    
    # Crear algunas órdenes de ejemplo
    orders_data = [
        {
            "table": tables[0],
            "items": [
                (recipes[0], "Sin cebolla"),
                (recipes[1], "Término medio"),
            ]
        },
        {
            "table": tables[3],
            "items": [
                (recipes[2], "Extra queso"),
                (recipes[3], ""),
            ]
        },
        {
            "table": tables[5],
            "items": [
                (recipes[1], "Bien cocido"),
            ]
        },
    ]
    
    orders = []
    for i, order_data in enumerate(orders_data):
        order = Order.objects.create(table=order_data["table"])
        
        for recipe, notes in order_data["items"]:
            OrderItem.objects.create(
                order=order,
                recipe=recipe,
                notes=notes
            )
        
        # Calcular total y consumir ingredientes solo para la primera orden
        order.calculate_total()
        if i == 0:  # Solo consumir ingredientes para la primera orden como ejemplo
            order.consume_ingredients_on_creation()
        
        orders.append(order)
    
    print(f"✅ Creadas {len(orders)} órdenes")
    
    print("\n🎉 ¡Datos de prueba creados exitosamente!")
    print("\n📊 Resumen:")
    print(f"  • {Category.objects.count()} categorías")
    print(f"  • {Unit.objects.count()} unidades")
    print(f"  • {Zone.objects.count()} zonas")
    print(f"  • {Table.objects.count()} mesas")
    print(f"  • {Ingredient.objects.count()} ingredientes")
    print(f"  • {Recipe.objects.count()} recetas")
    print(f"  • {Order.objects.count()} órdenes")
    print(f"  • {OrderItem.objects.count()} items de órdenes")
    
    print("\n🔗 URLs útiles:")
    print("  • Admin: http://localhost:8000/admin/")
    print("  • API Docs: http://localhost:8000/api/docs/")
    print("  • Frontend: http://localhost:3000/")


if __name__ == "__main__":
    create_sample_data()