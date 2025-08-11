#!/usr/bin/env python3
"""
DEBUG - Problema actualización de órdenes
Analizar paso a paso qué está pasando
"""

import requests
import json
from decimal import Decimal

BASE_URL = "https://www.xn--elfogndedonsoto-zrb.com/api/v1"

def debug_order_update():
    print("🔍 DEBUG: Problema actualización órdenes")
    print("=" * 50)
    
    # 1. Obtener una orden existente
    orders_response = requests.get(f"{BASE_URL}/orders/?status=CREATED")
    orders = orders_response.json()
    
    if not orders:
        print("❌ No hay órdenes para testear")
        return
        
    test_order = orders[0]
    order_id = test_order['id']
    
    print(f"📋 Usando orden #{order_id}")
    
    # 2. Obtener detalles completos ANTES
    before_response = requests.get(f"{BASE_URL}/orders/{order_id}/")
    before_order = before_response.json()
    
    print(f"\n📊 ANTES de la actualización:")
    print(f"   Items: {len(before_order.get('items', []))}")
    print(f"   total_amount: {before_order.get('total_amount')}")
    print(f"   grand_total: {before_order.get('grand_total')}")
    
    # Mostrar items individuales
    for i, item in enumerate(before_order.get('items', [])):
        print(f"   Item {i+1}: {item.get('recipe_name')} x{item.get('quantity')} = S/ {item.get('total_price')}")
    
    # 3. Obtener una receta para agregar
    recipes_response = requests.get(f"{BASE_URL}/recipes/?is_active=true&is_available=true")
    recipes = recipes_response.json()
    
    if not recipes:
        print("❌ No hay recetas disponibles")
        return
    
    new_recipe = recipes[0]
    print(f"\n➕ Agregando: {new_recipe['name']} x2 (S/ {new_recipe['base_price']} c/u)")
    
    # 4. Preparar datos de actualización
    items_data = []
    
    # Mantener items existentes
    for item in before_order.get('items', []):
        recipe_id = item.get('recipe')
        if isinstance(recipe_id, dict):
            recipe_id = recipe_id.get('id')
        
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
        "quantity": 2,
        "notes": "Item agregado en test",
        "is_takeaway": False,
        "has_taper": False
    })
    
    update_data = {
        "items_data": items_data
    }
    
    print(f"\n📤 Enviando actualización con {len(items_data)} items")
    print(f"   Data: {json.dumps(update_data, indent=2)}")
    
    # 5. Ejecutar actualización
    update_response = requests.put(
        f"{BASE_URL}/orders/{order_id}/",
        json=update_data,
        headers={'Content-Type': 'application/json'}
    )
    
    print(f"\n📥 Respuesta actualización: {update_response.status_code}")
    
    if update_response.status_code not in [200, 202]:
        print(f"❌ Error: {update_response.text}")
        return
    
    # 6. Obtener detalles DESPUÉS
    after_response = requests.get(f"{BASE_URL}/orders/{order_id}/")
    after_order = after_response.json()
    
    print(f"\n📊 DESPUÉS de la actualización:")
    print(f"   Items: {len(after_order.get('items', []))}")
    print(f"   total_amount: {after_order.get('total_amount')}")
    print(f"   grand_total: {after_order.get('grand_total')}")
    
    # Mostrar items individuales
    for i, item in enumerate(after_order.get('items', [])):
        print(f"   Item {i+1}: {item.get('recipe_name')} x{item.get('quantity')} = S/ {item.get('total_price')}")
    
    # 7. Comparar y analizar
    before_total = Decimal(str(before_order.get('total_amount', 0)))
    after_total = Decimal(str(after_order.get('total_amount', 0)))
    expected_increase = Decimal(str(new_recipe['base_price'])) * 2
    
    print(f"\n🔍 ANÁLISIS:")
    print(f"   Total antes: S/ {before_total}")
    print(f"   Total después: S/ {after_total}")
    print(f"   Diferencia: S/ {after_total - before_total}")
    print(f"   Esperado aumento: S/ {expected_increase}")
    print(f"   Items antes: {len(before_order.get('items', []))}")
    print(f"   Items después: {len(after_order.get('items', []))}")
    
    # Validaciones
    items_increased = len(after_order.get('items', [])) > len(before_order.get('items', []))
    total_increased = after_total > before_total
    
    print(f"\n✅ VALIDACIONES:")
    print(f"   Items aumentaron: {'✅' if items_increased else '❌'}")
    print(f"   Total aumentó: {'✅' if total_increased else '❌'}")
    
    if not items_increased or not total_increased:
        print(f"\n🚨 PROBLEMA DETECTADO:")
        if not items_increased:
            print("   - Los items no aumentaron correctamente")
        if not total_increased:
            print("   - El total no se recalculó correctamente")
    else:
        print(f"\n🎉 Actualización funcionando correctamente")

if __name__ == "__main__":
    debug_order_update()