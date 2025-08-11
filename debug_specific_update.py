#!/usr/bin/env python3
"""
DEBUG ESPECÍFICO - Problema actualización que no cambia total
"""

import requests
import json
from decimal import Decimal

BASE_URL = "https://www.xn--elfogndedonsoto-zrb.com/api/v1"

def debug_specific_update():
    print("🔍 DEBUG ESPECÍFICO: Actualización sin cambio de total")
    print("=" * 60)
    
    # Usar orden específica del test que falló
    order_id = 29  # Esta fue la que falló en el test
    
    # Obtener estado actual
    before_response = requests.get(f"{BASE_URL}/orders/{order_id}/")
    if before_response.status_code != 200:
        print(f"❌ No se puede obtener orden #{order_id}")
        return
        
    before_order = before_response.json()
    print(f"📊 Orden #{order_id} ANTES:")
    print(f"   Items: {len(before_order.get('items', []))}")
    print(f"   total_amount: {before_order.get('total_amount')}")
    print(f"   grand_total: {before_order.get('grand_total')}")
    
    current_items = before_order.get('items', [])
    for i, item in enumerate(current_items):
        print(f"   Item {i+1}: {item.get('recipe_name')} x{item.get('quantity')} = S/ {item.get('total_price')}")
    
    # Obtener una receta nueva
    recipes_response = requests.get(f"{BASE_URL}/recipes/?is_active=true&is_available=true")
    recipes = recipes_response.json()
    
    # Usar una receta diferente a las existentes
    existing_recipe_ids = [
        item.get('recipe') if isinstance(item.get('recipe'), int) 
        else item.get('recipe', {}).get('id') 
        for item in current_items
    ]
    
    new_recipe = None
    for recipe in recipes:
        if recipe['id'] not in existing_recipe_ids:
            new_recipe = recipe
            break
    
    if not new_recipe:
        print("❌ No hay recetas nuevas para agregar")
        return
    
    print(f"\n➕ Agregando receta NUEVA: {new_recipe['name']} (S/ {new_recipe['base_price']})")
    
    # Preparar items_data manteniendo existentes + nueva
    items_data = []
    
    # Mantener items existentes
    for item in current_items:
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
    
    # Agregar nueva receta
    items_data.append({
        "recipe": new_recipe['id'],
        "quantity": 1,
        "notes": "DEBUG - Nueva receta",
        "is_takeaway": False,
        "has_taper": False
    })
    
    update_data = {
        "items_data": items_data
    }
    
    print(f"\n📤 Enviando actualización:")
    print(f"   Items antes: {len(current_items)}")
    print(f"   Items después: {len(items_data)}")
    print(f"   Nueva receta ID: {new_recipe['id']}")
    
    # Ejecutar actualización
    update_response = requests.put(
        f"{BASE_URL}/orders/{order_id}/",
        json=update_data,
        headers={'Content-Type': 'application/json'}
    )
    
    print(f"\n📥 Respuesta: {update_response.status_code}")
    if update_response.status_code not in [200, 202]:
        print(f"❌ Error: {update_response.text}")
        return
    
    # Verificar resultado
    after_response = requests.get(f"{BASE_URL}/orders/{order_id}/")
    after_order = after_response.json()
    
    print(f"\n📊 Orden #{order_id} DESPUÉS:")
    print(f"   Items: {len(after_order.get('items', []))}")
    print(f"   total_amount: {after_order.get('total_amount')}")
    print(f"   grand_total: {after_order.get('grand_total')}")
    
    new_items = after_order.get('items', [])
    for i, item in enumerate(new_items):
        print(f"   Item {i+1}: {item.get('recipe_name')} x{item.get('quantity')} = S/ {item.get('total_price')}")
    
    # Análisis
    before_total = Decimal(str(before_order.get('total_amount', 0)))
    after_total = Decimal(str(after_order.get('total_amount', 0)))
    expected_increase = Decimal(str(new_recipe['base_price']))
    
    print(f"\n🔍 ANÁLISIS DETALLADO:")
    print(f"   Total antes: S/ {before_total}")
    print(f"   Total después: S/ {after_total}")
    print(f"   Diferencia real: S/ {after_total - before_total}")
    print(f"   Diferencia esperada: S/ {expected_increase}")
    print(f"   Items antes: {len(current_items)}")
    print(f"   Items después: {len(new_items)}")
    
    # Calcular manualmente el total esperado
    manual_total = Decimal('0')
    for item in new_items:
        item_total = Decimal(str(item.get('total_price', 0)))
        manual_total += item_total
    
    print(f"   Total calculado manual: S/ {manual_total}")
    
    if after_total == manual_total:
        print("   ✅ Backend calculó correctamente")
    else:
        print("   ❌ Error en cálculo backend")
    
    if len(new_items) > len(current_items):
        print("   ✅ Items se agregaron")
    else:
        print("   ❌ Items no se agregaron")
    
    if after_total > before_total:
        print("   ✅ Total aumentó")
    else:
        print("   ❌ Total NO aumentó - PROBLEMA DETECTADO!")

if __name__ == "__main__":
    debug_specific_update()