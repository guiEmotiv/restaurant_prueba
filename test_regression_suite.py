#!/usr/bin/env python3
"""
SUITE DE REGRESIÓN - Gestión de Mesas
Garantiza que todos los flujos funcionen correctamente
"""

import requests
import json
from decimal import Decimal
import time
import sys

BASE_URL = "https://www.xn--elfogndedonsoto-zrb.com/api/v1"

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.tests = []
    
    def add_test(self, name, result):
        self.tests.append((name, result))
        if result:
            self.passed += 1
        else:
            self.failed += 1
    
    def print_summary(self):
        total = self.passed + self.failed
        percentage = (self.passed / total * 100) if total > 0 else 0
        
        print("\n" + "="*60)
        print(f"RESUMEN DE PRUEBAS: {self.passed}/{total} ({percentage:.0f}%)")
        print("="*60)
        
        for test_name, result in self.tests:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} - {test_name}")
        
        return self.failed == 0

def test_1_empty_order_validation():
    """Test 1: Validación de pedidos vacíos"""
    print("\n🧪 TEST 1: Validación pedidos vacíos")
    
    tables_response = requests.get(f"{BASE_URL}/tables/")
    tables = tables_response.json()
    
    if not tables:
        return None
    
    # Intentar crear pedido vacío
    empty_order = {
        "table": tables[0]['id'],
        "waiter": "TEST",
        "items": []
    }
    
    response = requests.post(f"{BASE_URL}/orders/", json=empty_order)
    
    # Limpiar si se creó
    if response.status_code in [200, 201]:
        try:
            order_id = response.json()['id']
            requests.delete(f"{BASE_URL}/orders/{order_id}/")
        except:
            pass
    
    return response.status_code >= 400

def test_2_create_order_with_items():
    """Test 2: Crear pedido con items"""
    print("\n🧪 TEST 2: Crear pedido con items")
    
    tables_response = requests.get(f"{BASE_URL}/tables/")
    recipes_response = requests.get(f"{BASE_URL}/recipes/?is_active=true")
    
    tables = tables_response.json()
    recipes = recipes_response.json()
    
    if not tables or len(recipes) < 2:
        return None
    
    order_data = {
        "table": tables[0]['id'],
        "waiter": "TEST_CREATE",
        "items": [
            {"recipe": recipes[0]['id'], "quantity": 2, "notes": "", "is_takeaway": False},
            {"recipe": recipes[1]['id'], "quantity": 1, "notes": "", "is_takeaway": True}
        ]
    }
    
    response = requests.post(f"{BASE_URL}/orders/", json=order_data)
    
    if response.status_code not in [200, 201]:
        return False
    
    order = response.json()
    expected_total = (Decimal(str(recipes[0]['base_price'])) * 2 + 
                     Decimal(str(recipes[1]['base_price'])) * 1)
    actual_total = Decimal(str(order.get('total_amount', 0)))
    
    # Limpiar
    requests.delete(f"{BASE_URL}/orders/{order['id']}/")
    
    return abs(actual_total - expected_total) < Decimal('0.01')

def test_3_add_items_to_existing():
    """Test 3: Agregar items a pedido existente"""
    print("\n🧪 TEST 3: Agregar items a pedido existente")
    
    # Crear pedido inicial
    tables_response = requests.get(f"{BASE_URL}/tables/")
    recipes_response = requests.get(f"{BASE_URL}/recipes/?is_active=true")
    
    tables = tables_response.json()
    recipes = recipes_response.json()
    
    if not tables or len(recipes) < 3:
        return None
    
    # Crear con 1 item
    initial_order = {
        "table": tables[0]['id'],
        "waiter": "TEST_ADD",
        "items": [
            {"recipe": recipes[0]['id'], "quantity": 1, "notes": "", "is_takeaway": False}
        ]
    }
    
    create_response = requests.post(f"{BASE_URL}/orders/", json=initial_order)
    if create_response.status_code not in [200, 201]:
        return False
    
    order = create_response.json()
    order_id = order['id']
    initial_total = Decimal(str(order.get('total_amount', 0)))
    
    # Agregar más items
    update_data = {
        "items_data": [
            {"recipe": recipes[0]['id'], "quantity": 1, "notes": "", "is_takeaway": False},
            {"recipe": recipes[1]['id'], "quantity": 2, "notes": "", "is_takeaway": False},
            {"recipe": recipes[2]['id'], "quantity": 1, "notes": "", "is_takeaway": False}
        ]
    }
    
    update_response = requests.put(f"{BASE_URL}/orders/{order_id}/", json=update_data)
    
    if update_response.status_code not in [200, 202]:
        requests.delete(f"{BASE_URL}/orders/{order_id}/")
        return False
    
    # Verificar total actualizado
    detail_response = requests.get(f"{BASE_URL}/orders/{order_id}/")
    updated_order = detail_response.json()
    final_total = Decimal(str(updated_order.get('total_amount', 0)))
    
    expected_total = (Decimal(str(recipes[0]['base_price'])) * 1 +
                     Decimal(str(recipes[1]['base_price'])) * 2 +
                     Decimal(str(recipes[2]['base_price'])) * 1)
    
    # Limpiar
    requests.delete(f"{BASE_URL}/orders/{order_id}/")
    
    success = (final_total > initial_total and 
               abs(final_total - expected_total) < Decimal('0.01'))
    
    if not success:
        print(f"   Initial: {initial_total}, Final: {final_total}, Expected: {expected_total}")
    
    return success

def test_4_table_state_transitions():
    """Test 4: Estado de mesa cambia correctamente"""
    print("\n🧪 TEST 4: Transiciones estado mesa")
    
    tables_response = requests.get(f"{BASE_URL}/tables/")
    orders_response = requests.get(f"{BASE_URL}/orders/?status=CREATED")
    
    tables = tables_response.json()
    orders = orders_response.json()
    
    # Buscar mesa libre
    occupied_ids = {o.get('table', {}).get('id') if isinstance(o.get('table'), dict) 
                   else o.get('table') for o in orders}
    free_tables = [t for t in tables if t['id'] not in occupied_ids]
    
    if not free_tables:
        return None
    
    table = free_tables[0]
    
    # Crear pedido
    recipes_response = requests.get(f"{BASE_URL}/recipes/?is_active=true")
    recipes = recipes_response.json()
    
    order_data = {
        "table": table['id'],
        "waiter": "TEST_STATE",
        "items": [{"recipe": recipes[0]['id'], "quantity": 1, "notes": "", "is_takeaway": False}]
    }
    
    response = requests.post(f"{BASE_URL}/orders/", json=order_data)
    if response.status_code not in [200, 201]:
        return False
    
    order_id = response.json()['id']
    
    # Verificar mesa ocupada
    table_detail = requests.get(f"{BASE_URL}/tables/{table['id']}/")
    occupied = table_detail.json().get('has_active_orders', False)
    
    # Eliminar pedido
    requests.delete(f"{BASE_URL}/orders/{order_id}/")
    
    # Verificar mesa libre nuevamente
    table_detail_after = requests.get(f"{BASE_URL}/tables/{table['id']}/")
    free_again = not table_detail_after.json().get('has_active_orders', True)
    
    return occupied and free_again

def test_5_concurrent_orders():
    """Test 5: Múltiples pedidos concurrentes"""
    print("\n🧪 TEST 5: Pedidos concurrentes")
    
    tables_response = requests.get(f"{BASE_URL}/tables/")
    tables = tables_response.json()
    
    if not tables:
        return None
    
    table = tables[0]
    recipes_response = requests.get(f"{BASE_URL}/recipes/?is_active=true")
    recipes = recipes_response.json()
    
    created_ids = []
    
    # Crear 3 pedidos rápidamente
    for i in range(3):
        order_data = {
            "table": table['id'],
            "waiter": f"TEST_CONCURRENT_{i}",
            "items": [{"recipe": recipes[i % len(recipes)]['id'], "quantity": 1, "notes": "", "is_takeaway": False}]
        }
        
        response = requests.post(f"{BASE_URL}/orders/", json=order_data)
        if response.status_code in [200, 201]:
            created_ids.append(response.json()['id'])
    
    # Verificar todos creados
    table_orders = requests.get(f"{BASE_URL}/tables/{table['id']}/active_orders/")
    active_count = len(table_orders.json())
    
    # Limpiar
    for order_id in created_ids:
        requests.delete(f"{BASE_URL}/orders/{order_id}/")
    
    return len(created_ids) == 3 and active_count >= 3

def test_6_recipe_validation():
    """Test 6: Validación de recipe inválido"""
    print("\n🧪 TEST 6: Validación recipe inválido")
    
    tables_response = requests.get(f"{BASE_URL}/tables/")
    tables = tables_response.json()
    
    if not tables:
        return None
    
    invalid_order = {
        "table": tables[0]['id'],
        "waiter": "TEST_INVALID",
        "items": [{"recipe": 99999, "quantity": 1, "notes": "", "is_takeaway": False}]
    }
    
    response = requests.post(f"{BASE_URL}/orders/", json=invalid_order)
    
    # Si se creó, eliminar
    if response.status_code in [200, 201]:
        try:
            order_id = response.json()['id']
            requests.delete(f"{BASE_URL}/orders/{order_id}/")
        except:
            pass
    
    return response.status_code >= 400

def test_7_extreme_quantities():
    """Test 7: Cantidades extremas"""
    print("\n🧪 TEST 7: Cantidades extremas")
    
    tables_response = requests.get(f"{BASE_URL}/tables/")
    recipes_response = requests.get(f"{BASE_URL}/recipes/?is_active=true")
    
    tables = tables_response.json()
    recipes = recipes_response.json()
    
    if not tables or not recipes:
        return None
    
    # Probar con 999 items
    extreme_order = {
        "table": tables[0]['id'],
        "waiter": "TEST_EXTREME",
        "items": [{"recipe": recipes[0]['id'], "quantity": 999, "notes": "", "is_takeaway": False}]
    }
    
    response = requests.post(f"{BASE_URL}/orders/", json=extreme_order)
    
    if response.status_code not in [200, 201]:
        return False
    
    order = response.json()
    expected = Decimal(str(recipes[0]['base_price'])) * 999
    actual = Decimal(str(order.get('total_amount', 0)))
    
    # Limpiar
    requests.delete(f"{BASE_URL}/orders/{order['id']}/")
    
    return abs(actual - expected) < Decimal('0.01')

def test_8_unicode_support():
    """Test 8: Soporte unicode en notas"""
    print("\n🧪 TEST 8: Soporte unicode")
    
    tables_response = requests.get(f"{BASE_URL}/tables/")
    recipes_response = requests.get(f"{BASE_URL}/recipes/?is_active=true")
    
    tables = tables_response.json()
    recipes = recipes_response.json()
    
    if not tables or not recipes:
        return None
    
    unicode_notes = "🍕🥤 Ñoño café 中文 عربي @#$%"
    
    unicode_order = {
        "table": tables[0]['id'],
        "waiter": "TEST_UNICODE",
        "items": [{
            "recipe": recipes[0]['id'], 
            "quantity": 1, 
            "notes": unicode_notes, 
            "is_takeaway": False
        }]
    }
    
    response = requests.post(f"{BASE_URL}/orders/", json=unicode_order)
    
    if response.status_code not in [200, 201]:
        return False
    
    order_id = response.json()['id']
    
    # Verificar notas guardadas
    detail = requests.get(f"{BASE_URL}/orders/{order_id}/")
    saved_notes = detail.json().get('items', [{}])[0].get('notes', '')
    
    # Limpiar
    requests.delete(f"{BASE_URL}/orders/{order_id}/")
    
    return unicode_notes in saved_notes

def run_regression_suite():
    """Ejecutar suite completa de regresión"""
    print("🔧 SUITE DE REGRESIÓN - GESTIÓN DE MESAS")
    print("="*60)
    
    results = TestResult()
    
    # Ejecutar todos los tests
    tests = [
        ("Validación pedidos vacíos", test_1_empty_order_validation),
        ("Crear pedido con items", test_2_create_order_with_items),
        ("Agregar items a existente", test_3_add_items_to_existing),
        ("Transiciones estado mesa", test_4_table_state_transitions),
        ("Pedidos concurrentes", test_5_concurrent_orders),
        ("Validación recipe inválido", test_6_recipe_validation),
        ("Cantidades extremas", test_7_extreme_quantities),
        ("Soporte unicode", test_8_unicode_support)
    ]
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            if result is None:
                print(f"   ⚠️  {test_name} - SKIP (datos insuficientes)")
            else:
                results.add_test(test_name, result)
                status = "✅" if result else "❌"
                print(f"   {status} {test_name}")
        except Exception as e:
            print(f"   ❌ {test_name} - ERROR: {e}")
            results.add_test(test_name, False)
    
    # Imprimir resumen
    success = results.print_summary()
    
    if success:
        print("\n🎉 ¡TODAS LAS PRUEBAS PASARON!")
        print("✅ Sistema 100% funcional")
    else:
        print(f"\n⚠️  {results.failed} pruebas fallaron")
        print("❌ Sistema necesita correcciones")
    
    return success

if __name__ == "__main__":
    success = run_regression_suite()
    sys.exit(0 if success else 1)