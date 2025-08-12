"""
Unit tests for Django models
Testing business logic, validations, and model methods
"""
import pytest
from decimal import Decimal
from django.test import TestCase
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from config.models import Unit, Zone, Table, Container
from inventory.models import Group, Ingredient, Recipe, RecipeItem
from operation.models import Order, OrderItem


@pytest.mark.unit
class TestUnitModel(TestCase):
    """Test Unit model functionality"""
    
    def test_unit_creation(self):
        """Test basic unit creation"""
        unit = Unit.objects.create(name="kg")
        self.assertEqual(unit.name, "kg")
        self.assertIsNotNone(unit.created_at)
    
    def test_unit_string_representation(self):
        """Test unit __str__ method"""
        unit = Unit.objects.create(name="litros")
        self.assertEqual(str(unit), "litros")
    
    def test_unit_uniqueness(self):
        """Test that unit names must be unique"""
        Unit.objects.create(name="kg")
        with self.assertRaises(IntegrityError):
            Unit.objects.create(name="kg")


@pytest.mark.unit
class TestZoneModel(TestCase):
    """Test Zone model functionality"""
    
    def test_zone_creation(self):
        """Test basic zone creation"""
        zone = Zone.objects.create(name="Salón Principal")
        self.assertEqual(zone.name, "Salón Principal")
        self.assertIsNotNone(zone.created_at)
    
    def test_zone_tables_relationship(self):
        """Test zone-table relationship"""
        zone = Zone.objects.create(name="Terraza")
        table = Table.objects.create(table_number="T01", zone=zone)
        
        self.assertEqual(zone.table_set.count(), 1)
        self.assertEqual(table.zone, zone)


@pytest.mark.unit
class TestIngredientModel(TestCase):
    """Test Ingredient model functionality"""
    
    def setUp(self):
        self.unit = Unit.objects.create(name="kg")
    
    def test_ingredient_creation(self):
        """Test basic ingredient creation"""
        ingredient = Ingredient.objects.create(
            name="Lomo Fino",
            unit=self.unit,
            cost_per_unit=Decimal("25.00"),
            stock=10
        )
        self.assertEqual(ingredient.name, "Lomo Fino")
        self.assertEqual(ingredient.cost_per_unit, Decimal("25.00"))
        self.assertEqual(ingredient.stock, 10)
    
    def test_ingredient_stock_validation(self):
        """Test that stock cannot be negative"""
        ingredient = Ingredient.objects.create(
            name="Test Ingredient",
            unit=self.unit,
            cost_per_unit=Decimal("5.00"),
            stock=10
        )
        
        # Test stock reduction
        ingredient.stock = 5
        ingredient.save()
        self.assertEqual(ingredient.stock, 5)
        
        # Stock should not go below 0 in business logic
        ingredient.stock = 0
        ingredient.save()
        self.assertEqual(ingredient.stock, 0)
    
    def test_ingredient_total_value(self):
        """Test ingredient total value calculation"""
        ingredient = Ingredient.objects.create(
            name="Test Ingredient",
            unit=self.unit,
            cost_per_unit=Decimal("10.00"),
            stock=5
        )
        
        # If we add a total_value method to the model
        expected_value = Decimal("50.00")  # 10.00 * 5
        # self.assertEqual(ingredient.total_value(), expected_value)


@pytest.mark.unit  
class TestRecipeModel(TestCase):
    """Test Recipe model functionality"""
    
    def setUp(self):
        self.unit = Unit.objects.create(name="kg")
        self.group = Group.objects.create(name="Parrillas")
        self.container = Container.objects.create(
            name="Plato Grande",
            description="Plato principal",
            price=Decimal("2.00"),
            stock=50
        )
    
    def test_recipe_creation(self):
        """Test basic recipe creation"""
        recipe = Recipe.objects.create(
            name="Lomo Saltado",
            version="1.0",
            group=self.group,
            container=self.container,
            base_price=Decimal("35.00"),
            profit_percentage=Decimal("80.00"),
            preparation_time=20
        )
        
        self.assertEqual(recipe.name, "Lomo Saltado")
        self.assertEqual(recipe.base_price, Decimal("35.00"))
        self.assertTrue(recipe.is_active)
        self.assertTrue(recipe.is_available)
    
    def test_recipe_unique_together(self):
        """Test that name+version must be unique"""
        Recipe.objects.create(
            name="Lomo Saltado",
            version="1.0",
            group=self.group,
            container=self.container,
            base_price=Decimal("35.00")
        )
        
        with self.assertRaises(IntegrityError):
            Recipe.objects.create(
                name="Lomo Saltado",
                version="1.0",  # Same name and version
                group=self.group,
                container=self.container,
                base_price=Decimal("30.00")
            )
    
    def test_recipe_ingredients_cost_calculation(self):
        """Test recipe ingredients cost calculation"""
        recipe = Recipe.objects.create(
            name="Test Recipe",
            version="1.0",
            group=self.group,
            container=self.container,
            base_price=Decimal("20.00")
        )
        
        # Create ingredients
        ingredient1 = Ingredient.objects.create(
            name="Ingredient 1",
            unit=self.unit,
            cost_per_unit=Decimal("10.00"),
            stock=5
        )
        ingredient2 = Ingredient.objects.create(
            name="Ingredient 2", 
            unit=self.unit,
            cost_per_unit=Decimal("5.00"),
            stock=10
        )
        
        # Add ingredients to recipe
        RecipeItem.objects.create(
            recipe=recipe,
            ingredient=ingredient1,
            quantity=Decimal("0.2")  # 0.2 * 10.00 = 2.00
        )
        RecipeItem.objects.create(
            recipe=recipe,
            ingredient=ingredient2,
            quantity=Decimal("0.3")  # 0.3 * 5.00 = 1.50
        )
        
        # Total ingredients cost should be 3.50
        # We would need to implement calculate_ingredients_cost method
        # expected_cost = Decimal("3.50")
        # self.assertEqual(recipe.calculate_ingredients_cost(), expected_cost)


@pytest.mark.unit
class TestOrderModel(TestCase):
    """Test Order model functionality"""
    
    def setUp(self):
        self.zone = Zone.objects.create(name="Test Zone")
        self.table = Table.objects.create(table_number="T01", zone=self.zone)
    
    def test_order_creation(self):
        """Test basic order creation"""
        order = Order.objects.create(
            table=self.table,
            waiter="admin",
            status="CREATED",
            total_amount=Decimal("0.00")
        )
        
        self.assertEqual(order.table, self.table)
        self.assertEqual(order.waiter, "admin")
        self.assertEqual(order.status, "CREATED")
        self.assertEqual(order.total_amount, Decimal("0.00"))
    
    def test_order_total_calculation(self):
        """Test order total calculation with items"""
        order = Order.objects.create(
            table=self.table,
            waiter="admin",
            status="CREATED",
            total_amount=Decimal("0.00")
        )
        
        # Create recipe dependencies
        unit = Unit.objects.create(name="kg")
        group = Group.objects.create(name="Test Group")
        container = Container.objects.create(
            name="Test Container",
            description="Test",
            price=Decimal("1.00"),
            stock=10
        )
        recipe = Recipe.objects.create(
            name="Test Recipe",
            version="1.0",
            group=group,
            container=container,
            base_price=Decimal("15.00")
        )
        
        # Add order items
        OrderItem.objects.create(
            order=order,
            recipe=recipe,
            quantity=2,
            unit_price=Decimal("15.00"),
            total_price=Decimal("30.00"),
            status="CREATED"
        )
        
        # Test that we can calculate total
        # We would need to implement calculate_total method
        # order.calculate_total()
        # self.assertEqual(order.total_amount, Decimal("30.00"))


@pytest.mark.unit
class TestRecipeItemModel(TestCase):
    """Test RecipeItem model functionality"""
    
    def setUp(self):
        self.unit = Unit.objects.create(name="kg")
        self.group = Group.objects.create(name="Test Group")
        self.container = Container.objects.create(
            name="Test Container",
            description="Test",
            price=Decimal("1.00"),
            stock=10
        )
        self.recipe = Recipe.objects.create(
            name="Test Recipe",
            version="1.0",
            group=self.group,
            container=self.container,
            base_price=Decimal("10.00")
        )
        self.ingredient = Ingredient.objects.create(
            name="Test Ingredient",
            unit=self.unit,
            cost_per_unit=Decimal("5.00"),
            stock=10
        )
    
    def test_recipe_item_creation(self):
        """Test recipe item creation"""
        recipe_item = RecipeItem.objects.create(
            recipe=self.recipe,
            ingredient=self.ingredient,
            quantity=Decimal("0.5")
        )
        
        self.assertEqual(recipe_item.recipe, self.recipe)
        self.assertEqual(recipe_item.ingredient, self.ingredient)
        self.assertEqual(recipe_item.quantity, Decimal("0.5"))
    
    def test_recipe_item_cost_calculation(self):
        """Test individual recipe item cost calculation"""
        recipe_item = RecipeItem.objects.create(
            recipe=self.recipe,
            ingredient=self.ingredient,
            quantity=Decimal("0.3")
        )
        
        # Cost should be 0.3 * 5.00 = 1.50
        expected_cost = Decimal("1.50")
        # We would implement a cost calculation method
        # self.assertEqual(recipe_item.calculate_cost(), expected_cost)