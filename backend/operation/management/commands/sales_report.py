"""
Management command para generar reportes detallados de ventas (pedidos pagados).
Incluye información consolidada y completa de todas las transacciones.

Uso:
    python manage.py sales_report
    python manage.py sales_report --today
    python manage.py sales_report --month
    python manage.py sales_report --start-date 2024-01-01 --end-date 2024-01-31
    python manage.py sales_report --export-csv
"""

from django.core.management.base import BaseCommand
from django.db import models
from django.db.models import Sum, Count, Avg, Q, F
from datetime import datetime, date, timedelta
from decimal import Decimal
import csv
from operation.models import Order, OrderItem, Payment, PaymentItem
from inventory.models import Recipe, Group


class Command(BaseCommand):
    help = 'Genera reportes detallados de ventas'

    def add_arguments(self, parser):
        parser.add_argument(
            '--today',
            action='store_true',
            help='Reporte del día de hoy',
        )
        parser.add_argument(
            '--month',
            action='store_true',
            help='Reporte del mes actual',
        )
        parser.add_argument(
            '--start-date',
            type=str,
            help='Fecha de inicio (YYYY-MM-DD)',
        )
        parser.add_argument(
            '--end-date',
            type=str,
            help='Fecha de fin (YYYY-MM-DD)',
        )
        parser.add_argument(
            '--export-csv',
            action='store_true',
            help='Exportar a CSV',
        )

    def handle(self, *args, **options):
        self.stdout.write("\n🍽️  SISTEMA DE REPORTES DE VENTAS")
        self.stdout.write("=" * 50)
        
        # Determinar el rango de fechas
        start_date, end_date = self.get_date_range(options)
        
        if start_date and end_date:
            self.stdout.write(f"Período: {start_date} al {end_date}")
        else:
            self.stdout.write("Período: Todos los registros")
        
        self.stdout.write(f"Generado: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self.stdout.write("=" * 50)
        
        # Generar reportes
        self.stdout.write("\n⏳ Generando reportes...")
        
        # Obtener órdenes pagadas
        orders = self.get_paid_orders(start_date, end_date)
        
        if not orders.exists():
            self.stdout.write(self.style.WARNING("❌ No hay ventas en el período seleccionado"))
            return
        
        # Resumen general
        summary = self.generate_summary_report(orders)
        self.print_summary_report(summary)
        
        # Ventas por grupo
        group_sales = self.generate_sales_by_group_report(orders)
        self.print_sales_by_group(group_sales)
        
        # Exportar a CSV si se solicita
        if options['export_csv']:
            filename = f"ventas_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            self.export_to_csv(orders, filename)
            self.stdout.write(self.style.SUCCESS(f"\n✅ Reporte exportado exitosamente: {filename}"))

    def get_date_range(self, options):
        """Determina el rango de fechas basado en las opciones."""
        if options['today']:
            today = date.today()
            return today, today
        elif options['month']:
            today = date.today()
            start_of_month = date(today.year, today.month, 1)
            return start_of_month, today
        elif options['start_date'] and options['end_date']:
            try:
                start_date = datetime.strptime(options['start_date'], '%Y-%m-%d').date()
                end_date = datetime.strptime(options['end_date'], '%Y-%m-%d').date()
                return start_date, end_date
            except ValueError:
                self.stdout.write(self.style.ERROR("❌ Formato de fecha inválido. Use YYYY-MM-DD"))
                return None, None
        
        return None, None

    def get_paid_orders(self, start_date=None, end_date=None):
        """Obtiene todas las órdenes pagadas en el rango de fechas."""
        query = Order.objects.filter(status='PAID')
        
        if start_date and end_date:
            query = query.filter(
                paid_at__date__gte=start_date,
                paid_at__date__lte=end_date
            )
        
        return query.select_related('table', 'table__zone').prefetch_related(
            'orderitem_set__recipe__group',
            'orderitem_set__orderitemingredient_set__ingredient',
            'payments__payment_items'
        )

    def generate_summary_report(self, orders):
        """Genera un reporte resumido de ventas."""
        # Estadísticas generales
        total_orders = orders.count()
        total_revenue = orders.aggregate(total=Sum('total_amount'))['total'] or Decimal('0')
        
        # Ventas por método de pago
        payment_methods = Payment.objects.filter(
            order__in=orders
        ).values('payment_method').annotate(
            count=Count('id'),
            total=Sum('amount')
        ).order_by('-total')
        
        # Ventas por mesa/zona
        zone_sales = orders.values(
            'table__zone__name'
        ).annotate(
            count=Count('id'),
            total=Sum('total_amount')
        ).order_by('-total')
        
        # Items más vendidos
        top_items = OrderItem.objects.filter(
            order__in=orders
        ).values(
            'recipe__name',
            'recipe__group__name'
        ).annotate(
            quantity=Count('id'),
            revenue=Sum('total_price')
        ).order_by('-quantity')[:10]
        
        # Promedio por orden
        avg_order_value = total_revenue / total_orders if total_orders > 0 else Decimal('0')
        
        return {
            'total_orders': total_orders,
            'total_revenue': total_revenue,
            'avg_order_value': avg_order_value,
            'payment_methods': list(payment_methods),
            'zone_sales': list(zone_sales),
            'top_items': list(top_items)
        }

    def generate_sales_by_group_report(self, orders):
        """Genera reporte de ventas por grupo de recetas."""
        # Obtener todos los grupos
        groups = Group.objects.all()
        group_sales = {}
        
        for group in groups:
            items = OrderItem.objects.filter(
                order__in=orders,
                recipe__group=group
            )
            
            if items.exists():
                group_sales[group.name] = {
                    'quantity': items.count(),
                    'revenue': items.aggregate(total=Sum('total_price'))['total'] or Decimal('0'),
                    'recipes': items.values(
                        'recipe__name'
                    ).annotate(
                        quantity=Count('id'),
                        revenue=Sum('total_price')
                    ).order_by('-quantity')
                }
        
        # Items sin grupo
        no_group_items = OrderItem.objects.filter(
            order__in=orders,
            recipe__group__isnull=True
        )
        
        if no_group_items.exists():
            group_sales['Sin Grupo'] = {
                'quantity': no_group_items.count(),
                'revenue': no_group_items.aggregate(total=Sum('total_price'))['total'] or Decimal('0'),
                'recipes': no_group_items.values(
                    'recipe__name'
                ).annotate(
                    quantity=Count('id'),
                    revenue=Sum('total_price')
                ).order_by('-quantity')
            }
        
        return group_sales

    def print_summary_report(self, summary):
        """Imprime el reporte resumido en consola."""
        self.stdout.write("\n" + "=" * 80)
        self.stdout.write("REPORTE DE VENTAS - RESUMEN")
        self.stdout.write("=" * 80)
        
        # Estadísticas generales
        self.stdout.write(f"\n📊 ESTADÍSTICAS GENERALES")
        self.stdout.write(f"   Total de órdenes pagadas: {summary['total_orders']}")
        self.stdout.write(f"   Ingresos totales: S/ {summary['total_revenue']:.2f}")
        self.stdout.write(f"   Ticket promedio: S/ {summary['avg_order_value']:.2f}")
        
        # Ventas por método de pago
        self.stdout.write(f"\n💳 VENTAS POR MÉTODO DE PAGO")
        for pm in summary['payment_methods']:
            percentage = (pm['total'] / summary['total_revenue'] * 100) if summary['total_revenue'] > 0 else 0
            method_label = dict(Payment.PAYMENT_METHOD_CHOICES).get(pm['payment_method'], pm['payment_method'])
            self.stdout.write(f"   {method_label}: S/ {pm['total']:.2f} ({percentage:.1f}%) - {pm['count']} pagos")
        
        # Ventas por zona
        self.stdout.write(f"\n📍 VENTAS POR ZONA")
        for zone in summary['zone_sales']:
            percentage = (zone['total'] / summary['total_revenue'] * 100) if summary['total_revenue'] > 0 else 0
            self.stdout.write(f"   {zone['table__zone__name']}: S/ {zone['total']:.2f} ({percentage:.1f}%) - {zone['count']} órdenes")
        
        # Top 10 items más vendidos
        self.stdout.write(f"\n🏆 TOP 10 ITEMS MÁS VENDIDOS")
        for i, item in enumerate(summary['top_items'], 1):
            group = item['recipe__group__name'] or 'Sin Grupo'
            self.stdout.write(f"   {i}. {item['recipe__name']} ({group}): "
                      f"{item['quantity']} unidades - S/ {item['revenue']:.2f}")

    def print_sales_by_group(self, group_sales):
        """Imprime el reporte de ventas por grupo."""
        self.stdout.write("\n" + "=" * 80)
        self.stdout.write("REPORTE DE VENTAS POR GRUPO")
        self.stdout.write("=" * 80)
        
        total_revenue = sum(data['revenue'] for data in group_sales.values())
        
        if total_revenue == 0:
            self.stdout.write("No hay ventas por grupo en el período seleccionado")
            return
        
        # Ordenar grupos por ingresos
        sorted_groups = sorted(
            group_sales.items(),
            key=lambda x: x[1]['revenue'],
            reverse=True
        )
        
        for group_name, data in sorted_groups:
            if data['revenue'] > 0:
                percentage = (data['revenue'] / total_revenue * 100) if total_revenue > 0 else 0
                self.stdout.write(f"\n📂 {group_name.upper()}")
                self.stdout.write(f"   Total: S/ {data['revenue']:.2f} ({percentage:.1f}%)")
                self.stdout.write(f"   Items vendidos: {data['quantity']}")
                self.stdout.write(f"   Desglose por receta:")
                
                for recipe in list(data['recipes'])[:5]:  # Top 5 recetas del grupo
                    self.stdout.write(f"      - {recipe['recipe__name']}: "
                              f"{recipe['quantity']} unidades, S/ {recipe['revenue']:.2f}")

    def export_to_csv(self, orders, filename):
        """Exporta el reporte detallado a CSV."""
        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = [
                'Orden ID', 'Fecha Creación', 'Fecha Servido', 'Fecha Pagado',
                'Mesa', 'Zona', 'Item', 'Grupo', 'Precio Unit.', 'Precio Total',
                'Notas', 'Personalizaciones', 'Método Pago', 'Monto Pago', 'Pagador'
            ]
            
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for order in orders.order_by('-paid_at'):
                base_row = {
                    'Orden ID': order.id,
                    'Fecha Creación': order.created_at.strftime('%Y-%m-%d %H:%M'),
                    'Fecha Servido': order.served_at.strftime('%Y-%m-%d %H:%M') if order.served_at else '',
                    'Fecha Pagado': order.paid_at.strftime('%Y-%m-%d %H:%M') if order.paid_at else '',
                    'Mesa': order.table.table_number,
                    'Zona': order.table.zone.name
                }
                
                for item in order.orderitem_set.all():
                    # Personalizaciones
                    customizations = []
                    for custom in item.orderitemingredient_set.all():
                        customizations.append(
                            f"{custom.ingredient.name} ({custom.quantity})"
                        )
                    
                    # Información del pago para este item
                    payment_info = self.get_payment_info_for_item(item)
                    
                    row = base_row.copy()
                    row.update({
                        'Item': item.recipe.name,
                        'Grupo': item.recipe.group.name if item.recipe.group else 'Sin Grupo',
                        'Precio Unit.': float(item.unit_price),
                        'Precio Total': float(item.total_price),
                        'Notas': item.notes or '',
                        'Personalizaciones': ', '.join(customizations),
                        'Método Pago': payment_info['method'],
                        'Monto Pago': payment_info['amount'],
                        'Pagador': payment_info['payer']
                    })
                    
                    writer.writerow(row)

    def get_payment_info_for_item(self, item):
        """Obtiene información de pago para un item específico."""
        payment_items = PaymentItem.objects.filter(order_item=item)
        
        if payment_items.exists():
            payment = payment_items.first().payment
            return {
                'method': payment.get_payment_method_display(),
                'amount': float(payment_items.first().amount),
                'payer': payment.payer_name or 'Sin nombre'
            }
        
        # Si no hay pago específico para el item, buscar el pago de la orden
        payment = item.order.payments.first()
        if payment:
            return {
                'method': payment.get_payment_method_display(),
                'amount': float(payment.amount),
                'payer': payment.payer_name or 'Sin nombre'
            }
        
        return {
            'method': 'N/A',
            'amount': 0,
            'payer': 'N/A'
        }