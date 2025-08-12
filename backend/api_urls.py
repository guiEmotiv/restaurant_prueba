from rest_framework.routers import DefaultRouter
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
import pandas as pd

# Import ViewSets
from config.views import UnitViewSet, ZoneViewSet, TableViewSet, ContainerViewSet, operational_info
from config.models import Unit
from config.views_debug import database_debug, api_debug
from inventory.views import GroupViewSet, IngredientViewSet, RecipeViewSet, RecipeItemViewSet
from operation.views import (
    OrderViewSet, OrderItemViewSet, OrderItemIngredientViewSet, PaymentViewSet, ContainerSaleViewSet
)
from operation.views_dashboard import DashboardViewSet

# Create router and register viewsets
router = DefaultRouter()

# Config app routes
router.register(r'units', UnitViewSet, basename='unit')
router.register(r'zones', ZoneViewSet, basename='zone')
router.register(r'tables', TableViewSet, basename='table')
router.register(r'containers', ContainerViewSet, basename='container')

# Inventory app routes
router.register(r'groups', GroupViewSet, basename='group')
router.register(r'ingredients', IngredientViewSet, basename='ingredient')
router.register(r'recipes', RecipeViewSet, basename='recipe')
router.register(r'recipe-items', RecipeItemViewSet, basename='recipeitem')

# Operation app routes
router.register(r'orders', OrderViewSet, basename='order')
router.register(r'order-items', OrderItemViewSet, basename='orderitem')
router.register(r'order-item-ingredients', OrderItemIngredientViewSet, basename='orderitemingredient')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'container-sales', ContainerSaleViewSet, basename='containersale')
router.register(r'dashboard', DashboardViewSet, basename='dashboard')

# ELIMINADO: Cart routes
# Sistema Cart eliminado para simplificar operaciones

# Test import function
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def import_units_excel(request):
    """Test import endpoint"""
    if request.method == 'GET':
        return Response({'status': 'Import endpoint is working', 'method': 'GET'})
    
    return Response({'status': 'Import endpoint is working', 'method': 'POST', 'files': list(request.FILES.keys())})

urlpatterns = [
    # Import endpoints FIRST to avoid router conflicts
    path('import/units/', import_units_excel, name='import-units-excel'),
    path('restaurant-config/operational_info/', operational_info, name='operational-info'),
    path('debug/database/', database_debug, name='database-debug'),
    path('debug/api/', api_debug, name='api-debug'),
    path('schema/', SpectacularAPIView.as_view(), name='schema'),
    path('docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    # Router patterns LAST
    path('', include(router.urls)),
]