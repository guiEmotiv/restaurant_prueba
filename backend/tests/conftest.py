"""
Pytest configuration and shared fixtures for the restaurant backend
"""
import pytest
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import User
from config.models import Unit, Zone, Table, Container
from inventory.models import Group, Ingredient, Recipe, RecipeItem
from operation.models import Order, OrderItem


@pytest.fixture
def unit_kg():
    """Create a kilogram unit for testing"""
    return Unit.objects.create(name="kg")


@pytest.fixture
def unit_liters():
    """Create a liters unit for testing"""
    return Unit.objects.create(name="litros")


@pytest.fixture
def unit_portions():
    """Create a portions unit for testing"""
    return Unit.objects.create(name="porciones")


@pytest.fixture
def zone_salon():
    """Create a main salon zone for testing"""
    return Zone.objects.create(name="Salón Principal")


@pytest.fixture
def container_plate():
    """Create a plate container for testing"""
    return Container.objects.create(
        name="Plato Grande",
        description="Plato para comidas principales",
        price=Decimal("2.00"),
        stock=50
    )


@pytest.fixture
def table_101(zone_salon):
    """Create a test table"""
    return Table.objects.create(
        table_number="101",
        zone=zone_salon
    )


@pytest.fixture
def group_parrillas():
    """Create a grill group for testing"""
    return Group.objects.create(name="Parrillas")


@pytest.fixture
def ingredient_beef(unit_kg):
    """Create beef ingredient for testing"""
    return Ingredient.objects.create(
        name="Lomo Fino",
        unit=unit_kg,
        cost_per_unit=Decimal("25.00"),
        stock=10
    )


@pytest.fixture
def ingredient_potatoes(unit_kg):
    """Create potatoes ingredient for testing"""
    return Ingredient.objects.create(
        name="Papas",
        unit=unit_kg,
        cost_per_unit=Decimal("3.00"),
        stock=20
    )


@pytest.fixture
def recipe_lomo_saltado(group_parrillas, container_plate):
    """Create lomo saltado recipe for testing"""
    return Recipe.objects.create(
        name="Lomo Saltado",
        version="1.0",
        group=group_parrillas,
        container=container_plate,
        base_price=Decimal("35.00"),
        profit_percentage=Decimal("80.00"),
        preparation_time=20
    )


@pytest.fixture
def recipe_with_ingredients(recipe_lomo_saltado, ingredient_beef, ingredient_potatoes):
    """Create a complete recipe with ingredients"""
    RecipeItem.objects.create(
        recipe=recipe_lomo_saltado,
        ingredient=ingredient_beef,
        quantity=Decimal("0.3")
    )
    RecipeItem.objects.create(
        recipe=recipe_lomo_saltado,
        ingredient=ingredient_potatoes,
        quantity=Decimal("0.2")
    )
    return recipe_lomo_saltado


@pytest.fixture
def order_in_progress(table_101):
    """Create an order in progress for testing"""
    return Order.objects.create(
        table=table_101,
        waiter="admin",
        status="CREATED",
        total_amount=Decimal("0.00")
    )


@pytest.fixture
def order_item(order_in_progress, recipe_with_ingredients):
    """Create an order item for testing"""
    return OrderItem.objects.create(
        order=order_in_progress,
        recipe=recipe_with_ingredients,
        quantity=1,
        unit_price=recipe_with_ingredients.base_price,
        total_price=recipe_with_ingredients.base_price,
        status="CREATED"
    )


@pytest.fixture
def sample_data_set(
    unit_kg, unit_liters, zone_salon, table_101, container_plate,
    group_parrillas, ingredient_beef, ingredient_potatoes,
    recipe_with_ingredients, order_in_progress, order_item
):
    """Complete sample data set for complex tests"""
    return {
        'unit_kg': unit_kg,
        'unit_liters': unit_liters,
        'zone_salon': zone_salon,
        'table_101': table_101,
        'container_plate': container_plate,
        'group_parrillas': group_parrillas,
        'ingredient_beef': ingredient_beef,
        'ingredient_potatoes': ingredient_potatoes,
        'recipe_with_ingredients': recipe_with_ingredients,
        'order_in_progress': order_in_progress,
        'order_item': order_item
    }


class BaseTestCase(TestCase):
    """Base test case with common setup"""
    
    def setUp(self):
        """Common setup for all test cases"""
        # Create basic test data
        self.unit_kg = Unit.objects.create(name="kg")
        self.zone = Zone.objects.create(name="Test Zone")
        self.table = Table.objects.create(table_number="T01", zone=self.zone)
        self.container = Container.objects.create(
            name="Test Container",
            description="Test container",
            price=Decimal("1.00"),
            stock=100
        )
        self.group = Group.objects.create(name="Test Group")
    
    def create_test_recipe(self, name="Test Recipe"):
        """Helper method to create a test recipe"""
        return Recipe.objects.create(
            name=name,
            version="1.0",
            group=self.group,
            container=self.container,
            base_price=Decimal("10.00"),
            profit_percentage=Decimal("50.00")
        )
    
    def create_test_ingredient(self, name="Test Ingredient", cost=Decimal("5.00")):
        """Helper method to create a test ingredient"""
        return Ingredient.objects.create(
            name=name,
            unit=self.unit_kg,
            cost_per_unit=cost,
            stock=10
        )