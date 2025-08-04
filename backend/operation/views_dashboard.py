from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils import timezone
from django.db.models import Sum, Count, Q, F, Avg
from django.http import HttpResponse
from datetime import datetime, date
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from decimal import Decimal
from .models import Order, OrderItem, Payment

class DashboardViewSet(viewsets.ViewSet):
    """
    ViewSet para el dashboard consolidado con exportación a Excel
    """
    permission_classes = []  # Acceso completo para usuarios autenticados
    
    @action(detail=False, methods=['get'])
    def report(self, request):
        """
        Endpoint consolidado para el dashboard con todos los datos finales
        Solo pedidos PAID, sin métricas en tiempo real
        """
        # Obtener fecha del parámetro o usar hoy (zona horaria Lima)
        date_param = request.query_params.get('date')
        if date_param:
            try:
                selected_date = datetime.strptime(date_param, '%Y-%m-%d').date()
            except ValueError:
                selected_date = timezone.now().date()
        else:
            selected_date = timezone.now().date()
        
        # Filtrar órdenes PAID por fecha de paid_at
        paid_orders = Order.objects.filter(
            status='PAID',
            paid_at__date=selected_date
        ).select_related(
            'table__zone'
        ).prefetch_related(
            'orderitem_set__recipe__group',
            'payments',
            'container_sales__container'
        ).order_by('paid_at')
        
        # Métricas básicas del día
        total_orders = paid_orders.count()
        total_revenue = paid_orders.aggregate(total=Sum('total_amount'))['total'] or Decimal('0')
        average_ticket = total_revenue / total_orders if total_orders > 0 else Decimal('0')
        
        # Análisis por categorías
        category_stats = {}
        dish_stats = {}
        waiter_revenue = {}
        zone_revenue = {}
        table_revenue = {}
        payment_method_totals = {}
        hourly_sales = {}
        
        # Procesar cada orden pagada
        orders_detail = []
        for order in paid_orders:
            # Calcular tiempo de servicio
            service_time = None
            if order.created_at and order.paid_at:
                service_time = int((order.paid_at - order.created_at).total_seconds() / 60)
            
            # Hora de la venta para análisis por hora
            hour = order.paid_at.hour if order.paid_at else 0
            hourly_sales[hour] = hourly_sales.get(hour, Decimal('0')) + order.total_amount
            
            # Detalle de la orden para Excel
            order_detail = {
                'order_id': order.id,
                'table': order.table.number if order.table else 'N/A',
                'zone': order.table.zone.name if order.table and order.table.zone else 'N/A',
                'waiter': order.waiter or 'Sin asignar',
                'created_at': order.created_at,
                'paid_at': order.paid_at,
                'service_time_minutes': service_time,
                'total_amount': float(order.total_amount),
                'items': []
            }
            
            # Stats por mesero
            waiter_key = order.waiter or 'Sin asignar'
            if waiter_key not in waiter_revenue:
                waiter_revenue[waiter_key] = {'orders': 0, 'revenue': Decimal('0')}
            waiter_revenue[waiter_key]['orders'] += 1
            waiter_revenue[waiter_key]['revenue'] += order.total_amount
            
            # Stats por zona
            zone_key = order.table.zone.name if order.table and order.table.zone else 'Sin zona'
            if zone_key not in zone_revenue:
                zone_revenue[zone_key] = {'orders': 0, 'revenue': Decimal('0'), 'tables': set()}
            zone_revenue[zone_key]['orders'] += 1
            zone_revenue[zone_key]['revenue'] += order.total_amount
            if order.table:
                zone_revenue[zone_key]['tables'].add(order.table.number)
            
            # Stats por mesa
            if order.table:
                table_key = f"Mesa {order.table.number}"
                table_revenue[table_key] = table_revenue.get(table_key, Decimal('0')) + order.total_amount
            
            # Procesar items de la orden
            for item in order.orderitem_set.all():
                category = item.recipe.group.name if item.recipe and item.recipe.group else 'Sin categoría'
                
                # Stats por categoría
                if category not in category_stats:
                    category_stats[category] = {'revenue': Decimal('0'), 'quantity': 0}
                category_stats[category]['revenue'] += item.total_price
                category_stats[category]['quantity'] += item.quantity
                
                # Stats por plato
                dish_key = item.recipe.name if item.recipe else 'Sin receta'
                if dish_key not in dish_stats:
                    dish_stats[dish_key] = {
                        'category': category,
                        'quantity': 0,
                        'revenue': Decimal('0'),
                        'unit_price': item.unit_price
                    }
                dish_stats[dish_key]['quantity'] += item.quantity
                dish_stats[dish_key]['revenue'] += item.total_price
                
                # Detalle del item para Excel
                order_detail['items'].append({
                    'recipe': dish_key,
                    'category': category,
                    'quantity': item.quantity,
                    'unit_price': float(item.unit_price),
                    'total_price': float(item.total_price),
                    'notes': item.notes or '',
                    'is_takeaway': item.is_takeaway
                })
            
            # Procesar pagos
            for payment in order.payments.all():
                method = payment.payment_method
                payment_method_totals[method] = payment_method_totals.get(method, Decimal('0')) + payment.amount
            
            orders_detail.append(order_detail)
        
        # Calcular porcentajes
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
        
        # Top 10 platos
        top_dishes = []
        for dish, stats in sorted(dish_stats.items(), key=lambda x: x[1]['quantity'], reverse=True)[:10]:
            top_dishes.append({
                'name': dish,
                'category': stats['category'],
                'quantity': stats['quantity'],
                'revenue': float(stats['revenue']),
                'unit_price': float(stats['unit_price'])
            })
        
        # Top 5 meseros
        waiter_performance = []
        for waiter, stats in sorted(waiter_revenue.items(), key=lambda x: x[1]['revenue'], reverse=True)[:5]:
            avg_ticket = stats['revenue'] / stats['orders'] if stats['orders'] > 0 else Decimal('0')
            waiter_performance.append({
                'waiter': waiter,
                'orders': stats['orders'],
                'revenue': float(stats['revenue']),
                'average_ticket': float(avg_ticket)
            })
        
        # Performance por zonas
        zone_performance = []
        for zone, stats in sorted(zone_revenue.items(), key=lambda x: x[1]['revenue'], reverse=True):
            tables_used = len(stats['tables'])
            avg_per_table = stats['revenue'] / tables_used if tables_used > 0 else Decimal('0')
            zone_performance.append({
                'zone': zone,
                'orders': stats['orders'],
                'revenue': float(stats['revenue']),
                'tables_used': tables_used,
                'average_per_table': float(avg_per_table)
            })
        
        # Top 5 mesas
        top_tables = []
        for table, revenue in sorted(table_revenue.items(), key=lambda x: x[1], reverse=True)[:5]:
            top_tables.append({
                'table': table,
                'revenue': float(revenue)
            })
        
        # Distribución por método de pago
        total_payments = sum(payment_method_totals.values())
        payment_methods = []
        for method, amount in payment_method_totals.items():
            percentage = (amount / total_payments * 100) if total_payments > 0 else 0
            payment_methods.append({
                'method': method,
                'amount': float(amount),
                'percentage': float(percentage)
            })
        
        # Ventas por hora
        hourly_breakdown = []
        for hour in range(24):
            revenue = hourly_sales.get(hour, Decimal('0'))
            if revenue > 0:
                hourly_breakdown.append({
                    'hour': f"{hour:02d}:00",
                    'revenue': float(revenue)
                })
        
        # Respuesta consolidada
        return Response({
            'date': selected_date.isoformat(),
            'summary': {
                'total_orders': total_orders,
                'total_revenue': float(total_revenue),
                'average_ticket': float(average_ticket)
            },
            'category_breakdown': category_breakdown,
            'top_dishes': top_dishes,
            'waiter_performance': waiter_performance,
            'zone_performance': zone_performance,
            'top_tables': top_tables,
            'payment_methods': payment_methods,
            'hourly_sales': hourly_breakdown,
            'orders_detail': orders_detail  # Para exportación detallada
        })
    
    @action(detail=False, methods=['get'])
    def export_excel(self, request):
        """
        Exporta el reporte del dashboard a Excel con todo el detalle
        """
        # Obtener datos usando el mismo método
        response_data = self.report(request).data
        
        # Crear libro de Excel
        wb = openpyxl.Workbook()
        
        # Estilos
        header_font = Font(bold=True, color="FFFFFF", size=12)
        header_fill = PatternFill("solid", fgColor="366092")
        header_alignment = Alignment(horizontal="center", vertical="center")
        border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        
        # Hoja 1: Resumen General
        ws_summary = wb.active
        ws_summary.title = "Resumen"
        
        # Título
        ws_summary.merge_cells('A1:D1')
        ws_summary['A1'] = f"Dashboard de Ventas - {response_data['date']}"
        ws_summary['A1'].font = Font(bold=True, size=16)
        ws_summary['A1'].alignment = Alignment(horizontal="center")
        
        # Resumen
        ws_summary['A3'] = "Métrica"
        ws_summary['B3'] = "Valor"
        ws_summary['A3'].font = header_font
        ws_summary['B3'].font = header_font
        
        summary_data = [
            ("Total de Órdenes", response_data['summary']['total_orders']),
            ("Ingresos Totales", f"S/ {response_data['summary']['total_revenue']:.2f}"),
            ("Ticket Promedio", f"S/ {response_data['summary']['average_ticket']:.2f}")
        ]
        
        for idx, (metric, value) in enumerate(summary_data, start=4):
            ws_summary[f'A{idx}'] = metric
            ws_summary[f'B{idx}'] = value
        
        # Hoja 2: Detalle de Órdenes
        ws_orders = wb.create_sheet("Detalle de Órdenes")
        
        # Headers
        order_headers = [
            "ID Orden", "Mesa", "Zona", "Mesero", "Hora Creación", "Hora Pago",
            "Tiempo Servicio (min)", "Plato", "Categoría", "Cantidad", 
            "Precio Unitario", "Precio Total", "Notas", "Para Llevar", "Total Orden"
        ]
        
        for col, header in enumerate(order_headers, start=1):
            cell = ws_orders.cell(row=1, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
            cell.border = border
        
        # Datos de órdenes
        row = 2
        for order in response_data['orders_detail']:
            order_total = order['total_amount']
            for item in order['items']:
                ws_orders.cell(row=row, column=1, value=order['order_id'])
                ws_orders.cell(row=row, column=2, value=order['table'])
                ws_orders.cell(row=row, column=3, value=order['zone'])
                ws_orders.cell(row=row, column=4, value=order['waiter'])
                ws_orders.cell(row=row, column=5, value=order['created_at'])
                ws_orders.cell(row=row, column=6, value=order['paid_at'])
                ws_orders.cell(row=row, column=7, value=order['service_time_minutes'])
                ws_orders.cell(row=row, column=8, value=item['recipe'])
                ws_orders.cell(row=row, column=9, value=item['category'])
                ws_orders.cell(row=row, column=10, value=item['quantity'])
                ws_orders.cell(row=row, column=11, value=f"S/ {item['unit_price']:.2f}")
                ws_orders.cell(row=row, column=12, value=f"S/ {item['total_price']:.2f}")
                ws_orders.cell(row=row, column=13, value=item['notes'])
                ws_orders.cell(row=row, column=14, value="Sí" if item['is_takeaway'] else "No")
                ws_orders.cell(row=row, column=15, value=f"S/ {order_total:.2f}")
                row += 1
        
        # Ajustar ancho de columnas
        for column in ws_orders.columns:
            max_length = 0
            column_letter = get_column_letter(column[0].column)
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = (max_length + 2) * 1.2
            ws_orders.column_dimensions[column_letter].width = adjusted_width
        
        # Hoja 3: Análisis por Categorías
        ws_categories = wb.create_sheet("Categorías")
        
        cat_headers = ["Categoría", "Ingresos", "Cantidad", "Porcentaje"]
        for col, header in enumerate(cat_headers, start=1):
            cell = ws_categories.cell(row=1, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
        
        for idx, cat in enumerate(response_data['category_breakdown'], start=2):
            ws_categories.cell(row=idx, column=1, value=cat['category'])
            ws_categories.cell(row=idx, column=2, value=f"S/ {cat['revenue']:.2f}")
            ws_categories.cell(row=idx, column=3, value=cat['quantity'])
            ws_categories.cell(row=idx, column=4, value=f"{cat['percentage']:.1f}%")
        
        # Hoja 4: Top Platos
        ws_dishes = wb.create_sheet("Top Platos")
        
        dish_headers = ["Ranking", "Plato", "Categoría", "Cantidad", "Ingresos", "Precio Unitario"]
        for col, header in enumerate(dish_headers, start=1):
            cell = ws_dishes.cell(row=1, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
        
        for idx, dish in enumerate(response_data['top_dishes'], start=2):
            ws_dishes.cell(row=idx, column=1, value=idx-1)
            ws_dishes.cell(row=idx, column=2, value=dish['name'])
            ws_dishes.cell(row=idx, column=3, value=dish['category'])
            ws_dishes.cell(row=idx, column=4, value=dish['quantity'])
            ws_dishes.cell(row=idx, column=5, value=f"S/ {dish['revenue']:.2f}")
            ws_dishes.cell(row=idx, column=6, value=f"S/ {dish['unit_price']:.2f}")
        
        # Hoja 5: Performance
        ws_performance = wb.create_sheet("Performance")
        
        # Meseros
        ws_performance['A1'] = "Performance por Meseros"
        ws_performance['A1'].font = Font(bold=True, size=14)
        
        waiter_headers = ["Mesero", "Órdenes", "Ingresos", "Ticket Promedio"]
        for col, header in enumerate(waiter_headers, start=1):
            cell = ws_performance.cell(row=3, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
        
        for idx, waiter in enumerate(response_data['waiter_performance'], start=4):
            ws_performance.cell(row=idx, column=1, value=waiter['waiter'])
            ws_performance.cell(row=idx, column=2, value=waiter['orders'])
            ws_performance.cell(row=idx, column=3, value=f"S/ {waiter['revenue']:.2f}")
            ws_performance.cell(row=idx, column=4, value=f"S/ {waiter['average_ticket']:.2f}")
        
        # Zonas
        start_row = len(response_data['waiter_performance']) + 7
        ws_performance.cell(row=start_row, column=1, value="Performance por Zonas")
        ws_performance.cell(row=start_row, column=1).font = Font(bold=True, size=14)
        
        zone_headers = ["Zona", "Órdenes", "Ingresos", "Mesas Usadas", "Promedio por Mesa"]
        for col, header in enumerate(zone_headers, start=1):
            cell = ws_performance.cell(row=start_row+2, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
        
        for idx, zone in enumerate(response_data['zone_performance'], start=start_row+3):
            ws_performance.cell(row=idx, column=1, value=zone['zone'])
            ws_performance.cell(row=idx, column=2, value=zone['orders'])
            ws_performance.cell(row=idx, column=3, value=f"S/ {zone['revenue']:.2f}")
            ws_performance.cell(row=idx, column=4, value=zone['tables_used'])
            ws_performance.cell(row=idx, column=5, value=f"S/ {zone['average_per_table']:.2f}")
        
        # Preparar respuesta HTTP
        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        filename = f"dashboard_ventas_{response_data['date']}.xlsx"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        # Guardar y retornar
        wb.save(response)
        return response