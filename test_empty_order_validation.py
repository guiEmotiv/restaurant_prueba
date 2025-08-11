#!/usr/bin/env python3
"""
TEST ESPECÍFICO: Validación de pedidos vacíos
"""

import requests
import json

BASE_URL = "https://www.xn--elfogndedonsoto-zrb.com/api/v1"

def test_empty_order_validation():
    print("🔍 TEST: Validación pedidos vacíos")
    print("=" * 40)
    
    # Obtener una mesa
    tables_response = requests.get(f"{BASE_URL}/tables/")
    tables = tables_response.json()
    
    if not tables:
        print("❌ No hay mesas disponibles")
        return
    
    test_table = tables[0]
    print(f"📍 Mesa de prueba: {test_table['table_number']}")
    
    # Test 1: Pedido completamente vacío
    print("\n🧪 Test 1: Pedido sin items")
    empty_data = {
        "table": test_table['id'],
        "waiter": "TEST_VALIDATION",
        "items": []
    }
    
    response = requests.post(
        f"{BASE_URL}/orders/",
        json=empty_data,
        headers={'Content-Type': 'application/json'}
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code >= 400:
        print("✅ PASS: Rechaza pedido vacío correctamente")
        return True
    else:
        print("❌ FAIL: Acepta pedido vacío (ERROR)")
        
        # Limpiar el pedido creado erróneamente
        if response.status_code in [200, 201]:
            try:
                order_data = response.json()
                order_id = order_data.get('id')
                if order_id:
                    delete_response = requests.delete(f"{BASE_URL}/orders/{order_id}/")
                    print(f"🧹 Pedido {order_id} eliminado (cleanup)")
            except:
                pass
        
        return False

if __name__ == "__main__":
    success = test_empty_order_validation()
    print(f"\n🎯 Resultado: {'PASS' if success else 'FAIL'}")
    exit(0 if success else 1)