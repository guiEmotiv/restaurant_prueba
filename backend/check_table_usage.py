#!/usr/bin/env python3

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection
from django.apps import apps

def check_table_usage():
    cursor = connection.cursor()
    
    # Get all app tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    all_tables = [table[0] for table in cursor.fetchall()]
    
    app_tables = [table for table in all_tables 
                  if not table.startswith('django_') 
                  and not table.startswith('auth_') 
                  and table != 'sqlite_sequence']
    
    print("🔍 ANÁLISIS DE USO DE TABLAS DE LA APLICACIÓN\n")
    
    # Mapeo de tablas a modelos Django
    model_to_table = {}
    table_to_model = {}
    
    for app_config in apps.get_app_configs():
        if app_config.label in ['config', 'inventory', 'operation']:
            for model in app_config.get_models():
                table_name = model._meta.db_table
                model_to_table[model.__name__] = table_name
                table_to_model[table_name] = f"{app_config.label}.{model.__name__}"
    
    print("📊 MAPEO MODELO → TABLA:")
    for model, table in model_to_table.items():
        print(f"  • {model} → {table}")
    
    print(f"\n🔍 ANÁLISIS DE REGISTROS POR TABLA:")
    
    tables_with_data = []
    tables_empty = []
    
    for table in app_tables:
        cursor.execute(f'SELECT COUNT(*) FROM "{table}";')
        count = cursor.fetchone()[0]
        
        model_name = table_to_model.get(table, "❓ Modelo no encontrado")
        
        if count > 0:
            tables_with_data.append((table, count, model_name))
            print(f"  ✅ {table}: {count} registros ({model_name})")
        else:
            tables_empty.append((table, count, model_name))
            print(f"  ⚠️  {table}: {count} registros ({model_name})")
    
    print(f"\n📈 RESUMEN:")
    print(f"  • Tablas con datos: {len(tables_with_data)}")
    print(f"  • Tablas vacías: {len(tables_empty)}")
    
    if tables_empty:
        print(f"\n🗑️ TABLAS VACÍAS (CANDIDATAS PARA ANÁLISIS):")
        for table, count, model in tables_empty:
            print(f"  • {table} ({model})")
            
            # Verificar si la tabla tiene claves foráneas
            cursor.execute(f"PRAGMA foreign_key_list({table});")
            fks = cursor.fetchall()
            if fks:
                print(f"    ⚠️  Tiene {len(fks)} foreign keys - verificar dependencias")
            else:
                print(f"    ✅ Sin foreign keys - más segura de analizar")
    
    return tables_empty, tables_with_data

if __name__ == "__main__":
    check_table_usage()