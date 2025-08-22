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
    Enfocada en análisis financiero y de ventas con filtros inteligentes de período
    """
    permission_classes = [AllowAny]  # Acceso completo en desarrollo
    
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
        Consulta directa a la vista de BD dashboard_financiero_view para máximo rendimiento
        """
        from django.db import connection
        from decimal import Decimal
        from collections import defaultdict
        
        # Usar Django ORM para consultar datos filtrados por período
        order_filter = Q(status='PAID')
        
        if period_info['start_date'] and period_info['end_date']:
            # Filtrar por rango de fechas
            order_filter &= Q(
                paid_at__date__gte=period_info['start_date'],
                paid_at__date__lte=period_info['end_date']
            )
        
        # Obtener órdenes filtradas
        orders = Order.objects.filter(order_filter).select_related('table')
        
        # Calcular métricas básicas
        total_orders = orders.count()
        total_revenue = orders.aggregate(total=Sum('total_amount'))['total'] or Decimal('0')
        
        # Obtener items de las órdenes
        order_items = OrderItem.objects.filter(order__in=orders).select_related('recipe')
        total_items = order_items.count()
        
        # Calcular promedio
        average_ticket = total_revenue / total_orders if total_orders > 0 else Decimal('0')
        
        # Agrupar por categorías (simulado)
        category_stats = {}
        dish_stats = {}
        daily_sales = {}
        
        for order in orders:
            # Usar fecha en zona horaria de Perú (UTC-5)
            if order.paid_at:
                peru_datetime = order.paid_at - timedelta(hours=5)
                order_date = peru_datetime.date().isoformat()
            else:
                peru_datetime = order.created_at - timedelta(hours=5)
                order_date = peru_datetime.date().isoformat()
            
            if order_date not in daily_sales:
                daily_sales[order_date] = {
                    'orders': 0,
                    'revenue': Decimal('0'),
                    'items': 0
                }
            
            daily_sales[order_date]['orders'] += 1
            daily_sales[order_date]['revenue'] += order.total_amount or Decimal('0')
            
            # Contar items por orden
            order_item_count = order.orderitem_set.count()
            daily_sales[order_date]['items'] += order_item_count
        
        # Agrupar por categorías Y por día
        category_stats = {}
        dish_stats = {}
        daily_category_stats = {}  # Nuevo: stats por día y categoría
        
        for item in order_items:
            if item.recipe:
                # Usar fecha en zona horaria de Perú (UTC-5)
                if item.order.paid_at:
                    peru_datetime = item.order.paid_at - timedelta(hours=5)
                    order_date = peru_datetime.date().isoformat()
                else:
                    peru_datetime = item.order.created_at - timedelta(hours=5)
                    order_date = peru_datetime.date().isoformat()
                category_name = getattr(item.recipe.group, 'name', 'Sin Categoría') if hasattr(item.recipe, 'group') and item.recipe.group else 'Sin Categoría'
                
                # Stats globales por categoría
                if category_name not in category_stats:
                    category_stats[category_name] = {'revenue': Decimal('0'), 'quantity': 0}
                
                category_stats[category_name]['revenue'] += item.total_price or Decimal('0')
                category_stats[category_name]['quantity'] += 1
                
                # Stats por día y categoría
                if order_date not in daily_category_stats:
                    daily_category_stats[order_date] = {}
                
                if category_name not in daily_category_stats[order_date]:
                    daily_category_stats[order_date][category_name] = {'revenue': Decimal('0'), 'quantity': 0}
                
                daily_category_stats[order_date][category_name]['revenue'] += item.total_price or Decimal('0')
                daily_category_stats[order_date][category_name]['quantity'] += 1
                
                # Stats por plato (top 10)
                if item.recipe.name not in dish_stats:
                    dish_stats[item.recipe.name] = {
                        'category': category_name,
                        'quantity': 0,
                        'revenue': Decimal('0'),
                        'unit_price': item.unit_price or Decimal('0')
                    }
                
                dish_stats[item.recipe.name]['quantity'] += 1
                dish_stats[item.recipe.name]['revenue'] += item.total_price or Decimal('0')
        
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
            
            sales_by_day.append({
                'date': day,
                'orders': stats['orders'],
                'revenue': float(stats['revenue']),
                'items': stats['items'],
                'category_breakdown': day_category_breakdown  # Datos reales por día
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
            'payment_methods': [],  # Simplificado por ahora
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