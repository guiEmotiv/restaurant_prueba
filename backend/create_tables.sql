-- Script para crear tablas de waiters y containers directamente

-- Crear tabla waiter si no existe
CREATE TABLE IF NOT EXISTS waiter (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) DEFAULT '',
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla container si no existe  
CREATE TABLE IF NOT EXISTS container (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    stock INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insertar datos de prueba para waiters
INSERT OR IGNORE INTO waiter (id, name, phone, is_active) VALUES 
(1, 'Juan Pérez', '123456789', 1),
(2, 'María García', '987654321', 1),
(3, 'Carlos López', '', 1);

-- Insertar datos de prueba para containers
INSERT OR IGNORE INTO container (id, name, description, price, stock, is_active) VALUES 
(1, 'Taper Pequeño', 'Envase pequeño para comida', 1.50, 50, 1),
(2, 'Taper Grande', 'Envase grande para comida', 2.00, 30, 1),
(3, 'Bolsa Plástica', 'Bolsa para llevar', 0.50, 100, 1);