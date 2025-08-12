"""
API Integration Tests for Restaurant Backend
Testing all API endpoints for proper functionality
"""
import pytest
import json
from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status

from config.models import Unit, Zone, Table, Container
from inventory.models import Group, Ingredient, Recipe, RecipeItem
from operation.models import Order, OrderItem


@pytest.mark.api
class TestConfigAPIEndpoints(APITestCase):
    """Test Configuration API endpoints"""
    
    def setUp(self):
        """Set up test data"""
        self.client = APIClient()
        
    def test_units_list_endpoint(self):
        """Test GET /api/v1/units/"""
        # Create test data
        Unit.objects.create(name="kg")
        Unit.objects.create(name="litros")
        
        url = reverse('unit-list')  # Assuming DRF router naming
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Assuming paginated response
        if 'results' in response.data:
            self.assertEqual(len(response.data['results']), 2)
        else:
            self.assertEqual(len(response.data), 2)
    
    def test_units_create_endpoint(self):
        """Test POST /api/v1/units/"""
        url = reverse('unit-list')
        data = {'name': 'porciones'}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Unit.objects.count(), 1)
        self.assertEqual(Unit.objects.first().name, 'porciones')
    
    def test_zones_list_endpoint(self):
        """Test GET /api/v1/zones/"""
        # Create test data
        Zone.objects.create(name="Salón Principal")
        Zone.objects.create(name="Terraza")
        
        url = reverse('zone-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Check response structure
        if 'results' in response.data:
            self.assertEqual(len(response.data['results']), 2)
        else:
            self.assertEqual(len(response.data), 2)
    
    def test_tables_list_endpoint(self):
        """Test GET /api/v1/tables/"""
        # Create test data
        zone = Zone.objects.create(name="Test Zone")
        Table.objects.create(table_number="T01", zone=zone)
        Table.objects.create(table_number="T02", zone=zone)
        
        url = reverse('table-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Check that tables are returned
        if 'results' in response.data:
            self.assertGreaterEqual(len(response.data['results']), 2)
        else:
            self.assertGreaterEqual(len(response.data), 2)
    
    def test_containers_list_endpoint(self):
        """Test GET /api/v1/containers/"""
        # Create test data
        Container.objects.create(
            name="Plato Grande",
            description="Plato principal",
            price=Decimal("2.00"),
            stock=50
        )
        
        url = reverse('container-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)


@pytest.mark.api
class TestInventoryAPIEndpoints(APITestCase):
    """Test Inventory API endpoints"""
    
    def setUp(self):
        """Set up test data"""
        self.client = APIClient()
        self.unit = Unit.objects.create(name="kg")
        self.group = Group.objects.create(name="Parrillas")
        self.container = Container.objects.create(
            name="Plato Grande",
            description="Plato principal",
            price=Decimal("2.00"),
            stock=50
        )
    
    def test_groups_list_endpoint(self):
        """Test GET /api/v1/groups/"""
        # Create additional test data
        Group.objects.create(name="Bebidas")
        
        url = reverse('group-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Check that groups are returned
        if 'results' in response.data:
            self.assertGreaterEqual(len(response.data['results']), 2)
        else:
            self.assertGreaterEqual(len(response.data), 2)
    
    def test_ingredients_list_endpoint(self):
        """Test GET /api/v1/ingredients/"""
        # Create test data
        Ingredient.objects.create(
            name="Lomo Fino",
            unit=self.unit,
            cost_per_unit=Decimal("25.00"),
            stock=10
        )
        
        url = reverse('ingredient-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_ingredients_create_endpoint(self):
        """Test POST /api/v1/ingredients/"""
        url = reverse('ingredient-list')
        data = {
            'name': 'Pollo',
            'unit': self.unit.id,
            'cost_per_unit': '15.00',
            'stock': 5
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Ingredient.objects.count(), 1)
        self.assertEqual(Ingredient.objects.first().name, 'Pollo')
    
    def test_recipes_list_endpoint(self):
        """Test GET /api/v1/recipes/"""
        # Create test data
        recipe = Recipe.objects.create(
            name="Lomo Saltado",
            version="1.0",
            group=self.group,
            container=self.container,
            base_price=Decimal("35.00"),
            profit_percentage=Decimal("80.00")
        )
        
        url = reverse('recipe-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Check that recipe is in response
        if 'results' in response.data:
            self.assertGreaterEqual(len(response.data['results']), 1)
        else:
            self.assertGreaterEqual(len(response.data), 1)
    
    def test_recipes_create_endpoint(self):
        """Test POST /api/v1/recipes/"""
        url = reverse('recipe-list')
        data = {
            'name': 'Pollo a la Brasa',
            'version': '1.0',
            'group': self.group.id,
            'container': self.container.id,
            'base_price': '28.00',
            'profit_percentage': '75.00',
            'preparation_time': 25
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Recipe.objects.count(), 1)
        self.assertEqual(Recipe.objects.first().name, 'Pollo a la Brasa')


@pytest.mark.api
class TestOperationAPIEndpoints(APITestCase):
    """Test Operation API endpoints"""
    
    def setUp(self):
        """Set up test data"""
        self.client = APIClient()
        
        # Create dependencies
        self.unit = Unit.objects.create(name="kg")
        self.zone = Zone.objects.create(name="Test Zone")
        self.table = Table.objects.create(table_number="T01", zone=self.zone)
        self.group = Group.objects.create(name="Parrillas")
        self.container = Container.objects.create(
            name="Plato Grande",
            description="Plato principal",
            price=Decimal("2.00"),
            stock=50
        )
        self.recipe = Recipe.objects.create(
            name="Test Recipe",
            version="1.0",
            group=self.group,
            container=self.container,
            base_price=Decimal("20.00")
        )
    
    def test_orders_list_endpoint(self):
        """Test GET /api/v1/orders/"""
        # Create test data
        Order.objects.create(
            table=self.table,
            waiter="admin",
            status="CREATED",
            total_amount=Decimal("0.00")
        )
        
        url = reverse('order-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Check that order is in response
        if 'results' in response.data:
            self.assertGreaterEqual(len(response.data['results']), 1)
        else:
            self.assertGreaterEqual(len(response.data), 1)
    
    def test_orders_create_endpoint(self):
        """Test POST /api/v1/orders/"""
        url = reverse('order-list')
        data = {
            'table': self.table.id,
            'waiter': 'test_waiter',
            'status': 'CREATED',
            'total_amount': '0.00'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(Order.objects.first().waiter, 'test_waiter')


@pytest.mark.api
class TestHealthCheckEndpoint(APITestCase):
    """Test system health check endpoint"""
    
    def test_health_check_endpoint(self):
        """Test GET /api/v1/health/"""
        # This endpoint should work without authentication
        response = self.client.get('/api/v1/health/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('status', response.data)
        self.assertEqual(response.data['status'], 'ok')


@pytest.mark.api
class TestErrorHandling(APITestCase):
    """Test API error handling"""
    
    def test_404_for_nonexistent_endpoint(self):
        """Test that non-existent endpoints return 404"""
        response = self.client.get('/api/v1/nonexistent/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_invalid_data_validation(self):
        """Test validation errors for invalid data"""
        url = reverse('unit-list')
        data = {'name': ''}  # Empty name should be invalid
        
        response = self.client.post(url, data, format='json')
        
        # Should return 400 Bad Request for validation errors
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_method_not_allowed(self):
        """Test method not allowed responses"""
        # Try PATCH on health endpoint which should only support GET
        response = self.client.patch('/api/v1/health/')
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)