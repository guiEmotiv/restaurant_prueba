from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.authentication import SessionAuthentication
from django.utils import timezone
from django.db.models import Sum, Count, Q, F, Prefetch
from django.db import connection
from datetime import datetime, timedelta
from decimal import Decimal
from .models import Order, OrderItem, Payment
from inventory.models import Recipe


class DashboardOperativoViewSet(viewsets.ViewSet):
    """
    Vista específica para Dashboard Operativo
    Enfocada en métricas operacionales y de cocina con vista de BD optimizada
    """
    permission_classes = [AllowAny]  # Acceso completo en desarrollo
    authentication_classes = []  # Sin autenticación requerida en desarrollo
    
    @action(detail=False, methods=['get'], permission_classes=[AllowAny], authentication_classes=[])
    def report(self, request):
        """
        Endpoint específico para dashboard operativo usando vista de BD optimizada
        Consulta directa a la vista dashboard_operativo_view para máximo rendimiento
        """
        try:
            # Obtener parámetros del request
            query_params = getattr(request, 'query_params', request.GET)
            date_param = query_params.get('date')
            
            # Calcular fecha de referencia
            if date_param:
                try:
                    selected_date = datetime.strptime(date_param, '%Y-%m-%d').date()
                except ValueError:
                    selected_date = timezone.now().date()
            else:
                selected_date = timezone.now().date()
            
            # Consultar la vista de BD optimizada
            operational_data = self._query_dashboard_view(selected_date)
            
            # Agregar información de la fecha
            operational_data['date'] = selected_date.isoformat()
            operational_data['timestamp'] = timezone.now().isoformat()
            
            return Response(operational_data)
        
        except Exception as e:
            return Response({
                'error': f'Error en dashboard operativo: {str(e)}',
                'date': timezone.now().date().isoformat(),
                'timestamp': timezone.now().isoformat(),
                'summary': {
                    'active_orders': 0, 
                    'pending_items': 0, 
                    'preparing_items': 0, 
                    'served_items': 0,
                    'overdue_items': 0,
                    'total_revenue_today': 0
                },
                'kitchen_status': [],
                'zone_activity': [],
                'recent_orders': [],
                'hourly_activity': []
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _query_dashboard_view(self, selected_date):
        """
        Enfoque híbrido: usa dashboard_operativo_view para datos operativos y consulta directa para PAID orders
        Dashboard operativo: PAID orders para métricas principales, TODOS los estados para Estado de Items
        """
        from django.db import connection
        from decimal import Decimal
        from collections import defaultdict
        
        # PARTE 1: Obtener datos financieros de órdenes PAID (sin payments para evitar duplicación)
        cursor = connection.cursor()
        try:
            cursor.execute("""
                SELECT 
                    o.id as order_id, o.total_amount as order_total, o.status as order_status, o.waiter,
                    oi.id as item_id, oi.quantity, oi.unit_price, oi.total_price, oi.status as item_status,
                    r.name as recipe_name, g.name as category_name, g.id as category_id,
                    DATE(datetime(o.paid_at, '-5 hours')) as operational_date
                FROM "order" o
                LEFT JOIN order_item oi ON o.id = oi.order_id
                LEFT JOIN recipe r ON oi.recipe_id = r.id
                LEFT JOIN "group" g ON r.group_id = g.id
                WHERE DATE(datetime(o.paid_at, '-5 hours')) = %s AND o.status = 'PAID'
                ORDER BY o.id, oi.id
            """, [selected_date])
            
            paid_data = cursor.fetchall()
        finally:
            cursor.close()
        
        # PARTE 1.5: Obtener datos de payments por separado
        cursor = connection.cursor()
        try:
            cursor.execute("""
                SELECT 
                    o.id as order_id, p.payment_method, p.amount as payment_amount
                FROM "order" o
                LEFT JOIN payment p ON o.id = p.order_id
                WHERE DATE(datetime(o.paid_at, '-5 hours')) = %s AND o.status = 'PAID'
                ORDER BY o.id
            """, [selected_date])
            
            payment_data = cursor.fetchall()
        finally:
            cursor.close()
        
        # PARTE 2: Obtener datos operativos completos de la vista dashboard_operativo_view
        cursor2 = connection.cursor()
        try:
            cursor2.execute("""
                SELECT 
                    order_id, order_status, order_total, waiter,
                    item_id, item_status, recipe_name, category_name,
                    operational_date, is_active_order, is_pending_item, 
                    is_preparing_item, is_served_item
                FROM dashboard_operativo_view 
                WHERE operational_date = %s
                ORDER BY order_id, item_id
            """, [selected_date])
            
            operational_data = cursor2.fetchall()
        finally:
            cursor2.close()
        
        if not paid_data and not operational_data:
            # Sin datos para la fecha
            return {
                'summary': {
                    'total_orders': 0, 'total_revenue': 0, 'average_ticket': 0, 'total_items': 0,
                    'average_service_time': 0, 'active_orders': 0, 'pending_items': 0,
                    'preparing_items': 0, 'served_items': 0
                },
                'category_breakdown': [], 'top_dishes': [], 'waiter_performance': [],
                'payment_methods': [], 'item_status_breakdown': [], 'unsold_recipes': []
            }
        
        # Inicializar estructuras de datos
        paid_orders = set()
        paid_orders_totals = {}
        category_stats = defaultdict(lambda: {'revenue': Decimal('0'), 'quantity': 0})
        dish_stats = defaultdict(lambda: {'category': '', 'quantity': 0, 'revenue': Decimal('0'), 'unit_price': Decimal('0')})
        waiter_stats = defaultdict(lambda: {'revenue': Decimal('0'), 'orders': 0})
        item_status_stats = defaultdict(lambda: {'count': 0, 'amount': Decimal('0')})
        payment_stats = defaultdict(lambda: {'amount': Decimal('0'), 'count': 0})
        
        # PROCESAR DATOS PAID (métricas financieras)
        for row in paid_data:
            (order_id, order_total, order_status, waiter,
             item_id, quantity, unit_price, total_price, item_status,
             recipe_name, category_name, category_id, operational_date) = row
            
            paid_orders.add(order_id)
            
            # Guardar total de la orden una sola vez
            if order_id not in paid_orders_totals:
                paid_orders_totals[order_id] = Decimal(str(order_total or 0))
            
            # Stats por categoría (solo órdenes PAID)
            if category_name and item_id:
                category_stats[category_name]['revenue'] += Decimal(str(total_price or 0))
                category_stats[category_name]['quantity'] += quantity or 0
            
            # Stats por plato (solo órdenes PAID)
            if recipe_name and item_id:
                dish_stats[recipe_name]['category'] = category_name or 'Sin Categoría'
                dish_stats[recipe_name]['quantity'] += quantity or 0
                dish_stats[recipe_name]['revenue'] += Decimal(str(total_price or 0))
                dish_stats[recipe_name]['unit_price'] = Decimal(str(unit_price or 0))
            
            # Stats por mesero (solo órdenes PAID) - evitar duplicados
            waiter_name = waiter or 'Sin Asignar'
            if order_id not in [w['order_id'] for w in waiter_stats[waiter_name].get('processed_orders', [])]:
                if 'processed_orders' not in waiter_stats[waiter_name]:
                    waiter_stats[waiter_name]['processed_orders'] = []
                waiter_stats[waiter_name]['processed_orders'].append({'order_id': order_id})
                waiter_stats[waiter_name]['revenue'] += Decimal(str(order_total or 0))
                waiter_stats[waiter_name]['orders'] += 1
        
        # PROCESAR DATOS DE PAYMENTS por separado
        for row in payment_data:
            (order_id, payment_method, payment_amount) = row
            
            if payment_method and payment_amount:
                payment_stats[payment_method]['amount'] += Decimal(str(payment_amount))
                payment_stats[payment_method]['count'] += 1
        
        # PROCESAR DATOS OPERATIVOS (estado de items y métricas operativas)
        for row in operational_data:
            (order_id, order_status, order_total, waiter,
             item_id, item_status, recipe_name, category_name,
             operational_date, is_active_order, is_pending_item, 
             is_preparing_item, is_served_item) = row
            
            # Estado de items: TODOS los items del día (operativos)
            if item_id and item_status:
                item_status_stats[item_status]['count'] += 1
                item_status_stats[item_status]['amount'] += Decimal('0')
        
        # AGREGAR ITEMS PAID AL ESTADO DE ITEMS (para mostrar TODOS los estados del día)
        for row in paid_data:
            (order_id, order_total, order_status, waiter,
             item_id, quantity, unit_price, total_price, item_status,
             recipe_name, category_name, category_id, operational_date) = row
            
            # Los items de órdenes PAID también van al estado de items
            if item_id and item_status:
                item_status_stats[item_status]['count'] += 1
                item_status_stats[item_status]['amount'] += Decimal(str(total_price or 0))
        
        # Calcular métricas principales (solo órdenes PAID)
        total_orders = len(paid_orders)
        total_revenue = sum(paid_orders_totals.values())
        average_ticket = total_revenue / total_orders if total_orders > 0 else Decimal('0')
        
        # Calcular items totales de órdenes PAID
        total_items = len([item for item in paid_data if item[4] is not None])  # item[4] is item_id
        
        # Calcular métricas operativas desde operational_data
        active_orders = len(set(row[0] for row in operational_data if row[9] == 1))  # is_active_order
        pending_items = sum(row[10] for row in operational_data if row[10] is not None)  # is_pending_item
        preparing_items = sum(row[11] for row in operational_data if row[11] is not None)  # is_preparing_item
        served_items = sum(row[12] for row in operational_data if row[12] is not None)  # is_served_item
        
        # Calcular tiempo promedio de servicio real usando datos PAID
        service_times = []
        
        # Obtener datos de tiempo desde paid_data
        cursor_time = connection.cursor()
        try:
            cursor_time.execute("""
                SELECT 
                    oi.created_at as item_created,
                    oi.preparing_at,
                    o.paid_at
                FROM "order" o
                LEFT JOIN order_item oi ON o.id = oi.order_id
                WHERE DATE(datetime(o.paid_at, '-5 hours')) = %s AND o.status = 'PAID'
                AND oi.id IS NOT NULL AND oi.created_at IS NOT NULL AND o.paid_at IS NOT NULL
            """, [selected_date])
            
            time_data = cursor_time.fetchall()
            
            for row in time_data:
                item_created, preparing_at, paid_at = row
                
                # Calcular tiempo de servicio desde creación del item hasta pago
                if item_created and paid_at:
                    from datetime import datetime
                    if isinstance(item_created, str):
                        item_created = datetime.fromisoformat(item_created.replace('Z', '+00:00'))
                    if isinstance(paid_at, str):
                        paid_at = datetime.fromisoformat(paid_at.replace('Z', '+00:00'))
                    
                    time_diff = paid_at - item_created
                    service_time_minutes = time_diff.total_seconds() / 60
                    service_times.append(service_time_minutes)
                    
        finally:
            cursor_time.close()
        
        # Promedio real de tiempo de servicio
        average_service_time = sum(service_times) / len(service_times) if service_times else 0
        
        # Formatear resultados
        
        # Category breakdown
        total_category_revenue = sum(cat['revenue'] for cat in category_stats.values())
        category_breakdown = []
        for category, stats in sorted(category_stats.items(), key=lambda x: x[1]['revenue'], reverse=True):
            percentage = (stats['revenue'] / total_category_revenue * 100) if total_category_revenue > 0 else 0
            category_breakdown.append({
                'category': category,
                'revenue': float(stats['revenue']),
                'quantity': stats['quantity'],
                'percentage': float(percentage)
            })
        
        # Top dishes
        top_dishes = []
        for dish, stats in sorted(dish_stats.items(), key=lambda x: x[1]['quantity'], reverse=True)[:10]:
            top_dishes.append({
                'name': dish,
                'category': stats['category'],
                'quantity': stats['quantity'],
                'revenue': float(stats['revenue']),
                'unit_price': float(stats['unit_price'])
            })
        
        # Waiter performance  
        waiter_performance = []
        for waiter, stats in sorted(waiter_stats.items(), key=lambda x: x[1]['revenue'], reverse=True):
            # Limpiar processed_orders del resultado
            clean_stats = {k: v for k, v in stats.items() if k != 'processed_orders'}
            avg_ticket = clean_stats['revenue'] / clean_stats['orders'] if clean_stats['orders'] > 0 else Decimal('0')
            waiter_performance.append({
                'waiter': waiter,
                'revenue': float(clean_stats['revenue']),
                'orders': clean_stats['orders'],
                'average_ticket': float(avg_ticket)
            })
        
        # Payment methods - limpiar processed_orders del resultado
        total_payment_amount = sum(stat['amount'] for stat in payment_stats.values())
        payment_methods = []
        for method, stats in payment_stats.items():
            clean_stats = {k: v for k, v in stats.items() if k != 'processed_orders'}
            percentage = (clean_stats['amount'] / total_payment_amount * 100) if total_payment_amount > 0 else 0
            payment_methods.append({
                'method': method,
                'amount': float(clean_stats['amount']),
                'percentage': float(percentage),
                'transaction_count': clean_stats['count']
            })
        
        # Item status breakdown (TODOS los estados)
        total_status_items = sum(stat['count'] for stat in item_status_stats.values())
        item_status_breakdown = []
        for status, stats in item_status_stats.items():
            count_percentage = (stats['count'] / total_status_items * 100) if total_status_items > 0 else 0
            item_status_breakdown.append({
                'status': status,
                'count': stats['count'],
                'amount': float(stats['amount']),
                'count_percentage': float(count_percentage)
            })
        
        # Recetas no vendidas (usando datos PAID procesados)
        from inventory.models import Recipe
        sold_recipe_names = [row[9] for row in paid_data if row[9] is not None]  # recipe_name from paid_data
        unsold_recipes = Recipe.objects.exclude(name__in=sold_recipe_names).select_related('group')[:50]
        unsold_recipes_list = []
        for recipe in unsold_recipes:
            unsold_recipes_list.append({
                'name': recipe.name,
                'category': getattr(recipe.group, 'name', 'Sin Categoría') if hasattr(recipe, 'group') and recipe.group else 'Sin Categoría',
                'price': float(recipe.base_price) if recipe.base_price else 0.0
            })
        
        return {
            'summary': {
                'total_orders': total_orders,
                'total_revenue': float(total_revenue),
                'average_ticket': float(average_ticket),
                'total_items': total_items,
                'average_service_time': round(average_service_time, 1),
                'active_orders': active_orders or 0,
                'pending_items': pending_items or 0,
                'preparing_items': preparing_items or 0,
                'served_items': served_items or 0
            },
            'category_breakdown': category_breakdown,
            'top_dishes': top_dishes,
            'waiter_performance': waiter_performance,
            'payment_methods': payment_methods,
            'item_status_breakdown': item_status_breakdown,
            'unsold_recipes': unsold_recipes_list
        }
    
    @action(detail=False, methods=['get'])
    def export_excel(self, request):
        """
        Exporta datos del dashboard operativo a Excel usando vista de BD optimizada
        """
        try:
            import openpyxl
            from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
            from openpyxl.utils import get_column_letter
            from django.http import HttpResponse
            from django.db import connection
            from decimal import Decimal
            
            # Obtener fecha del parámetro
            date_param = request.query_params.get('date')
            if date_param:
                try:
                    selected_date = datetime.strptime(date_param, '%Y-%m-%d').date()
                except ValueError:
                    selected_date = timezone.now().date()
            else:
                selected_date = timezone.now().date()
            
            # Usar consulta SQL directa con máximo detalle incluyendo ingredientes para trazabilidad completa
            cursor = connection.cursor()
            try:
                cursor.execute("""
                    SELECT 
                        -- Información básica de la orden
                        o.id as order_id,
                        o.created_at as order_created,
                        o.served_at as order_served,
                        o.paid_at as order_paid,
                        o.total_amount as order_total,
                        o.status as order_status,
                        o.waiter,
                        
                        -- Información de la mesa y zona
                        t.table_number,
                        z.name as zone_name,
                        z.id as zone_id,
                        
                        -- Información del item
                        oi.id as item_id,
                        oi.quantity as item_quantity,
                        oi.unit_price as item_unit_price,
                        oi.total_price as item_total_price,
                        oi.status as item_status,
                        oi.notes as item_notes,
                        oi.is_takeaway,
                        oi.has_taper,
                        oi.created_at as item_created,
                        oi.preparing_at as item_preparing,
                        
                        -- Información de la receta
                        r.id as recipe_id,
                        r.name as recipe_name,
                        r.version as recipe_version,
                        r.base_price as recipe_base_price,
                        r.preparation_time as recipe_prep_time,
                        r.is_active as recipe_active,
                        r.is_available as recipe_available,
                        
                        -- Información del grupo/categoría
                        g.name as category_name,
                        g.id as category_id,
                        
                        -- Información detallada de ingredientes
                        ri.id as recipe_item_id,
                        ri.quantity as ingredient_recipe_quantity,
                        i.id as ingredient_id,
                        i.name as ingredient_name,
                        i.unit_price as ingredient_unit_price,
                        i.current_stock as ingredient_stock,
                        u.name as ingredient_unit,
                        
                        -- Cálculos de costos
                        (ri.quantity * i.unit_price) as ingredient_cost,
                        (ri.quantity * oi.quantity) as total_ingredient_quantity_used,
                        (ri.quantity * i.unit_price * oi.quantity) as total_ingredient_cost,
                        
                        -- Información de pagos
                        p.id as payment_id,
                        p.payment_method,
                        p.amount as payment_amount,
                        p.tax_amount as payment_tax,
                        p.payer_name,
                        p.created_at as payment_date,
                        
                        -- Información de contenedores/envases
                        cs.id as container_sale_id,
                        cs.quantity as container_quantity,
                        cs.unit_price as container_unit_price,
                        cs.total_price as container_total_price,
                        c.name as container_name,
                        
                        -- Tiempos calculados para trazabilidad
                        CASE 
                            WHEN oi.created_at IS NOT NULL AND oi.preparing_at IS NOT NULL 
                            THEN CAST((julianday(oi.preparing_at) - julianday(oi.created_at)) * 24 * 60 AS INTEGER)
                            ELSE NULL 
                        END as prep_start_minutes,
                        
                        CASE 
                            WHEN oi.preparing_at IS NOT NULL AND o.served_at IS NOT NULL 
                            THEN CAST((julianday(o.served_at) - julianday(oi.preparing_at)) * 24 * 60 AS INTEGER)
                            ELSE NULL 
                        END as prep_duration_minutes,
                        
                        CASE 
                            WHEN o.created_at IS NOT NULL AND o.paid_at IS NOT NULL 
                            THEN CAST((julianday(o.paid_at) - julianday(o.created_at)) * 24 * 60 AS INTEGER)
                            ELSE NULL 
                        END as total_service_minutes,
                        
                        -- Fecha operativa
                        DATE(datetime(o.paid_at, '-5 hours')) as operational_date
                        
                    FROM "order" o
                    LEFT JOIN "table" t ON o.table_id = t.id
                    LEFT JOIN zone z ON t.zone_id = z.id
                    LEFT JOIN order_item oi ON o.id = oi.order_id
                    LEFT JOIN recipe r ON oi.recipe_id = r.id
                    LEFT JOIN "group" g ON r.group_id = g.id
                    LEFT JOIN recipe_item ri ON r.id = ri.recipe_id
                    LEFT JOIN ingredient i ON ri.ingredient_id = i.id
                    LEFT JOIN unit u ON i.unit_id = u.id
                    LEFT JOIN payment p ON o.id = p.order_id
                    LEFT JOIN container_sale cs ON o.id = cs.order_id
                    LEFT JOIN container c ON cs.container_id = c.id
                    
                    WHERE DATE(datetime(o.paid_at, '-5 hours')) = %s 
                    AND o.status = 'PAID'
                    
                    ORDER BY o.created_at DESC, oi.id ASC, ri.id ASC;
                """, [selected_date])
                
                dashboard_data = cursor.fetchall()
            finally:
                cursor.close()
            
            # Crear workbook de Excel
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Dashboard Operativo"
            
            # Estilos
            header_font = Font(bold=True, color="FFFFFF")
            header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
            header_alignment = Alignment(horizontal="center", vertical="center")
            border = Border(
                left=Side(style='thin'),
                right=Side(style='thin'),
                top=Side(style='thin'),
                bottom=Side(style='thin')
            )
            
            # Headers completos para máxima trazabilidad
            headers = [
                # Información básica de orden
                'Fecha', 'Hora Orden', 'ID Orden', 'Estado Orden', 'Total Orden', 'Mesero',
                'Mesa', 'Zona', 'ID Zona',
                
                # Información de item
                'ID Item', 'Cantidad Item', 'Precio Unit. Item', 'Precio Total Item', 'Estado Item', 'Notas Item', 
                'Delivery', 'Con Envase', 'Hora Creación Item', 'Hora Preparación Item',
                
                # Información de receta
                'ID Receta', 'Nombre Receta', 'Versión Receta', 'Precio Base Receta', 'Tiempo Prep. Receta (min)',
                'Receta Activa', 'Receta Disponible', 'Categoría', 'ID Categoría',
                
                # Información detallada de ingredientes
                'ID Ingrediente', 'Nombre Ingrediente', 'Cantidad en Receta', 'Unidad Ingrediente',
                'Precio Unit. Ingrediente', 'Stock Actual Ingrediente', 'Costo Ingrediente en Receta',
                'Cantidad Total Ingrediente Usado', 'Costo Total Ingrediente',
                
                # Información de pagos
                'ID Pago', 'Método Pago', 'Monto Pagado', 'Impuesto Pago', 'Nombre Pagador', 'Fecha Pago',
                
                # Información de contenedores
                'ID Venta Contenedor', 'Nombre Contenedor', 'Cantidad Contenedor', 'Precio Unit. Contenedor',
                'Precio Total Contenedor',
                
                # Tiempos de trazabilidad
                'Tiempo Inicio Prep. (min)', 'Tiempo Duración Prep. (min)', 'Tiempo Total Servicio (min)',
                
                # Fechas de seguimiento
                'Fecha Operativa', 'Hora Servido', 'Hora Pagado'
            ]
            
            # Escribir headers
            for col, header in enumerate(headers, 1):
                cell = ws.cell(row=1, column=col, value=header)
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = header_alignment
                cell.border = border
            
            # Datos detallados completos
            row_num = 2
            
            for row in dashboard_data:
                (order_id, order_created, order_served, order_paid, order_total, order_status, waiter,
                 table_number, zone_name, zone_id,
                 item_id, item_quantity, item_unit_price, item_total_price, item_status, item_notes, 
                 is_takeaway, has_taper, item_created, item_preparing,
                 recipe_id, recipe_name, recipe_version, recipe_base_price, recipe_prep_time, 
                 recipe_active, recipe_available, category_name, category_id,
                 recipe_item_id, ingredient_recipe_quantity, ingredient_id, ingredient_name, 
                 ingredient_unit_price, ingredient_stock, ingredient_unit,
                 ingredient_cost, total_ingredient_quantity_used, total_ingredient_cost,
                 payment_id, payment_method, payment_amount, payment_tax, payer_name, payment_date,
                 container_sale_id, container_quantity, container_unit_price, container_total_price, 
                 container_name,
                 prep_start_minutes, prep_duration_minutes, total_service_minutes,
                 operational_date) = row
                
                # Formatear fechas y horas
                def format_datetime(dt_value):
                    try:
                        if dt_value:
                            if isinstance(dt_value, str):
                                dt = datetime.fromisoformat(dt_value.replace('Z', '+00:00'))
                            else:
                                dt = dt_value
                            return dt.strftime('%H:%M')
                        return ''
                    except:
                        return ''
                
                def format_date(dt_value):
                    try:
                        if dt_value:
                            if isinstance(dt_value, str):
                                dt = datetime.fromisoformat(dt_value.replace('Z', '+00:00'))
                            else:
                                dt = dt_value
                            return dt.strftime('%d/%m/%Y %H:%M')
                        return ''
                    except:
                        return ''
                
                # Escribir fila completa con todos los detalles
                col_data = [
                    # Información básica de orden
                    selected_date.strftime('%d/%m/%Y'),
                    format_datetime(order_created),
                    order_id or '',
                    order_status or '',
                    float(order_total or 0),
                    waiter or '',
                    table_number or '',
                    zone_name or '',
                    zone_id or '',
                    
                    # Información de item
                    item_id or '',
                    item_quantity or 0,
                    float(item_unit_price or 0),
                    float(item_total_price or 0),
                    item_status or '',
                    item_notes or '',
                    'Sí' if is_takeaway else 'No',
                    'Sí' if has_taper else 'No',
                    format_datetime(item_created),
                    format_datetime(item_preparing),
                    
                    # Información de receta
                    recipe_id or '',
                    recipe_name or '',
                    recipe_version or '',
                    float(recipe_base_price or 0),
                    recipe_prep_time or 0,
                    'Sí' if recipe_active else 'No',
                    'Sí' if recipe_available else 'No',
                    category_name or '',
                    category_id or '',
                    
                    # Información detallada de ingredientes
                    ingredient_id or '',
                    ingredient_name or '',
                    float(ingredient_recipe_quantity or 0),
                    ingredient_unit or '',
                    float(ingredient_unit_price or 0),
                    float(ingredient_stock or 0),
                    float(ingredient_cost or 0),
                    float(total_ingredient_quantity_used or 0),
                    float(total_ingredient_cost or 0),
                    
                    # Información de pagos
                    payment_id or '',
                    payment_method or '',
                    float(payment_amount or 0),
                    float(payment_tax or 0),
                    payer_name or '',
                    format_date(payment_date),
                    
                    # Información de contenedores
                    container_sale_id or '',
                    container_name or '',
                    container_quantity or 0,
                    float(container_unit_price or 0),
                    float(container_total_price or 0),
                    
                    # Tiempos de trazabilidad
                    prep_start_minutes or 0,
                    prep_duration_minutes or 0,
                    total_service_minutes or 0,
                    
                    # Fechas de seguimiento
                    operational_date or '',
                    format_datetime(order_served),
                    format_datetime(order_paid)
                ]
                
                # Escribir datos en Excel
                for col, value in enumerate(col_data, 1):
                    ws.cell(row=row_num, column=col, value=value)
                
                # Aplicar bordes a todas las columnas
                for col in range(1, len(headers) + 1):
                    ws.cell(row=row_num, column=col).border = border
                
                row_num += 1
            
            # Ajustar ancho de columnas
            for column in ws.columns:
                max_length = 0
                column = [cell for cell in column]
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = min(max_length + 2, 30)
                ws.column_dimensions[get_column_letter(column[0].column)].width = adjusted_width
            
            # Preparar respuesta
            response = HttpResponse(
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            )
            response['Content-Disposition'] = f'attachment; filename=Dashboard_Operativo_{selected_date.strftime("%d-%m-%Y")}.xlsx'
            
            # Guardar el workbook en la respuesta
            wb.save(response)
            
            return response
                
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'error': f'Error generating export: {str(e)}',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)