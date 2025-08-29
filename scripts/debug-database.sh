#!/bin/bash
# Script de diagnóstico para la base de datos en producción

set -e

echo "🔍 DIAGNÓSTICO DE BASE DE DATOS"
echo "==============================="

# Conectar al contenedor Django
echo "📊 Conectando al contenedor de la aplicación..."
sudo docker exec -it restaurant-web-app python manage.py shell << 'DJANGO_SHELL'
import logging
from django.db import connection

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    cursor = connection.cursor()
    
    # 1. Verificar si existe la vista dashboard_operativo_view
    print("🔍 Verificando vista dashboard_operativo_view...")
    cursor.execute("""
        SELECT COUNT(*) as count
        FROM sqlite_master 
        WHERE type='view' AND name='dashboard_operativo_view'
    """)
    view_exists = cursor.fetchone()[0]
    print(f"✅ Vista existe: {view_exists > 0}")
    
    if view_exists > 0:
        # 2. Verificar datos en la vista
        print("📊 Verificando datos en la vista...")
        cursor.execute("SELECT COUNT(*) FROM dashboard_operativo_view")
        total_records = cursor.fetchone()[0]
        print(f"📈 Total registros en vista: {total_records}")
        
        # 3. Verificar datos para hoy
        from datetime import date
        today = date.today()
        cursor.execute("SELECT COUNT(*) FROM dashboard_operativo_view WHERE operational_date = ?", [today])
        today_records = cursor.fetchone()[0]
        print(f"📅 Registros para hoy ({today}): {today_records}")
        
        # 4. Verificar estructura de la vista
        print("🏗️ Estructura de la vista:")
        cursor.execute("PRAGMA table_info(dashboard_operativo_view)")
        columns = cursor.fetchall()
        for col in columns:
            print(f"   {col[1]}: {col[2]}")
    
    # 5. Verificar tablas base
    print("\n📋 Verificando tablas base:")
    base_tables = ['order', 'order_item', 'recipe', 'group', 'table', 'zone', 'container']
    
    for table in base_tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM '{table}'")
            count = cursor.fetchone()[0]
            print(f"   {table}: {count} registros")
        except Exception as e:
            print(f"   ❌ Error en tabla {table}: {e}")
    
    cursor.close()

except Exception as e:
    print(f"❌ Error en diagnóstico: {e}")
    import traceback
    traceback.print_exc()

DJANGO_SHELL

echo "✅ Diagnóstico completado"