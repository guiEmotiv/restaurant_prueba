-- ==========================================
-- 🗑️ SCRIPT DE LIMPIEZA COMPLETA DE BASE DE DATOS
-- ==========================================
-- Este script elimina TODOS los datos y reinicia los contadores
-- USAR CON PRECAUCIÓN - NO HAY VUELTA ATRÁS
--
-- INSTRUCCIONES DE USO:
-- 1. Hacer backup si es necesario
-- 2. Ejecutar: python3 manage.py dbshell < clean_database.sql
-- 3. Verificar con: python3 manage.py shell
--
-- ==========================================

-- Deshabilitar foreign keys temporalmente
PRAGMA foreign_keys=OFF;

-- ==========================================
-- 🗑️ LIMPIEZA DE DATOS OPERACIONALES
-- ==========================================
BEGIN TRANSACTION;

-- Limpiar operaciones (pagos, órdenes)
DELETE FROM payment_item;
DELETE FROM container_sale;
DELETE FROM payment;
DELETE FROM order_item_ingredient;
DELETE FROM order_item;
DELETE FROM "order";

-- Reiniciar secuencias
DELETE FROM sqlite_sequence WHERE name IN ('payment_item', 'container_sale', 'payment', 'order_item_ingredient', 'order_item', 'order');

COMMIT;

-- ==========================================
-- 🗑️ LIMPIEZA DE DATOS DE INVENTARIO
-- ==========================================
BEGIN TRANSACTION;

-- Limpiar inventario
DELETE FROM recipe_item;
DELETE FROM recipe;
DELETE FROM ingredient;
DELETE FROM "group";

-- Reiniciar secuencias
DELETE FROM sqlite_sequence WHERE name IN ('recipe_item', 'recipe', 'ingredient', 'group');

COMMIT;

-- ==========================================
-- 🗑️ LIMPIEZA DE CONFIGURACIÓN
-- ==========================================
BEGIN TRANSACTION;

-- Limpiar configuración del restaurante
DELETE FROM container;
DELETE FROM waiter;
DELETE FROM "table";
DELETE FROM zone;
DELETE FROM unit;
DELETE FROM restaurant_operational_config;

-- Reiniciar secuencias
DELETE FROM sqlite_sequence WHERE name IN ('container', 'waiter', 'table', 'zone', 'unit', 'restaurant_operational_config');

COMMIT;

-- ==========================================
-- 🗑️ LIMPIEZA DE DATOS DE SISTEMA DJANGO
-- ==========================================
BEGIN TRANSACTION;

-- Limpiar sesiones y tokens
DELETE FROM django_session;
DELETE FROM authtoken_token;

-- Limpiar logs de admin
DELETE FROM django_admin_log;

-- Reiniciar secuencias
DELETE FROM sqlite_sequence WHERE name IN ('django_session', 'authtoken_token', 'django_admin_log');

COMMIT;

-- ==========================================
-- 🗑️ LIMPIEZA DE USUARIOS (OPCIONAL)
-- ==========================================
-- Descomenta las siguientes líneas si quieres eliminar usuarios también
-- BEGIN TRANSACTION;
-- DELETE FROM auth_user_user_permissions;
-- DELETE FROM auth_user_groups;
-- DELETE FROM auth_user;
-- DELETE FROM sqlite_sequence WHERE name IN ('auth_user_user_permissions', 'auth_user_groups', 'auth_user');
-- COMMIT;

-- Rehabilitar foreign keys
PRAGMA foreign_keys=ON;

-- ==========================================
-- ✅ LIMPIEZA COMPLETADA
-- ==========================================
-- La base de datos ha sido completamente limpiada:
-- ✓ Todos los datos operacionales eliminados
-- ✓ Inventario y recetas eliminados
-- ✓ Configuración del restaurante eliminada
-- ✓ Contadores de ID reiniciados
-- ✓ Sesiones y tokens limpiados
--
-- La base de datos está lista para ser poblada desde cero
-- ==========================================