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
# Printer management imports
from operation.views_printer_config import PrinterConfigViewSet

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
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'container-sales', ContainerSaleViewSet, basename='containersale')
router.register(r'dashboard-financiero', DashboardFinancieroViewSet, basename='dashboard-financiero')
router.register(r'dashboard-operativo', DashboardOperativoViewSet, basename='dashboard-operativo')

# Printer management routes
router.register(r'printer-config', PrinterConfigViewSet, basename='printer-config')

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
    """Scan available USB ports for printers directly on the local system"""
    import os
    import glob
    import subprocess

    available_ports = []

    try:
        # Scan for USB printer devices
        # Common USB printer device patterns
        patterns = [
            '/dev/usb/lp*',    # USB printers
            '/dev/ttyUSB*',    # USB serial devices
            '/dev/lp*',        # Parallel/USB printers
        ]

        for pattern in patterns:
            ports = glob.glob(pattern)
            for port in ports:
                # Check if the device exists and is accessible
                if os.path.exists(port):
                    try:
                        # Check if we can access the device
                        os.stat(port)
                        available_ports.append(port)
                    except (OSError, PermissionError):
                        # Device exists but we don't have permission
                        pass

        # Try to get more info using lsusb if available
        additional_info = []
        try:
            result = subprocess.run(['lsusb'], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                for line in lines:
                    if 'printer' in line.lower() or 'print' in line.lower():
                        additional_info.append(line)
        except (subprocess.SubprocessError, FileNotFoundError):
            pass

        # If no ports found, provide common fallback ports
        if not available_ports:
            fallback_ports = ['/dev/usb/lp0', '/dev/usb/lp1', '/dev/ttyUSB0', '/dev/ttyUSB1', '/dev/lp0']
            # Check which fallback ports actually exist
            for port in fallback_ports:
                if os.path.exists(port):
                    available_ports.append(port)

            if not available_ports:
                # If still no ports, return the fallback list anyway
                available_ports = fallback_ports
                message = 'No USB devices detected, showing common port options'
            else:
                message = f'Found {len(available_ports)} USB device(s)'
        else:
            message = f'Successfully scanned {len(available_ports)} USB port(s)'

        return Response({
            'available_ports': sorted(list(set(available_ports))),  # Remove duplicates and sort
            'message': message,
            'total_found': len(available_ports),
            'rpi_status': 'local_scan',
            'additional_info': additional_info if additional_info else None
        }, status=status.HTTP_200_OK)

    except Exception as e:
        # If scanning fails, return common ports as fallback
        fallback_ports = ['/dev/usb/lp0', '/dev/usb/lp1', '/dev/ttyUSB0', '/dev/ttyUSB1', '/dev/lp0']
        return Response({
            'available_ports': fallback_ports,
            'message': f'Error scanning ports: {str(e)}, showing common options',
            'total_found': len(fallback_ports),
            'rpi_status': 'error',
            'error': str(e)
        }, status=status.HTTP_200_OK)

urlpatterns = [
    # Health check endpoint
    path('health/', health_check, name='health-check'),
    # CSRF endpoint for frontend
    path('csrf/', get_csrf_token, name='csrf-token'),
    # Authentication endpoints
    path('auth/', include('backend.auth_urls')),
    # REMOVIDO: SSE endpoints - Era específico para kitchen views
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