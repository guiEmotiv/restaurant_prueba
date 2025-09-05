import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_prod')
django.setup()

from django.db import connection

print("🔧 CORRIGIENDO VISTA DASHBOARD - ELIMINANDO DUPLICADOS")
print("=" * 58)

cursor = connection.cursor()

print("1️⃣ Eliminando vista con duplicados...")
try:
    cursor.execute("DROP VIEW IF EXISTS dashboard_operativo_view")
    print("✅ Vista anterior eliminada")
except Exception as e:
    print(f"⚠️ Error: {e}")

print("\n2️⃣ Creando vista corregida SIN duplicados...")
try:
    cursor.execute("""
        CREATE VIEW dashboard_operativo_view AS
        SELECT DISTINCT
            o.id as order_id,
            o.total_amount as order_total,
            o.status as order_status,
            CASE 
                WHEN o.waiter = '' OR o.waiter IS NULL THEN 'Sin Asignar'
                ELSE o.waiter
            END as waiter,
            DATE(o.created_at) as operational_date,
            oi.id as item_id,
            oi.quantity,
            oi.unit_price,
            oi.total_price,
            CASE 
                WHEN oi.is_takeaway = 1 AND oi.container_price > 0 
                THEN oi.total_price + (oi.container_price * oi.quantity)
                ELSE oi.total_price
            END as total_with_container,
            oi.status as item_status,
            oi.is_takeaway,
            r.name as recipe_name,
            g.name as category_name,
            g.id as category_id,
            -- Payment info agregado por separado, sin multiplicar items
            (SELECT GROUP_CONCAT(p2.payment_method || ':$' || p2.amount, ', ') 
             FROM payment p2 
             WHERE p2.order_id = o.id) as payment_info,
            -- Total pagado por orden (sin multiplicar)
            (SELECT COALESCE(SUM(p3.amount), 0) 
             FROM payment p3 
             WHERE p3.order_id = o.id) as total_paid
        FROM "order" o
        LEFT JOIN order_item oi ON o.id = oi.order_id
        LEFT JOIN recipe r ON oi.recipe_id = r.id
        LEFT JOIN "group" g ON r.group_id = g.id
        WHERE (o.status IN ('PAID', 'PREPARING', 'SERVED', 'CREATED', 'pending', 'processing') OR o.status IS NULL)
        ORDER BY o.created_at DESC, o.id DESC, oi.id
    """)
    print("✅ Vista corregida creada exitosamente")
    
except Exception as e:
    print(f"❌ Error creando vista: {e}")
    cursor.close()
    exit(1)

print("\n3️⃣ Validando vista corregida...")
try:
    cursor.execute("SELECT COUNT(*) FROM dashboard_operativo_view")
    count = cursor.fetchone()[0]
    print(f"✅ Registros en vista corregida: {count}")
    
    # Mostrar datos corregidos
    cursor.execute("""
        SELECT order_id, recipe_name, quantity, order_total, total_with_container, 
               order_status, operational_date, payment_info, total_paid
        FROM dashboard_operativo_view 
        ORDER BY order_id, item_id
    """)
    corrected_data = cursor.fetchall()
    print(f"\n📋 Datos corregidos (sin duplicados):")
    for i, data in enumerate(corrected_data, 1):
        payments = data[7] or "Sin pagos"
        print(f"   {i}. Order #{data[0]} - {data[1]} x{data[2]} - Total Order: ${data[3]} - Item: ${data[4]} - {data[5]} - Pagos: {payments} (Total: ${data[8]})")
    
    # Validar totales por fecha
    print(f"\n4️⃣ Totales corregidos por fecha:")
    cursor.execute("""
        SELECT operational_date, 
               SUM(total_with_container) as daily_items_total,
               COUNT(DISTINCT order_id) as unique_orders,
               COUNT(*) as total_items,
               AVG(total_paid) as avg_paid_per_order
        FROM dashboard_operativo_view 
        WHERE order_status IN ('PAID', 'processing')
        GROUP BY operational_date
        ORDER BY operational_date DESC
    """)
    daily_totals = cursor.fetchall()
    for data in daily_totals:
        print(f"   {data[0]}: ${data[1]} de items ({data[3]} items de {data[2]} órdenes) - Promedio pagado: ${data[4]:.2f}")
    
except Exception as e:
    print(f"❌ Error validando vista: {e}")

cursor.close()
print(f"\n🎉 VISTA DASHBOARD CORREGIDA - SIN DUPLICADOS!")
print(f"📊 Ahora los totales deben ser consistentes con la data real")