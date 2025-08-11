from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db import connection
from django.conf import settings
from datetime import datetime
import os

from .models import Unit, Zone, Table, Container
from inventory.models import Group, Ingredient, Recipe
from operation.models import Order, OrderItem

@api_view(['GET'])
@permission_classes([AllowAny])
def database_debug(request):
    """Debug endpoint to check database state"""
    
    try:
        # Database info
        db_config = settings.DATABASES['default']
        db_path = db_config['NAME']
        file_exists = os.path.exists(db_path)
        file_size = os.path.getsize(db_path) / 1024 if file_exists else 0
        
        # Test connection
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            connection_ok = True
        except Exception as e:
            connection_ok = False
            
        # Count records
        counts = {}
        sample_data = {}
        
        try:
            counts['units'] = Unit.objects.count()
            counts['zones'] = Zone.objects.count() 
            counts['tables'] = Table.objects.count()
            counts['containers'] = Container.objects.count()
            counts['groups'] = Group.objects.count()
            counts['ingredients'] = Ingredient.objects.count()
            counts['recipes'] = Recipe.objects.count()
            counts['orders'] = Order.objects.count()
            counts['order_items'] = OrderItem.objects.count()
            
            # Sample data
            sample_data['zones'] = [
                {
                    'id': zone.id,
                    'name': zone.name,
                    'tables_count': zone.table_set.count()
                }
                for zone in Zone.objects.all()[:5]
            ]
            
            sample_data['tables'] = [
                {
                    'id': table.id,
                    'table_number': table.table_number,
                    'zone_name': table.zone.name if table.zone else None,
                    'zone_id': table.zone.id if table.zone else None
                }
                for table in Table.objects.all()[:10]
            ]
            
            sample_data['recipes'] = [
                {
                    'id': recipe.id,
                    'name': recipe.name,
                    'price': float(recipe.base_price) if recipe.base_price else None,
                    'group_name': recipe.group.name if recipe.group else None,
                    'is_active': recipe.is_active,
                    'is_available': recipe.is_available
                }
                for recipe in Recipe.objects.all()[:10]
            ]
            
        except Exception as e:
            counts['error'] = str(e)
            
        return Response({
            'timestamp': str(datetime.now()),
            'database': {
                'engine': db_config['ENGINE'],
                'path': str(db_path),
                'file_exists': file_exists,
                'file_size_kb': round(file_size, 2),
                'connection_ok': connection_ok
            },
            'environment': {
                'settings_module': os.getenv('DJANGO_SETTINGS_MODULE'),
                'database_name': os.getenv('DATABASE_NAME'),
                'database_path': os.getenv('DATABASE_PATH'),
            },
            'data_counts': counts,
            'sample_data': sample_data,
            'status': 'ok' if connection_ok and sum(counts.values()) > 0 else 'needs_data'
        })
        
    except Exception as e:
        return Response({
            'error': str(e),
            'status': 'error'
        })


@api_view(['GET'])
@permission_classes([AllowAny])
def api_debug(request):
    """Debug endpoint to test API responses"""
    
    try:
        # Simulate the same calls the frontend makes
        from .serializers import ZoneSerializer, TableSerializer
        from inventory.serializers import GroupSerializer, RecipeSerializer
        
        zones = Zone.objects.all()
        tables = Table.objects.all()
        groups = Group.objects.all()
        recipes = Recipe.objects.all()
        
        zones_data = ZoneSerializer(zones, many=True).data
        tables_data = TableSerializer(tables, many=True).data
        groups_data = GroupSerializer(groups, many=True).data
        recipes_data = RecipeSerializer(recipes, many=True).data
        
        return Response({
            'api_test': 'success',
            'counts': {
                'zones': len(zones_data),
                'tables': len(tables_data), 
                'groups': len(groups_data),
                'recipes': len(recipes_data)
            },
            'zones': zones_data[:3],
            'tables': tables_data[:5],
            'groups': groups_data[:3],
            'recipes': recipes_data[:3]
        })
        
    except Exception as e:
        return Response({
            'api_test': 'error',
            'error': str(e)
        })