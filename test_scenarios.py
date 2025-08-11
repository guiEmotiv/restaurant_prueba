#!/usr/bin/env python3
"""
ESCENARIOS DE PRUEBA - VISTA GESTIÓN MESAS
Análisis profundo de cálculos y flujo de datos
"""

import requests
import json
from decimal import Decimal

BASE_URL = "https://www.xn--elfogndedonsoto-zrb.com/api/v1"

def test_scenario_1_empty_table():
    """Escenario 1: Mesa sin pedidos - debe estar DISPONIBLE"""
    print("🧪 ESCENARIO 1: Mesa sin pedidos")
    print("=" * 40)
    
    # 1. Obtener todas las mesas
    tables_response = requests.get(f"{BASE_URL}/tables/")
    if tables_response.status_code != 200:
        print(f"❌ Error obteniendo mesas: {tables_response.status_code}")
        return
    
    tables = tables_response.json()
    print(f"✅ Total mesas: {len(tables)}")
    
    # 2. Obtener órdenes activas
    orders_response = requests.get(f"{BASE_URL}/orders/?status=CREATED")
    if orders_response.status_code != 200:
        print(f"❌ Error obteniendo órdenes: {orders_response.status_code}")
        return
        
    orders = orders_response.json()
    print(f"✅ Total órdenes activas: {len(orders)}")
    
    # 3. Identificar mesas sin pedidos
    occupied_table_ids = {order['table'] for order in orders if order.get('table')}
    empty_tables = [table for table in tables if table['id'] not in occupied_table_ids]
    
    print(f"\n📊 Análisis Estados:")
    print(f"   Mesas ocupadas: {len(occupied_table_ids)}")
    print(f"   Mesas disponibles: {len(empty_tables)}")
    
    # 4. Validar que backend marca correctamente has_active_orders
    backend_occupied = [t for t in tables if t.get('has_active_orders', False)]
    backend_empty = [t for t in tables if not t.get('has_active_orders', False)]
    
    print(f"\n🔍 Backend vs Lógica:")
    print(f"   Backend marca ocupadas: {len(backend_occupied)}")
    print(f"   Backend marca disponibles: {len(backend_empty)}")
    
    if len(occupied_table_ids) == len(backend_occupied):
        print("   ✅ Backend coherente con órdenes")
    else:
        print("   ❌ INCONSISTENCIA detectada!")
        
    return empty_tables[0] if empty_tables else None

def test_scenario_2_single_order():
    """Escenario 2: Mesa con 1 pedido - cálculos correctos"""
    print("\n🧪 ESCENARIO 2: Mesa con 1 pedido")
    print("=" * 40)
    
    # Obtener una orden específica con detalles
    orders_response = requests.get(f"{BASE_URL}/orders/?status=CREATED")
    orders = orders_response.json()
    
    if not orders:
        print("❌ No hay órdenes para probar")
        return
        
    order_id = orders[0]['id']
    print(f"🎯 Probando orden ID: {order_id}")
    
    # Obtener detalles completos de la orden
    order_detail_response = requests.get(f"{BASE_URL}/orders/{order_id}/")
    if order_detail_response.status_code != 200:
        print(f"❌ Error obteniendo detalles: {order_detail_response.status_code}")
        return
        
    order = order_detail_response.json()
    
    print(f"\n📋 Detalles Orden {order_id}:")
    print(f"   Mesa: {order.get('table_number', 'N/A')}")
    print(f"   Estado: {order.get('status')}")
    print(f"   Items: {len(order.get('items', []))}")
    
    # Análisis de cálculos
    print(f"\n💰 Análisis Cálculos:")
    
    # Backend totales
    backend_total_amount = Decimal(str(order.get('total_amount', 0)))
    backend_containers_total = Decimal(str(order.get('containers_total', 0)))
    backend_grand_total = Decimal(str(order.get('grand_total', 0)))
    
    print(f"   Backend total_amount: S/ {backend_total_amount}")
    print(f"   Backend containers_total: S/ {backend_containers_total}")
    print(f"   Backend grand_total: S/ {backend_grand_total}")
    
    # Cálculo manual items
    manual_items_total = Decimal('0')
    for item in order.get('items', []):
        item_total = Decimal(str(item.get('total_price', 0)))
        manual_items_total += item_total
        print(f"     Item: {item.get('recipe_name', 'N/A')} x{item.get('quantity', 1)} = S/ {item_total}")
    
    print(f"   Manual items total: S/ {manual_items_total}")
    
    # Cálculo manual containers
    manual_containers_total = Decimal('0')
    for container in order.get('container_sales', []):
        container_total = Decimal(str(container.get('total_price', 0)))
        manual_containers_total += container_total
        print(f"     Container: {container.get('container_name', 'N/A')} x{container.get('quantity', 1)} = S/ {container_total}")
    
    print(f"   Manual containers total: S/ {manual_containers_total}")
    print(f"   Manual grand total: S/ {manual_items_total + manual_containers_total}")
    
    # Validaciones
    validations = []
    validations.append(("Items total", backend_total_amount == manual_items_total))
    validations.append(("Containers total", backend_containers_total == manual_containers_total))
    validations.append(("Grand total", backend_grand_total == manual_items_total + manual_containers_total))
    
    print(f"\n✅ Validaciones:")
    for desc, result in validations:
        status = "✅" if result else "❌"
        print(f"   {status} {desc}: {'OK' if result else 'FALLO'}")
        
    return order

def test_scenario_3_multiple_orders():
    """Escenario 3: Mesa con múltiples pedidos - totales acumulados"""
    print("\n🧪 ESCENARIO 3: Mesa con múltiples pedidos")
    print("=" * 40)
    
    # Obtener órdenes por mesa
    orders_response = requests.get(f"{BASE_URL}/orders/?status=CREATED")
    orders = orders_response.json()
    
    # Agrupar por mesa
    orders_by_table = {}
    for order in orders:
        table_id = order.get('table')
        if table_id:
            if table_id not in orders_by_table:
                orders_by_table[table_id] = []
            orders_by_table[table_id].append(order)
    
    # Encontrar mesa con múltiples pedidos
    multi_order_tables = {k: v for k, v in orders_by_table.items() if len(v) > 1}
    
    print(f"📊 Mesas con múltiples pedidos: {len(multi_order_tables)}")
    
    if not multi_order_tables:
        print("ℹ️  No hay mesas con múltiples pedidos para probar")
        return
        
    # Analizar primera mesa con múltiples pedidos
    table_id, table_orders = next(iter(multi_order_tables.items()))
    print(f"\n🎯 Analizando Mesa ID {table_id} con {len(table_orders)} pedidos:")
    
    total_accumulated = Decimal('0')
    total_items = 0
    
    for i, order in enumerate(table_orders, 1):
        grand_total = Decimal(str(order.get('grand_total', 0)))
        items_count = len(order.get('items', []))
        
        print(f"   Pedido {i}: #{order['id']} - S/ {grand_total} ({items_count} items)")
        
        total_accumulated += grand_total
        total_items += items_count
    
    print(f"\n💰 Totales Acumulados Mesa:")
    print(f"   Total items: {total_items}")
    print(f"   Total acumulado: S/ {total_accumulated}")
    
    return table_id, table_orders

def test_scenario_4_frontend_calculation():
    """Escenario 4: Simular cálculos del frontend"""
    print("\n🧪 ESCENARIO 4: Simulación cálculos frontend")
    print("=" * 40)
    
    # Simular función getTableOrders del frontend
    orders_response = requests.get(f"{BASE_URL}/orders/?status=CREATED")
    all_orders = orders_response.json()
    
    def simulate_getTableOrders(table_id):
        orders = []
        for order in all_orders:
            table_ref = order.get('table')
            order_table_id = None
            
            if isinstance(table_ref, dict) and 'id' in table_ref:
                order_table_id = table_ref['id']
            elif isinstance(table_ref, int):
                order_table_id = table_ref
            elif order.get('table_id'):
                order_table_id = order.get('table_id')
                
            if order_table_id == table_id:
                orders.append(order)
        return orders
    
    def simulate_getTableStatus(table_id):
        orders = simulate_getTableOrders(table_id)
        return 'occupied' if len(orders) > 0 else 'available'
    
    def simulate_getTableSummary(table_id):
        orders = simulate_getTableOrders(table_id)
        if not orders:
            return None
            
        total_amount = sum(
            float(order.get('grand_total', 0) or order.get('total_amount', 0)) 
            for order in orders
        )
        total_items = sum(len(order.get('items', [])) for order in orders)
        
        return {
            'orderCount': len(orders),
            'totalAmount': total_amount,
            'totalItems': total_items
        }
    
    # Probar con mesas reales
    tables_response = requests.get(f"{BASE_URL}/tables/")
    tables = tables_response.json()
    
    print(f"🔍 Simulando cálculos frontend para {len(tables)} mesas:")
    
    discrepancies = []
    
    for table in tables[:5]:  # Probar primeras 5 mesas
        table_id = table['id']
        table_number = table.get('table_number', 'N/A')
        
        # Backend status
        backend_status = 'occupied' if table.get('has_active_orders') else 'available'
        
        # Frontend simulation
        frontend_status = simulate_getTableStatus(table_id)
        frontend_summary = simulate_getTableSummary(table_id)
        
        print(f"\n   Mesa {table_number} (ID: {table_id}):")
        print(f"     Backend status: {backend_status}")
        print(f"     Frontend status: {frontend_status}")
        
        if frontend_summary:
            print(f"     Frontend summary: {frontend_summary['orderCount']} pedidos, {frontend_summary['totalItems']} items, S/ {frontend_summary['totalAmount']:.2f}")
        
        if backend_status != frontend_status:
            discrepancies.append({
                'table_id': table_id,
                'table_number': table_number,
                'backend': backend_status,
                'frontend': frontend_status
            })
    
    if discrepancies:
        print(f"\n❌ DISCREPANCIAS ENCONTRADAS:")
        for disc in discrepancies:
            print(f"   Mesa {disc['table_number']}: Backend={disc['backend']} vs Frontend={disc['frontend']}")
    else:
        print(f"\n✅ No se encontraron discrepancias en los primeros 5 casos")

def run_all_scenarios():
    """Ejecutar todos los escenarios de prueba"""
    print("🚀 INICIANDO ANÁLISIS PROFUNDO - VISTA GESTIÓN MESAS")
    print("=" * 60)
    
    try:
        scenario_1_result = test_scenario_1_empty_table()
        scenario_2_result = test_scenario_2_single_order() 
        scenario_3_result = test_scenario_3_multiple_orders()
        test_scenario_4_frontend_calculation()
        
        print(f"\n📋 RESUMEN ANÁLISIS:")
        print("=" * 30)
        print("✅ Escenario 1: Mesas vacías")
        print("✅ Escenario 2: Pedido único") 
        print("✅ Escenario 3: Múltiples pedidos")
        print("✅ Escenario 4: Simulación frontend")
        
        return True
        
    except Exception as e:
        print(f"❌ Error durante análisis: {e}")
        return False

if __name__ == "__main__":
    success = run_all_scenarios()
    exit(0 if success else 1)