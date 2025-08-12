from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.http import HttpResponse, FileResponse, Http404
from pathlib import Path
import mimetypes
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

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
    from django.http import JsonResponse
    return JsonResponse({
        'status': 'ok',
        'message': 'Restaurant API is running'
    })


from django.views.decorators.csrf import csrf_exempt

def create_import_excel_function(model_class, table_name, required_columns, process_row_func=None):
    """Factory function to create Excel import functions for different models"""
    
    def import_excel_main(request):
        from django.http import JsonResponse
        from django.db import transaction
        import pandas as pd
        
        if request.method != 'POST':
            return JsonResponse({'error': 'Solo método POST permitido'}, status=405)
        
        try:
            if 'file' not in request.FILES:
                return JsonResponse({'error': 'No se proporcionó ningún archivo'}, status=400)
            
            excel_file = request.FILES['file']
            
            # Validar formato y leer archivo
            file_ext = excel_file.name.lower().split('.')[-1]
            if file_ext not in ['xlsx', 'xls', 'csv']:
                return JsonResponse({'error': 'Formato no válido. Use Excel (.xlsx/.xls) o CSV'}, status=400)
            
            try:
                df = pd.read_csv(excel_file) if file_ext == 'csv' else pd.read_excel(excel_file)
            except Exception as e:
                return JsonResponse({'error': f'Error al leer el archivo: {str(e)}'}, status=400)
            
            # Validar estructura
            if df.empty:
                return JsonResponse({'error': 'El archivo está vacío'}, status=400)
            
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                return JsonResponse({'error': f'El archivo debe contener las columnas: {", ".join(missing_columns)}'}, status=400)
            
            # Procesar datos
            created_items = []
            errors = []
            
            with transaction.atomic():
                # Paso 1: Contar y eliminar elementos existentes
                deleted_count = model_class.objects.count()
                model_class.objects.all().delete()
                
                # Paso 2: Reiniciar contador de IDs en SQLite
                from django.db import connection
                with connection.cursor() as cursor:
                    try:
                        cursor.execute(f"DELETE FROM sqlite_sequence WHERE name='{table_name}'")
                    except Exception:
                        try:
                            cursor.execute(f"INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('{table_name}', 0)")
                        except Exception:
                            pass
                
                # Paso 3: Procesar filas y crear elementos
                items_to_create = []
                for index, row in df.iterrows():
                    try:
                        if process_row_func:
                            item_data = process_row_func(row, index + 2, errors)
                            if item_data is not None:
                                items_to_create.append(model_class(**item_data))
                                created_items.append(str(item_data.get('name', f'Item {index + 1}')))
                        else:
                            # Default behavior for simple models
                            name = str(row['name']).strip()
                            if not name or name.lower() == 'nan':
                                errors.append(f'Fila {index + 2}: Nombre vacío')
                                continue
                            items_to_create.append(model_class(name=name))
                            created_items.append(name)
                    except Exception as e:
                        errors.append(f'Fila {index + 2}: {str(e)}')
                
                # Crear todos los elementos de una vez
                if items_to_create:
                    model_class.objects.bulk_create(items_to_create)
            
            # Preparar respuesta
            result = {
                'success': True,
                'deleted': deleted_count,
                'created': len(created_items),
                'errors': len(errors),
                'created_items': created_items,
                'error_details': errors[:10]
            }
            
            if errors:
                result['message'] = f'Importación completada: {deleted_count} eliminadas, {len(created_items)} creadas, {len(errors)} errores'
            else:
                result['message'] = f'Importación exitosa: {deleted_count} eliminadas, {len(created_items)} creadas'
            
            return JsonResponse(result)
            
        except Exception as e:
            return JsonResponse({'error': f'Error interno del servidor: {str(e)}'}, status=500)
    
    return import_excel_main

# Create specific import functions using the factory
from config.models import Unit, Zone, Table, Container
from inventory.models import Group, Ingredient, Recipe, RecipeItem

# Units import (simple)
import_units_excel_main = create_import_excel_function(Unit, 'unit', ['name'])

# Zones import (simple)  
import_zones_excel_main = create_import_excel_function(Zone, 'zone', ['name'])

# Groups import (simple)
import_groups_excel_main = create_import_excel_function(Group, 'group', ['name'])

# Tables import (requires zone reference)
def process_tables_row(row, row_num, errors):
    try:
        zone_name = str(row['zone']).strip()
        table_number = str(row['table_number']).strip()
        
        if not zone_name or zone_name.lower() == 'nan':
            errors.append(f'Fila {row_num}: Nombre de zona vacío')
            return None
            
        if not table_number or table_number.lower() == 'nan':
            errors.append(f'Fila {row_num}: Número de mesa vacío')
            return None
        
        # Find zone
        try:
            zone = Zone.objects.get(name__iexact=zone_name)
        except Zone.DoesNotExist:
            errors.append(f'Fila {row_num}: Zona "{zone_name}" no existe')
            return None
        
        return {
            'zone': zone,
            'table_number': table_number
        }
    except Exception as e:
        errors.append(f'Fila {row_num}: {str(e)}')
        return None

import_tables_excel_main = create_import_excel_function(Table, 'table', ['zone', 'table_number'], process_tables_row)

# Containers import (with price and optional fields)
def process_containers_row(row, row_num, errors):
    try:
        name = str(row['name']).strip()
        price = row['price']
        description = str(row.get('description', '')).strip()
        stock = int(row.get('stock', 0))
        
        if not name or name.lower() == 'nan':
            errors.append(f'Fila {row_num}: Nombre vacío')
            return None
            
        try:
            price = float(price)
            if price < 0:
                errors.append(f'Fila {row_num}: Precio no puede ser negativo')
                return None
        except (ValueError, TypeError):
            errors.append(f'Fila {row_num}: Precio inválido')
            return None
            
        if description.lower() == 'nan':
            description = ''
            
        return {
            'name': name,
            'description': description,
            'price': price,
            'stock': stock,
            'is_active': True
        }
    except Exception as e:
        errors.append(f'Fila {row_num}: {str(e)}')
        return None

import_containers_excel_main = create_import_excel_function(Container, 'container', ['name', 'price'], process_containers_row)

# Ingredients import (requires unit reference)
def process_ingredients_row(row, row_num, errors):
    try:
        unit_name = str(row['unit']).strip()
        name = str(row['name']).strip()
        unit_price = row['unit_price']
        current_stock = row.get('current_stock', 0)
        
        if not unit_name or unit_name.lower() == 'nan':
            errors.append(f'Fila {row_num}: Nombre de unidad vacío')
            return None
            
        if not name or name.lower() == 'nan':
            errors.append(f'Fila {row_num}: Nombre de ingrediente vacío')
            return None
        
        # Find unit
        try:
            unit = Unit.objects.get(name__iexact=unit_name)
        except Unit.DoesNotExist:
            errors.append(f'Fila {row_num}: Unidad "{unit_name}" no existe')
            return None
            
        try:
            unit_price = float(unit_price)
            current_stock = float(current_stock)
            if unit_price <= 0:
                errors.append(f'Fila {row_num}: Precio unitario debe ser mayor a 0')
                return None
            if current_stock < 0:
                errors.append(f'Fila {row_num}: Stock actual no puede ser negativo')
                return None
        except (ValueError, TypeError):
            errors.append(f'Fila {row_num}: Precio o stock inválido')
            return None
        
        return {
            'unit': unit,
            'name': name,
            'unit_price': unit_price,
            'current_stock': current_stock,
            'is_active': current_stock > 0
        }
    except Exception as e:
        errors.append(f'Fila {row_num}: {str(e)}')
        return None

import_ingredients_excel_main = create_import_excel_function(Ingredient, 'ingredient', ['unit', 'name', 'unit_price'], process_ingredients_row)

# Recipes import (with group, container references and ingredients)
def process_recipes_row(row, row_num, errors):
    try:
        name = str(row['name']).strip()
        version = str(row.get('version', '1.0')).strip()
        profit_percentage = float(row.get('profit_percentage', 0))
        preparation_time = int(row.get('preparation_time', 10))
        
        group_name = str(row.get('group', '')).strip()
        container_name = str(row.get('container', '')).strip()
        
        if not name or name.lower() == 'nan':
            errors.append(f'Fila {row_num}: Nombre de receta vacío')
            return None
        
        # Parse ingredients from separate columns (ingredient_1, quantity_1, etc.)
        recipe_ingredients = []
        calculated_price = 0
        
        # Process up to 8 ingredient pairs
        for i in range(1, 9):
            ingredient_col = f'ingredient_{i}'
            quantity_col = f'quantity_{i}'
            
            ingredient_name = str(row.get(ingredient_col, '')).strip()
            quantity_str = str(row.get(quantity_col, '')).strip()
            
            # Skip if ingredient name is empty
            if not ingredient_name or ingredient_name.lower() in ['nan', 'none', '']:
                continue
                
            # Skip if quantity is empty
            if not quantity_str or quantity_str.lower() in ['nan', 'none', '']:
                continue
            
            try:
                quantity = float(quantity_str)
                if quantity <= 0:
                    errors.append(f'Fila {row_num}: Cantidad del ingrediente "{ingredient_name}" debe ser mayor a 0')
                    return None
            except ValueError:
                errors.append(f'Fila {row_num}: Cantidad inválida para "{ingredient_name}": {quantity_str}')
                return None
            
            # Find ingredient
            try:
                ingredient = Ingredient.objects.get(name__iexact=ingredient_name)
                recipe_ingredients.append({'ingredient': ingredient, 'quantity': quantity})
                calculated_price += ingredient.unit_price * quantity
            except Ingredient.DoesNotExist:
                errors.append(f'Fila {row_num}: Ingrediente "{ingredient_name}" no existe')
                return None
        
        # Always calculate base_price from ingredients + profit (no manual override)
        if calculated_price == 0:
            errors.append(f'Fila {row_num}: Se requiere al menos un ingrediente para calcular el precio')
            return None
            
        # Calculate base price: cost of ingredients + profit percentage
        base_price = calculated_price * (1 + profit_percentage / 100)
        
        if base_price <= 0:
            errors.append(f'Fila {row_num}: El precio calculado debe ser mayor a 0')
            return None
        
        # Optional group reference
        group = None
        if group_name and group_name.lower() != 'nan':
            try:
                group = Group.objects.get(name__iexact=group_name)
            except Group.DoesNotExist:
                errors.append(f'Fila {row_num}: Grupo "{group_name}" no existe')
                return None
        
        # Optional container reference  
        container = None
        if container_name and container_name.lower() != 'nan':
            try:
                container = Container.objects.get(name__iexact=container_name)
            except Container.DoesNotExist:
                errors.append(f'Fila {row_num}: Envase "{container_name}" no existe')
                return None
        
        return {
            'group': group,
            'container': container,
            'name': name,
            'version': version,
            'base_price': base_price,
            'profit_percentage': profit_percentage,
            'preparation_time': preparation_time,
            'is_available': True,
            'is_active': True,
            'recipe_ingredients': recipe_ingredients  # Include ingredients for processing
        }
    except Exception as e:
        errors.append(f'Fila {row_num}: {str(e)}')
        return None

# Custom import function for recipes with ingredients
@csrf_exempt
def import_recipes_excel_main(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Solo se permite método POST'}, status=405)
    
    if 'file' not in request.FILES:
        return JsonResponse({'error': 'No se encontró el archivo'}, status=400)
    
    try:
        # Clear existing data and reset counter
        Recipe.objects.all().delete()
        RecipeItem.objects.all().delete()
        
        # Reset SQLite sequence for recipe table
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM sqlite_sequence WHERE name='recipe'")
            cursor.execute("DELETE FROM sqlite_sequence WHERE name='recipe_item'")
        
        # Read Excel file
        file = request.FILES['file']
        df = pd.read_excel(file)
        
        if df.empty:
            return JsonResponse({'error': 'El archivo está vacío'}, status=400)
        
        # Validate required columns
        required_columns = ['name']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            return JsonResponse({
                'error': f'Faltan las siguientes columnas requeridas: {", ".join(missing_columns)}'
            }, status=400)
        
        # Check if at least one ingredient column exists
        ingredient_columns = [f'ingredient_{i}' for i in range(1, 9)]
        has_ingredient_columns = any(col in df.columns for col in ingredient_columns)
        if not has_ingredient_columns:
            return JsonResponse({
                'error': 'Se requiere al menos una columna de ingrediente (ingredient_1, ingredient_2, etc.)'
            }, status=400)
        
        # Process rows
        valid_data = []
        errors = []
        
        for index, row in df.iterrows():
            row_num = index + 2  # Excel row number (1-based + header)
            
            # Skip empty rows
            if pd.isna(row['name']) or not str(row['name']).strip():
                continue
            
            processed_row = process_recipes_row(row, row_num, errors)
            if processed_row:
                valid_data.append(processed_row)
        
        if errors:
            return JsonResponse({
                'error': 'Errores de validación encontrados',
                'details': errors[:10]  # Limit to first 10 errors
            }, status=400)
        
        if not valid_data:
            return JsonResponse({'error': 'No hay datos válidos para importar'}, status=400)
        
        # Create recipes with ingredients
        created_recipes = []
        for recipe_data in valid_data:
            recipe_ingredients = recipe_data.pop('recipe_ingredients', [])
            
            # Create recipe
            recipe = Recipe.objects.create(**recipe_data)
            
            # Create recipe ingredients
            for ingredient_data in recipe_ingredients:
                RecipeItem.objects.create(
                    recipe=recipe,
                    ingredient=ingredient_data['ingredient'],
                    quantity=ingredient_data['quantity']
                )
            
            # Update calculated price if ingredients were provided
            if recipe_ingredients:
                recipe.update_base_price()
            
            created_recipes.append(recipe)
        
        return JsonResponse({
            'success': True,
            'message': f'Se importaron exitosamente {len(created_recipes)} recetas con sus ingredientes',
            'count': len(created_recipes)
        })
        
    except Exception as e:
        return JsonResponse({'error': f'Error procesando archivo: {str(e)}'}, status=400)

# Add CSRF exemption to all functions (except recipes which is already exempt)
import_zones_excel_main = csrf_exempt(import_zones_excel_main)
import_groups_excel_main = csrf_exempt(import_groups_excel_main)  
import_tables_excel_main = csrf_exempt(import_tables_excel_main)
import_containers_excel_main = csrf_exempt(import_containers_excel_main)
import_ingredients_excel_main = csrf_exempt(import_ingredients_excel_main)

urlpatterns = [
    path('admin/', admin.site.urls),
    # Health check - MUST come before api/v1/ include to bypass authentication
    path('api/v1/health/', health_check, name='health_check'),
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
