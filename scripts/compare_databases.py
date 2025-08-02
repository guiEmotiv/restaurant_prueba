#!/usr/bin/env python3
"""
Script para comparar tablas entre bases de datos de desarrollo y producción
"""
import sqlite3
import sys
from pathlib import Path

def get_tables(db_path):
    """Obtiene lista de tablas de una base de datos SQLite"""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
        tables = [row[0] for row in cursor.fetchall()]
        conn.close()
        return tables
    except Exception as e:
        print(f"Error accessing database {db_path}: {e}")
        return []

def get_table_info(db_path, table_name):
    """Obtiene información de estructura de una tabla"""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute(f"PRAGMA table_info({table_name});")
        columns = cursor.fetchall()
        cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
        count = cursor.fetchone()[0]
        conn.close()
        return {'columns': columns, 'count': count}
    except Exception as e:
        return {'columns': [], 'count': 0, 'error': str(e)}

def main():
    # Rutas de las bases de datos
    dev_db = Path(__file__).parent.parent / 'backend' / 'restaurant_dev.sqlite3'
    prod_db = Path(__file__).parent.parent / 'data' / 'restaurant_prod.sqlite3'
    
    print("🔍 COMPARACIÓN DE BASES DE DATOS")
    print("=" * 50)
    
    # Verificar existencia de archivos
    print(f"Base de datos DESARROLLO: {dev_db}")
    print(f"Existe: {'✅' if dev_db.exists() else '❌'}")
    
    print(f"\nBase de datos PRODUCCIÓN: {prod_db}")
    print(f"Existe: {'✅' if prod_db.exists() else '❌'}")
    
    if not dev_db.exists() and not prod_db.exists():
        print("❌ No se encontraron bases de datos para comparar")
        return
    
    # Obtener tablas
    dev_tables = get_tables(dev_db) if dev_db.exists() else []
    prod_tables = get_tables(prod_db) if prod_db.exists() else []
    
    print(f"\n📊 RESUMEN:")
    print(f"Tablas en DESARROLLO: {len(dev_tables)}")
    print(f"Tablas en PRODUCCIÓN: {len(prod_tables)}")
    
    # Comparar tablas
    all_tables = sorted(set(dev_tables + prod_tables))
    
    print(f"\n📋 COMPARACIÓN DETALLADA:")
    print("-" * 60)
    print(f"{'TABLA':<30} {'DESARROLLO':<15} {'PRODUCCIÓN':<15}")
    print("-" * 60)
    
    for table in all_tables:
        dev_status = "✅" if table in dev_tables else "❌"
        prod_status = "✅" if table in prod_tables else "❌"
        print(f"{table:<30} {dev_status:<15} {prod_status:<15}")
    
    # Tablas solo en desarrollo
    dev_only = set(dev_tables) - set(prod_tables)
    if dev_only:
        print(f"\n🔧 TABLAS SOLO EN DESARROLLO ({len(dev_only)}):")
        for table in sorted(dev_only):
            print(f"  - {table}")
    
    # Tablas solo en producción
    prod_only = set(prod_tables) - set(dev_tables)
    if prod_only:
        print(f"\n🚀 TABLAS SOLO EN PRODUCCIÓN ({len(prod_only)}):")
        for table in sorted(prod_only):
            print(f"  - {table}")
    
    # Tablas comunes con conteo de registros
    common_tables = set(dev_tables) & set(prod_tables)
    if common_tables:
        print(f"\n📊 TABLAS COMUNES - CONTEO DE REGISTROS:")
        print("-" * 50)
        print(f"{'TABLA':<30} {'DEV':<10} {'PROD':<10}")
        print("-" * 50)
        
        for table in sorted(common_tables):
            if table.startswith('django_') or table.startswith('auth_') or table == 'sqlite_sequence':
                continue  # Skip system tables
                
            dev_info = get_table_info(dev_db, table) if dev_db.exists() else {'count': 0}
            prod_info = get_table_info(prod_db, table) if prod_db.exists() else {'count': 0}
            
            dev_count = dev_info.get('count', 0)
            prod_count = prod_info.get('count', 0)
            
            print(f"{table:<30} {dev_count:<10} {prod_count:<10}")

if __name__ == "__main__":
    main()