from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse, FileResponse, Http404, JsonResponse
from pathlib import Path
import mimetypes
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from django.db import connection
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
from django.middleware.csrf import get_token
import pandas as pd

@require_http_methods(["GET"])
@ensure_csrf_cookie
def get_csrf_token(request):
    """Get CSRF token for frontend - public endpoint"""
    return JsonResponse({'csrfToken': get_token(request)})

def index_view(request):
    """Serve React index.html for production"""
    try:
        with open(settings.BASE_DIR / 'frontend_static' / 'index.html', 'r') as f:
            response = HttpResponse(f.read(), content_type='text/html')
            # Add anti-cache headers for production
            response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response['Pragma'] = 'no-cache' 
            response['Expires'] = '0'
            return response
    except FileNotFoundError:
        return HttpResponse('Frontend not built yet. Build the React app first.', status=404)

def serve_frontend_asset(request, path):
    """Serve frontend assets (CSS, JS, etc.) - we know they're in staticfiles/assets"""
    static_asset_path = settings.STATIC_ROOT / 'assets' / path
    if static_asset_path.exists() and static_asset_path.is_file():
        content_type, _ = mimetypes.guess_type(str(static_asset_path))
        return FileResponse(open(static_asset_path, 'rb'), content_type=content_type)
    
    raise Http404(f"Asset not found at {static_asset_path}: {path}")

def serve_vite_svg(request):
    """Serve vite.svg - try multiple locations"""
    # Try frontend_static first
    svg_path = settings.BASE_DIR / 'frontend_static' / 'vite.svg'
    if svg_path.exists():
        return FileResponse(open(svg_path, 'rb'), content_type='image/svg+xml')
    
    # Try staticfiles
    static_svg_path = settings.STATIC_ROOT / 'vite.svg'
    if static_svg_path.exists():
        return FileResponse(open(static_svg_path, 'rb'), content_type='image/svg+xml')
    
    raise Http404("vite.svg not found")


def health_check(request):
    """Simple health check endpoint that doesn't require authentication"""
    return JsonResponse({
        'status': 'ok',
        'message': 'Restaurant API is running'
    })

def auth_debug(request):
    """Debug endpoint to check authentication status - no auth required"""
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    user_info = {
        'is_authenticated': hasattr(request, 'user') and request.user.is_authenticated,
        'user': str(request.user) if hasattr(request, 'user') else 'No user',
        'has_auth_header': bool(auth_header),
        'auth_header_prefix': auth_header[:20] + '...' if len(auth_header) > 20 else auth_header,
        'auth_header_length': len(auth_header),
    }
    
    if auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        token_segments = len(token.split('.'))
        user_info.update({
            'token_length': len(token),
            'token_segments': token_segments,
            'token_prefix': token[:30] + '...' if len(token) > 30 else token,
            'token_valid_format': token_segments == 3
        })
    
    return JsonResponse(user_info)

def create_optimized_import_function(model_class, table_name, required_columns, process_row_func=None, max_file_size_mb=10):
    """
    Optimized factory function to create Excel import functions for different models
    
    Features:
    - Enhanced error handling and logging
    - File size validation
    - Improved performance with bulk operations
    - Standardized response format
    - Better security validation
    """
    
    def import_excel_main(request):
        import logging
        import pandas as pd
        from django.http import JsonResponse
        from django.db import transaction, connection
        from decimal import InvalidOperation
        
        logger = logging.getLogger(__name__)
        
        # Validate HTTP method
        if request.method != 'POST':
            return JsonResponse({'error': 'Solo método POST permitido'}, status=405)
        
        try:
            # Validate file presence
            if 'file' not in request.FILES:
                return JsonResponse({'error': 'No se proporcionó ningún archivo'}, status=400)
            
            excel_file = request.FILES['file']
            
            # Validate file size
            max_size = max_file_size_mb * 1024 * 1024  # Convert to bytes
            if excel_file.size > max_size:
                return JsonResponse({
                    'error': f'Archivo demasiado grande. Máximo permitido: {max_file_size_mb}MB'
                }, status=400)
            
            # Validate Excel format
            file_ext = excel_file.name.lower().split('.')[-1]
            if file_ext not in ['xlsx', 'xls']:
                return JsonResponse({
                    'error': 'Formato no válido. Solo se aceptan archivos Excel (.xlsx o .xls)'
                }, status=400)
            
            # Read Excel file with error handling
            try:
                df = pd.read_excel(excel_file)
                logger.info(f'Excel file loaded successfully: {excel_file.name}, {len(df)} rows')
            except Exception as e:
                logger.error(f'Error reading Excel file {excel_file.name}: {str(e)}')
                return JsonResponse({'error': f'Error al leer el archivo Excel: {str(e)}'}, status=400)
            
            # Validate file structure
            if df.empty:
                return JsonResponse({'error': 'El archivo está vacío'}, status=400)
            
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                return JsonResponse({
                    'error': f'El archivo debe contener las columnas requeridas: {", ".join(missing_columns)}'
                }, status=400)
            
            # Process data with optimized transaction
            created_items = []
            errors = []
            deleted_count = 0
            
            with transaction.atomic():
                # Count existing items before deletion
                deleted_count = model_class.objects.count()
                logger.info(f'Deleting {deleted_count} existing {model_class.__name__} records')
                
                # Delete existing data
                model_class.objects.all().delete()
                
                # Reset SQLite sequence safely
                with connection.cursor() as cursor:
                    try:
                        # Use parameterized query with proper escaping
                        cursor.execute("DELETE FROM sqlite_sequence WHERE name = %s", [table_name])
                        logger.debug(f'Reset SQLite sequence for table: {table_name}')
                    except Exception as seq_error:
                        logger.warning(f'Could not reset sequence for {table_name}: {seq_error}')
                
                # Process rows efficiently
                items_to_create = []
                for index, row in df.iterrows():
                    row_number = index + 2  # Excel row number (1-based + header)
                    
                    try:
                        if process_row_func:
                            # Use custom processing function
                            item_data = process_row_func(row, row_number, errors)
                            if item_data is not None:
                                items_to_create.append(model_class(**item_data))
                                created_items.append(str(item_data.get('name', f'Item {row_number}')))
                        else:
                            # Default processing for simple name-only models
                            name = str(row['name']).strip()
                            if not name or name.lower() in ['nan', 'none', '']:
                                errors.append(f'Fila {row_number}: Nombre vacío o inválido')
                                continue
                                
                            items_to_create.append(model_class(name=name))
                            created_items.append(name)
                            
                    except (ValueError, InvalidOperation, KeyError) as e:
                        errors.append(f'Fila {row_number}: Error de validación - {str(e)}')
                    except Exception as e:
                        errors.append(f'Fila {row_number}: Error inesperado - {str(e)}')
                        logger.error(f'Unexpected error processing row {row_number}: {str(e)}')
                
                # Bulk create all valid items
                if items_to_create:
                    created_objects = model_class.objects.bulk_create(items_to_create)
                    logger.info(f'Successfully created {len(created_objects)} {model_class.__name__} records')
            
            # Prepare standardized response
            result = {
                'success': True,
                'deleted': deleted_count,
                'created': len(created_items),
                'errors': len(errors),
                'created_items': created_items[:50],  # Limit for performance
                'error_details': errors[:10]  # Limit error details
            }
            
            # Generate appropriate message
            if errors:
                result['message'] = f'Importación completada con advertencias: {deleted_count} eliminados, {len(created_items)} creados, {len(errors)} errores'
            else:
                result['message'] = f'Importación exitosa: {deleted_count} eliminados, {len(created_items)} creados'
            
            logger.info(f'Import completed for {model_class.__name__}: {result["message"]}')
            return JsonResponse(result)
            
        except Exception as e:
            logger.error(f'Critical error in {model_class.__name__} import: {str(e)}', exc_info=True)
            return JsonResponse({
                'error': f'Error crítico del servidor: {str(e)}',
                'success': False
            }, status=500)
    
    return import_excel_main

# Create specific import functions using the factory
from config.models import Unit, Zone, Table, Container
from inventory.models import Group, Ingredient, Recipe, RecipeItem

# Units import (simple) - Enhanced
import_units_excel_main = create_optimized_import_function(
    Unit, 'config_unit', ['name'], max_file_size_mb=5
)

# Zones import (simple) - Enhanced
import_zones_excel_main = create_optimized_import_function(
    Zone, 'config_zone', ['name'], max_file_size_mb=5
)

# Groups import (simple) - Enhanced
import_groups_excel_main = create_optimized_import_function(
    Group, 'inventory_group', ['name'], max_file_size_mb=5
)

# Tables import (requires zone reference) - Optimized
def process_tables_row_optimized(row, row_num, errors):
    """Optimized table row processing with better error handling and caching"""
    try:
        zone_name = str(row['zone']).strip()
        table_number = str(row['table_number']).strip()
        
        # Enhanced validation
        if not zone_name or zone_name.lower() in ['nan', 'none', '']:
            errors.append(f'Fila {row_num}: Nombre de zona requerido')
            return None
            
        if not table_number or table_number.lower() in ['nan', 'none', '']:
            errors.append(f'Fila {row_num}: Número de mesa requerido')
            return None
        
        # Cache zones to avoid repeated database queries
        if not hasattr(process_tables_row_optimized, '_zone_cache'):
            process_tables_row_optimized._zone_cache = {
                zone.name.lower(): zone for zone in Zone.objects.all()
            }
        
        zone_cache = process_tables_row_optimized._zone_cache
        zone_key = zone_name.lower()
        
        if zone_key not in zone_cache:
            errors.append(f'Fila {row_num}: Zona "{zone_name}" no existe. Zonas disponibles: {list(zone_cache.keys())}')
            return None
        
        return {
            'zone': zone_cache[zone_key],
            'table_number': table_number
        }
        
    except KeyError as e:
        errors.append(f'Fila {row_num}: Columna requerida faltante: {str(e)}')
        return None
    except Exception as e:
        errors.append(f'Fila {row_num}: Error inesperado - {str(e)}')
        return None

# Clear zone cache when function is created
if hasattr(process_tables_row_optimized, '_zone_cache'):
    del process_tables_row_optimized._zone_cache

import_tables_excel_main = create_optimized_import_function(
    Table, 'config_table', ['zone', 'table_number'], 
    process_tables_row_optimized, max_file_size_mb=5
)

# Containers import (with price and optional fields) - Optimized
def process_containers_row_optimized(row, row_num, errors):
    """Optimized container row processing with enhanced validation"""
    from decimal import Decimal, InvalidOperation
    
    try:
        name = str(row['name']).strip()
        price = row['price']
        description = str(row.get('description', '')).strip()
        stock = row.get('stock', 0)
        
        # Enhanced name validation
        if not name or name.lower() in ['nan', 'none', '']:
            errors.append(f'Fila {row_num}: Nombre de envase requerido')
            return None
            
        # Improved price validation with Decimal for precision
        try:
            price_decimal = Decimal(str(price))
            if price_decimal < 0:
                errors.append(f'Fila {row_num}: Precio no puede ser negativo')
                return None
            if price_decimal > 9999.99:  # Reasonable maximum
                errors.append(f'Fila {row_num}: Precio demasiado alto (máximo: S/ 9999.99)')
                return None
        except (ValueError, TypeError, InvalidOperation):
            errors.append(f'Fila {row_num}: Precio inválido - debe ser un número (ej: 15.50)')
            return None
            
        # Enhanced stock validation
        try:
            stock = int(float(stock)) if stock else 0
            if stock < 0:
                errors.append(f'Fila {row_num}: Stock no puede ser negativo')
                return None
        except (ValueError, TypeError):
            errors.append(f'Fila {row_num}: Stock inválido - debe ser un número entero')
            return None
            
        # Clean description
        if description.lower() in ['nan', 'none', '']:
            description = ''
            
        return {
            'name': name,
            'description': description,
            'price': price_decimal,
            'stock': stock,
            'is_active': True
        }
        
    except KeyError as e:
        errors.append(f'Fila {row_num}: Columna requerida faltante: {str(e)}')
        return None
    except Exception as e:
        errors.append(f'Fila {row_num}: Error inesperado - {str(e)}')
        return None

import_containers_excel_main = create_optimized_import_function(
    Container, 'config_container', ['name', 'price'], 
    process_containers_row_optimized, max_file_size_mb=5
)

# Ingredients import (requires unit reference) - Optimized
def process_ingredients_row_optimized(row, row_num, errors):
    """Optimized ingredient row processing with caching and enhanced validation"""
    from decimal import Decimal, InvalidOperation
    
    try:
        unit_name = str(row['unit']).strip()
        name = str(row['name']).strip()
        unit_price = row['unit_price']
        current_stock = row.get('current_stock', 0)
        
        # Enhanced validation
        if not unit_name or unit_name.lower() in ['nan', 'none', '']:
            errors.append(f'Fila {row_num}: Unidad requerida')
            return None
            
        if not name or name.lower() in ['nan', 'none', '']:
            errors.append(f'Fila {row_num}: Nombre de ingrediente requerido')
            return None
        
        # Cache units to avoid repeated database queries
        if not hasattr(process_ingredients_row_optimized, '_unit_cache'):
            process_ingredients_row_optimized._unit_cache = {
                unit.name.lower(): unit for unit in Unit.objects.all()
            }
        
        unit_cache = process_ingredients_row_optimized._unit_cache
        unit_key = unit_name.lower()
        
        if unit_key not in unit_cache:
            available_units = list(unit_cache.keys())
            errors.append(f'Fila {row_num}: Unidad "{unit_name}" no existe. Unidades disponibles: {available_units}')
            return None
        
        unit = unit_cache[unit_key]
        
        # Enhanced price validation with Decimal
        try:
            unit_price_decimal = Decimal(str(unit_price))
            if unit_price_decimal <= 0:
                errors.append(f'Fila {row_num}: Precio unitario debe ser mayor a 0')
                return None
            if unit_price_decimal > 9999.99:
                errors.append(f'Fila {row_num}: Precio unitario demasiado alto (máximo: S/ 9999.99)')
                return None
        except (ValueError, TypeError, InvalidOperation):
            errors.append(f'Fila {row_num}: Precio unitario inválido - debe ser un número (ej: 12.50)')
            return None
        
        # Enhanced stock validation
        try:
            current_stock_decimal = Decimal(str(current_stock)) if current_stock else Decimal('0')
            if current_stock_decimal < 0:
                errors.append(f'Fila {row_num}: Stock actual no puede ser negativo')
                return None
        except (ValueError, TypeError, InvalidOperation):
            errors.append(f'Fila {row_num}: Stock actual inválido - debe ser un número (ej: 25.5)')
            return None
        
        return {
            'unit': unit,
            'name': name,
            'unit_price': unit_price_decimal,
            'current_stock': current_stock_decimal,
            'is_active': current_stock_decimal > 0
        }
        
    except KeyError as e:
        errors.append(f'Fila {row_num}: Columna requerida faltante: {str(e)}')
        return None
    except Exception as e:
        errors.append(f'Fila {row_num}: Error inesperado - {str(e)}')
        return None

# Clear unit cache when function is created
if hasattr(process_ingredients_row_optimized, '_unit_cache'):
    del process_ingredients_row_optimized._unit_cache

import_ingredients_excel_main = create_optimized_import_function(
    Ingredient, 'inventory_ingredient', ['unit', 'name', 'unit_price'], 
    process_ingredients_row_optimized, max_file_size_mb=10
)

# Recipes import (with group, container references and ingredients) - Optimized
def process_recipes_row_optimized(row, row_num, errors):
    """Optimized recipe row processing with enhanced validation and caching"""
    from decimal import Decimal, InvalidOperation
    
    try:
        name = str(row['name']).strip()
        version = str(row.get('version', '1.0')).strip()
        group_name = str(row.get('group', '')).strip()
        container_name = str(row.get('container', '')).strip()
        
        # Enhanced validation for core fields
        if not name or name.lower() in ['nan', 'none', '']:
            errors.append(f'Fila {row_num}: Nombre de receta requerido')
            return None
            
        # Validate version format
        if not version or version.lower() in ['nan', 'none', '']:
            version = '1.0'
        
        # Enhanced profit percentage validation
        try:
            profit_percentage = float(row.get('profit_percentage', 0))
            if profit_percentage < 0:
                errors.append(f'Fila {row_num}: Porcentaje de ganancia no puede ser negativo')
                return None
            if profit_percentage > 500:  # Reasonable maximum
                errors.append(f'Fila {row_num}: Porcentaje de ganancia demasiado alto (máximo: 500%)')
                return None
        except (ValueError, TypeError):
            errors.append(f'Fila {row_num}: Porcentaje de ganancia inválido - debe ser un número')
            return None
            
        # Enhanced preparation time validation
        try:
            preparation_time = int(float(row.get('preparation_time', 10)))
            if preparation_time <= 0:
                errors.append(f'Fila {row_num}: Tiempo de preparación debe ser mayor a 0')
                return None
            if preparation_time > 300:  # 5 hours maximum
                errors.append(f'Fila {row_num}: Tiempo de preparación demasiado alto (máximo: 300 min)')
                return None
        except (ValueError, TypeError):
            errors.append(f'Fila {row_num}: Tiempo de preparación inválido - debe ser un número entero')
            return None
        
        # Initialize caches for foreign key lookups to avoid repeated queries
        if not hasattr(process_recipes_row_optimized, '_group_cache'):
            process_recipes_row_optimized._group_cache = {
                group.name.lower(): group for group in Group.objects.all()
            }
        if not hasattr(process_recipes_row_optimized, '_container_cache'):
            process_recipes_row_optimized._container_cache = {
                container.name.lower(): container for container in Container.objects.all()
            }
        if not hasattr(process_recipes_row_optimized, '_ingredient_cache'):
            process_recipes_row_optimized._ingredient_cache = {
                ingredient.name.lower(): ingredient for ingredient in Ingredient.objects.all()
            }
        
        group_cache = process_recipes_row_optimized._group_cache
        container_cache = process_recipes_row_optimized._container_cache
        ingredient_cache = process_recipes_row_optimized._ingredient_cache
        
        # Optional group reference with caching
        group = None
        if group_name and group_name.lower() not in ['nan', 'none', '']:
            group_key = group_name.lower()
            if group_key not in group_cache:
                available_groups = list(group_cache.keys())
                errors.append(f'Fila {row_num}: Grupo "{group_name}" no existe. Grupos disponibles: {available_groups}')
                return None
            group = group_cache[group_key]
        
        # Optional container reference with caching
        container = None
        if container_name and container_name.lower() not in ['nan', 'none', '']:
            container_key = container_name.lower()
            if container_key not in container_cache:
                available_containers = list(container_cache.keys())
                errors.append(f'Fila {row_num}: Envase "{container_name}" no existe. Envases disponibles: {available_containers}')
                return None
            container = container_cache[container_key]
        
        # Parse ingredients with enhanced validation
        recipe_ingredients = []
        calculated_price = Decimal('0')
        ingredient_count = 0
        
        # Process up to 8 ingredient pairs with enhanced validation
        for i in range(1, 9):
            ingredient_col = f'ingredient_{i}'
            quantity_col = f'quantity_{i}'
            
            ingredient_name = str(row.get(ingredient_col, '')).strip()
            quantity_str = str(row.get(quantity_col, '')).strip()
            
            # Skip empty ingredient slots
            if not ingredient_name or ingredient_name.lower() in ['nan', 'none', '']:
                continue
                
            # Validate quantity is provided for ingredient
            if not quantity_str or quantity_str.lower() in ['nan', 'none', '']:
                errors.append(f'Fila {row_num}: Cantidad requerida para ingrediente "{ingredient_name}"')
                return None
            
            # Enhanced quantity validation
            try:
                quantity = Decimal(str(quantity_str))
                if quantity <= 0:
                    errors.append(f'Fila {row_num}: Cantidad del ingrediente "{ingredient_name}" debe ser mayor a 0')
                    return None
                if quantity > 1000:  # Reasonable maximum
                    errors.append(f'Fila {row_num}: Cantidad del ingrediente "{ingredient_name}" demasiado alta')
                    return None
            except (ValueError, TypeError, InvalidOperation):
                errors.append(f'Fila {row_num}: Cantidad inválida para "{ingredient_name}": {quantity_str}')
                return None
            
            # Find ingredient with caching
            ingredient_key = ingredient_name.lower()
            if ingredient_key not in ingredient_cache:
                available_ingredients = list(ingredient_cache.keys())[:10]  # Show first 10
                errors.append(f'Fila {row_num}: Ingrediente "{ingredient_name}" no existe. Algunos disponibles: {available_ingredients}')
                return None
                
            ingredient = ingredient_cache[ingredient_key]
            recipe_ingredients.append({'ingredient': ingredient, 'quantity': quantity})
            calculated_price += ingredient.unit_price * quantity
            ingredient_count += 1
        
        # Validate at least one ingredient is provided
        if ingredient_count == 0:
            errors.append(f'Fila {row_num}: Se requiere al menos un ingrediente para la receta')
            return None
            
        # Enhanced price calculation with Decimal precision
        if calculated_price <= 0:
            errors.append(f'Fila {row_num}: El costo calculado de ingredientes debe ser mayor a 0')
            return None
            
        # Calculate base price: cost of ingredients + profit percentage
        try:
            profit_multiplier = Decimal('1') + (Decimal(str(profit_percentage)) / Decimal('100'))
            base_price = calculated_price * profit_multiplier
            
            if base_price <= 0:
                errors.append(f'Fila {row_num}: El precio base calculado debe ser mayor a 0')
                return None
            if base_price > Decimal('9999.99'):
                errors.append(f'Fila {row_num}: El precio base calculado es demasiado alto (máximo: S/ 9999.99)')
                return None
                
        except (InvalidOperation, ValueError):
            errors.append(f'Fila {row_num}: Error calculando precio base')
            return None
        
        return {
            'group': group,
            'container': container,
            'name': name,
            'version': version,
            'base_price': base_price,
            'profit_percentage': Decimal(str(profit_percentage)),
            'preparation_time': preparation_time,
            'is_available': True,
            'is_active': True,
            'recipe_ingredients': recipe_ingredients,  # Include ingredients for processing
            'ingredient_count': ingredient_count  # For logging
        }
        
    except KeyError as e:
        errors.append(f'Fila {row_num}: Columna requerida faltante: {str(e)}')
        return None
    except Exception as e:
        errors.append(f'Fila {row_num}: Error inesperado - {str(e)}')
        return None

# Clear caches when function is created
for attr in ['_group_cache', '_container_cache', '_ingredient_cache']:
    if hasattr(process_recipes_row_optimized, attr):
        delattr(process_recipes_row_optimized, attr)

# Optimized recipes import using enhanced architecture
@csrf_exempt
def import_recipes_excel_main(request):
    """
    Optimized recipe import function with complex ingredient handling
    
    Features:
    - Enhanced error handling and logging
    - File size validation
    - Improved performance with bulk operations for RecipeItems
    - Standardized response format
    - Better ingredient validation with caching
    """
    import logging
    import pandas as pd
    from django.http import JsonResponse
    from django.db import transaction, connection
    from decimal import InvalidOperation
    
    logger = logging.getLogger(__name__)
    
    # Validate HTTP method
    if request.method != 'POST':
        return JsonResponse({'error': 'Solo método POST permitido'}, status=405)
    
    try:
        # Validate file presence
        if 'file' not in request.FILES:
            return JsonResponse({'error': 'No se proporcionó ningún archivo'}, status=400)
        
        excel_file = request.FILES['file']
        
        # Validate file size (15MB for recipes with ingredients)
        max_size = 15 * 1024 * 1024  # 15MB
        if excel_file.size > max_size:
            return JsonResponse({
                'error': 'Archivo demasiado grande. Máximo permitido: 15MB'
            }, status=400)
        
        # Validate Excel format
        file_ext = excel_file.name.lower().split('.')[-1]
        if file_ext not in ['xlsx', 'xls']:
            return JsonResponse({
                'error': 'Formato no válido. Solo se aceptan archivos Excel (.xlsx o .xls)'
            }, status=400)
        
        # Read Excel file with error handling
        try:
            df = pd.read_excel(excel_file)
            logger.info(f'Excel file loaded successfully: {excel_file.name}, {len(df)} rows')
        except Exception as e:
            logger.error(f'Error reading Excel file {excel_file.name}: {str(e)}')
            return JsonResponse({'error': f'Error al leer el archivo Excel: {str(e)}'}, status=400)
        
        # Validate file structure
        if df.empty:
            return JsonResponse({'error': 'El archivo está vacío'}, status=400)
        
        # Validate required columns
        required_columns = ['name']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            return JsonResponse({
                'error': f'El archivo debe contener las columnas requeridas: {", ".join(missing_columns)}'
            }, status=400)
        
        # Check if at least one ingredient column exists
        ingredient_columns = [f'ingredient_{i}' for i in range(1, 9)]
        has_ingredient_columns = any(col in df.columns for col in ingredient_columns)
        if not has_ingredient_columns:
            return JsonResponse({
                'error': 'Se requiere al menos una columna de ingrediente (ingredient_1, ingredient_2, etc.)'
            }, status=400)
        
        # Process data with optimized transaction
        created_items = []
        recipe_items_to_create = []
        errors = []
        deleted_count = 0
        
        with transaction.atomic():
            # Count existing items before deletion
            deleted_recipes = Recipe.objects.count()
            deleted_recipe_items = RecipeItem.objects.count()
            deleted_count = deleted_recipes + deleted_recipe_items
            logger.info(f'Deleting {deleted_recipes} recipes and {deleted_recipe_items} recipe items')
            
            # Delete existing data
            Recipe.objects.all().delete()
            RecipeItem.objects.all().delete()
            
            # Reset SQLite sequences safely
            with connection.cursor() as cursor:
                try:
                    cursor.execute("DELETE FROM sqlite_sequence WHERE name = %s", ['inventory_recipe'])
                    cursor.execute("DELETE FROM sqlite_sequence WHERE name = %s", ['inventory_recipeitem'])
                    logger.debug('Reset SQLite sequences for recipe tables')
                except Exception as seq_error:
                    logger.warning(f'Could not reset sequences for recipe tables: {seq_error}')
            
            # Process rows efficiently
            recipes_to_create = []
            for index, row in df.iterrows():
                row_number = index + 2  # Excel row number (1-based + header)
                
                # Skip empty rows
                if pd.isna(row['name']) or not str(row['name']).strip():
                    continue
                
                try:
                    recipe_data = process_recipes_row_optimized(row, row_number, errors)
                    if recipe_data is not None:
                        # Extract ingredients before creating recipe
                        recipe_ingredients = recipe_data.pop('recipe_ingredients', [])
                        ingredient_count = recipe_data.pop('ingredient_count', 0)
                        
                        recipes_to_create.append((recipe_data, recipe_ingredients))
                        created_items.append(f"{recipe_data.get('name')} ({ingredient_count} ingredientes)")
                        
                except Exception as e:
                    errors.append(f'Fila {row_number}: Error inesperado - {str(e)}')
                    logger.error(f'Unexpected error processing row {row_number}: {str(e)}')
            
            # Create recipes and recipe items with bulk operations
            if recipes_to_create:
                created_recipes = []
                
                for recipe_data, recipe_ingredients in recipes_to_create:
                    # Create recipe
                    recipe = Recipe.objects.create(**recipe_data)
                    created_recipes.append(recipe)
                    
                    # Prepare recipe items for bulk creation
                    for ingredient_data in recipe_ingredients:
                        recipe_items_to_create.append(
                            RecipeItem(
                                recipe=recipe,
                                ingredient=ingredient_data['ingredient'],
                                quantity=ingredient_data['quantity']
                            )
                        )
                
                # Bulk create all recipe items
                if recipe_items_to_create:
                    RecipeItem.objects.bulk_create(recipe_items_to_create)
                    logger.info(f'Successfully created {len(recipe_items_to_create)} recipe items')
                
                # Update calculated prices for all recipes
                for recipe in created_recipes:
                    recipe.update_base_price()
                
                logger.info(f'Successfully created {len(created_recipes)} recipes with ingredients')
        
        # Prepare standardized response
        result = {
            'success': True,
            'deleted': deleted_count,
            'created': len(created_items),
            'errors': len(errors),
            'created_items': created_items[:50],  # Limit for performance
            'error_details': errors[:10]  # Limit error details
        }
        
        # Generate appropriate message
        if errors:
            result['message'] = f'Importación completada con advertencias: {deleted_count} elementos eliminados, {len(created_items)} recetas creadas, {len(errors)} errores'
        else:
            result['message'] = f'Importación exitosa: {deleted_count} elementos eliminados, {len(created_items)} recetas creadas con ingredientes'
        
        logger.info(f'Recipe import completed: {result["message"]}')
        return JsonResponse(result)
        
    except Exception as e:
        logger.error(f'Critical error in recipe import: {str(e)}', exc_info=True)
        return JsonResponse({
            'error': f'Error crítico del servidor: {str(e)}',
            'success': False
        }, status=500)

# Add CSRF exemption to all functions (except recipes which is already exempt)
import_units_excel_main = csrf_exempt(import_units_excel_main)
import_zones_excel_main = csrf_exempt(import_zones_excel_main)
import_groups_excel_main = csrf_exempt(import_groups_excel_main)  
import_tables_excel_main = csrf_exempt(import_tables_excel_main)
import_containers_excel_main = csrf_exempt(import_containers_excel_main)
import_ingredients_excel_main = csrf_exempt(import_ingredients_excel_main)

urlpatterns = [
    path('admin/', admin.site.urls),
    # Health check - MUST come before api/v1/ include to bypass authentication
    path('api/v1/health/', health_check, name='health_check'),
    # Auth debug endpoint (public - no auth required)
    path('api/v1/auth-debug/', auth_debug, name='auth_debug'),
    # CSRF endpoint (public - no auth required)
    path('csrf/', get_csrf_token, name='csrf_token'),
    # Import endpoints outside of API middleware
    path('import-units/', import_units_excel_main, name='import_units'),
    path('import-zones/', import_zones_excel_main, name='import_zones'),
    path('import-tables/', import_tables_excel_main, name='import_tables'),
    path('import-containers/', import_containers_excel_main, name='import_containers'),
    path('import-groups/', import_groups_excel_main, name='import_groups'),
    path('import-ingredients/', import_ingredients_excel_main, name='import_ingredients'),
    path('import-recipes/', import_recipes_excel_main, name='import_recipes'),
    # Serve frontend assets - MUST come before the catch-all route
    re_path(r'^assets/(?P<path>.*)$', serve_frontend_asset, name='frontend_assets'),
    path('vite.svg', serve_vite_svg, name='vite_svg'),
    # Include API routes with explicit api/v1/ prefix
    path('api/v1/', include('api_urls')),
]

# Serve static and media files in production
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
# Also serve assets directly from static
urlpatterns += static('/assets/', document_root=settings.STATIC_ROOT / 'assets')

# Serve React app only for root and specific frontend routes (after API routes)
urlpatterns += [
    path('', index_view, name='frontend_index'),  # Root only
]
