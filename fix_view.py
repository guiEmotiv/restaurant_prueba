import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_prod')
django.setup()

from django.db import connection

print("🔧 FIXING DASHBOARD VIEW WITH CORRECT COLUMNS")
print("=" * 55)

cursor = connection.cursor()

print("1️⃣ Dropping existing view...")
try:
    cursor.execute("DROP VIEW IF EXISTS dashboard_operativo_view")
    print("✅ Dropped existing view")
except Exception as e:
    print(f"⚠️ Drop view warning: {e}")

print("\n2️⃣ Creating corrected view with proper columns...")
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
            p.payment_method as payment_method,
            p.amount as payment_amount
        FROM "order" o
        LEFT JOIN order_item oi ON o.id = oi.order_id
        LEFT JOIN recipe r ON oi.recipe_id = r.id
        LEFT JOIN "group" g ON r.group_id = g.id
        LEFT JOIN payment p ON o.id = p.order_id
        WHERE (o.status IN ('PAID', 'PREPARING', 'SERVED', 'CREATED') OR o.status IS NULL)
        ORDER BY o.created_at DESC, o.id DESC, oi.id
    """)
    print("✅ Created corrected dashboard_operativo_view with proper columns")
except Exception as e:
    print(f"❌ View creation failed: {e}")
    exit(1)

print("\n3️⃣ Testing the corrected view...")
try:
    cursor.execute("SELECT COUNT(*) FROM dashboard_operativo_view")
    count = cursor.fetchone()[0]
    print(f"✅ View working: {count} records")
    
    if count > 0:
        cursor.execute("SELECT order_id, recipe_name, order_total, total_with_container FROM dashboard_operativo_view LIMIT 3")
        samples = cursor.fetchall()
        print("📋 Sample data:")
        for sample in samples:
            print(f"   Order {sample[0]}: {sample[1]} - Order Total: ${sample[2]}, With Container: ${sample[3]}")
except Exception as e:
    print(f"❌ View test failed: {e}")

cursor.close()
print("\n🎉 Dashboard view fix completed!")
print("🌐 Dashboard should now work at: https://www.xn--elfogndedonsoto-zrb.com/")