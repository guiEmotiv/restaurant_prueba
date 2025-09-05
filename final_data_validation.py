import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_prod')
django.setup()

from operation.models import Order, OrderItem, Payment
from django.db import connection

print("🎯 VALIDACIÓN FINAL - CONSISTENCIA DE DATOS")
print("=" * 50)

print("📊 RESUMEN DE DATOS REALES:")
print("-" * 30)

# Calcular totales reales desde los modelos
total_orders = Order.objects.count()
total_items = OrderItem.objects.count()
total_payments = Payment.objects.count()

print(f"✅ Órdenes: {total_orders}")
print(f"✅ Items: {total_items}")
print(f"✅ Pagos: {total_payments}")

# Totales por status
paid_orders = Order.objects.filter(status='PAID').count()
paid_items_total = sum(item.total_price for item in OrderItem.objects.filter(order__status='PAID'))
processing_items_total = sum(item.total_price for item in OrderItem.objects.filter(order__status='processing'))

print(f"\n💰 TOTALES REALES POR STATUS:")
print(f"   PAID orders: {paid_orders} órdenes")
print(f"   PAID items total: ${paid_items_total}")
print(f"   PROCESSING items total: ${processing_items_total}")

# Validar contra la vista
cursor = connection.cursor()

print(f"\n🔍 COMPARACIÓN CON VISTA dashboard_operativo_view:")
print("-" * 50)

# Contar registros en vista
cursor.execute("SELECT COUNT(*) FROM dashboard_operativo_view WHERE order_status = 'PAID'")
vista_paid_count = cursor.fetchone()[0]

cursor.execute("SELECT SUM(total_with_container) FROM dashboard_operativo_view WHERE order_status = 'PAID'")
vista_paid_total = cursor.fetchone()[0] or 0

cursor.execute("SELECT COUNT(*) FROM dashboard_operativo_view WHERE order_status = 'processing'")
vista_processing_count = cursor.fetchone()[0]

cursor.execute("SELECT SUM(total_with_container) FROM dashboard_operativo_view WHERE order_status = 'processing'")
vista_processing_total = cursor.fetchone()[0] or 0

print(f"Vista PAID items: {vista_paid_count} -> ${vista_paid_total}")
print(f"Vista PROCESSING items: {vista_processing_count} -> ${vista_processing_total}")

# Verificar consistencia
print(f"\n✅ VERIFICACIÓN DE CONSISTENCIA:")
print("-" * 30)

paid_consistent = abs(float(paid_items_total) - float(vista_paid_total)) < 0.01
processing_consistent = abs(float(processing_items_total) - float(vista_processing_total)) < 0.01

if paid_consistent:
    print(f"✅ PAID totals coinciden: Real ${paid_items_total} = Vista ${vista_paid_total}")
else:
    print(f"❌ PAID totals NO coinciden: Real ${paid_items_total} ≠ Vista ${vista_paid_total}")

if processing_consistent:
    print(f"✅ PROCESSING totals coinciden: Real ${processing_items_total} = Vista ${vista_processing_total}")
else:
    print(f"❌ PROCESSING totals NO coinciden: Real ${processing_items_total} ≠ Vista ${vista_processing_total}")

# Mostrar detalle order by order
print(f"\n📋 DETALLE ORDEN POR ORDEN:")
print("-" * 30)

for order in Order.objects.all().order_by('id'):
    real_items_total = sum(item.total_price for item in order.orderitem_set.all())
    real_payments_total = sum(payment.amount for payment in order.payments.all())
    
    cursor.execute("SELECT SUM(total_with_container) FROM dashboard_operativo_view WHERE order_id = ?", [order.id])
    vista_items_total = cursor.fetchone()[0] or 0
    
    print(f"Order #{order.id} ({order.status}):")
    print(f"  Items reales: ${real_items_total} | Vista: ${vista_items_total}")
    print(f"  Pagos reales: ${real_payments_total}")
    print(f"  Order total_amount: ${order.total_amount}")

cursor.close()

if paid_consistent and processing_consistent:
    print(f"\n🎉 ¡DATOS COMPLETAMENTE CONSISTENTES!")
    print(f"✅ La vista dashboard_operativo_view ahora refleja exactamente los datos reales")
else:
    print(f"\n⚠️ Aún hay inconsistencias que requieren corrección")

print(f"\n🌐 Dashboard listo en: https://www.xn--elfogndedonsoto-zrb.com/")