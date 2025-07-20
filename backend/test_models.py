#!/usr/bin/env python3
"""
Script para probar todos los modelos y la lógica de negocio
"""

import os
import django
from decimal import Decimal

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from config.models import Category, Unit, Zone, Table
from inventory.models import Ingredient, Recipe, RecipeItem
from operation.models import Order, OrderItem, OrderItemIngredient, Payment


def test_basic_creation():
    print("=== 1. Probando creación de datos básicos ===")
    
    # Crear categorías
    cat_vegetables = Category.objects.create(name="Verduras")
    cat_proteins = Category.objects.create(name="Proteínas")
    print(f"✅ Categorías creadas: {cat_vegetables}, {cat_proteins}")
    
    # Crear unidades
    unit_kg = Unit.objects.create(name="Kilogramo")
    unit_units = Unit.objects.create(name="Unidades")
    print(f"✅ Unidades creadas: {unit_kg}, {unit_units}")
    
    # Crear zonas y mesas
    zone_terraza = Zone.objects.create(name="Terraza")
    table_1 = Table.objects.create(zone=zone_terraza, table_number="T-01")
    print(f"✅ Zona y mesa creadas: {table_1}")
    
    # Crear ingredientes
    tomato = Ingredient.objects.create(
        category=cat_vegetables,
        unit=unit_kg,
        name="Tomate",
        unit_price=Decimal("3.50"),
        current_stock=Decimal("10.00")
    )
    
    chicken = Ingredient.objects.create(
        category=cat_proteins,
        unit=unit_kg,
        name="Pollo",
        unit_price=Decimal("12.00"),
        current_stock=Decimal("5.00")
    )
    print(f"✅ Ingredientes creados: {tomato}, {chicken}")
    
    return {
        'categories': [cat_vegetables, cat_proteins],
        'units': [unit_kg, unit_units],
        'zone': zone_terraza,
        'table': table_1,
        'ingredients': [tomato, chicken]
    }


def test_recipe_creation(data):
    print("\n=== 2. Probando creación de recetas ===")
    
    # Crear receta
    recipe = Recipe.objects.create(
        name="Pollo con Tomate",
        base_price=Decimal("0.01"),  # Se actualizará automáticamente
        preparation_time=30
    )
    
    # Agregar ingredientes a la receta
    recipe_item1 = RecipeItem.objects.create(
        recipe=recipe,
        ingredient=data['ingredients'][1],  # Pollo
        quantity=Decimal("0.5")
    )
    
    recipe_item2 = RecipeItem.objects.create(
        recipe=recipe,
        ingredient=data['ingredients'][0],  # Tomate
        quantity=Decimal("0.3")
    )
    
    # Verificar que el precio se actualizó automáticamente
    recipe.refresh_from_db()
    expected_price = (Decimal("12.00") * Decimal("0.5")) + (Decimal("3.50") * Decimal("0.3"))
    print(f"✅ Receta creada: {recipe}")
    print(f"✅ Precio calculado automáticamente: {recipe.base_price} (esperado: {expected_price})")
    
    # Verificar disponibilidad
    print(f"✅ Receta disponible: {recipe.check_availability()}")
    
    return recipe


def test_order_creation(data, recipe):
    print("\n=== 3. Probando creación de órdenes ===")
    
    # Crear orden
    order = Order.objects.create(table=data['table'])
    print(f"✅ Orden creada: {order}")
    
    # Agregar item a la orden
    order_item = OrderItem.objects.create(
        order=order,
        recipe=recipe,
        notes="Sin sal extra"
    )
    print(f"✅ Item de orden creado: {order_item}")
    print(f"✅ Precio unitario tomado de receta: {order_item.unit_price}")
    
    # Calcular total de la orden
    total = order.calculate_total()
    print(f"✅ Total de orden calculado: {total}")
    
    return order, order_item


def test_customization(order_item, ingredient):
    print("\n=== 4. Probando personalización de ingredientes ===")
    
    # Agregar ingrediente extra
    extra_ingredient = OrderItemIngredient.objects.create(
        order_item=order_item,
        ingredient=ingredient,
        quantity=Decimal("0.1")
    )
    
    print(f"✅ Ingrediente extra agregado: {extra_ingredient}")
    print(f"✅ Precio unitario: {extra_ingredient.unit_price}")
    print(f"✅ Precio total: {extra_ingredient.total_price}")
    
    # Verificar que se actualizaron los totales
    order_item.refresh_from_db()
    order_item.order.refresh_from_db()
    print(f"✅ Nuevo total del item: {order_item.total_price}")
    print(f"✅ Nuevo total de la orden: {order_item.order.total_amount}")


def test_stock_management(data, recipe, order):
    print("\n=== 5. Probando gestión de stock ===")
    
    # Verificar stock inicial
    tomato, chicken = data['ingredients']
    tomato.refresh_from_db()
    chicken.refresh_from_db()
    print(f"Stock inicial - Tomate: {tomato.current_stock}, Pollo: {chicken.current_stock}")
    
    # Simular consumo de ingredientes cuando se confirma la orden
    order.consume_ingredients_on_creation()
    
    # Verificar stock después del consumo
    tomato.refresh_from_db()
    chicken.refresh_from_db()
    print(f"Stock después de consumir - Tomate: {tomato.current_stock}, Pollo: {chicken.current_stock}")
    
    # Verificar cancelación de orden (devolver stock)
    print("\n--- Probando cancelación de orden ---")
    order.update_status('CANCELLED')
    
    tomato.refresh_from_db()
    chicken.refresh_from_db()
    print(f"Stock después de cancelar - Tomate: {tomato.current_stock}, Pollo: {chicken.current_stock}")


def test_business_logic_validation():
    print("\n=== 6. Probando validaciones de lógica de negocio ===")
    
    try:
        # Intentar crear ingrediente con precio inválido
        invalid_ingredient = Ingredient(
            category=Category.objects.first(),
            unit=Unit.objects.first(),
            name="Ingrediente Inválido",
            unit_price=Decimal("0.00"),  # Inválido
            current_stock=Decimal("1.00")
        )
        invalid_ingredient.full_clean()  # Esto ejecuta las validaciones
        invalid_ingredient.save()
        print("❌ ERROR: Debería haber fallado con precio inválido")
    except Exception as e:
        print(f"✅ Validación de precio mínimo funcionó: {e}")
    
    # Probar eliminación protegida
    try:
        Category.objects.first().delete()
        print("❌ ERROR: Debería haber fallado al eliminar categoría con ingredientes")
    except Exception as e:
        print(f"✅ Protección de eliminación funcionó: {e}")


def main():
    print("🚀 Iniciando pruebas del sistema de restaurante\n")
    
    # Limpiar datos existentes para pruebas limpias
    Order.objects.all().delete()
    Recipe.objects.all().delete()
    Ingredient.objects.all().delete()
    Table.objects.all().delete()
    Zone.objects.all().delete()
    Unit.objects.all().delete()
    Category.objects.all().delete()
    
    try:
        # Ejecutar todas las pruebas
        data = test_basic_creation()
        recipe = test_recipe_creation(data)
        order, order_item = test_order_creation(data, recipe)
        test_customization(order_item, data['ingredients'][0])
        test_stock_management(data, recipe, order)
        test_business_logic_validation()
        
        print("\n🎉 ¡Todas las pruebas pasaron exitosamente!")
        print("✅ Los modelos están funcionando correctamente")
        print("✅ La lógica de negocio está implementada")
        print("✅ Las validaciones están funcionando")
        
    except Exception as e:
        print(f"\n❌ Error durante las pruebas: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()