#!/usr/bin/env python
"""
Script para generar reportes detallados de ventas (pedidos pagados).
Incluye información consolidada y completa de todas las transacciones.

Uso:
    python manage.py shell < scripts/sales_report.py
    o
    python scripts/sales_report.py (desde el directorio backend)
    
Opciones:
    - Reporte del día actual
    - Reporte por rango de fechas
    - Exportar a CSV
"""

import os
import sys
import django
from django.db import models
from django.db.models import Sum, Count, Avg, Q, F
from datetime import datetime, date, timedelta
from decimal import Decimal
import csv

# Configurar Django si se ejecuta como script independiente
if __name__ == "__main__":
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    django.setup()

from operation.models import Order, OrderItem, Payment, PaymentItem
from inventory.models import Recipe, Group


class SalesReportGenerator:
    """Generador de reportes de ventas detallados."""
    
    def __init__(self):
        self.start_date = None
        self.end_date = None
        
    def set_date_range(self, start_date, end_date):
        """Establece el rango de fechas para el reporte."""
        self.start_date = start_date
        self.end_date = end_date
    
    def get_paid_orders(self):
        """Obtiene todas las órdenes pagadas en el rango de fechas."""
        query = Order.objects.filter(status='PAID')
        
        if self.start_date and self.end_date:
            query = query.filter(
                paid_at__date__gte=self.start_date,
                paid_at__date__lte=self.end_date
            )
        
        return query.select_related('table', 'table__zone').prefetch_related(
            'orderitem_set__recipe__group',
            'orderitem_set__orderitemingredient_set__ingredient',
            'payments__payment_items'
        )
    
    def generate_summary_report(self):
        """Genera un reporte resumido de ventas."""
        orders = self.get_paid_orders()
        
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
    
    def generate_detailed_report(self):
        """Genera un reporte detallado orden por orden."""
        orders = self.get_paid_orders().order_by('-paid_at')
        detailed_data = []
        
        for order in orders:
            order_data = {
                'order_id': order.id,
                'table': f"{order.table.zone.name} - {order.table.table_number}",
                'created_at': order.created_at,
                'served_at': order.served_at,
                'paid_at': order.paid_at,
                'total_amount': order.total_amount,
                'items': [],
                'payments': []
            }
            
            # Detalles de items
            for item in order.orderitem_set.all():
                item_data = {
                    'recipe': item.recipe.name,
                    'group': item.recipe.group.name if item.recipe.group else 'Sin Grupo',
                    'unit_price': item.unit_price,
                    'total_price': item.total_price,
                    'notes': item.notes,
                    'customizations': []
                }
                
                # Personalizaciones
                for custom in item.orderitemingredient_set.all():
                    item_data['customizations'].append({
                        'ingredient': custom.ingredient.name,
                        'quantity': custom.quantity,
                        'price': custom.total_price
                    })
                
                order_data['items'].append(item_data)
            
            # Detalles de pagos
            for payment in order.payments.all():
                payment_data = {
                    'method': payment.get_payment_method_display(),
                    'amount': payment.amount,
                    'payer_name': payment.payer_name,
                    'created_at': payment.created_at,
                    'items_paid': []
                }
                
                # Items específicos pagados
                for payment_item in payment.payment_items.all():
                    payment_data['items_paid'].append({
                        'item': payment_item.order_item.recipe.name,
                        'amount': payment_item.amount
                    })
                
                order_data['payments'].append(payment_data)
            
            detailed_data.append(order_data)
        
        return detailed_data
    
    def generate_sales_by_group_report(self):
        """Genera reporte de ventas por grupo de recetas."""
        orders = self.get_paid_orders()
        
        # Obtener todos los grupos
        groups = Group.objects.all()
        group_sales = {}
        
        for group in groups:
            items = OrderItem.objects.filter(
                order__in=orders,
                recipe__group=group
            )
            
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
    
    def export_to_csv(self, filename='sales_report.csv'):
        """Exporta el reporte detallado a CSV."""
        orders = self.get_paid_orders().order_by('-paid_at')
        
        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = [
                'Orden ID', 'Fecha Creación', 'Fecha Servido', 'Fecha Pagado',
                'Mesa', 'Zona', 'Item', 'Grupo', 'Precio Unit.', 'Precio Total',
                'Notas', 'Personalizaciones', 'Método Pago', 'Monto Pago', 'Pagador'
            ]
            
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for order in orders:
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
                    payment_info = self._get_payment_info_for_item(item)
                    
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
        
        return filename
    
    def _get_payment_info_for_item(self, item):
        """Obtiene información de pago para un item específico."""
        payment_items = PaymentItem.objects.filter(order_item=item)
        
        if payment_items.exists():
            payment = payment_items.first().payment
            return {
                'method': payment.get_payment_method_display(),
                'amount': float(payment_items.first().amount),
                'payer': payment.payer_name or 'Sin nombre'
            }
        
        return {
            'method': 'N/A',
            'amount': 0,
            'payer': 'N/A'
        }
    
    def print_summary_report(self, summary):
        """Imprime el reporte resumido en consola."""
        print("\n" + "=" * 80)
        print("REPORTE DE VENTAS - RESUMEN")
        print("=" * 80)
        
        if self.start_date and self.end_date:
            print(f"Período: {self.start_date} al {self.end_date}")
        else:
            print("Período: Todos los registros")
        
        print(f"\nGenerado: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("-" * 80)
        
        # Estadísticas generales
        print(f"\n📊 ESTADÍSTICAS GENERALES")
        print(f"   Total de órdenes pagadas: {summary['total_orders']}")
        print(f"   Ingresos totales: S/ {summary['total_revenue']:.2f}")
        print(f"   Ticket promedio: S/ {summary['avg_order_value']:.2f}")
        
        # Ventas por método de pago
        print(f"\n💳 VENTAS POR MÉTODO DE PAGO")
        for pm in summary['payment_methods']:
            percentage = (pm['total'] / summary['total_revenue'] * 100) if summary['total_revenue'] > 0 else 0
            print(f"   {pm['payment_method']}: S/ {pm['total']:.2f} ({percentage:.1f}%) - {pm['count']} pagos")
        
        # Ventas por zona
        print(f"\n📍 VENTAS POR ZONA")
        for zone in summary['zone_sales']:
            percentage = (zone['total'] / summary['total_revenue'] * 100) if summary['total_revenue'] > 0 else 0
            print(f"   {zone['table__zone__name']}: S/ {zone['total']:.2f} ({percentage:.1f}%) - {zone['count']} órdenes")
        
        # Top 10 items más vendidos
        print(f"\n🏆 TOP 10 ITEMS MÁS VENDIDOS")
        for i, item in enumerate(summary['top_items'], 1):
            group = item['recipe__group__name'] or 'Sin Grupo'
            print(f"   {i}. {item['recipe__name']} ({group}): "
                  f"{item['quantity']} unidades - S/ {item['revenue']:.2f}")
        
        print("\n" + "=" * 80)
    
    def print_sales_by_group(self, group_sales):
        """Imprime el reporte de ventas por grupo."""
        print("\n" + "=" * 80)
        print("REPORTE DE VENTAS POR GRUPO")
        print("=" * 80)
        
        total_revenue = sum(data['revenue'] for data in group_sales.values())
        
        # Ordenar grupos por ingresos
        sorted_groups = sorted(
            group_sales.items(),
            key=lambda x: x[1]['revenue'],
            reverse=True
        )
        
        for group_name, data in sorted_groups:
            if data['revenue'] > 0:
                percentage = (data['revenue'] / total_revenue * 100) if total_revenue > 0 else 0
                print(f"\n📂 {group_name.upper()}")
                print(f"   Total: S/ {data['revenue']:.2f} ({percentage:.1f}%)")
                print(f"   Items vendidos: {data['quantity']}")
                print(f"   Desglose por receta:")
                
                for recipe in list(data['recipes'])[:5]:  # Top 5 recetas del grupo
                    print(f"      - {recipe['recipe__name']}: "
                          f"{recipe['quantity']} unidades, S/ {recipe['revenue']:.2f}")
        
        print("\n" + "=" * 80)


def main():
    """Función principal del script."""
    generator = SalesReportGenerator()
    
    print("\n🍽️  SISTEMA DE REPORTES DE VENTAS")
    print("=" * 50)
    print("1. Reporte del día de hoy")
    print("2. Reporte del mes actual")
    print("3. Reporte por rango de fechas")
    print("4. Reporte completo (todas las ventas)")
    print("=" * 50)
    
    choice = input("\nSeleccione una opción (1-4): ")
    
    # Configurar fechas según la opción
    if choice == '1':
        today = date.today()
        generator.set_date_range(today, today)
    elif choice == '2':
        today = date.today()
        start_of_month = date(today.year, today.month, 1)
        generator.set_date_range(start_of_month, today)
    elif choice == '3':
        start_str = input("Fecha inicio (YYYY-MM-DD): ")
        end_str = input("Fecha fin (YYYY-MM-DD): ")
        try:
            start_date = datetime.strptime(start_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_str, '%Y-%m-%d').date()
            generator.set_date_range(start_date, end_date)
        except ValueError:
            print("❌ Formato de fecha inválido. Use YYYY-MM-DD")
            return
    
    # Generar reportes
    print("\n⏳ Generando reportes...")
    
    # Resumen general
    summary = generator.generate_summary_report()
    generator.print_summary_report(summary)
    
    # Ventas por grupo
    group_sales = generator.generate_sales_by_group_report()
    generator.print_sales_by_group(group_sales)
    
    # Preguntar si desea exportar a CSV
    export = input("\n¿Desea exportar el reporte detallado a CSV? (s/n): ")
    if export.lower() == 's':
        filename = f"ventas_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        generator.export_to_csv(filename)
        print(f"\n✅ Reporte exportado exitosamente: {filename}")
    
    # Preguntar si desea ver el detalle en consola
    detail = input("\n¿Desea ver el reporte detallado en consola? (s/n): ")
    if detail.lower() == 's':
        detailed = generator.generate_detailed_report()
        print(f"\n📋 REPORTE DETALLADO - {len(detailed)} órdenes")
        print("-" * 80)
        
        for order in detailed[:10]:  # Mostrar solo las primeras 10
            print(f"\nOrden #{order['order_id']} - {order['table']}")
            print(f"Fecha: {order['paid_at'].strftime('%Y-%m-%d %H:%M')}")
            print(f"Total: S/ {order['total_amount']:.2f}")
            print("Items:")
            for item in order['items']:
                print(f"  - {item['recipe']} ({item['group']}): S/ {item['total_price']:.2f}")
            print("Pagos:")
            for payment in order['payments']:
                print(f"  - {payment['method']}: S/ {payment['amount']:.2f}")
        
        if len(detailed) > 10:
            print(f"\n... y {len(detailed) - 10} órdenes más")


if __name__ == "__main__":
    main()