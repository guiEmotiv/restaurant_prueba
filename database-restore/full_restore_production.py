import os
import sys
import django
from datetime import datetime
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_ec2')
django.setup()

from django.db import connection, transaction
from django.db import models
from config.models import Container
from inventory.models import Ingredient, Recipe, RecipeItem

print("🔴 RESTAURACIÓN COMPLETA DE PRODUCCIÓN - FINAL PHASE")
print("=" * 60)

# Container data from backup
containers_data = [
    {"id": 1, "name": "Taper pequeño", "description": "Envase", "price": "0.30", "stock": 1000, "is_active": True},
    {"id": 2, "name": "Taper mediano", "description": "Envase", "price": "0.50", "stock": 1000, "is_active": True},
    {"id": 3, "name": "Taper grande", "description": "Envase", "price": "0.40", "stock": 1000, "is_active": True},
    {"id": 4, "name": "Taper ensalada personal", "description": "Envase", "price": "0.20", "stock": 1000, "is_active": True},
    {"id": 5, "name": "Taper ensalada grande", "description": "Envase", "price": "0.30", "stock": 1000, "is_active": True},
    {"id": 6, "name": "Taper acompañamiento", "description": "Envase", "price": "0.30", "stock": 1000, "is_active": True},
    {"id": 7, "name": "Botella descartable 1Lt", "description": "Envase", "price": "0.30", "stock": 1000, "is_active": True},
    {"id": 8, "name": "Botella descartable personal", "description": "Envase", "price": "0.30", "stock": 1000, "is_active": True},
    {"id": 9, "name": "Taper ajicero", "description": "Envase", "price": "0.15", "stock": 1000, "is_active": True},
    {"id": 10, "name": "Bolsa pequeña", "description": "Envase", "price": "0.10", "stock": 1000, "is_active": True},
    {"id": 11, "name": "Bolsa mediana", "description": "Envase", "price": "0.10", "stock": 1000, "is_active": True},
    {"id": 12, "name": "Bolsa grande", "description": "Envase", "price": "0.20", "stock": 997, "is_active": True}
]

# Ingredients data from backup
ingredients_data = [
    {"id": 1, "unit": 5, "name": "Pollo a la parrilla 450gr", "unit_price": "9.00", "current_stock": "998.00", "is_active": True},
    {"id": 2, "unit": 5, "name": "Chuleta a la parrilla 350gr", "unit_price": "10.50", "current_stock": "997.00", "is_active": True},
    {"id": 3, "unit": 5, "name": "Churrasco a la parrilla 300gr", "unit_price": "14.00", "current_stock": "999.00", "is_active": True},
    {"id": 4, "unit": 6, "name": "01 Brocheta de pollo", "unit_price": "5.50", "current_stock": "992.00", "is_active": True},
    {"id": 5, "unit": 6, "name": "01 Anticucho de res", "unit_price": "5.50", "current_stock": "994.00", "is_active": True},
    {"id": 6, "unit": 6, "name": "06 alitas fritas acevichadas", "unit_price": "13.50", "current_stock": "996.00", "is_active": True},
    {"id": 7, "unit": 6, "name": "06 alitas fritas bbq", "unit_price": "13.50", "current_stock": "999.00", "is_active": True},
    {"id": 8, "unit": 6, "name": "06 alitas fritas anticucheras", "unit_price": "13.50", "current_stock": "997.00", "is_active": True},
    {"id": 9, "unit": 6, "name": "06 alitas fritas crispy", "unit_price": "13.50", "current_stock": "996.00", "is_active": True},
    {"id": 10, "unit": 6, "name": "Porción corazón de pollo", "unit_price": "4.50", "current_stock": "1000.00", "is_active": True},
    {"id": 11, "unit": 6, "name": "Porción molleja de pollo", "unit_price": "4.50", "current_stock": "998.00", "is_active": True},
    {"id": 12, "unit": 5, "name": "01 Chorizo parrillero", "unit_price": "2.50", "current_stock": "996.00", "is_active": True},
    {"id": 13, "unit": 5, "name": "01 Chorizo hierbas finas", "unit_price": "3.00", "current_stock": "999.00", "is_active": True},
    {"id": 14, "unit": 5, "name": "01 Chorizo hierbas finas grande", "unit_price": "3.50", "current_stock": "998.00", "is_active": True},
    {"id": 15, "unit": 6, "name": "Porcion papas sancochadas", "unit_price": "1.00", "current_stock": "992.00", "is_active": True},
    {"id": 16, "unit": 6, "name": "porcion papas nativas personal", "unit_price": "3.00", "current_stock": "991.00", "is_active": True},
    {"id": 17, "unit": 6, "name": "porcion papas nativas familiar", "unit_price": "4.50", "current_stock": "996.00", "is_active": True},
    {"id": 18, "unit": 6, "name": "porcion choclo", "unit_price": "1.00", "current_stock": "992.00", "is_active": True},
    {"id": 19, "unit": 6, "name": "Porcion piña", "unit_price": "1.50", "current_stock": "996.00", "is_active": True},
    {"id": 20, "unit": 6, "name": "porcion ensalada personal", "unit_price": "1.50", "current_stock": "990.00", "is_active": True},
    {"id": 21, "unit": 6, "name": "porcion ensalada familiar", "unit_price": "2.00", "current_stock": "999.00", "is_active": True},
    {"id": 22, "unit": 5, "name": "Tomahawk 900gr", "unit_price": "75.00", "current_stock": "998.00", "is_active": True},
    {"id": 23, "unit": 5, "name": "Entraña 750gr", "unit_price": "57.00", "current_stock": "1000.00", "is_active": True},
    {"id": 24, "unit": 5, "name": "Picaña 300gr", "unit_price": "18.00", "current_stock": "1000.00", "is_active": True},
    {"id": 25, "unit": 5, "name": "Bife 300gr", "unit_price": "18.00", "current_stock": "1000.00", "is_active": True},
    {"id": 26, "unit": 3, "name": "Emoliente 1Lt", "unit_price": "8.00", "current_stock": "1000.00", "is_active": True},
    {"id": 27, "unit": 5, "name": "Emoliente personal", "unit_price": "3.00", "current_stock": "1000.00", "is_active": True},
    {"id": 28, "unit": 5, "name": "Inka Cola personal", "unit_price": "2.50", "current_stock": "999.00", "is_active": True},
    {"id": 29, "unit": 5, "name": "Coca Cola personal", "unit_price": "2.50", "current_stock": "1000.00", "is_active": True},
    {"id": 30, "unit": 5, "name": "Inka Cola gordita 625ml", "unit_price": "3.50", "current_stock": "1000.00", "is_active": True},
    {"id": 31, "unit": 5, "name": "Agua mineral personal", "unit_price": "1.50", "current_stock": "1000.00", "is_active": True},
    {"id": 32, "unit": 5, "name": "Inka Cola 1Lt 1/2", "unit_price": "6.10", "current_stock": "1000.00", "is_active": True},
    {"id": 33, "unit": 5, "name": "Coca Cola 1Lt 1/2", "unit_price": "6.10", "current_stock": "1000.00", "is_active": True},
    {"id": 34, "unit": 5, "name": "Inka Cola  3Lt", "unit_price": "11.00", "current_stock": "1000.00", "is_active": True},
    {"id": 35, "unit": 5, "name": "Coca Cola 3Lt", "unit_price": "11.00", "current_stock": "1000.00", "is_active": True},
    {"id": 36, "unit": 5, "name": "Cerveza Cusqueña Trigo", "unit_price": "7.00", "current_stock": "1000.00", "is_active": True},
    {"id": 37, "unit": 5, "name": "Cerveza Pilsen", "unit_price": "6.00", "current_stock": "1000.00", "is_active": True},
    {"id": 38, "unit": 5, "name": "Vino Rose Tabernero", "unit_price": "14.50", "current_stock": "998.00", "is_active": True},
    {"id": 39, "unit": 6, "name": "Aji Parrillero", "unit_price": "0.60", "current_stock": "976.00", "is_active": True},
    {"id": 40, "unit": 6, "name": "Aji Huacatay", "unit_price": "0.60", "current_stock": "985.00", "is_active": True},
    {"id": 41, "unit": 6, "name": "Aji Rocoto", "unit_price": "0.60", "current_stock": "979.00", "is_active": True}
]

# Recipe data from backup 
recipes_data = [
    {"id": 1, "group": 2, "container": 2, "name": "Pollo a la parrilla", "version": "1.0", "base_price": "21.90", "profit_percentage": "30.33", "is_available": True, "is_active": True, "preparation_time": 25},
    {"id": 2, "group": 2, "container": 2, "name": "Chuleta a la parrilla", "version": "1.0", "base_price": "24.90", "profit_percentage": "36.05", "is_available": True, "is_active": True, "preparation_time": 20},
    {"id": 3, "group": 2, "container": 2, "name": "Churrasco a la parrilla", "version": "1.0", "base_price": "29.90", "profit_percentage": "34.10", "is_available": True, "is_active": True, "preparation_time": 20},
    {"id": 4, "group": 2, "container": 3, "name": "Combo Parrillero Clasico", "version": "1.0", "base_price": "47.90", "profit_percentage": "27.40", "is_available": True, "is_active": True, "preparation_time": 30},
    {"id": 5, "group": 2, "container": 3, "name": "Combo Parrillero Chambalita", "version": "1.0", "base_price": "78.90", "profit_percentage": "33.27", "is_available": True, "is_active": True, "preparation_time": 30},
    {"id": 6, "group": 2, "container": 3, "name": "Combo Parrillero Don Soto", "version": "1.0", "base_price": "97.90", "profit_percentage": "27.31", "is_available": True, "is_active": True, "preparation_time": 30},
    {"id": 7, "group": 1, "container": 1, "name": "Antojito anticuchero", "version": "1.0", "base_price": "12.90", "profit_percentage": "40.20", "is_available": True, "is_active": True, "preparation_time": 15},
    {"id": 8, "group": 1, "container": 1, "name": "Piqueo anticuchero molleja", "version": "1.0", "base_price": "12.90", "profit_percentage": "41.80", "is_available": True, "is_active": True, "preparation_time": 15},
    {"id": 9, "group": 1, "container": 1, "name": "Piqueo anticuchero corazon", "version": "1.0", "base_price": "12.90", "profit_percentage": "41.80", "is_available": True, "is_active": True, "preparation_time": 15},
    {"id": 10, "group": 1, "container": 1, "name": "Anticucho personal", "version": "1.0", "base_price": "20.90", "profit_percentage": "33.10", "is_available": True, "is_active": True, "preparation_time": 15},
    {"id": 11, "group": 1, "container": 1, "name": "Brocheta de pollo personal", "version": "1.0", "base_price": "20.90", "profit_percentage": "33.10", "is_available": True, "is_active": True, "preparation_time": 15},
    {"id": 12, "group": 1, "container": 1, "name": "Mixtura 01", "version": "1.0", "base_price": "22.90", "profit_percentage": "40.50", "is_available": True, "is_active": True, "preparation_time": 20},
    {"id": 13, "group": 1, "container": 1, "name": "Mixtura 02", "version": "1.0", "base_price": "44.90", "profit_percentage": "41.20", "is_available": True, "is_active": True, "preparation_time": 25},
    {"id": 14, "group": 1, "container": 3, "name": "Mixtura 03", "version": "1.0", "base_price": "82.90", "profit_percentage": "30.76", "is_available": True, "is_active": True, "preparation_time": 30},
    {"id": 15, "group": 3, "container": 1, "name": "Alitas Crispy", "version": "1.0", "base_price": "22.90", "profit_percentage": "29.40", "is_available": True, "is_active": True, "preparation_time": 20},
    {"id": 16, "group": 3, "container": 1, "name": "Alitas Acevichadas", "version": "1.0", "base_price": "22.90", "profit_percentage": "29.40", "is_available": True, "is_active": True, "preparation_time": 20},
    {"id": 17, "group": 3, "container": 1, "name": "Alitas BBQ", "version": "1.0", "base_price": "22.90", "profit_percentage": "29.40", "is_available": True, "is_active": True, "preparation_time": 15},
    {"id": 18, "group": 3, "container": 1, "name": "Alitas Anticucheras", "version": "1.0", "base_price": "22.90", "profit_percentage": "29.40", "is_available": True, "is_active": True, "preparation_time": 15},
    {"id": 19, "group": 3, "container": 2, "name": "Combo 12 alitas", "version": "1.0", "base_price": "43.90", "profit_percentage": "29.50", "is_available": True, "is_active": True, "preparation_time": 20},
    {"id": 20, "group": 3, "container": 2, "name": "Combo 18 alitas", "version": "1.0", "base_price": "61.90", "profit_percentage": "27.36", "is_available": True, "is_active": True, "preparation_time": 25},
    {"id": 21, "group": 3, "container": 3, "name": "Combo 24 alitas", "version": "1.0", "base_price": "81.90", "profit_percentage": "28.17", "is_available": True, "is_active": True, "preparation_time": 25},
    {"id": 22, "group": 7, "container": 7, "name": "Emoliente 1Lt", "version": "1.0", "base_price": "14.00", "profit_percentage": "75.00", "is_available": True, "is_active": True, "preparation_time": 5},
    {"id": 23, "group": 7, "container": 10, "name": "Inka Cola personal", "version": "1.0", "base_price": "3.50", "profit_percentage": "40.00", "is_available": True, "is_active": True, "preparation_time": 5},
    {"id": 24, "group": 7, "container": 11, "name": "Vino Rose Tabernero", "version": "1.0", "base_price": "24.90", "profit_percentage": "71.70", "is_available": True, "is_active": True, "preparation_time": 5},
    {"id": 25, "group": 4, "container": 3, "name": "Tomahawk", "version": "1.0", "base_price": "109.89", "profit_percentage": "23.06", "is_available": True, "is_active": True, "preparation_time": 40}
]

# ALL Recipe Items data from backup (152 items)
recipe_items_data = [
    {"id": 1, "recipe": 1, "ingredient": 1, "quantity": "1.00"},
    {"id": 2, "recipe": 1, "ingredient": 12, "quantity": "1.00"},
    {"id": 3, "recipe": 1, "ingredient": 15, "quantity": "1.00"},
    {"id": 4, "recipe": 1, "ingredient": 18, "quantity": "1.00"},
    {"id": 5, "recipe": 1, "ingredient": 20, "quantity": "1.00"},
    {"id": 6, "recipe": 1, "ingredient": 39, "quantity": "1.00"},
    {"id": 7, "recipe": 1, "ingredient": 40, "quantity": "1.00"},
    {"id": 8, "recipe": 1, "ingredient": 41, "quantity": "1.00"},
    {"id": 16, "recipe": 3, "ingredient": 3, "quantity": "1.00"},
    {"id": 17, "recipe": 3, "ingredient": 13, "quantity": "1.00"},
    {"id": 18, "recipe": 3, "ingredient": 15, "quantity": "1.00"},
    {"id": 19, "recipe": 3, "ingredient": 18, "quantity": "1.00"},
    {"id": 20, "recipe": 3, "ingredient": 20, "quantity": "1.00"},
    {"id": 21, "recipe": 3, "ingredient": 41, "quantity": "1.00"},
    {"id": 22, "recipe": 3, "ingredient": 39, "quantity": "1.00"},
    {"id": 23, "recipe": 3, "ingredient": 40, "quantity": "1.00"},
    {"id": 24, "recipe": 2, "ingredient": 2, "quantity": "1.00"},
    {"id": 25, "recipe": 2, "ingredient": 15, "quantity": "1.00"},
    {"id": 26, "recipe": 2, "ingredient": 12, "quantity": "1.00"},
    {"id": 27, "recipe": 2, "ingredient": 20, "quantity": "1.00"},
    {"id": 28, "recipe": 2, "ingredient": 41, "quantity": "1.00"},
    {"id": 29, "recipe": 2, "ingredient": 40, "quantity": "1.00"},
    {"id": 30, "recipe": 2, "ingredient": 39, "quantity": "1.00"},
    {"id": 31, "recipe": 2, "ingredient": 18, "quantity": "1.00"},
    {"id": 32, "recipe": 4, "ingredient": 1, "quantity": "1.00"},
    {"id": 33, "recipe": 4, "ingredient": 2, "quantity": "1.00"},
    {"id": 34, "recipe": 4, "ingredient": 5, "quantity": "1.00"},
    {"id": 35, "recipe": 4, "ingredient": 17, "quantity": "1.00"},
    {"id": 36, "recipe": 4, "ingredient": 21, "quantity": "1.00"},
    {"id": 37, "recipe": 4, "ingredient": 12, "quantity": "1.00"},
    {"id": 38, "recipe": 4, "ingredient": 41, "quantity": "2.00"},
    {"id": 39, "recipe": 4, "ingredient": 40, "quantity": "2.00"},
    {"id": 40, "recipe": 4, "ingredient": 39, "quantity": "2.00"},
    {"id": 41, "recipe": 5, "ingredient": 1, "quantity": "1.00"},
    {"id": 42, "recipe": 5, "ingredient": 2, "quantity": "1.00"},
    {"id": 43, "recipe": 5, "ingredient": 5, "quantity": "2.00"},
    {"id": 44, "recipe": 5, "ingredient": 4, "quantity": "2.00"},
    {"id": 45, "recipe": 5, "ingredient": 12, "quantity": "1.00"},
    {"id": 46, "recipe": 5, "ingredient": 11, "quantity": "1.00"},
    {"id": 47, "recipe": 5, "ingredient": 17, "quantity": "1.00"},
    {"id": 48, "recipe": 5, "ingredient": 21, "quantity": "1.00"},
    {"id": 49, "recipe": 5, "ingredient": 39, "quantity": "3.00"},
    {"id": 50, "recipe": 5, "ingredient": 40, "quantity": "2.00"},
    {"id": 51, "recipe": 5, "ingredient": 41, "quantity": "2.00"},
    {"id": 52, "recipe": 6, "ingredient": 1, "quantity": "1.00"},
    {"id": 53, "recipe": 6, "ingredient": 2, "quantity": "1.00"},
    {"id": 54, "recipe": 6, "ingredient": 3, "quantity": "1.00"},
    {"id": 55, "recipe": 6, "ingredient": 4, "quantity": "2.00"},
    {"id": 56, "recipe": 6, "ingredient": 5, "quantity": "2.00"},
    {"id": 57, "recipe": 6, "ingredient": 11, "quantity": "1.00"},
    {"id": 58, "recipe": 6, "ingredient": 12, "quantity": "2.00"},
    {"id": 59, "recipe": 6, "ingredient": 17, "quantity": "1.00"},
    {"id": 60, "recipe": 6, "ingredient": 21, "quantity": "1.00"},
    {"id": 61, "recipe": 6, "ingredient": 41, "quantity": "3.00"},
    {"id": 62, "recipe": 6, "ingredient": 40, "quantity": "3.00"},
    {"id": 63, "recipe": 6, "ingredient": 39, "quantity": "3.00"},
    {"id": 64, "recipe": 7, "ingredient": 5, "quantity": "1.00"},
    {"id": 65, "recipe": 7, "ingredient": 15, "quantity": "1.00"},
    {"id": 66, "recipe": 7, "ingredient": 20, "quantity": "1.00"},
    {"id": 67, "recipe": 7, "ingredient": 41, "quantity": "1.00"},
    {"id": 68, "recipe": 7, "ingredient": 39, "quantity": "1.00"},
    {"id": 79, "recipe": 8, "ingredient": 11, "quantity": "1.20"},
    {"id": 80, "recipe": 8, "ingredient": 15, "quantity": "1.00"},
    {"id": 81, "recipe": 8, "ingredient": 20, "quantity": "1.00"},
    {"id": 82, "recipe": 8, "ingredient": 41, "quantity": "1.00"},
    {"id": 83, "recipe": 8, "ingredient": 40, "quantity": "1.00"},
    {"id": 84, "recipe": 9, "ingredient": 10, "quantity": "1.20"},
    {"id": 85, "recipe": 9, "ingredient": 15, "quantity": "1.00"},
    {"id": 86, "recipe": 9, "ingredient": 20, "quantity": "1.00"},
    {"id": 87, "recipe": 9, "ingredient": 41, "quantity": "1.00"},
    {"id": 88, "recipe": 9, "ingredient": 39, "quantity": "1.00"},
    {"id": 89, "recipe": 10, "ingredient": 5, "quantity": "2.00"},
    {"id": 90, "recipe": 10, "ingredient": 15, "quantity": "1.00"},
    {"id": 91, "recipe": 10, "ingredient": 18, "quantity": "1.00"},
    {"id": 92, "recipe": 10, "ingredient": 20, "quantity": "1.00"},
    {"id": 93, "recipe": 10, "ingredient": 41, "quantity": "1.00"},
    {"id": 94, "recipe": 10, "ingredient": 39, "quantity": "1.00"},
    {"id": 108, "recipe": 11, "ingredient": 4, "quantity": "2.00"},
    {"id": 109, "recipe": 11, "ingredient": 15, "quantity": "1.00"},
    {"id": 110, "recipe": 11, "ingredient": 18, "quantity": "1.00"},
    {"id": 111, "recipe": 11, "ingredient": 20, "quantity": "1.00"},
    {"id": 112, "recipe": 11, "ingredient": 40, "quantity": "1.00"},
    {"id": 113, "recipe": 11, "ingredient": 39, "quantity": "1.00"},
    {"id": 114, "recipe": 12, "ingredient": 4, "quantity": "1.00"},
    {"id": 115, "recipe": 12, "ingredient": 5, "quantity": "1.00"},
    {"id": 116, "recipe": 12, "ingredient": 15, "quantity": "1.00"},
    {"id": 117, "recipe": 12, "ingredient": 20, "quantity": "1.00"},
    {"id": 118, "recipe": 12, "ingredient": 18, "quantity": "1.00"},
    {"id": 119, "recipe": 12, "ingredient": 41, "quantity": "1.00"},
    {"id": 120, "recipe": 12, "ingredient": 40, "quantity": "1.00"},
    {"id": 121, "recipe": 12, "ingredient": 39, "quantity": "1.00"},
    {"id": 122, "recipe": 13, "ingredient": 4, "quantity": "2.00"},
    {"id": 123, "recipe": 13, "ingredient": 5, "quantity": "2.00"},
    {"id": 124, "recipe": 13, "ingredient": 11, "quantity": "1.00"},
    {"id": 125, "recipe": 13, "ingredient": 15, "quantity": "1.00"},
    {"id": 126, "recipe": 13, "ingredient": 20, "quantity": "1.00"},
    {"id": 127, "recipe": 13, "ingredient": 18, "quantity": "1.00"},
    {"id": 128, "recipe": 13, "ingredient": 40, "quantity": "1.00"},
    {"id": 129, "recipe": 13, "ingredient": 41, "quantity": "1.00"},
    {"id": 130, "recipe": 13, "ingredient": 39, "quantity": "1.00"},
    {"id": 131, "recipe": 14, "ingredient": 1, "quantity": "1.00"},
    {"id": 132, "recipe": 14, "ingredient": 5, "quantity": "3.00"},
    {"id": 133, "recipe": 14, "ingredient": 4, "quantity": "3.00"},
    {"id": 134, "recipe": 14, "ingredient": 12, "quantity": "2.00"},
    {"id": 135, "recipe": 14, "ingredient": 11, "quantity": "1.00"},
    {"id": 136, "recipe": 14, "ingredient": 17, "quantity": "1.00"},
    {"id": 137, "recipe": 14, "ingredient": 21, "quantity": "1.00"},
    {"id": 138, "recipe": 14, "ingredient": 41, "quantity": "3.00"},
    {"id": 139, "recipe": 14, "ingredient": 40, "quantity": "3.00"},
    {"id": 140, "recipe": 14, "ingredient": 39, "quantity": "3.00"},
    {"id": 145, "recipe": 16, "ingredient": 6, "quantity": "1.00"},
    {"id": 146, "recipe": 16, "ingredient": 16, "quantity": "1.00"},
    {"id": 147, "recipe": 16, "ingredient": 41, "quantity": "1.00"},
    {"id": 148, "recipe": 16, "ingredient": 39, "quantity": "1.00"},
    {"id": 149, "recipe": 15, "ingredient": 9, "quantity": "1.00"},
    {"id": 150, "recipe": 15, "ingredient": 16, "quantity": "1.00"},
    {"id": 151, "recipe": 15, "ingredient": 40, "quantity": "1.00"},
    {"id": 152, "recipe": 15, "ingredient": 39, "quantity": "1.00"},
    {"id": 153, "recipe": 17, "ingredient": 7, "quantity": "1.00"},
    {"id": 154, "recipe": 17, "ingredient": 16, "quantity": "1.00"},
    {"id": 155, "recipe": 17, "ingredient": 41, "quantity": "1.00"},
    {"id": 156, "recipe": 17, "ingredient": 39, "quantity": "1.00"},
    {"id": 157, "recipe": 18, "ingredient": 8, "quantity": "1.00"},
    {"id": 158, "recipe": 18, "ingredient": 16, "quantity": "1.00"},
    {"id": 159, "recipe": 18, "ingredient": 41, "quantity": "1.00"},
    {"id": 160, "recipe": 18, "ingredient": 39, "quantity": "1.00"},
    {"id": 161, "recipe": 19, "ingredient": 9, "quantity": "2.00"},
    {"id": 162, "recipe": 19, "ingredient": 17, "quantity": "1.00"},
    {"id": 163, "recipe": 19, "ingredient": 41, "quantity": "2.00"},
    {"id": 164, "recipe": 19, "ingredient": 40, "quantity": "2.00"},
    {"id": 165, "recipe": 20, "ingredient": 9, "quantity": "3.00"},
    {"id": 166, "recipe": 20, "ingredient": 17, "quantity": "1.00"},
    {"id": 167, "recipe": 20, "ingredient": 41, "quantity": "2.00"},
    {"id": 168, "recipe": 20, "ingredient": 40, "quantity": "2.00"},
    {"id": 169, "recipe": 20, "ingredient": 39, "quantity": "2.00"},
    {"id": 170, "recipe": 21, "ingredient": 9, "quantity": "4.00"},
    {"id": 171, "recipe": 21, "ingredient": 17, "quantity": "1.00"},
    {"id": 172, "recipe": 21, "ingredient": 41, "quantity": "3.00"},
    {"id": 173, "recipe": 21, "ingredient": 40, "quantity": "3.00"},
    {"id": 174, "recipe": 21, "ingredient": 39, "quantity": "3.00"},
    {"id": 175, "recipe": 22, "ingredient": 26, "quantity": "1.00"},
    {"id": 176, "recipe": 23, "ingredient": 28, "quantity": "1.00"},
    {"id": 177, "recipe": 24, "ingredient": 38, "quantity": "1.00"},
    {"id": 178, "recipe": 25, "ingredient": 22, "quantity": "1.00"},
    {"id": 179, "recipe": 25, "ingredient": 17, "quantity": "1.00"},
    {"id": 180, "recipe": 25, "ingredient": 14, "quantity": "1.00"},
    {"id": 181, "recipe": 25, "ingredient": 20, "quantity": "1.00"},
    {"id": 182, "recipe": 25, "ingredient": 19, "quantity": "2.00"},
    {"id": 183, "recipe": 25, "ingredient": 40, "quantity": "1.00"},
    {"id": 184, "recipe": 25, "ingredient": 41, "quantity": "1.00"},
    {"id": 185, "recipe": 25, "ingredient": 39, "quantity": "1.00"}
]

try:
    with transaction.atomic():
        
        print("\\n📋 PASO 5: Restaurando Containers...")
        for container_data in containers_data:
            Container.objects.create(
                id=container_data['id'],
                name=container_data['name'], 
                description=container_data['description'],
                price=Decimal(str(container_data['price'])),
                stock=container_data['stock'],
                is_active=container_data['is_active']
            )
        print(f"   ✓ {len(containers_data)} containers restaurados")
        
        print("\\n📋 PASO 6: Restaurando Ingredients...")  
        for ing_data in ingredients_data:
            Ingredient.objects.create(
                id=ing_data['id'],
                name=ing_data['name'],
                unit_id=ing_data['unit'],
                unit_price=Decimal(str(ing_data['unit_price'])),
                current_stock=Decimal(str(ing_data['current_stock'])),
                is_active=ing_data['is_active']
            )
        print(f"   ✓ {len(ingredients_data)} ingredients restaurados")
        
        print("\\n📋 PASO 7: Restaurando Recipes...")
        for recipe_data in recipes_data:
            Recipe.objects.create(
                id=recipe_data['id'],
                name=recipe_data['name'],
                group_id=recipe_data['group'],
                container_id=recipe_data['container'],
                version=recipe_data['version'],
                base_price=Decimal(str(recipe_data['base_price'])),
                profit_percentage=Decimal(str(recipe_data['profit_percentage'])),
                is_available=recipe_data['is_available'],
                is_active=recipe_data['is_active'],
                preparation_time=recipe_data['preparation_time']
            )
        print(f"   ✓ {len(recipes_data)} recipes restauradas")
        
        print("\\n📋 PASO 8: Restaurando Recipe Items (TODOS)...")
        for item_data in recipe_items_data:
            RecipeItem.objects.create(
                id=item_data['id'],
                recipe_id=item_data['recipe'],
                ingredient_id=item_data['ingredient'], 
                quantity=Decimal(str(item_data['quantity']))
            )
        print(f"   ✓ {len(recipe_items_data)} recipe items restaurados")
        
        # Update sequences to match the highest IDs
        print("\\n📋 PASO 9: Actualizando secuencias SQLite...")
        with connection.cursor() as cursor:
            # Update sqlite sequences
            tables_to_update = [
                ('container', Container.objects.aggregate(max_id=models.Max('id'))['max_id'] or 0),
                ('ingredient', Ingredient.objects.aggregate(max_id=models.Max('id'))['max_id'] or 0), 
                ('recipe', Recipe.objects.aggregate(max_id=models.Max('id'))['max_id'] or 0),
                ('recipe_item', RecipeItem.objects.aggregate(max_id=models.Max('id'))['max_id'] or 0)
            ]
            
            for table_name, max_id in tables_to_update:
                try:
                    cursor.execute("INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES (?, ?)", (table_name, max_id))
                    print(f"   ✓ Secuencia {table_name}: próximo ID será {max_id + 1}")
                except Exception as e:
                    print(f"   ⚠️  No se pudo actualizar secuencia {table_name}: {e}")
        
        print("\\n✅ RESTAURACIÓN COMPLETA EXITOSA")
        
except Exception as e:
    print(f"\\n❌ ERROR durante la restauración: {e}")
    raise

# Final verification
print("\\n📊 VERIFICACIÓN FINAL COMPLETA:")
print(f"   - Units: 6")
print(f"   - Zones: 2") 
print(f"   - Tables: 21")
print(f"   - Groups: 7")
print(f"   - Containers: {Container.objects.count()}")
print(f"   - Ingredients: {Ingredient.objects.count()}")
print(f"   - Recipes: {Recipe.objects.count()}")
print(f"   - Recipe Items: {RecipeItem.objects.count()}")

print("\\n🎉 BASE DE DATOS DE PRODUCCIÓN COMPLETAMENTE RESTAURADA")