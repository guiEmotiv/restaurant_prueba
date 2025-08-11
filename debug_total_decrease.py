#!/usr/bin/env python3
"""
DEBUG: Problema total que disminuye al agregar items
"""

import requests
import json
from decimal import Decimal

BASE_URL = "https://www.xn--elfogndedonsoto-zrb.com/api/v1"

def debug_total_decrease():
    print("🔍 DEBUG: Total que disminuye")
    print("=" * 40)
    
    # Buscar mesa libre
    tables_response = requests.get(f"{BASE_URL}/tables/")
    orders_response = requests.get(f"{BASE_URL}/orders/?status=CREATED")
    
    tables = tables_response.json()
    orders = orders_response.json()
    
    occupied_ids = {order.get('table', {}).get('id') if isinstance(order.get('table'), dict) 
                   else order.get('table') for order in orders}
    free_tables = [t for t in tables if t['id'] not in occupied_ids]
    
    if not free_tables:
        print("❌ No hay mesas libres")
        return
    
    test_table = free_tables[0]
    
    # Obtener recetas
    recipes_response = requests.get(f"{BASE_URL}/recipes/?is_active=true&is_available=true")
    recipes = recipes_response.json()
    
    print(f"📍 Mesa: {test_table['table_number']}")
    print(f"🍽️ Recetas disponibles: {len(recipes)}")
    
    # PASO 1: Crear pedido inicial con 1 item
    initial_order = {
        "table": test_table['id'],
        "waiter": "DEBUG_TEST",
        "items": [
            {
                "recipe": recipes[0]['id'],
                "quantity": 2,
                "notes": "Item inicial",
                "is_takeaway": False,
                "has_taper": False
            }
        ]
    }
    
    print(f"\n🔨 PASO 1: Crear pedido inicial")
    print(f"   Recipe: {recipes[0]['name']} x2 = S/ {Decimal(str(recipes[0]['base_price'])) * 2}")
    
    create_response = requests.post(f"{BASE_URL}/orders/", json=initial_order)
    if create_response.status_code not in [200, 201]:
        print(f"❌ Error: {create_response.status_code}")
        return
    
    order_data = create_response.json()
    order_id = order_data['id']
    initial_total = Decimal(str(order_data.get('total_amount', 0)))
    
    print(f"✅ Pedido creado #{order_id}")
    print(f"   Total inicial: S/ {initial_total}")
    
    # Verificar detalles
    detail_response = requests.get(f"{BASE_URL}/orders/{order_id}/")
    detail = detail_response.json()
    
    print(f"   Items en pedido: {len(detail.get('items', []))}")
    for i, item in enumerate(detail.get('items', [])):
        print(f"      {i+1}. {item.get('recipe_name')} x{item.get('quantity')} = S/ {item.get('total_price')}")
    
    # PASO 2: Agregar segundo item
    print(f"\n🔨 PASO 2: Agregar segundo item")
    print(f"   Recipe: {recipes[1]['name']} x1 = S/ {recipes[1]['base_price']}")
    
    # Construir items_data con item existente + nuevo
    items_data = [
        {
            "recipe": recipes[0]['id'],
            "quantity": 2,
            "notes": "Item inicial",
            "is_takeaway": False,
            "has_taper": False
        },
        {
            "recipe": recipes[1]['id'],
            "quantity": 1,
            "notes": "Item agregado",
            "is_takeaway": False,
            "has_taper": False
        }
    ]
    
    expected_total = (Decimal(str(recipes[0]['base_price'])) * 2 + 
                     Decimal(str(recipes[1]['base_price'])) * 1)
    
    print(f"   Total esperado: S/ {expected_total}")
    
    update_data = {"items_data": items_data}
    
    update_response = requests.put(f"{BASE_URL}/orders/{order_id}/", json=update_data)
    if update_response.status_code not in [200, 202]:
        print(f"❌ Error actualizando: {update_response.status_code}")
        print(f"   Response: {update_response.text}")
        return
    
    print(f"✅ Pedido actualizado")
    
    # Verificar resultado
    updated_detail_response = requests.get(f"{BASE_URL}/orders/{order_id}/")
    updated_detail = updated_detail_response.json()
    final_total = Decimal(str(updated_detail.get('total_amount', 0)))
    
    print(f"   Total después: S/ {final_total}")
    print(f"   Items en pedido: {len(updated_detail.get('items', []))}")
    
    total_from_items = Decimal('0')
    for i, item in enumerate(updated_detail.get('items', [])):
        item_total = Decimal(str(item.get('total_price', 0)))
        total_from_items += item_total
        print(f"      {i+1}. {item.get('recipe_name')} x{item.get('quantity')} = S/ {item_total}")
    
    print(f"\n📊 ANÁLISIS:")
    print(f"   Total inicial: S/ {initial_total}")
    print(f"   Total final: S/ {final_total}")
    print(f"   Cambio: S/ {final_total - initial_total}")
    print(f"   Total esperado: S/ {expected_total}")
    print(f"   Total calculado manual: S/ {total_from_items}")
    
    if final_total < initial_total:
        print("   ❌ PROBLEMA: Total disminuyó!")
    elif final_total == initial_total:
        print("   ❌ PROBLEMA: Total no cambió!")
    else:
        print("   ✅ Total aumentó correctamente")
    
    if abs(final_total - expected_total) < Decimal('0.01'):
        print("   ✅ Total coincide con esperado")
    else:
        print("   ❌ Total NO coincide con esperado")
    
    if abs(final_total - total_from_items) < Decimal('0.01'):
        print("   ✅ Total coincide con suma manual")
    else:
        print("   ❌ Total NO coincide con suma manual")
    
    # PASO 3: Forzar recálculo
    print(f"\n🔨 PASO 3: Forzar recálculo manual")
    
    # Llamar a endpoint ficticio o hacer otra consulta para forzar
    recalc_response = requests.get(f"{BASE_URL}/orders/{order_id}/")
    recalc_detail = recalc_response.json()
    recalc_total = Decimal(str(recalc_detail.get('total_amount', 0)))
    
    print(f"   Total tras nueva consulta: S/ {recalc_total}")
    
    if recalc_total != final_total:
        print("   ⚠️ Total cambió entre consultas (inconsistencia)")
    else:
        print("   ✅ Total consistente entre consultas")
    
    # Limpiar
    requests.delete(f"{BASE_URL}/orders/{order_id}/")
    print(f"\n🧹 Pedido {order_id} eliminado")

if __name__ == "__main__":
    debug_total_decrease()