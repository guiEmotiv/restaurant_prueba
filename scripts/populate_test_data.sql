-- Script para poblar la base de datos con datos de prueba
-- Para restaurante "El Fogón de Don Soto"

-- UNIDADES DE MEDIDA
INSERT INTO unit (id, name, created_at) VALUES
(1, 'kg', '2025-08-02 12:00:00'),
(2, 'g', '2025-08-02 12:00:00'),
(3, 'litros', '2025-08-02 12:00:00'),
(4, 'ml', '2025-08-02 12:00:00'),
(5, 'unidades', '2025-08-02 12:00:00'),
(6, 'porciones', '2025-08-02 12:00:00'),
(7, 'cucharadas', '2025-08-02 12:00:00'),
(8, 'tazas', '2025-08-02 12:00:00');

-- ZONAS DEL RESTAURANTE
INSERT INTO zone (id, name, created_at) VALUES
(1, 'Terraza Principal', '2025-08-02 12:00:00'),
(2, 'Salón Interior', '2025-08-02 12:00:00'),
(3, 'Área VIP', '2025-08-02 12:00:00'),
(4, 'Barra', '2025-08-02 12:00:00'),
(5, 'Jardín', '2025-08-02 12:00:00');

-- MESAS
INSERT INTO "table" (id, zone_id, table_number, created_at) VALUES
-- Terraza Principal
(1, 1, 'T01', '2025-08-02 12:00:00'),
(2, 1, 'T02', '2025-08-02 12:00:00'),
(3, 1, 'T03', '2025-08-02 12:00:00'),
(4, 1, 'T04', '2025-08-02 12:00:00'),
(5, 1, 'T05', '2025-08-02 12:00:00'),
-- Salón Interior
(6, 2, 'S01', '2025-08-02 12:00:00'),
(7, 2, 'S02', '2025-08-02 12:00:00'),
(8, 2, 'S03', '2025-08-02 12:00:00'),
(9, 2, 'S04', '2025-08-02 12:00:00'),
-- Área VIP
(10, 3, 'V01', '2025-08-02 12:00:00'),
(11, 3, 'V02', '2025-08-02 12:00:00'),
-- Barra
(12, 4, 'B01', '2025-08-02 12:00:00'),
(13, 4, 'B02', '2025-08-02 12:00:00'),
-- Jardín
(14, 5, 'J01', '2025-08-02 12:00:00'),
(15, 5, 'J02', '2025-08-02 12:00:00');

-- ENVASES PARA LLEVAR
INSERT INTO container (id, name, description, price, stock, is_active, created_at, updated_at) VALUES
(1, 'Bandeja Pequeña', 'Bandeja biodegradable 500ml', 2.50, 100, true, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
(2, 'Bandeja Grande', 'Bandeja biodegradable 1L', 3.50, 80, true, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
(3, 'Vaso Térmico', 'Vaso para bebidas calientes 400ml', 1.50, 150, true, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
(4, 'Botella Plástica', 'Botella para bebidas frías 500ml', 1.00, 200, true, '2025-08-02 12:00:00', '2025-08-02 12:00:00');

-- GRUPOS DE INGREDIENTES
INSERT INTO "group" (id, name, created_at) VALUES
(1, 'Carnes', '2025-08-02 12:00:00'),
(2, 'Verduras', '2025-08-02 12:00:00'),
(3, 'Bebidas', '2025-08-02 12:00:00'),
(4, 'Condimentos', '2025-08-02 12:00:00'),
(5, 'Lácteos', '2025-08-02 12:00:00'),
(6, 'Cereales', '2025-08-02 12:00:00'),
(7, 'Postres', '2025-08-02 12:00:00');

-- INGREDIENTES
INSERT INTO ingredient (id, name, group_id, unit_id, current_stock, min_stock, unit_cost, is_active, created_at, updated_at) VALUES
-- Carnes
(1, 'Lomo de Res', 1, 1, 25.5, 5.0, 35.00, true, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
(2, 'Pollo Entero', 1, 5, 15, 3, 12.50, true, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
(3, 'Chorizo Parrillero', 1, 1, 8.0, 2.0, 18.00, true, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
(4, 'Costillas de Cerdo', 1, 1, 12.0, 3.0, 22.00, true, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
-- Verduras
(5, 'Papa Amarilla', 2, 1, 50.0, 10.0, 2.50, true, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
(6, 'Cebolla Roja', 2, 1, 20.0, 5.0, 3.00, true, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
(7, 'Tomate', 2, 1, 15.0, 3.0, 4.00, true, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
(8, 'Lechuga', 2, 5, 20, 5, 1.50, true, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
-- Bebidas
(9, 'Coca Cola', 3, 3, 48.0, 12.0, 2.80, true, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
(10, 'Cerveza Pilsen', 3, 5, 100, 24, 4.50, true, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
(11, 'Agua Mineral', 3, 5, 80, 20, 1.20, true, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
-- Condimentos
(12, 'Sal', 4, 1, 5.0, 1.0, 2.00, true, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
(13, 'Pimienta', 4, 1, 2.0, 0.5, 8.00, true, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
(14, 'Ají Amarillo', 4, 1, 3.0, 0.5, 12.00, true, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
-- Lácteos
(15, 'Queso Fresco', 5, 1, 8.0, 2.0, 15.00, true, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
-- Cereales
(16, 'Arroz Blanco', 6, 1, 25.0, 5.0, 3.50, true, '2025-08-02 12:00:00', '2025-08-02 12:00:00');

-- RECETAS
INSERT INTO recipe (id, name, group_id, base_price, profit_percentage, is_active, version, created_at, updated_at) VALUES
-- Parrillas
(1, 'Parrillada Mixta', 1, 45.00, 150.0, true, 1, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
(2, 'Lomo Saltado', 1, 28.00, 140.0, true, 1, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
(3, 'Pollo a la Brasa', 1, 25.00, 120.0, true, 1, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
(4, 'Costillas BBQ', 1, 32.00, 130.0, true, 1, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
-- Bebidas
(5, 'Coca Cola Personal', 3, 5.00, 80.0, true, 1, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
(6, 'Cerveza Pilsen', 3, 8.00, 60.0, true, 1, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
(7, 'Agua Mineral', 3, 3.50, 70.0, true, 1, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
-- Acompañamientos
(8, 'Papas Fritas', 2, 8.00, 200.0, true, 1, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
(9, 'Ensalada Mixta', 2, 12.00, 150.0, true, 1, '2025-08-02 12:00:00', '2025-08-02 12:00:00'),
(10, 'Arroz Chaufa', 6, 15.00, 180.0, true, 1, '2025-08-02 12:00:00', '2025-08-02 12:00:00');

-- ITEMS DE RECETAS (Ingredientes por receta)
INSERT INTO recipe_item (id, recipe_id, ingredient_id, quantity, created_at) VALUES
-- Parrillada Mixta
(1, 1, 1, 0.3, '2025-08-02 12:00:00'), -- Lomo de Res 300g
(2, 1, 3, 0.2, '2025-08-02 12:00:00'), -- Chorizo 200g
(3, 1, 4, 0.25, '2025-08-02 12:00:00'), -- Costillas 250g
(4, 1, 5, 0.3, '2025-08-02 12:00:00'), -- Papa 300g
-- Lomo Saltado
(5, 2, 1, 0.25, '2025-08-02 12:00:00'), -- Lomo 250g
(6, 2, 6, 0.1, '2025-08-02 12:00:00'), -- Cebolla 100g
(7, 2, 7, 0.15, '2025-08-02 12:00:00'), -- Tomate 150g
(8, 2, 5, 0.3, '2025-08-02 12:00:00'), -- Papa 300g
-- Pollo a la Brasa
(9, 3, 2, 0.5, '2025-08-02 12:00:00'), -- Medio pollo
(10, 3, 5, 0.25, '2025-08-02 12:00:00'), -- Papa 250g
-- Costillas BBQ
(11, 4, 4, 0.4, '2025-08-02 12:00:00'), -- Costillas 400g
(12, 4, 5, 0.2, '2025-08-02 12:00:00'), -- Papa 200g
-- Bebidas (sin ingredientes complejos)
(13, 5, 9, 0.33, '2025-08-02 12:00:00'), -- Coca Cola 330ml
(14, 6, 10, 1, '2025-08-02 12:00:00'), -- Cerveza 1 unidad
(15, 7, 11, 1, '2025-08-02 12:00:00'); -- Agua 1 unidad

-- ÓRDENES DE PRUEBA
INSERT INTO "order" (id, table_id, waiter, status, total_amount, created_at, served_at, paid_at) VALUES
(1, 1, 'admin', 'PAID', 78.50, '2025-08-02 13:30:00', '2025-08-02 14:15:00', '2025-08-02 14:30:00'),
(2, 5, 'mesero01', 'PAID', 45.00, '2025-08-02 14:00:00', '2025-08-02 14:45:00', '2025-08-02 15:00:00'),
(3, 8, 'admin', 'PAID', 33.00, '2025-08-02 15:30:00', '2025-08-02 16:15:00', '2025-08-02 16:30:00'),
(4, 12, 'mesero01', 'CREATED', 25.00, '2025-08-02 17:00:00', null, null),
(5, 3, 'admin', 'PAID', 91.50, '2025-08-02 18:00:00', '2025-08-02 18:45:00', '2025-08-02 19:00:00');

-- ITEMS DE ÓRDENES
INSERT INTO order_item (id, order_id, recipe_id, quantity, unit_price, total_price, status, notes, is_takeaway, has_taper, created_at) VALUES
-- Orden 1: Mesa T01
(1, 1, 1, 1, 45.00, 45.00, 'SERVED', 'Término medio', false, false, '2025-08-02 13:30:00'),
(2, 1, 5, 2, 5.00, 10.00, 'SERVED', '', false, false, '2025-08-02 13:30:00'),
(3, 1, 6, 3, 8.00, 24.00, 'SERVED', 'Bien fría', false, false, '2025-08-02 13:30:00'),
-- Orden 2: Mesa T05
(4, 2, 1, 1, 45.00, 45.00, 'SERVED', 'Sin cebolla', false, false, '2025-08-02 14:00:00'),
-- Orden 3: Mesa S03
(5, 3, 2, 1, 28.00, 28.00, 'SERVED', '', false, false, '2025-08-02 15:30:00'),
(6, 3, 7, 1, 3.50, 3.50, 'SERVED', '', false, false, '2025-08-02 15:30:00'),
-- Orden 4: Mesa B01 (Pendiente)
(7, 4, 3, 1, 25.00, 25.00, 'CREATED', 'Para llevar', true, true, '2025-08-02 17:00:00'),
-- Orden 5: Mesa T03
(8, 5, 4, 2, 32.00, 64.00, 'SERVED', 'Extra salsa BBQ', false, false, '2025-08-02 18:00:00'),
(9, 5, 6, 2, 8.00, 16.00, 'SERVED', '', false, false, '2025-08-02 18:00:00'),
(10, 5, 8, 1, 8.00, 8.00, 'SERVED', 'Extra crocante', false, false, '2025-08-02 18:00:00');

-- PAGOS
INSERT INTO payment (id, order_id, payment_method, amount, tax_amount, payer_name, notes, created_at) VALUES
(1, 1, 'CASH', 78.50, 0.00, 'Cliente Mesa 1', 'Pago en efectivo', '2025-08-02 14:30:00'),
(2, 2, 'CARD', 45.00, 0.00, 'Sr. García', 'Visa terminada en 1234', '2025-08-02 15:00:00'),
(3, 3, 'YAPE', 33.00, 0.00, 'Ana Pérez', 'Transferencia Yape', '2025-08-02 16:30:00'),
(4, 5, 'CASH', 91.50, 0.00, 'Familia Rodríguez', 'Pago mesa VIP', '2025-08-02 19:00:00');

-- ITEMS DE PAGOS (Dividir pagos por items si es necesario)
INSERT INTO payment_item (id, payment_id, order_item_id, amount, created_at) VALUES
-- Pago 1: Orden completa
(1, 1, 1, 45.00, '2025-08-02 14:30:00'),
(2, 1, 2, 10.00, '2025-08-02 14:30:00'),
(3, 1, 3, 24.00, '2025-08-02 14:30:00'),
-- Pago 2: Orden completa
(4, 2, 4, 45.00, '2025-08-02 15:00:00'),
-- Pago 3: Orden completa
(5, 3, 5, 28.00, '2025-08-02 16:30:00'),
(6, 3, 6, 3.50, '2025-08-02 16:30:00'),
-- Pago 4: Orden completa
(7, 4, 8, 64.00, '2025-08-02 19:00:00'),
(8, 4, 9, 16.00, '2025-08-02 19:00:00'),
(9, 4, 10, 8.00, '2025-08-02 19:00:00');

-- VENTAS DE ENVASES (Para órdenes para llevar)
INSERT INTO container_sale (id, order_id, container_id, quantity, unit_price, total_price, created_at) VALUES
(1, 4, 2, 1, 3.50, 3.50, '2025-08-02 17:00:00'); -- Bandeja grande para pollo para llevar

-- Verificar datos insertados
SELECT 'RESUMEN DE DATOS INSERTADOS:' as status;
SELECT 
    'Unidades' as tabla, COUNT(*) as registros FROM unit
    UNION ALL
SELECT 'Zonas', COUNT(*) FROM zone
    UNION ALL  
SELECT 'Mesas', COUNT(*) FROM "table"
    UNION ALL
SELECT 'Envases', COUNT(*) FROM container
    UNION ALL
SELECT 'Grupos', COUNT(*) FROM "group" 
    UNION ALL
SELECT 'Ingredientes', COUNT(*) FROM ingredient
    UNION ALL
SELECT 'Recetas', COUNT(*) FROM recipe
    UNION ALL
SELECT 'Items de Receta', COUNT(*) FROM recipe_item
    UNION ALL
SELECT 'Órdenes', COUNT(*) FROM "order"
    UNION ALL
SELECT 'Items de Orden', COUNT(*) FROM order_item
    UNION ALL
SELECT 'Pagos', COUNT(*) FROM payment
    UNION ALL
SELECT 'Items de Pago', COUNT(*) FROM payment_item
    UNION ALL
SELECT 'Ventas de Envases', COUNT(*) FROM container_sale;

SELECT '✅ Base de datos poblada correctamente con datos de prueba' as resultado;