# Fix dashboard_operativo_view with correct table names

from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('operation', '0045_fix_dashboard_operativo_view_complete'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            DROP VIEW IF EXISTS dashboard_operativo_view;
            
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
                oi.total_price as total_with_container,
                oi.status as item_status,
                oi.is_takeaway,
                r.name as recipe_name,
                g.name as category_name,
                g.id as category_id,
                p.payment_method as payment_method,
                p.amount as payment_amount
            FROM "order" o
            LEFT JOIN "order_item" oi ON o.id = oi.order_id
            LEFT JOIN "recipe" r ON oi.recipe_id = r.id
            LEFT JOIN "group" g ON r.group_id = g.id
            LEFT JOIN "payment" p ON o.id = p.order_id
            WHERE (o.status IN ('PAID', 'PENDING', 'IN_PREPARATION', 'COMPLETED') OR o.status IS NULL)
            ORDER BY o.created_at DESC, o.id DESC, oi.id
            """,
            reverse_sql="DROP VIEW IF EXISTS dashboard_operativo_view;"
        ),
    ]