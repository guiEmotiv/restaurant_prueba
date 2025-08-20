from rest_framework.routers import DefaultRouter
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
import pandas as pd

# Import ViewSets
from config.views import UnitViewSet, ZoneViewSet, TableViewSet, ContainerViewSet, operational_info
from config.models import Unit
# Debug views removed - not needed for simplified setup
from inventory.views import GroupViewSet, IngredientViewSet, RecipeViewSet, RecipeItemViewSet
from operation.views import (
    OrderViewSet, OrderItemViewSet, PaymentViewSet, ContainerSaleViewSet
    # OrderItemIngredientViewSet removed - functionality deprecated
)
from operation.views_dashboard import DashboardViewSet
from operation.sse_views import order_updates_stream, kitchen_updates_stream

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
# router.register(r'order-item-ingredients', OrderItemIngredientViewSet, basename='orderitemingredient')  # Removed - functionality deprecated
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

@require_http_methods(["GET"])
@ensure_csrf_cookie
def get_csrf_token(request):
    """Get CSRF token for frontend - Django view (no DRF auth)"""
    return JsonResponse({'csrfToken': get_token(request)})

urlpatterns = [
    # CSRF endpoint for frontend
    path('csrf/', get_csrf_token, name='csrf-token'),
    # Server-Sent Events endpoints
    path('sse/orders/', order_updates_stream, name='sse-orders'),
    path('sse/kitchen/', kitchen_updates_stream, name='sse-kitchen'),
    # Import endpoints FIRST to avoid router conflicts
    path('import/units/', import_units_excel, name='import-units-excel'),
    path('restaurant-config/operational_info/', operational_info, name='operational-info'),
    # Debug endpoints removed for simplified setup
    path('schema/', SpectacularAPIView.as_view(), name='schema'),
    path('docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    # Router patterns LAST
    path('', include(router.urls)),
]