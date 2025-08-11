#!/usr/bin/env python3
"""
DEBUG - Conteo múltiples pedidos en mesa
"""

import requests
import json
from collections import defaultdict

BASE_URL = "https://www.xn--elfogndedonsoto-zrb.com/api/v1"

def debug_table_orders():
    print("🔍 DEBUG: Conteo pedidos por mesa")
    print("=" * 40)
    
    # 1. Obtener todas las órdenes y mesas
    orders_response = requests.get(f"{BASE_URL}/orders/?status=CREATED")
    tables_response = requests.get(f"{BASE_URL}/tables/")
    
    orders = orders_response.json()
    tables = tables_response.json()
    
    print(f"📊 Datos generales:")
    print(f"   Total órdenes activas: {len(orders)}")
    print(f"   Total mesas: {len(tables)}")
    
    # 2. Agrupar órdenes por mesa
    orders_by_table = defaultdict(list)
    
    for order in orders:
        table_ref = order.get('table')
        table_id = None
        
        if isinstance(table_ref, dict) and 'id' in table_ref:
            table_id = table_ref['id']
            table_name = table_ref.get('table_number', f"ID-{table_id}")
        elif isinstance(table_ref, int):
            table_id = table_ref
            table_name = f"ID-{table_id}"
        
        if table_id:
            orders_by_table[table_id].append({
                'order_id': order['id'],
                'table_name': table_name,
                'total': order.get('grand_total', order.get('total_amount', 0)),
                'items_count': len(order.get('items', []))
            })
    
    # 3. Mostrar distribución
    print(f"\n📋 Distribución pedidos por mesa:")
    
    tables_with_multiple = 0
    total_orders_multiple_tables = 0
    
    for table_id, table_orders in orders_by_table.items():
        order_count = len(table_orders)
        if order_count > 1:
            tables_with_multiple += 1
            total_orders_multiple_tables += order_count
            
            table_name = table_orders[0]['table_name']
            total_amount = sum(float(o['total']) for o in table_orders)
            total_items = sum(o['items_count'] for o in table_orders)
            
            print(f"   Mesa {table_name}: {order_count} pedidos")
            print(f"     Órdenes: {[o['order_id'] for o in table_orders]}")
            print(f"     Total: S/ {total_amount:.2f}")
            print(f"     Items: {total_items}")
            print()
        
    print(f"📊 Resumen:")
    print(f"   Mesas con múltiples pedidos: {tables_with_multiple}")
    print(f"   Total órdenes en mesas múltiples: {total_orders_multiple_tables}")
    
    # 4. Verificar consistencia con backend
    print(f"\n🔍 Verificación backend:")
    
    for table_id, table_orders in list(orders_by_table.items())[:3]:  # Verificar primeras 3
        table_name = table_orders[0]['table_name']
        
        # Consultar directamente las órdenes activas de esta mesa
        table_orders_response = requests.get(f"{BASE_URL}/tables/{table_id}/active_orders/")
        
        if table_orders_response.status_code == 200:
            backend_orders = table_orders_response.json()
            
            print(f"   Mesa {table_name}:")
            print(f"     Conteo manual: {len(table_orders)}")
            print(f"     Backend count: {len(backend_orders)}")
            
            if len(table_orders) != len(backend_orders):
                print(f"     ❌ INCONSISTENCIA detectada!")
            else:
                print(f"     ✅ Consistente")
    
    return tables_with_multiple > 0

if __name__ == "__main__":
    debug_table_orders()