from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from django.utils import timezone
from django.db.models import Sum, Count, Q, F
from django.db import connection
from datetime import datetime, timedelta
from decimal import Decimal
from .models import Order, OrderItem, Payment
from inventory.models import Recipe


class DashboardFinancieroViewSet(viewsets.ViewSet):
    """
    Vista específica para Dashboard Financiero
    AHORA USA dashboard_operativo_view para estandarización completa del sistema
    """
    # Use default authentication from settings (Cognito if enabled)
    
    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def debug_view(self, request):
        """Debug endpoint para verificar estado de dashboard_operativo_view"""
        try:
            from django.db import connection
            cursor = connection.cursor()
            
            # Verificar si la vista existe
            cursor.execute("SELECT name FROM sqlite_master WHERE type='view' AND name='dashboard_operativo_view'")
            view_exists = cursor.fetchone()
            
            if view_exists:
                # Contar registros
                cursor.execute("SELECT COUNT(*) FROM dashboard_operativo_view")
                count = cursor.fetchone()[0]
                
                # Obtener primeros 3 registros
                cursor.execute("SELECT * FROM dashboard_operativo_view LIMIT 3")
                sample_data = cursor.fetchall()
                
                cursor.close()
                return Response({
                    'view_exists': True,
                    'record_count': count,
                    'sample_data': sample_data[:3] if sample_data else [],
                    'status': 'success'
                })
            else:
                cursor.close()
                return Response({
                    'view_exists': False,
                    'error': 'dashboard_operativo_view no existe',
                    'status': 'error'
                })
                
        except Exception as e:
            return Response({
                'error': str(e),
                'status': 'database_error'
            })
    
    @action(detail=False, methods=['get'])
    def report(self, request):
        """
        Endpoint específico para dashboard financiero usando vista de BD optimizada
        Consulta directa a la vista dashboard_financiero_view para máximo rendimiento
        """
        try:
            # Obtener parámetros del request
            query_params = getattr(request, 'query_params', request.GET)
            period = query_params.get('period', 'all')
            date_param = query_params.get('date')
            
            # Calcular fechas según el período
            period_info = self._calculate_period_dates(period, date_param)
            
            # Consultar la vista de BD optimizada
            financial_data = self._query_dashboard_view(period_info)
            
            # Agregar información del período
            financial_data['period_info'] = {
                'period': period,
                'start_date': period_info['start_date'].isoformat() if period_info['start_date'] else None,
                'end_date': period_info['end_date'].isoformat() if period_info['end_date'] else None,
                'display_date': period_info['display_date'].isoformat(),
                'total_days': period_info['total_days']
            }
            
            return Response(financial_data)
        
        except Exception as e:
            return Response({
                'error': f'Error en dashboard financiero: {str(e)}',
                'period_info': {'period': 'error', 'start_date': None, 'end_date': None, 'display_date': None, 'total_days': 0},
                'summary': {'total_orders': 0, 'total_revenue': 0, 'average_ticket': 0, 'total_items': 0},
                'category_breakdown': [],
                'top_dishes': [],
                'payment_methods': [],
                'sales_by_day': [],
                'revenue_trends': []
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _calculate_period_dates(self, period, date_param=None):
        """
        Calcula las fechas de inicio y fin según el período seleccionado
        """
        today = timezone.now().date()
        
        if date_param:
            try:
                reference_date = datetime.strptime(date_param, '%Y-%m-%d').date()
            except ValueError:
                reference_date = today
        else:
            reference_date = today
        
        if period == 'today':
            return {
                'start_date': reference_date,
                'end_date': reference_date,
                'display_date': reference_date,
                'total_days': 1
            }
        elif period == 'yesterday':
            yesterday = reference_date - timedelta(days=1)
            return {
                'start_date': yesterday,
                'end_date': yesterday,
                'display_date': yesterday,
                'total_days': 1
            }
        elif period == 'month':
            # Último mes (30 días)
            start_date = reference_date - timedelta(days=29)
            return {
                'start_date': start_date,
                'end_date': reference_date,
                'display_date': reference_date,
                'total_days': 30
            }
        elif period == 'quarter':
            # Último trimestre (90 días)
            start_date = reference_date - timedelta(days=89)
            return {
                'start_date': start_date,
                'end_date': reference_date,
                'display_date': reference_date,
                'total_days': 90
            }
        elif period == 'semester':
            # Último semestre (180 días)
            start_date = reference_date - timedelta(days=179)
            return {
                'start_date': start_date,
                'end_date': reference_date,
                'display_date': reference_date,
                'total_days': 180
            }
        elif period == 'year':
            # Último año (365 días)
            start_date = reference_date - timedelta(days=364)
            return {
                'start_date': start_date,
                'end_date': reference_date,
                'display_date': reference_date,
                'total_days': 365
            }
        else:
            # Por defecto: último mes
            start_date = reference_date - timedelta(days=29)
            return {
                'start_date': start_date,
                'end_date': reference_date,
                'display_date': reference_date,
                'total_days': 30
            }
    
    def _query_dashboard_view(self, period_info):
        """
        USA dashboard_operativo_view para estandarización completa del sistema
        Filtrada por período para análisis financiero
        """
        from django.db import connection
        from decimal import Decimal
        from collections import defaultdict
        
        cursor = connection.cursor()
        
        # Construir filtro de fechas para el período
        date_filter = ""
        params = []
        
        if period_info['start_date'] and period_info['end_date']:
            date_filter = "WHERE operational_date BETWEEN ? AND ? AND order_status = 'PAID'"
            params = [period_info['start_date'], period_info['end_date']]
        else:
            date_filter = "WHERE order_status = 'PAID'"
        
        # CONSULTA ÚNICA A dashboard_operativo_view - INCLUIR total_with_container para consistencia
        try:
            cursor.execute(f"""
                SELECT 
                    order_id, order_total, order_status, waiter, operational_date,
                    item_id, quantity, unit_price, total_price, total_with_container, item_status, is_takeaway,
                    recipe_name, category_name, category_id,
                    payment_method, payment_amount
                FROM dashboard_operativo_view
                {date_filter}
                ORDER BY operational_date DESC, order_id, item_id
            """, params)
        except Exception as db_error:
            cursor.close()
            raise Exception(f"Error en consulta dashboard_operativo_view: {str(db_error)}")
        
        all_data = cursor.fetchall()
        cursor.close()
        
        if not all_data:
            # Retorno vacío para período sin datos
            return {
                'summary': {
                    'total_orders': 0,
                    'total_revenue': 0.0,
                    'average_ticket': 0.0,
                    'total_items': 0
                },
                'category_breakdown': [],
                'top_dishes': [],
                'payment_methods': [],
                'sales_by_day': [],
                'revenue_trends': {
                    'daily_average': 0,
                    'daily_maximum': 0
                },
                'production_trends': {
                    'daily_average': 0,
                    'daily_maximum': 0
                }
            }
        
        # Inicializar estructuras de datos
        paid_orders = set()
        paid_orders_totals = {}
        category_stats = defaultdict(lambda: {'revenue': Decimal('0'), 'quantity': 0})
        dish_stats = defaultdict(lambda: {'category': '', 'quantity': 0, 'revenue': Decimal('0'), 'unit_price': Decimal('0')})
        payment_stats = defaultdict(lambda: {'amount': Decimal('0'), 'count': 0})
        daily_sales = defaultdict(lambda: {'orders': 0, 'revenue': Decimal('0'), 'items': 0})
        daily_category_stats = defaultdict(lambda: defaultdict(lambda: {'revenue': Decimal('0'), 'quantity': 0}))
        daily_dish_stats = defaultdict(lambda: defaultdict(lambda: {'category': '', 'quantity': 0, 'revenue': Decimal('0'), 'unit_price': Decimal('0')}))
        
        # PROCESAR DATOS DE dashboard_operativo_view - INCLUIR total_with_container para consistencia
        for row in all_data:
            (order_id, order_total, order_status, waiter, operational_date,
             item_id, quantity, unit_price, total_price, total_with_container, item_status, is_takeaway,
             recipe_name, category_name, category_id,
             payment_method, payment_amount) = row
            
            # Solo órdenes PAID
            if order_status == 'PAID' and item_id:
                paid_orders.add(order_id)
                
                if order_id not in paid_orders_totals:
                    # Calcular el total real con containers para esta orden
                    order_real_total = Decimal('0')
                    for check_row in all_data:
                        if check_row[0] == order_id and check_row[2] == 'PAID' and check_row[5] is not None:  # order_id, order_status, item_id
                            order_real_total += Decimal(str(check_row[9] or 0))  # total_with_container
                    
                    paid_orders_totals[order_id] = order_real_total
                    # Agregar a daily_sales una sola vez por orden - USAR total real con containers
                    date_str = str(operational_date)
                    daily_sales[date_str]['orders'] += 1
                    daily_sales[date_str]['revenue'] += order_real_total
                
                # Stats por categoría - USAR total_with_container para consistencia
                if category_name and recipe_name:
                    category = category_name or 'Sin Categoría'
                    category_stats[category]['revenue'] += Decimal(str(total_with_container or 0))
                    category_stats[category]['quantity'] += quantity or 0
                    
                    # Stats por día y categoría
                    date_str = str(operational_date)
                    daily_category_stats[date_str][category]['revenue'] += Decimal(str(total_with_container or 0))
                    daily_category_stats[date_str][category]['quantity'] += quantity or 0
                
                # Stats por receta (top dishes) - USAR total_with_container para consistencia
                if recipe_name:
                    dish_stats[recipe_name]['category'] = category_name or 'Sin Categoría'
                    dish_stats[recipe_name]['quantity'] += quantity or 0
                    dish_stats[recipe_name]['revenue'] += Decimal(str(total_with_container or 0))
                    dish_stats[recipe_name]['unit_price'] = Decimal(str(unit_price or 0))
                    
                    # Stats por día y receta (para tooltips específicos por fecha)
                    date_str = str(operational_date)
                    daily_dish_stats[date_str][recipe_name]['category'] = category_name or 'Sin Categoría'
                    daily_dish_stats[date_str][recipe_name]['quantity'] += quantity or 0
                    daily_dish_stats[date_str][recipe_name]['revenue'] += Decimal(str(total_with_container or 0))
                    daily_dish_stats[date_str][recipe_name]['unit_price'] = Decimal(str(unit_price or 0))
                
                # Stats de pagos - USAR total de la orden con contenedores para consistencia
                if payment_method and payment_amount and order_id not in [p['order_id'] for p in payment_stats[payment_method].get('processed_orders', [])]:
                    # Usar el total_with_container de todos los items de la orden para este método de pago
                    order_total_with_container = Decimal('0')
                    for check_row in all_data:
                        if check_row[0] == order_id and check_row[2] == 'PAID' and check_row[5] is not None:  # order_id, order_status, item_id
                            order_total_with_container += Decimal(str(check_row[9] or 0))  # total_with_container
                    
                    payment_stats[payment_method]['amount'] += order_total_with_container
                    payment_stats[payment_method]['count'] += 1
                    
                    # Marcar orden como procesada para este método de pago
                    if 'processed_orders' not in payment_stats[payment_method]:
                        payment_stats[payment_method]['processed_orders'] = []
                    payment_stats[payment_method]['processed_orders'].append({'order_id': order_id})
                
                # Items por día
                date_str = str(operational_date)
                daily_sales[date_str]['items'] += quantity or 0
        
        # Calcular métricas principales
        total_orders = len(paid_orders)
        total_revenue = sum(paid_orders_totals.values())
        average_ticket = total_revenue / total_orders if total_orders > 0 else Decimal('0')
        total_items = len([row for row in all_data if row[2] == 'PAID' and row[5] is not None])
        
        # Formatear category_breakdown
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
        
        # Top dishes - incluir TODOS los platos para que el tooltip funcione correctamente
        top_dishes = []
        for dish, stats in sorted(dish_stats.items(), key=lambda x: x[1]['quantity'], reverse=True):
            top_dishes.append({
                'name': dish,
                'category': stats['category'],
                'quantity': stats['quantity'],
                'revenue': float(stats['revenue']),
                'unit_price': float(stats['unit_price'])
            })
        
        # Ventas por día CON breakdown por categoría
        sales_by_day = []
        for day, stats in sorted(daily_sales.items()):
            # Category breakdown para este día específico
            day_category_breakdown = []
            if day in daily_category_stats:
                for category, cat_stats in daily_category_stats[day].items():
                    day_category_breakdown.append({
                        'category': category,
                        'revenue': float(cat_stats['revenue']),
                        'quantity': cat_stats['quantity']
                    })
            
            # Top dishes para este día específico (para tooltips)
            day_top_dishes = []
            if day in daily_dish_stats:
                for dish_name, dish_stat in sorted(daily_dish_stats[day].items(), key=lambda x: x[1]['quantity'], reverse=True):
                    day_top_dishes.append({
                        'name': dish_name,
                        'category': dish_stat['category'],
                        'quantity': dish_stat['quantity'],
                        'revenue': float(dish_stat['revenue']),
                        'unit_price': float(dish_stat['unit_price'])
                    })
            
            sales_by_day.append({
                'date': day,
                'orders': stats['orders'],
                'revenue': float(stats['revenue']),
                'items': stats['items'],
                'category_breakdown': day_category_breakdown,  # Datos reales por día
                'top_dishes': day_top_dishes  # ✅ AGREGADO: top_dishes específicos del día
            })
        
        # Metas dinámicas
        revenue_values = [day['revenue'] for day in sales_by_day if day['revenue'] > 0]
        items_values = [day['items'] for day in sales_by_day if day['items'] > 0]
        
        revenue_average = sum(revenue_values) / len(revenue_values) if revenue_values else 0
        revenue_maximum = max(revenue_values) if revenue_values else 0
        items_average = sum(items_values) / len(items_values) if items_values else 0
        items_maximum = max(items_values) if items_values else 0
        
        return {
            'summary': {
                'total_orders': total_orders,
                'total_revenue': float(total_revenue),
                'average_ticket': float(average_ticket),
                'total_items': total_items
            },
            'category_breakdown': category_breakdown,
            'top_dishes': top_dishes,
            'payment_methods': self._format_payment_methods(payment_stats),
            'sales_by_day': sales_by_day,
            'revenue_trends': {
                'daily_average': revenue_average,
                'daily_maximum': revenue_maximum,
                'items_average': items_average,
                'items_maximum': items_maximum
            },
            'goals': {
                'sales': {
                    'meta300': revenue_average,
                    'meta500': revenue_maximum
                },
                'production': {
                    'meta300': int(items_average),
                    'meta500': int(items_maximum)
                }
            }
        }
    
    def _format_payment_methods(self, payment_stats):
        """
        Formatea los payment methods limpiando processed_orders y calculando percentages
        """
        total_payment_amount = sum(stat['amount'] for stat in payment_stats.values())
        payment_methods = []
        
        for method, stats in payment_stats.items():
            percentage = (stats['amount'] / total_payment_amount * 100) if total_payment_amount > 0 else 0
            # Limpiar stats para el frontend (remover processed_orders)
            clean_stats = {k: v for k, v in stats.items() if k != 'processed_orders'}
            payment_methods.append({
                'method': method,
                'amount': float(clean_stats['amount']),
                'percentage': float(percentage),
                'transaction_count': clean_stats['count']
            })
        
        return payment_methods