"""
Management command para eliminar datos de pedidos (órdenes) de la base de datos.
Esto permite modificar recetas sin restricciones de integridad referencial.

Uso:
    python manage.py clean_orders_data
    python manage.py clean_orders_data --force  # Sin confirmación
"""

from django.core.management.base import BaseCommand
from django.db import transaction, models
from datetime import datetime
from operation.models import Order, OrderItem, OrderItemIngredient, Payment, PaymentItem


class Command(BaseCommand):
    help = 'Elimina todos los datos de órdenes de la base de datos'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Eliminar sin solicitar confirmación',
        )

    def handle(self, *args, **options):
        self.stdout.write("=" * 70)
        self.stdout.write(self.style.HTTP_INFO("LIMPIEZA DE DATOS DE ÓRDENES"))
        self.stdout.write("=" * 70)
        self.stdout.write(f"Fecha y hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self.stdout.write("")
        
        # Mostrar resumen antes de proceder
        self.get_orders_summary()
        
        # Obtener conteos antes de eliminar
        counts = {
            'orders': Order.objects.count(),
            'order_items': OrderItem.objects.count(),
            'order_item_ingredients': OrderItemIngredient.objects.count(),
            'payments': Payment.objects.count(),
            'payment_items': PaymentItem.objects.count(),
        }
        
        self.stdout.write("Datos actuales en la base de datos:")
        self.stdout.write(f"  - Órdenes: {counts['orders']}")
        self.stdout.write(f"  - Items de órdenes: {counts['order_items']}")
        self.stdout.write(f"  - Ingredientes personalizados: {counts['order_item_ingredients']}")
        self.stdout.write(f"  - Pagos: {counts['payments']}")
        self.stdout.write(f"  - Items de pagos: {counts['payment_items']}")
        self.stdout.write("")
        
        if any(count > 0 for count in counts.values()):
            if not options['force']:
                # Confirmación del usuario
                self.stdout.write("\n" + "⚠️ " * 20)
                self.stdout.write(self.style.WARNING("ADVERTENCIA: Esta acción es IRREVERSIBLE"))
                self.stdout.write("⚠️ " * 20)
                self.stdout.write("\nSe eliminarán TODOS los siguientes datos:")
                self.stdout.write("📝 TODOS los pedidos CREADOS")
                self.stdout.write("🍽️  TODOS los pedidos ENTREGADOS") 
                self.stdout.write("💰 TODOS los pedidos PAGADOS")
                self.stdout.write("🗂️  TODOS los pagos y transacciones")
                self.stdout.write("📋 TODOS los items de órdenes")
                self.stdout.write("🔧 TODAS las personalizaciones")
                self.stdout.write("\n💡 Esto te permitirá modificar recetas sin restricciones de integridad referencial.")
                self.stdout.write("")
                
                confirmation = input("¿Está ABSOLUTAMENTE seguro? (escriba 'SI ELIMINAR' para confirmar): ")
                
                if confirmation != "SI ELIMINAR":
                    self.stdout.write(self.style.ERROR("\n❌ Operación cancelada. No se eliminó ningún dato."))
                    return
            
            self.stdout.write("\nEliminando datos...")
            
            try:
                with transaction.atomic():
                    # Eliminar en orden para respetar las restricciones de FK
                    # 1. Primero los items de pago
                    deleted_payment_items = PaymentItem.objects.all().delete()
                    self.stdout.write(f"  ✓ Items de pagos eliminados: {deleted_payment_items[0]}")
                    
                    # 2. Luego los pagos
                    deleted_payments = Payment.objects.all().delete()
                    self.stdout.write(f"  ✓ Pagos eliminados: {deleted_payments[0]}")
                    
                    # 3. Ingredientes personalizados de items
                    deleted_ingredients = OrderItemIngredient.objects.all().delete()
                    self.stdout.write(f"  ✓ Ingredientes personalizados eliminados: {deleted_ingredients[0]}")
                    
                    # 4. Items de órdenes
                    deleted_items = OrderItem.objects.all().delete()
                    self.stdout.write(f"  ✓ Items de órdenes eliminados: {deleted_items[0]}")
                    
                    # 5. Finalmente las órdenes
                    deleted_orders = Order.objects.all().delete()
                    self.stdout.write(f"  ✓ Órdenes eliminadas: {deleted_orders[0]}")
                    
                    self.stdout.write(self.style.SUCCESS("\n✅ Limpieza completada exitosamente."))
                    
                    # Mostrar resumen
                    self.stdout.write("\nResumen de eliminación:")
                    for model, details in deleted_orders[1].items():
                        if details > 0:
                            self.stdout.write(f"  - {model}: {details}")
                            
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"\n❌ Error durante la eliminación: {str(e)}"))
                self.stdout.write("No se eliminó ningún dato debido al error.")
                
        else:
            self.stdout.write(self.style.SUCCESS("✅ No hay datos de órdenes para eliminar. La base de datos ya está limpia."))
        
        self.stdout.write("\n" + "=" * 70)

    def get_orders_summary(self):
        """Muestra un resumen de las órdenes actuales antes de eliminar."""
        
        self.stdout.write("\n📋 RESUMEN DE ÓRDENES ACTUALES:")
        self.stdout.write("-" * 50)
        
        total_orders = Order.objects.count()
        if total_orders == 0:
            self.stdout.write("  No hay órdenes en la base de datos")
            return
            
        self.stdout.write(f"Total de órdenes: {total_orders}")
        self.stdout.write("\nPor estado:")
        
        # Contadores por estado
        created_count = Order.objects.filter(status='CREATED').count()
        served_count = Order.objects.filter(status='SERVED').count()  
        paid_count = Order.objects.filter(status='PAID').count()
        
        if created_count > 0:
            self.stdout.write(f"  📝 Pedidos CREADOS: {created_count}")
        if served_count > 0:
            self.stdout.write(f"  🍽️  Pedidos ENTREGADOS: {served_count}")
        if paid_count > 0:
            self.stdout.write(f"  💰 Pedidos PAGADOS: {paid_count}")
        
        # Información adicional
        total_items = OrderItem.objects.count()
        total_payments = Payment.objects.count()
        total_revenue = Order.objects.filter(status='PAID').aggregate(
            total=models.Sum('total_amount')
        )['total'] or 0
        
        self.stdout.write(f"\nDatos relacionados:")
        self.stdout.write(f"  - Items de órdenes: {total_items}")
        self.stdout.write(f"  - Pagos registrados: {total_payments}")
        if total_revenue > 0:
            self.stdout.write(f"  - Ingresos totales: S/ {total_revenue:.2f}")
        
        # Mostrar órdenes recientes
        recent_orders = Order.objects.order_by('-created_at')[:5]
        if recent_orders:
            self.stdout.write("\nÚltimas 5 órdenes:")
            for order in recent_orders:
                status_emoji = {
                    'CREATED': '📝',
                    'SERVED': '🍽️',
                    'PAID': '💰'
                }.get(order.status, '❓')
                
                self.stdout.write(f"  {status_emoji} Orden #{order.id}: Mesa {order.table.table_number}, "
                          f"Total: S/{order.total_amount:.2f}, Estado: {order.get_status_display()}")