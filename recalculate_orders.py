#!/usr/bin/env python3
"""
Script para recalcular totales de órdenes existentes
Ejecutar una vez para corregir data inconsistente
"""

import requests
import json

BASE_URL = "https://www.xn--elfogndedonsoto-zrb.com/api/v1"

def trigger_recalculation():
    """Disparar recálculo haciendo una actualización mínima a cada orden"""
    print("🔄 RECALCULANDO TOTALES DE ÓRDENES")
    print("=" * 40)
    
    # Obtener todas las órdenes activas
    orders_response = requests.get(f"{BASE_URL}/orders/?status=CREATED")
    
    if orders_response.status_code != 200:
        print(f"❌ Error obteniendo órdenes: {orders_response.status_code}")
        return False
        
    orders = orders_response.json()
    print(f"📋 Órdenes a recalcular: {len(orders)}")
    
    recalculated = 0
    errors = 0
    
    for order in orders:
        order_id = order['id']
        current_total = float(order.get('total_amount', 0))
        current_grand = float(order.get('grand_total', 0))
        
        print(f"\n🎯 Orden #{order_id}:")
        print(f"   Total actual: S/ {current_total}")
        print(f"   Grand actual: S/ {current_grand}")
        
        # Si el total es 0 pero hay items, necesita recálculo
        items_count = len(order.get('items', []))
        if current_total == 0 and items_count > 0:
            print(f"   ⚠️  Requiere recálculo ({items_count} items)")
            
            # Hacer una actualización mínima para disparar recálculo
            # Solo actualizamos un campo que no afecte funcionalmente
            update_data = {
                "waiter": order.get('waiter', 'Sistema')  # Mantener el mismo waiter
            }
            
            try:
                update_response = requests.patch(
                    f"{BASE_URL}/orders/{order_id}/",
                    json=update_data,
                    headers={'Content-Type': 'application/json'}
                )
                
                if update_response.status_code in [200, 202]:
                    print(f"   ✅ Recálculo disparado")
                    recalculated += 1
                    
                    # Verificar resultado
                    check_response = requests.get(f"{BASE_URL}/orders/{order_id}/")
                    if check_response.status_code == 200:
                        updated_order = check_response.json()
                        new_total = float(updated_order.get('total_amount', 0))
                        new_grand = float(updated_order.get('grand_total', 0))
                        print(f"   📊 Nuevo total: S/ {new_total}")
                        print(f"   📊 Nuevo grand: S/ {new_grand}")
                else:
                    print(f"   ❌ Error en actualización: {update_response.status_code}")
                    errors += 1
                    
            except Exception as e:
                print(f"   ❌ Excepción: {e}")
                errors += 1
        else:
            print(f"   ✅ Ya está correcto")
    
    print(f"\n📊 RESUMEN:")
    print(f"   Recalculadas: {recalculated}")
    print(f"   Errores: {errors}")
    print(f"   Total procesadas: {len(orders)}")
    
    return errors == 0

if __name__ == "__main__":
    success = trigger_recalculation()
    print(f"\n🎯 {'✅ ÉXITO' if success else '❌ CON ERRORES'}")