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
import os
from django.utils import timezone

# Import ViewSets
from config.views import UnitViewSet, ZoneViewSet, TableViewSet, ContainerViewSet, operational_info
from config.models import Unit
# Debug views removed - not needed for simplified setup
from inventory.views import GroupViewSet, IngredientViewSet, RecipeViewSet, RecipeItemViewSet
from operation.views import (
    OrderViewSet, OrderItemViewSet, PaymentViewSet, ContainerSaleViewSet
    # OrderItemIngredientViewSet removed - functionality deprecated
)
from operation.views_financiero import DashboardFinancieroViewSet
from operation.views_operativo import DashboardOperativoViewSet
from operation.sse_views import order_updates_stream

# Printer management imports
from operation.views_printer_config import PrinterConfigViewSet
from operation.views_printer_queue import PrintQueueViewSet

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
router.register(r'dashboard-financiero', DashboardFinancieroViewSet, basename='dashboard-financiero')
router.register(r'dashboard-operativo', DashboardOperativoViewSet, basename='dashboard-operativo')

# Printer management routes
router.register(r'printer-config', PrinterConfigViewSet, basename='printer-config')
router.register(r'print-queue', PrintQueueViewSet, basename='print-queue')

# ELIMINADO: Cart routes
# Sistema Cart eliminado para simplificar operaciones

# Test import function
@api_view(['GET', 'POST'])
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

@api_view(['GET'])
@permission_classes([AllowAny])  # Health check should be public
def health_check(request):
    """Health check endpoint for Docker containers"""
    try:
        # Basic health checks
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        
        return Response({
            'status': 'healthy',
            'database': 'connected',
            'environment': os.getenv('ENVIRONMENT', 'development'),
            'cognito': 'enabled' if os.getenv('COGNITO_USER_POOL_ID') else 'missing_config',
            'timestamp': timezone.now().isoformat()
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': timezone.now().isoformat()
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

@api_view(['GET'])
@permission_classes([AllowAny])  # Allow public access for development
def rpi_scan_ports(request):
    """Scan available USB ports for printers from RPi4"""
    import requests
    
    # RPi4 HTTP server URL
    RPI4_BASE_URL = os.getenv('RPI4_HTTP_URL', 'http://raspberrypi.local:3001')
    
    try:
        # Make HTTP request to RPi4 to scan ports
        response = requests.post(f'{RPI4_BASE_URL}/scan', 
                                json={}, 
                                headers={'Content-Type': 'application/json'}, 
                                timeout=10)
        
        if response.status_code == 200:
            rpi_data = response.json()
            active_ports = rpi_data.get('active_ports', [])
            return Response({
                'available_ports': active_ports,
                'message': f'Scanned {len(active_ports)} ports from RPi4 at {RPI4_BASE_URL}',
                'total_found': len(active_ports),
                'rpi_status': 'connected'
            }, status=status.HTTP_200_OK)
        else:
            # RPi4 responded but with error
            return Response({
                'available_ports': [],
                'message': f'RPi4 error: HTTP {response.status_code}',
                'total_found': 0,
                'rpi_status': 'error',
                'error': f'RPi4 returned status {response.status_code}'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            
    except requests.exceptions.ConnectionError:
        # RPi4 not reachable - return fallback
        fallback_ports = ['/dev/usb/lp0', '/dev/usb/lp1', '/dev/ttyUSB0', '/dev/ttyUSB1']
        return Response({
            'available_ports': fallback_ports,
            'message': f'RPi4 not reachable at {RPI4_BASE_URL}, using fallback ports',
            'total_found': len(fallback_ports),
            'rpi_status': 'unreachable'
        }, status=status.HTTP_200_OK)
        
    except requests.exceptions.Timeout:
        # RPi4 timeout
        return Response({
            'available_ports': [],
            'message': f'RPi4 timeout at {RPI4_BASE_URL}',
            'total_found': 0,
            'rpi_status': 'timeout'
        }, status=status.HTTP_408_REQUEST_TIMEOUT)
        
    except Exception as e:
        # Other errors
        return Response({
            'available_ports': [],
            'message': f'Error scanning RPi4: {str(e)}',
            'total_found': 0,
            'rpi_status': 'error',
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

urlpatterns = [
    # Health check endpoint
    path('health/', health_check, name='health-check'),
    # CSRF endpoint for frontend
    path('csrf/', get_csrf_token, name='csrf-token'),
    # Server-Sent Events endpoints
    path('sse/orders/', order_updates_stream, name='sse-orders'),
    # Import endpoints FIRST to avoid router conflicts
    path('import/units/', import_units_excel, name='import-units-excel'),
    path('restaurant-config/operational_info/', operational_info, name='operational-info'),
    
    path('rpi-scan-ports/', rpi_scan_ports, name='rpi-scan-ports'),
    
    # Debug endpoints removed for simplified setup
    path('schema/', SpectacularAPIView.as_view(), name='schema'),
    path('docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    # Router patterns LAST
    path('', include(router.urls)),
]