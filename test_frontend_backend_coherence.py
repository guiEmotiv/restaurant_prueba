#!/usr/bin/env python3
"""
TEST COHERENCIA FRONTEND-BACKEND-DATABASE
Validación específica de la lógica del frontend vs backend
"""

import requests
import json
from decimal import Decimal

BASE_URL = "https://www.xn--elfogndedonsoto-zrb.com/api/v1"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_test(message, status="INFO"):
    colors = {"PASS": Colors.GREEN, "FAIL": Colors.RED, "WARNING": Colors.YELLOW, "INFO": Colors.BLUE}
    color = colors.get(status, "")
    print(f"{color}{Colors.BOLD}[{status}]{Colors.END} {message}")

def simulate_frontend_getTableOrders(all_orders, table_id):
    """Simular exactamente la función getTableOrders del frontend"""
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

def simulate_frontend_getTableStatus(all_orders, table_id):
    """Simular función getTableStatus del frontend"""
    orders = simulate_frontend_getTableOrders(all_orders, table_id)
    return 'occupied' if len(orders) > 0 else 'available'

def simulate_frontend_getTableSummary(all_orders, table_id):
    """Simular función getTableSummary del frontend"""
    orders = simulate_frontend_getTableOrders(all_orders, table_id)
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

def test_frontend_backend_logic_coherence():
    """Test principal de coherencia lógica"""
    print_test("🔄 VALIDACIÓN COHERENCIA FRONTEND ↔ BACKEND", "INFO")
    print("=" * 60)
    
    try:
        # Obtener datos como el frontend
        print("📤 Obteniendo datos simulando carga frontend...")
        tables_response = requests.get(f"{BASE_URL}/tables/")
        orders_response = requests.get(f"{BASE_URL}/orders/?status=CREATED")
        
        if tables_response.status_code != 200 or orders_response.status_code != 200:
            print_test("Error obteniendo datos básicos", "FAIL")
            return False
            
        tables = tables_response.json()
        all_orders = orders_response.json()
        
        print(f"✅ Datos cargados: {len(tables)} mesas, {len(all_orders)} órdenes")
        
        # Validar cada mesa
        discrepancies = []
        logic_errors = []
        data_inconsistencies = []
        
        for table in tables:
            table_id = table['id']
            table_number = table.get('table_number', 'N/A')
            
            # --- 1. ESTADOS: Frontend vs Backend ---
            frontend_status = simulate_frontend_getTableStatus(all_orders, table_id)
            backend_status = 'occupied' if table.get('has_active_orders', False) else 'available'
            
            if frontend_status != backend_status:
                discrepancies.append({
                    'mesa': table_number,
                    'frontend': frontend_status,
                    'backend': backend_status
                })
            
            # --- 2. CONTEO ÓRDENES: Frontend vs Backend ---
            frontend_orders = simulate_frontend_getTableOrders(all_orders, table_id)
            frontend_count = len(frontend_orders)
            
            # Backend debería tener mismo número de órdenes
            backend_orders_response = requests.get(f"{BASE_URL}/tables/{table_id}/active_orders/")
            if backend_orders_response.status_code == 200:
                backend_orders = backend_orders_response.json()
                backend_count = len(backend_orders)
                
                if frontend_count != backend_count:
                    logic_errors.append({
                        'mesa': table_number,
                        'frontend_orders': frontend_count,
                        'backend_orders': backend_count
                    })
            
            # --- 3. CÁLCULOS TOTALES: Validar coherencia ---
            if frontend_count > 0:
                frontend_summary = simulate_frontend_getTableSummary(all_orders, table_id)
                
                # Validar que los cálculos del frontend sean consistentes
                manual_total = 0
                manual_items = 0
                
                for order in frontend_orders:
                    order_total = float(order.get('grand_total', 0) or order.get('total_amount', 0))
                    order_items = len(order.get('items', []))
                    
                    manual_total += order_total
                    manual_items += order_items
                    
                    # Validar que la orden tenga estructura correcta
                    if order_total == 0 and order_items > 0:
                        data_inconsistencies.append({
                            'issue': f"Orden #{order['id']} tiene {order_items} items pero total=0",
                            'mesa': table_number
                        })
                
                # Comparar cálculos
                if abs(frontend_summary['totalAmount'] - manual_total) > 0.01:
                    logic_errors.append({
                        'mesa': table_number,
                        'issue': 'Cálculo total incorrecto',
                        'frontend': frontend_summary['totalAmount'],
                        'manual': manual_total
                    })
                    
                if frontend_summary['totalItems'] != manual_items:
                    logic_errors.append({
                        'mesa': table_number,
                        'issue': 'Conteo items incorrecto',
                        'frontend': frontend_summary['totalItems'],
                        'manual': manual_items
                    })
            
            # --- 4. ESTRUCTURA DATOS MESA ---
            # Validar que tenga zona correctamente asignada
            zone_name = table.get('zone_name') or table.get('zone', {}).get('name')
            if not zone_name:
                data_inconsistencies.append({
                    'issue': f"Mesa sin zona asignada",
                    'mesa': table_number
                })
        
        # --- REPORTAR RESULTADOS ---
        print(f"\n📊 ANÁLISIS COHERENCIA:")
        print(f"   Mesas analizadas: {len(tables)}")
        print(f"   Órdenes activas: {len(all_orders)}")
        
        # Estados
        if discrepancies:
            print_test(f"DISCREPANCIAS ESTADOS: {len(discrepancies)}", "FAIL")
            for disc in discrepancies[:3]:
                print(f"     Mesa {disc['mesa']}: Frontend={disc['frontend']} vs Backend={disc['backend']}")
        else:
            print_test("Estados Frontend ↔ Backend: COHERENTES", "PASS")
        
        # Lógica
        if logic_errors:
            print_test(f"ERRORES LÓGICA: {len(logic_errors)}", "FAIL")
            for error in logic_errors[:3]:
                print(f"     Mesa {error['mesa']}: {error['issue']}")
        else:
            print_test("Lógica cálculos Frontend: CORRECTA", "PASS")
        
        # Datos
        if data_inconsistencies:
            print_test(f"INCONSISTENCIAS DATOS: {len(data_inconsistencies)}", "FAIL")
            for issue in data_inconsistencies[:3]:
                print(f"     {issue['issue']} (Mesa {issue.get('mesa', 'N/A')})")
        else:
            print_test("Integridad datos: CORRECTA", "PASS")
        
        # Resultado final
        total_issues = len(discrepancies) + len(logic_errors) + len(data_inconsistencies)
        
        if total_issues == 0:
            print_test("🎉 COHERENCIA TOTAL VALIDADA", "PASS")
            return True
        else:
            print_test(f"🚨 {total_issues} PROBLEMAS ENCONTRADOS", "FAIL")
            return False
            
    except Exception as e:
        print_test(f"Excepción durante validación: {e}", "FAIL")
        return False

def test_specific_order_workflows():
    """Test de workflows específicos problemáticos"""
    print_test("\n🔍 VALIDACIÓN WORKFLOWS ESPECÍFICOS", "INFO")
    print("=" * 45)
    
    try:
        # Obtener órdenes activas
        orders_response = requests.get(f"{BASE_URL}/orders/?status=CREATED")
        orders = orders_response.json()
        
        workflow_issues = []
        
        for order in orders[:3]:  # Validar primeras 3
            order_id = order['id']
            
            # --- 1. Test obtener detalles orden ---
            detail_response = requests.get(f"{BASE_URL}/orders/{order_id}/")
            if detail_response.status_code != 200:
                workflow_issues.append(f"No se puede obtener detalles orden #{order_id}")
                continue
                
            order_detail = detail_response.json()
            
            # --- 2. Test actualización orden (simulando frontend) ---
            if order_detail.get('items'):
                # Simular actualización manteniendo items existentes
                update_data = {
                    "waiter": "TEST_UPDATE",
                    "items_data": [
                        {
                            "recipe": item.get('recipe') or item.get('recipe_id'),
                            "quantity": item.get('quantity', 1),
                            "notes": item.get('notes', ''),
                            "is_takeaway": item.get('is_takeaway', False),
                            "has_taper": item.get('has_taper', False)
                        }
                        for item in order_detail['items']
                    ]
                }
                
                try:
                    update_response = requests.put(
                        f"{BASE_URL}/orders/{order_id}/",
                        json=update_data,
                        headers={'Content-Type': 'application/json'}
                    )
                    
                    if update_response.status_code not in [200, 202]:
                        workflow_issues.append(f"Error actualizando orden #{order_id}: {update_response.status_code}")
                        print(f"     Error detail: {update_response.text}")
                    else:
                        print_test(f"Orden #{order_id}: Actualización exitosa", "PASS")
                        
                except Exception as e:
                    workflow_issues.append(f"Excepción actualizando orden #{order_id}: {e}")
        
        if workflow_issues:
            print_test(f"PROBLEMAS WORKFLOWS: {len(workflow_issues)}", "FAIL")
            for issue in workflow_issues:
                print(f"   {issue}")
            return False
        else:
            print_test("Workflows críticos funcionando", "PASS")
            return True
            
    except Exception as e:
        print_test(f"Excepción en workflows: {e}", "FAIL")
        return False

def run_coherence_validation():
    """Ejecutar validación completa de coherencia"""
    print(f"{Colors.BOLD}🎯 VALIDACIÓN COHERENCIA SISTEMA COMPLETO{Colors.END}")
    print(f"{Colors.BOLD}Backend ↔ Database ↔ Frontend{Colors.END}")
    print("=" * 70)
    
    test_results = [
        ("Coherencia lógica Frontend-Backend", test_frontend_backend_logic_coherence()),
        ("Workflows críticos funcionando", test_specific_order_workflows())
    ]
    
    print(f"\n{Colors.BOLD}📋 RESULTADO COHERENCIA{Colors.END}")
    print("=" * 35)
    
    passed = 0
    for test_name, result in test_results:
        if result:
            print_test(f"✅ {test_name}", "PASS")
            passed += 1
        else:
            print_test(f"❌ {test_name}", "FAIL")
    
    success_rate = (passed / len(test_results)) * 100
    print(f"\n🎯 COHERENCIA: {passed}/{len(test_results)} ({success_rate:.0f}%)")
    
    if passed == len(test_results):
        print(f"🎉 COHERENCIA TOTAL VALIDADA")
        return True
    else:
        print(f"⚠️  PROBLEMAS DE COHERENCIA DETECTADOS")
        return False

if __name__ == "__main__":
    success = run_coherence_validation()
    exit(0 if success else 1)