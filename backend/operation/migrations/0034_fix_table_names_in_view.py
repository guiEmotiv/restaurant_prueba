# Fix table names in dashboard_operativo_view

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('operation', '0033_fix_container_price_column'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            DROP VIEW IF EXISTS dashboard_operativo_view;
            
            CREATE VIEW dashboard_operativo_view AS
            SELECT 
                -- Datos básicos de orden
                o.id as order_id,
                o.created_at,
                o.served_at,
                o.paid_at,
                o.total_amount as order_total,
                o.status as order_status,
                o.waiter,
                
                -- Datos de mesa y zona
                t.table_number,
                z.name as zone_name,
                
                -- Datos de order item
                oi.id as item_id,
                oi.quantity,
                oi.unit_price,
                oi.total_price,
                CASE 
                    WHEN oi.container_id IS NOT NULL AND oi.container_price IS NOT NULL 
                    THEN oi.total_price + (oi.container_price * oi.quantity)
                    WHEN oi.has_taper = 1 THEN (
                        SELECT oi.total_price + COALESCE(
                            (SELECT cs.unit_price * cs.quantity 
                             FROM operation_containersale cs 
                             WHERE cs.order_id = o.id 
                               AND cs.quantity = oi.quantity 
                               AND cs.created_at >= oi.created_at
                             ORDER BY cs.created_at 
                             LIMIT 1), 0)
                    )
                    ELSE oi.total_price
                END as total_with_container,
                oi.status as item_status,
                oi.notes,
                oi.is_takeaway,
                oi.has_taper,
                oi.created_at as item_created_at,
                oi.preparing_at,
                
                -- Datos de receta
                r.name as recipe_name,
                r.version as recipe_version,
                r.base_price,
                r.preparation_time,
                r.is_active as recipe_active,
                r.is_available as recipe_available,
                
                -- Datos de categoría/grupo
                g.name as category_name,
                g.id as category_id,
                
                -- Datos de contenedores
                c.name as container_name,
                c.price as container_unit_price,
                
                -- Ingredientes simplificados
                'N/A' as actual_ingredients_used,
                0 as actual_ingredient_cost,
                'N/A' as recipe_ingredients_json,
                0 as recipe_total_ingredient_cost,
                (r.base_price * COALESCE(r.profit_percentage, 0) / 100) as recipe_profit_margin,
                
                -- Datos de pago
                (SELECT payment_method
                 FROM operation_payment p1
                 WHERE p1.order_id = o.id
                 ORDER BY p1.created_at DESC
                 LIMIT 1) as payment_method,
                (SELECT amount
                 FROM operation_payment p2
                 WHERE p2.order_id = o.id
                 ORDER BY p2.created_at DESC
                 LIMIT 1) as payment_amount,
                (SELECT created_at
                 FROM operation_payment p3
                 WHERE p3.order_id = o.id
                 ORDER BY p3.created_at DESC
                 LIMIT 1) as payment_date,
                
                -- Métricas de tiempo
                CASE
                    WHEN o.created_at IS NOT NULL AND o.paid_at IS NOT NULL
                    THEN CAST((julianday(o.paid_at) - julianday(o.created_at)) * 24 * 60 AS INTEGER)
                    ELSE NULL
                END as service_time_minutes,
                
                CASE
                    WHEN oi.created_at IS NOT NULL
                    THEN CAST((julianday('now') - julianday(oi.created_at)) * 24 * 60 AS INTEGER)
                    ELSE NULL
                END as item_age_minutes,
                
                -- Clasificaciones temporales
                DATE(COALESCE(o.paid_at, o.created_at)) as operational_date,
                
                CASE
                    WHEN strftime('%H', o.created_at) BETWEEN '06' AND '11' THEN 'desayuno'
                    WHEN strftime('%H', o.created_at) BETWEEN '12' AND '15' THEN 'almuerzo'
                    WHEN strftime('%H', o.created_at) BETWEEN '16' AND '18' THEN 'lonche'
                    WHEN strftime('%H', o.created_at) BETWEEN '19' AND '23' THEN 'cena'
                    ELSE 'madrugada'
                END as meal_period,
                
                CASE strftime('%w', o.created_at)
                    WHEN '0' THEN 'domingo'
                    WHEN '1' THEN 'lunes'
                    WHEN '2' THEN 'martes'
                    WHEN '3' THEN 'miércoles'
                    WHEN '4' THEN 'jueves'
                    WHEN '5' THEN 'viernes'
                    WHEN '6' THEN 'sábado'
                END as day_of_week
                
            FROM operation_order o
            LEFT JOIN config_table t ON o.table_id = t.id
            LEFT JOIN config_zone z ON t.zone_id = z.id
            LEFT JOIN operation_orderitem oi ON o.id = oi.order_id
            LEFT JOIN inventory_recipe r ON oi.recipe_id = r.id
            LEFT JOIN inventory_group g ON r.group_id = g.id
            LEFT JOIN config_container c ON oi.container_id = c.id
            
            ORDER BY o.created_at DESC, oi.id;
            """,
            reverse_sql="""
            DROP VIEW IF EXISTS dashboard_operativo_view;
            """
        )
    ]