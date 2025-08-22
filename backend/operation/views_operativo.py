from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.authentication import SessionAuthentication
from django.utils import timezone
from django.db.models import Sum, Count, Q, F
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
        sold_recipe_names = [row[6] for row in paid_data if row[6] is not None]  # recipe_name from paid_data
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