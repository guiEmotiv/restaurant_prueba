# Generated migration to fix dashboard_operativo_view with all required fields

from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('operation', '0044_fix_production_data_integrity'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            DROP VIEW IF EXISTS dashboard_operativo_view;
            
            CREATE VIEW dashboard_operativo_view AS
            SELECT DISTINCT
                o.id as order_id,
                o.total as order_total,
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
                    WHEN oi.is_takeaway = 1 AND r.container_price > 0 
                    THEN oi.total_price + (r.container_price * oi.quantity)
                    ELSE oi.total_price
                END as total_with_container,
                oi.status as item_status,
                oi.is_takeaway,
                r.name as recipe_name,
                ic.name as category_name,
                ic.id as category_id,
                p.method as payment_method,
                p.amount as payment_amount
            FROM orders o
            LEFT JOIN order_item oi ON o.id = oi.order_id
            LEFT JOIN inventory_recipe r ON oi.recipe_id = r.id
            LEFT JOIN inventory_category ic ON r.category_id = ic.id
            LEFT JOIN payment p ON o.id = p.order_id
            WHERE (o.status IN ('PAID', 'PENDING', 'IN_PREPARATION', 'COMPLETED') OR o.status IS NULL)
            ORDER BY o.created_at DESC, o.id DESC, oi.id
            """,
            reverse_sql="DROP VIEW IF EXISTS dashboard_operativo_view;"
        ),
    ]