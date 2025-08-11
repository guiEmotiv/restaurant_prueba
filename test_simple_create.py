#!/usr/bin/env python3
"""
TEST SIMPLE: Crear pedido básico para verificar que el backend funciona
"""

import requests
import json

BASE_URL = "https://www.xn--elfogndedonsoto-zrb.com/api/v1"

def test_simple_create():
    print("🔍 TEST SIMPLE: Crear pedido básico")
    print("="*40)
    
    # Obtener datos básicos
    print("1. Obteniendo mesas...")
    tables_response = requests.get(f"{BASE_URL}/tables/")
    print(f"   Status: {tables_response.status_code}")
    
    if tables_response.status_code != 200:
        print("❌ Error obteniendo mesas")
        return
    
    tables = tables_response.json()
    print(f"   Mesas disponibles: {len(tables)}")
    
    print("\n2. Obteniendo recetas...")
    recipes_response = requests.get(f"{BASE_URL}/recipes/?is_active=true")
    print(f"   Status: {recipes_response.status_code}")
    
    if recipes_response.status_code != 200:
        print("❌ Error obteniendo recetas")
        return
    
    recipes = recipes_response.json()
    print(f"   Recetas disponibles: {len(recipes)}")
    
    if not tables or not recipes:
        print("❌ Datos insuficientes")
        return
    
    # Test crear pedido
    print("\n3. Creando pedido simple...")
    
    simple_order = {
        "table": tables[0]['id'],
        "waiter": "TEST_SIMPLE",
        "items": [
            {
                "recipe": recipes[0]['id'],
                "quantity": 1,
                "notes": "Test simple",
                "is_takeaway": False,
                "has_taper": False
            }
        ]
    }
    
    create_response = requests.post(f"{BASE_URL}/orders/", json=simple_order)
    print(f"   Status: {create_response.status_code}")
    
    if create_response.status_code in [200, 201]:
        order_data = create_response.json()
        order_id = order_data['id']
        print(f"   ✅ Pedido creado: #{order_id}")
        print(f"   Total: S/ {order_data.get('total_amount')}")
        
        # Test actualización simple
        print("\n4. Actualizando pedido...")
        
        update_data = {
            "items_data": [
                {
                    "recipe": recipes[0]['id'],
                    "quantity": 2,  # Cambiar cantidad
                    "notes": "Test actualizado",
                    "is_takeaway": False,
                    "has_taper": False
                }
            ]
        }
        
        update_response = requests.put(f"{BASE_URL}/orders/{order_id}/", json=update_data)
        print(f"   Status: {update_response.status_code}")
        
        if update_response.status_code in [200, 202]:
            updated_data = update_response.json()
            print(f"   ✅ Pedido actualizado")
            print(f"   Nuevo total: S/ {updated_data.get('total_amount')}")
            
            if float(updated_data.get('total_amount', 0)) > float(order_data.get('total_amount', 0)):
                print("   ✅ Total aumentó correctamente")
            else:
                print("   ❌ Total no aumentó")
        else:
            print(f"   ❌ Error actualizando: {update_response.text}")
        
        # Limpiar
        delete_response = requests.delete(f"{BASE_URL}/orders/{order_id}/")
        print(f"\n5. Limpieza: {delete_response.status_code}")
        
    else:
        print(f"   ❌ Error creando: {create_response.text}")

if __name__ == "__main__":
    test_simple_create()