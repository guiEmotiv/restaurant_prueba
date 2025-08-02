-- Script para limpiar completamente la base de datos
-- ATENCIÓN: Este script eliminará TODOS los datos

-- Deshabilitar foreign key constraints temporalmente
PRAGMA foreign_keys = OFF;

-- Eliminar datos de tablas de operación (en orden para respetar dependencias)
DELETE FROM container_sale;
DELETE FROM payment_item;
DELETE FROM payment;
DELETE FROM order_item_ingredient;
DELETE FROM order_item;
DELETE FROM "order";

-- Eliminar datos de inventario
DELETE FROM recipe_item;
DELETE FROM recipe;
DELETE FROM ingredient;
DELETE FROM "group";

-- Eliminar datos de configuración
DELETE FROM container;
DELETE FROM "table";
DELETE FROM zone;
DELETE FROM unit;

-- Eliminar datos de autenticación Django
DELETE FROM authtoken_token;
DELETE FROM auth_user_user_permissions;
DELETE FROM auth_user_groups;
DELETE FROM auth_user;
DELETE FROM auth_group_permissions;
DELETE FROM auth_group;
DELETE FROM auth_permission;

-- Eliminar datos administrativos
DELETE FROM django_admin_log;
DELETE FROM django_session;

-- Reiniciar secuencias (SQLite usa sqlite_sequence para AUTO_INCREMENT)
DELETE FROM sqlite_sequence;

-- Rehabilitar foreign key constraints
PRAGMA foreign_keys = ON;

-- Verificar que las tablas están vacías
SELECT 'Verificación de limpieza:' as status;
SELECT 
    'unit' as tabla, COUNT(*) as registros FROM unit
    UNION ALL
SELECT 'zone', COUNT(*) FROM zone
    UNION ALL  
SELECT 'table', COUNT(*) FROM "table"
    UNION ALL
SELECT 'container', COUNT(*) FROM container
    UNION ALL
SELECT 'group', COUNT(*) FROM "group" 
    UNION ALL
SELECT 'ingredient', COUNT(*) FROM ingredient
    UNION ALL
SELECT 'recipe', COUNT(*) FROM recipe
    UNION ALL
SELECT 'recipe_item', COUNT(*) FROM recipe_item
    UNION ALL
SELECT 'order', COUNT(*) FROM "order"
    UNION ALL
SELECT 'order_item', COUNT(*) FROM order_item
    UNION ALL
SELECT 'payment', COUNT(*) FROM payment;

SELECT '✅ Base de datos limpiada correctamente' as resultado;