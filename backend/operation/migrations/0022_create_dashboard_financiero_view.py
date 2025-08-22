# Generated migration for dashboard financiero database view

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('operation', '0021_remove_orderitemingredient_table'),
    ]

    operations = [
        migrations.RunSQL(
            """
            CREATE VIEW IF NOT EXISTS dashboard_financiero_view AS
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
                oi.status as item_status,
                oi.notes,
                oi.is_takeaway,
                oi.has_taper,
                
                -- Información de la receta
                r.name as recipe_name,
                r.version as recipe_version,
                r.base_price,
                r.profit_percentage,
                r.preparation_time,
                r.is_active as recipe_active,
                
                -- Información del grupo/categoría
                g.name as category_name,
                
                -- Información de pagos (principal)
                p.payment_method,
                p.amount as payment_amount,
                p.created_at as payment_date,
                p.payer_name,
                
                -- Métricas calculadas
                CASE 
                    WHEN o.created_at IS NOT NULL AND o.paid_at IS NOT NULL 
                    THEN CAST((julianday(o.paid_at) - julianday(o.created_at)) * 24 * 60 AS INTEGER)
                    ELSE NULL 
                END as service_time_minutes,
                
                -- Fecha operativa (para filtros)
                DATE(o.paid_at) as operational_date,
                
                -- Tiempo desde creación del item (para análisis)
                CASE 
                    WHEN oi.created_at IS NOT NULL 
                    THEN CAST((julianday('now') - julianday(oi.created_at)) * 24 * 60 AS INTEGER)
                    ELSE NULL 
                END as item_age_minutes,
                
                -- Indicadores de rentabilidad
                oi.total_price - (
                    SELECT COALESCE(SUM(ri.quantity * i.unit_price), 0)
                    FROM recipe_item ri
                    JOIN ingredient i ON ri.ingredient_id = i.id
                    WHERE ri.recipe_id = r.id
                ) as estimated_profit,
                
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
                END as day_of_week,
                
                -- Indicadores de eficiencia
                CASE 
                    WHEN oi.status = 'PAID' AND o.status = 'PAID' THEN 1 
                    ELSE 0 
                END as is_completed_sale
                
            FROM "order" o
            LEFT JOIN "table" t ON o.table_id = t.id
            LEFT JOIN zone z ON t.zone_id = z.id
            LEFT JOIN order_item oi ON o.id = oi.order_id
            LEFT JOIN recipe r ON oi.recipe_id = r.id
            LEFT JOIN "group" g ON r.group_id = g.id
            LEFT JOIN payment p ON o.id = p.order_id
            
            WHERE o.status = 'PAID'  -- Solo órdenes pagadas para dashboard financiero
            
            ORDER BY o.paid_at DESC, oi.id;
            """,
            reverse_sql="DROP VIEW IF EXISTS dashboard_financiero_view;"
        ),
        
        # Crear índices para optimizar consultas en la vista
        migrations.RunSQL(
            """
            CREATE INDEX IF NOT EXISTS idx_dashboard_financiero_operational_date 
            ON "order"(paid_at) WHERE status = 'PAID';
            """,
            reverse_sql="DROP INDEX IF EXISTS idx_dashboard_financiero_operational_date;"
        ),
        
        migrations.RunSQL(
            """
            CREATE INDEX IF NOT EXISTS idx_dashboard_financiero_category 
            ON recipe(group_id) WHERE is_active = 1;
            """,
            reverse_sql="DROP INDEX IF EXISTS idx_dashboard_financiero_category;"
        ),
        
        migrations.RunSQL(
            """
            CREATE INDEX IF NOT EXISTS idx_dashboard_financiero_payment_method 
            ON payment(payment_method, created_at);
            """,
            reverse_sql="DROP INDEX IF EXISTS idx_dashboard_financiero_payment_method;"
        ),
    ]