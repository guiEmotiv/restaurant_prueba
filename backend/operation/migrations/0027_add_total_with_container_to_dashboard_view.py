# Generated migration to add total_with_container to dashboard_operativo_view

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('operation', '0026_remove_dashboard_financiero_view'),
    ]

    operations = [
        migrations.RunSQL(
            """
            DROP VIEW IF EXISTS dashboard_operativo_view;
            
            CREATE VIEW dashboard_operativo_view AS
            SELECT 
                -- Información básica de la orden
                o.id as order_id,
                o.created_at,
                o.served_at,
                o.paid_at,
                o.total_amount as order_total,
                o.status as order_status,
                o.waiter,
                
                -- Información de la mesa y zona  
                t.table_number,
                z.name as zone_name,
                
                -- Información del item
                oi.id as item_id,
                oi.quantity,
                oi.unit_price,
                oi.total_price,
                -- NUEVO: Calcular total con contenedor
                CASE 
                    WHEN oi.container_id IS NOT NULL AND oi.container_price IS NOT NULL 
                    THEN oi.total_price + (oi.container_price * oi.quantity)
                    WHEN oi.has_taper = 1 THEN (
                        SELECT oi.total_price + COALESCE(
                            (SELECT cs.unit_price * cs.quantity 
                             FROM container_sale cs 
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
                
                -- Información de la receta
                r.name as recipe_name,
                r.version as recipe_version,
                r.base_price,
                r.preparation_time,
                r.is_active as recipe_active,
                r.is_available as recipe_available,
                
                -- Información del grupo/categoría
                g.name as category_name,
                g.id as category_id,
                
                -- Información de pagos - USAR SUBQUERY AGREGADA para evitar duplicados
                (SELECT payment_method 
                 FROM payment p1 
                 WHERE p1.order_id = o.id 
                 ORDER BY p1.created_at DESC 
                 LIMIT 1) as payment_method,
                (SELECT amount 
                 FROM payment p2 
                 WHERE p2.order_id = o.id 
                 ORDER BY p2.created_at DESC 
                 LIMIT 1) as payment_amount,
                (SELECT created_at 
                 FROM payment p3 
                 WHERE p3.order_id = o.id 
                 ORDER BY p3.created_at DESC 
                 LIMIT 1) as payment_date,
                
                -- Métricas calculadas para operaciones
                CASE 
                    WHEN o.created_at IS NOT NULL AND o.paid_at IS NOT NULL 
                    THEN CAST((julianday(o.paid_at) - julianday(o.created_at)) * 24 * 60 AS INTEGER)
                    ELSE NULL 
                END as service_time_minutes,
                
                -- Fecha operativa (para filtros y agrupación)
                DATE(COALESCE(o.paid_at, o.created_at)) as operational_date,
                
                -- Tiempo desde creación del item (para métricas de cocina)
                CASE 
                    WHEN oi.created_at IS NOT NULL 
                    THEN CAST((julianday('now') - julianday(oi.created_at)) * 24 * 60 AS INTEGER)
                    ELSE NULL 
                END as item_age_minutes,
                
                -- Clasificación de horario
                CASE 
                    WHEN strftime('%H', o.created_at) BETWEEN '06' AND '11' THEN 'desayuno'
                    WHEN strftime('%H', o.created_at) BETWEEN '12' AND '15' THEN 'almuerzo'
                    WHEN strftime('%H', o.created_at) BETWEEN '16' AND '18' THEN 'lonche'
                    WHEN strftime('%H', o.created_at) BETWEEN '19' AND '23' THEN 'cena'
                    ELSE 'madrugada'
                END as meal_period,
                
                -- Día de la semana
                CASE strftime('%w', o.created_at)
                    WHEN '0' THEN 'domingo'
                    WHEN '1' THEN 'lunes'
                    WHEN '2' THEN 'martes'
                    WHEN '3' THEN 'miércoles'
                    WHEN '4' THEN 'jueves'
                    WHEN '5' THEN 'viernes'
                    WHEN '6' THEN 'sábado'
                END as day_of_week
                
            FROM \"order\" o
            LEFT JOIN \"table\" t ON o.table_id = t.id
            LEFT JOIN zone z ON t.zone_id = z.id
            LEFT JOIN order_item oi ON o.id = oi.order_id
            LEFT JOIN recipe r ON oi.recipe_id = r.id
            LEFT JOIN \"group\" g ON r.group_id = g.id
            
            ORDER BY o.created_at DESC, oi.id;
            """,
            reverse_sql="DROP VIEW IF EXISTS dashboard_operativo_view;"
        ),
    ]