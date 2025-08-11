#!/usr/bin/env python3
"""
TEST ESPECÍFICO: Agregar items a pedido existente con items
"""

import requests
import json
from decimal import Decimal
from datetime import datetime

BASE_URL = "https://www.xn--elfogndedonsoto-zrb.com/api/v1"

def test_add_items_to_existing_order():
    print("🔍 TEST: Agregar items a pedido con items existentes")
    print("=" * 60)
    
    # 1. Buscar un pedido existente con items
    orders_response = requests.get(f"{BASE_URL}/orders/?status=CREATED")
    orders = orders_response.json()
    
    # Buscar orden con al menos 1 item
    test_order = None
    for order in orders:
        if len(order.get('items', [])) > 0:
            test_order = order
            break
    
    if not test_order:
        print("❌ No hay pedidos con items para probar")
        print("   Creando pedido de prueba...")
        
        # Crear pedido con items
        tables_response = requests.get(f"{BASE_URL}/tables/")
        recipes_response = requests.get(f"{BASE_URL}/recipes/?is_active=true&is_available=true")
        
        tables = tables_response.json()
        recipes = recipes_response.json()
        
        if not tables or not recipes:
            print("❌ No hay datos suficientes")
            return
        
        create_data = {
            "table": tables[0]['id'],
            "waiter": "TEST_EXISTING",
            "items": [
                {
                    "recipe": recipes[0]['id'],
                    "quantity": 2,
                    "notes": "Item inicial 1",
                    "is_takeaway": False
                },
                {
                    "recipe": recipes[1]['id'],
                    "quantity": 1,
                    "notes": "Item inicial 2",
                    "is_takeaway": False
                }
            ]
        }
        
        create_response = requests.post(f"{BASE_URL}/orders/", json=create_data)
        if create_response.status_code not in [200, 201]:
            print(f"❌ Error creando pedido: {create_response.status_code}")
            return
        
        test_order = create_response.json()
        print(f"✅ Pedido creado #{test_order['id']}")
    
    order_id = test_order['id']
    
    # 2. Verificar estado inicial
    detail_response = requests.get(f"{BASE_URL}/orders/{order_id}/")
    initial_detail = detail_response.json()
    
    print(f"\n📊 ESTADO INICIAL - Pedido #{order_id}")
    print(f"   Mesa: {initial_detail.get('table', {}).get('table_number')}")
    print(f"   Items: {len(initial_detail.get('items', []))}")
    print(f"   Total: S/ {initial_detail.get('total_amount')}")
    
    initial_total = Decimal(str(initial_detail.get('total_amount', 0)))
    
    print("\n   Detalle items:")
    for i, item in enumerate(initial_detail.get('items', [])):
        print(f"   {i+1}. {item.get('recipe_name')} x{item.get('quantity')} = S/ {item.get('total_price')}")
    
    # 3. Obtener recetas para agregar
    recipes_response = requests.get(f"{BASE_URL}/recipes/?is_active=true&is_available=true")
    recipes = recipes_response.json()
    
    # Buscar receta diferente a las existentes
    existing_recipe_ids = []
    for item in initial_detail.get('items', []):
        recipe_ref = item.get('recipe')
        if isinstance(recipe_ref, dict):
            existing_recipe_ids.append(recipe_ref.get('id'))
        elif isinstance(recipe_ref, int):
            existing_recipe_ids.append(recipe_ref)
    
    new_recipe = None
    for recipe in recipes:
        if recipe['id'] not in existing_recipe_ids:
            new_recipe = recipe
            break
    
    if not new_recipe:
        # Usar cualquier receta
        new_recipe = recipes[0]
    
    # 4. Preparar actualización - mantener existentes + agregar nuevo
    print(f"\n➕ AGREGANDO ITEM NUEVO")
    print(f"   Receta: {new_recipe['name']}")
    print(f"   Precio unitario: S/ {new_recipe['base_price']}")
    print(f"   Cantidad: 3")
    print(f"   Subtotal esperado: S/ {Decimal(str(new_recipe['base_price'])) * 3}")
    
    items_data = []
    
    # Mantener items existentes
    for item in initial_detail.get('items', []):
        recipe_ref = item.get('recipe')
        if isinstance(recipe_ref, dict):
            recipe_id = recipe_ref.get('id')
        else:
            recipe_id = recipe_ref
            
        items_data.append({
            "recipe": recipe_id,
            "quantity": item.get('quantity', 1),
            "notes": item.get('notes', ''),
            "is_takeaway": item.get('is_takeaway', False),
            "has_taper": item.get('has_taper', False)
        })
    
    # Agregar nuevo item
    items_data.append({
        "recipe": new_recipe['id'],
        "quantity": 3,
        "notes": "Item agregado TEST",
        "is_takeaway": False,
        "has_taper": False
    })
    
    update_data = {"items_data": items_data}
    
    expected_new_total = initial_total + (Decimal(str(new_recipe['base_price'])) * 3)
    print(f"\n   Total esperado después: S/ {expected_new_total}")
    
    # 5. Ejecutar actualización
    print(f"\n📤 Enviando actualización...")
    update_response = requests.put(
        f"{BASE_URL}/orders/{order_id}/",
        json=update_data,
        headers={'Content-Type': 'application/json'}
    )
    
    if update_response.status_code not in [200, 202]:
        print(f"❌ Error actualizando: {update_response.status_code}")
        print(f"   Response: {update_response.text}")
        return
    
    print("✅ Actualización exitosa")
    
    # 6. Verificar resultado
    updated_response = requests.get(f"{BASE_URL}/orders/{order_id}/")
    updated_detail = updated_response.json()
    
    print(f"\n📊 ESTADO FINAL - Pedido #{order_id}")
    print(f"   Items: {len(updated_detail.get('items', []))}")
    print(f"   Total: S/ {updated_detail.get('total_amount')}")
    
    final_total = Decimal(str(updated_detail.get('total_amount', 0)))
    
    print("\n   Detalle items:")
    total_calculado_manual = Decimal('0')
    for i, item in enumerate(updated_detail.get('items', [])):
        item_total = Decimal(str(item.get('total_price', 0)))
        total_calculado_manual += item_total
        print(f"   {i+1}. {item.get('recipe_name')} x{item.get('quantity')} = S/ {item_total}")
    
    # 7. Análisis de resultados
    print(f"\n🔍 ANÁLISIS DE RESULTADOS:")
    print(f"   Total inicial: S/ {initial_total}")
    print(f"   Total final: S/ {final_total}")
    print(f"   Diferencia: S/ {final_total - initial_total}")
    print(f"   Total esperado: S/ {expected_new_total}")
    print(f"   Total calculado manual: S/ {total_calculado_manual}")
    
    print(f"\n📋 VERIFICACIONES:")
    
    # Verificación 1: Items aumentaron
    if len(updated_detail.get('items', [])) > len(initial_detail.get('items', [])):
        print("   ✅ Items aumentaron correctamente")
    else:
        print("   ❌ Items NO aumentaron")
    
    # Verificación 2: Total aumentó
    if final_total > initial_total:
        print("   ✅ Total aumentó")
    else:
        print("   ❌ Total NO aumentó o disminuyó")
    
    # Verificación 3: Total coincide con esperado
    if abs(final_total - expected_new_total) < Decimal('0.01'):
        print("   ✅ Total coincide con esperado")
    else:
        print("   ❌ Total NO coincide con esperado")
    
    # Verificación 4: Total coincide con suma manual
    if abs(final_total - total_calculado_manual) < Decimal('0.01'):
        print("   ✅ Total coincide con suma manual")
    else:
        print("   ❌ Total NO coincide con suma manual")
    
    # Resultado final
    if (final_total > initial_total and 
        abs(final_total - expected_new_total) < Decimal('0.01') and
        abs(final_total - total_calculado_manual) < Decimal('0.01')):
        print(f"\n✅ TEST PASADO: Agregar items funciona correctamente")
        return True
    else:
        print(f"\n❌ TEST FALLIDO: Problema al agregar items a pedido existente")
        return False

if __name__ == "__main__":
    success = test_add_items_to_existing_order()
    exit(0 if success else 1)