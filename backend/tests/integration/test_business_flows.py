"""
Integration Tests for Business Flows
Testing complete restaurant operation workflows
"""
import pytest
from decimal import Decimal
from django.test import TestCase
from django.db import transaction

from config.models import Unit, Zone, Table, Container
from inventory.models import Group, Ingredient, Recipe, RecipeItem
from operation.models import Order, OrderItem, Payment, PaymentItem


@pytest.mark.integration
class TestRestaurantOperationFlow(TestCase):
    """Test complete restaurant operation workflows"""
    
    def setUp(self):
        """Set up complete test environment"""
        # Create basic configuration
        self.unit_kg = Unit.objects.create(name="kg")
        self.unit_portions = Unit.objects.create(name="porciones")
        
        self.zone = Zone.objects.create(name="Salón Principal")
        self.table = Table.objects.create(table_number="T01", zone=self.zone)
        
        self.container = Container.objects.create(
            name="Plato Grande",
            description="Plato para comidas principales",
            price=Decimal("2.00"),
            stock=50
        )
        
        self.group = Group.objects.create(name="Parrillas")
        
        # Create ingredients
        self.beef = Ingredient.objects.create(
            name="Lomo Fino",
            unit=self.unit_kg,
            cost_per_unit=Decimal("25.00"),
            stock=10
        )
        
        self.potatoes = Ingredient.objects.create(
            name="Papas",
            unit=self.unit_kg,
            cost_per_unit=Decimal("3.00"),
            stock=20
        )
        
        # Create recipe with ingredients
        self.recipe = Recipe.objects.create(
            name="Lomo Saltado",
            version="1.0",
            group=self.group,
            container=self.container,
            base_price=Decimal("35.00"),
            profit_percentage=Decimal("80.00"),
            preparation_time=20
        )
        
        # Add ingredients to recipe
        RecipeItem.objects.create(
            recipe=self.recipe,
            ingredient=self.beef,
            quantity=Decimal("0.3")  # 300g of beef
        )
        
        RecipeItem.objects.create(
            recipe=self.recipe,
            ingredient=self.potatoes,
            quantity=Decimal("0.2")  # 200g of potatoes
        )
    
    def test_complete_order_flow(self):
        """Test complete order flow from creation to payment"""
        
        # Step 1: Create order
        order = Order.objects.create(
            table=self.table,
            waiter="admin",
            status="CREATED",
            total_amount=Decimal("0.00")
        )
        
        self.assertEqual(order.status, "CREATED")
        self.assertEqual(order.total_amount, Decimal("0.00"))
        
        # Step 2: Add items to order
        order_item = OrderItem.objects.create(
            order=order,
            recipe=self.recipe,
            quantity=2,  # Order 2 lomo saltados
            unit_price=self.recipe.base_price,
            total_price=self.recipe.base_price * 2,
            status="CREATED",
            notes="Extra spicy"
        )
        
        self.assertEqual(order_item.quantity, 2)
        self.assertEqual(order_item.total_price, Decimal("70.00"))
        
        # Step 3: Calculate order total
        # In a real implementation, this would be done automatically
        order.total_amount = order_item.total_price
        order.save()
        
        self.assertEqual(order.total_amount, Decimal("70.00"))
        
        # Step 4: Update order status to IN_KITCHEN
        order.status = "IN_KITCHEN"
        order_item.status = "IN_KITCHEN"
        order.save()
        order_item.save()
        
        self.assertEqual(order.status, "IN_KITCHEN")
        self.assertEqual(order_item.status, "IN_KITCHEN")
        
        # Step 5: Complete order
        order.status = "READY"
        order_item.status = "READY"
        order.save()
        order_item.save()
        
        self.assertEqual(order.status, "READY")
        
        # Step 6: Process payment
        payment = Payment.objects.create(
            order=order,
            amount=order.total_amount,
            payment_method="CASH",
            status="COMPLETED"
        )
        
        # Create payment item
        PaymentItem.objects.create(
            payment=payment,
            order_item=order_item,
            amount=order_item.total_price
        )
        
        self.assertEqual(payment.amount, Decimal("70.00"))
        self.assertEqual(payment.status, "COMPLETED")
        
        # Step 7: Mark order as paid
        order.status = "PAID"
        order.save()
        
        self.assertEqual(order.status, "PAID")
        
        # Verify complete flow
        final_order = Order.objects.get(id=order.id)
        self.assertEqual(final_order.status, "PAID")
        self.assertEqual(final_order.orderitem_set.count(), 1)
        self.assertEqual(final_order.payment_set.count(), 1)
    
    def test_multiple_items_order_flow(self):
        """Test order with multiple different items"""
        
        # Create another recipe
        recipe2 = Recipe.objects.create(
            name="Pollo a la Brasa",
            version="1.0",
            group=self.group,
            container=self.container,
            base_price=Decimal("28.00"),
            profit_percentage=Decimal("75.00")
        )
        
        # Create order
        order = Order.objects.create(
            table=self.table,
            waiter="mesero01",
            status="CREATED",
            total_amount=Decimal("0.00")
        )
        
        # Add multiple items
        item1 = OrderItem.objects.create(
            order=order,
            recipe=self.recipe,
            quantity=1,
            unit_price=self.recipe.base_price,
            total_price=self.recipe.base_price,
            status="CREATED"
        )
        
        item2 = OrderItem.objects.create(
            order=order,
            recipe=recipe2,
            quantity=2,
            unit_price=recipe2.base_price,
            total_price=recipe2.base_price * 2,
            status="CREATED"
        )
        
        # Calculate total
        expected_total = item1.total_price + item2.total_price
        order.total_amount = expected_total
        order.save()
        
        self.assertEqual(order.total_amount, Decimal("91.00"))  # 35 + 56
        self.assertEqual(order.orderitem_set.count(), 2)
    
    def test_split_payment_flow(self):
        """Test order with split payment"""
        
        # Create order with items
        order = Order.objects.create(
            table=self.table,
            waiter="admin",
            status="READY",
            total_amount=Decimal("70.00")
        )
        
        order_item = OrderItem.objects.create(
            order=order,
            recipe=self.recipe,
            quantity=2,
            unit_price=self.recipe.base_price,
            total_price=Decimal("70.00"),
            status="READY"
        )
        
        # Split payment: 40 cash + 30 card
        payment1 = Payment.objects.create(
            order=order,
            amount=Decimal("40.00"),
            payment_method="CASH",
            status="COMPLETED"
        )
        
        payment2 = Payment.objects.create(
            order=order,
            amount=Decimal("30.00"),
            payment_method="CARD",
            status="COMPLETED"
        )
        
        # Create payment items
        PaymentItem.objects.create(
            payment=payment1,
            order_item=order_item,
            amount=Decimal("40.00")
        )
        
        PaymentItem.objects.create(
            payment=payment2,
            order_item=order_item,
            amount=Decimal("30.00")
        )
        
        # Verify split payment
        total_paid = sum(p.amount for p in order.payment_set.all())
        self.assertEqual(total_paid, order.total_amount)
        self.assertEqual(order.payment_set.count(), 2)
    
    def test_ingredient_stock_management(self):
        """Test ingredient stock is properly managed during orders"""
        
        # Check initial stock
        initial_beef_stock = self.beef.stock
        initial_potato_stock = self.potatoes.stock
        
        # Create order that consumes ingredients
        order = Order.objects.create(
            table=self.table,
            waiter="admin",
            status="CREATED",
            total_amount=Decimal("0.00")
        )
        
        order_item = OrderItem.objects.create(
            order=order,
            recipe=self.recipe,
            quantity=3,  # Order 3 portions
            unit_price=self.recipe.base_price,
            total_price=self.recipe.base_price * 3,
            status="CREATED"
        )
        
        # In a real implementation, this would happen automatically
        # when the order moves to "IN_KITCHEN" status
        
        # Simulate ingredient consumption
        beef_consumed = RecipeItem.objects.get(
            recipe=self.recipe, ingredient=self.beef
        ).quantity * order_item.quantity
        
        potato_consumed = RecipeItem.objects.get(
            recipe=self.recipe, ingredient=self.potatoes
        ).quantity * order_item.quantity
        
        # Update stock (this would be automated in real implementation)
        self.beef.stock -= beef_consumed
        self.potatoes.stock -= potato_consumed
        self.beef.save()
        self.potatoes.save()
        
        # Verify stock reduction
        expected_beef_stock = initial_beef_stock - (Decimal("0.3") * 3)
        expected_potato_stock = initial_potato_stock - (Decimal("0.2") * 3)
        
        self.assertEqual(self.beef.stock, expected_beef_stock)
        self.assertEqual(self.potatoes.stock, expected_potato_stock)
    
    def test_recipe_availability_check(self):
        """Test recipe availability based on ingredient stock"""
        
        # Reduce beef stock to very low
        self.beef.stock = Decimal("0.1")  # Only 100g left
        self.beef.save()
        
        # Recipe needs 0.3kg per portion, so should not be available
        # for more than 0 portions (0.1 / 0.3 = 0.33, rounded down = 0)
        
        # In a real implementation, we would have a method like:
        # available_portions = self.recipe.check_available_portions()
        # self.assertEqual(available_portions, 0)
        
        # Or a simple availability check:
        # self.assertFalse(self.recipe.is_available_for_quantity(1))
        
        # For now, we can manually calculate
        beef_recipe_item = RecipeItem.objects.get(
            recipe=self.recipe, ingredient=self.beef
        )
        max_portions = int(self.beef.stock / beef_recipe_item.quantity)
        self.assertEqual(max_portions, 0)


@pytest.mark.integration  
class TestTableManagement(TestCase):
    """Test table management workflows"""
    
    def setUp(self):
        """Set up table test environment"""
        self.zone = Zone.objects.create(name="Salón Principal")
        self.table1 = Table.objects.create(table_number="T01", zone=self.zone)
        self.table2 = Table.objects.create(table_number="T02", zone=self.zone)
    
    def test_table_status_workflow(self):
        """Test table status changes during service"""
        
        # Initially, tables should be available
        # In a real implementation, tables might have a status field
        
        # Create order for table (occupies it)
        order = Order.objects.create(
            table=self.table1,
            waiter="admin",
            status="CREATED",
            total_amount=Decimal("0.00")
        )
        
        # Table should now be occupied
        active_orders_count = Order.objects.filter(
            table=self.table1,
            status__in=["CREATED", "IN_KITCHEN", "READY"]
        ).count()
        
        self.assertEqual(active_orders_count, 1)
        
        # Complete and pay order
        order.status = "PAID"
        order.save()
        
        # Table should now be available again
        active_orders_count = Order.objects.filter(
            table=self.table1,
            status__in=["CREATED", "IN_KITCHEN", "READY"]
        ).count()
        
        self.assertEqual(active_orders_count, 0)