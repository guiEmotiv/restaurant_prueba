# Generated migration for dashboard operativo database view

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('operation', '0022_create_dashboard_financiero_view'),
    ]

    operations = [
        migrations.RunSQL(
            """
            CREATE VIEW IF NOT EXISTS dashboard_operativo_view AS
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
                z.id as zone_id,
                
                -- Información del item
                oi.id as item_id,
                oi.quantity,
                oi.unit_price,
                oi.total_price,
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
                
                -- Información de pagos
                p.payment_method,
                p.amount as payment_amount,
                p.created_at as payment_date,
                
                -- Métricas calculadas para operaciones
                CASE 
                    WHEN oi.created_at IS NOT NULL AND oi.preparing_at IS NOT NULL 
                    THEN CAST((julianday(oi.preparing_at) - julianday(oi.created_at)) * 24 * 60 AS INTEGER)
                    ELSE NULL 
                END as prep_start_minutes,
                
                CASE 
                    WHEN oi.preparing_at IS NOT NULL AND o.served_at IS NOT NULL 
                    THEN CAST((julianday(o.served_at) - julianday(oi.preparing_at)) * 24 * 60 AS INTEGER)
                    ELSE NULL 
                END as prep_duration_minutes,
                
                CASE 
                    WHEN o.created_at IS NOT NULL 
                    THEN CAST((julianday('now') - julianday(o.created_at)) * 24 * 60 AS INTEGER)
                    ELSE NULL 
                END as order_age_minutes,
                
                CASE 
                    WHEN oi.created_at IS NOT NULL 
                    THEN CAST((julianday('now') - julianday(oi.created_at)) * 24 * 60 AS INTEGER)
                    ELSE NULL 
                END as item_age_minutes,
                
                -- Fecha operativa (para filtros)
                DATE(o.created_at) as operational_date,
                
                -- Clasificación de horario operativo
                CASE 
                    WHEN strftime('%H', o.created_at) BETWEEN '06' AND '11' THEN 'desayuno'
                    WHEN strftime('%H', o.created_at) BETWEEN '12' AND '15' THEN 'almuerzo'
                    WHEN strftime('%H', o.created_at) BETWEEN '16' AND '18' THEN 'lonche'
                    WHEN strftime('%H', o.created_at) BETWEEN '19' AND '23' THEN 'cena'
                    ELSE 'madrugada'
                END as meal_period,
                
                -- Estados operativos
                CASE 
                    WHEN o.status IN ('CREATED', 'SERVED') THEN 1 
                    ELSE 0 
                END as is_active_order,
                
                CASE 
                    WHEN oi.status = 'CREATED' THEN 1 
                    ELSE 0 
                END as is_pending_item,
                
                CASE 
                    WHEN oi.status = 'PREPARING' THEN 1 
                    ELSE 0 
                END as is_preparing_item,
                
                CASE 
                    WHEN oi.status = 'SERVED' THEN 1 
                    ELSE 0 
                END as is_served_item,
                
                -- Indicadores de eficiencia operativa
                CASE 
                    WHEN oi.created_at IS NOT NULL AND r.preparation_time IS NOT NULL
                         AND (julianday('now') - julianday(oi.created_at)) * 24 * 60 > r.preparation_time 
                    THEN 1 
                    ELSE 0 
                END as is_overdue_item,
                
                CASE 
                    WHEN o.status = 'CREATED' AND oi.status IN ('CREATED', 'PREPARING') THEN 1 
                    ELSE 0 
                END as needs_kitchen_attention
                
            FROM "order" o
            LEFT JOIN "table" t ON o.table_id = t.id
            LEFT JOIN zone z ON t.zone_id = z.id
            LEFT JOIN order_item oi ON o.id = oi.order_id
            LEFT JOIN recipe r ON oi.recipe_id = r.id
            LEFT JOIN "group" g ON r.group_id = g.id
            LEFT JOIN payment p ON o.id = p.order_id
            
            -- Filtrar solo órdenes activas para dashboard operativo
            WHERE o.status IN ('CREATED', 'SERVED')
            
            ORDER BY o.created_at DESC, oi.created_at ASC;
            """,
            reverse_sql="DROP VIEW IF EXISTS dashboard_operativo_view;"
        ),
        
        # Crear índices para optimizar consultas operativas
        migrations.RunSQL(
            """
            CREATE INDEX IF NOT EXISTS idx_dashboard_operativo_active_orders 
            ON "order"(status, created_at) WHERE status IN ('CREATED', 'SERVED');
            """,
            reverse_sql="DROP INDEX IF EXISTS idx_dashboard_operativo_active_orders;"
        ),
        
        migrations.RunSQL(
            """
            CREATE INDEX IF NOT EXISTS idx_dashboard_operativo_pending_items 
            ON order_item(status, created_at) WHERE status IN ('CREATED', 'PREPARING');
            """,
            reverse_sql="DROP INDEX IF EXISTS idx_dashboard_operativo_pending_items;"
        ),
        
        migrations.RunSQL(
            """
            CREATE INDEX IF NOT EXISTS idx_dashboard_operativo_zones 
            ON "table"(zone_id);
            """,
            reverse_sql="DROP INDEX IF EXISTS idx_dashboard_operativo_zones;"
        ),
    ]