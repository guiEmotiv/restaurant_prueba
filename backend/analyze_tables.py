#!/usr/bin/env python3

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection

def analyze_database_tables():
    cursor = connection.cursor()
    
    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    all_tables = [table[0] for table in cursor.fetchall()]
    
    print("=== ANÁLISIS DE TABLAS EN LA BASE DE DATOS ===\n")
    
    # Filter out Django system tables
    app_tables = [table for table in all_tables 
                  if not table.startswith('django_') 
                  and not table.startswith('auth_') 
                  and table != 'sqlite_sequence']
    
    print("📊 TABLAS DE LA APLICACIÓN:")
    for table in app_tables:
        try:
            # Use quotes for table names that might be SQL keywords
            cursor.execute(f'SELECT COUNT(*) FROM "{table}";')
            count = cursor.fetchone()[0]
            print(f"  • {table}: {count} registros")
        except Exception as e:
            print(f"  • {table}: ERROR - {str(e)}")
    
    print(f"\n📈 RESUMEN:")
    print(f"  • Total tablas del sistema: {len(all_tables)}")
    print(f"  • Tablas de Django/Auth: {len(all_tables) - len(app_tables)}")
    print(f"  • Tablas de la aplicación: {len(app_tables)}")
    
    return app_tables

if __name__ == "__main__":
    analyze_database_tables()