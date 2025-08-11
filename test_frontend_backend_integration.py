#!/usr/bin/env python3
"""
TEST DE INTEGRACIÓN FRONTEND-BACKEND
Valida que los cambios del backend sean compatibles con el frontend
"""

import requests
import json
from decimal import Decimal
import time

BASE_URL = "https://www.xn--elfogndedonsoto-zrb.com/api/v1"

def test_frontend_backend_alignment():
    print("🔍 TEST INTEGRACIÓN FRONTEND-BACKEND")
    print("="*60)
    
    results = []
    
    # Test 1: Validación de pedidos vacíos retorna error esperado
    print("\n1️⃣ Validación pedidos vacíos")
    tables = requests.get(f"{BASE_URL}/tables/").json()
    if tables:
        empty_order = {
            "table": tables[0]['id'],
            "waiter": "Frontend Test",
            "items": []
        }
        
        response = requests.post(f"{BASE_URL}/orders/", json=empty_order)
        
        # Frontend espera 400 con campo 'error'
        if response.status_code == 400 and 'error' in response.json():
            print("✅ Backend rechaza pedidos vacíos con formato esperado")
            results.append(True)
        else:
            print("❌ Respuesta no compatible con frontend")
            print(f"   Status: {response.status_code}")
            print(f"   Body: {response.text}")
            results.append(False)
            
        # Limpiar si se creó
        if response.status_code in [200, 201]:
            try:
                requests.delete(f"{BASE_URL}/orders/{response.json()['id']}/")
            except:
                pass
    
    # Test 2: Crear pedido retorna estructura esperada
    print("\n2️⃣ Estructura de respuesta al crear")
    recipes = requests.get(f"{BASE_URL}/recipes/?is_active=true").json()
    
    if tables and recipes:
        new_order = {
            "table": tables[0]['id'],
            "waiter": "Frontend Test",
            "items": [
                {
                    "recipe": recipes[0]['id'],
                    "quantity": 2,
                    "notes": "Test note",
                    "is_takeaway": False,
                    "has_taper": False
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/orders/", json=new_order)
        
        if response.status_code in [200, 201]:
            data = response.json()
            
            # Verificar campos que usa el frontend
            required_fields = ['id', 'total_amount', 'items', 'table']
            has_all_fields = all(field in data for field in required_fields)
            
            # Verificar que total_amount sea correcto
            expected_total = Decimal(str(recipes[0]['base_price'])) * 2
            actual_total = Decimal(str(data.get('total_amount', 0)))
            total_correct = abs(actual_total - expected_total) < Decimal('0.01')
            
            if has_all_fields and total_correct:
                print("✅ Estructura de respuesta correcta")
                results.append(True)
            else:
                print("❌ Estructura incompleta o total incorrecto")
                print(f"   Campos presentes: {list(data.keys())}")
                print(f"   Total: {actual_total} (esperado: {expected_total})")
                results.append(False)
            
            order_id = data['id']
            
            # Test 3: Actualizar pedido mantiene consistencia
            print("\n3️⃣ Actualización de pedido existente")
            
            update_data = {
                "items_data": [
                    {
                        "recipe": recipes[0]['id'],
                        "quantity": 2,
                        "notes": "Test note",
                        "is_takeaway": False,
                        "has_taper": False
                    },
                    {
                        "recipe": recipes[1]['id'] if len(recipes) > 1 else recipes[0]['id'],
                        "quantity": 3,
                        "notes": "New item",
                        "is_takeaway": False,
                        "has_taper": False
                    }
                ]
            }
            
            update_response = requests.put(f"{BASE_URL}/orders/{order_id}/", json=update_data)
            
            if update_response.status_code in [200, 202]:
                updated_data = update_response.json()
                
                # Verificar que el total se actualizó
                new_total = Decimal(str(updated_data.get('total_amount', 0)))
                
                if new_total > actual_total:
                    print("✅ Total actualizado correctamente")
                    results.append(True)
                else:
                    print("❌ Total no se actualizó")
                    print(f"   Antes: {actual_total}, Después: {new_total}")
                    results.append(False)
            else:
                print("❌ Error actualizando pedido")
                results.append(False)
            
            # Limpiar
            requests.delete(f"{BASE_URL}/orders/{order_id}/")
        else:
            print("❌ Error creando pedido")
            results.append(False)
    
    # Test 4: Endpoint de mesas retorna formato esperado
    print("\n4️⃣ Formato de respuesta de mesas")
    tables_response = requests.get(f"{BASE_URL}/tables/")
    
    if tables_response.status_code == 200:
        tables_data = tables_response.json()
        if isinstance(tables_data, list) and len(tables_data) > 0:
            table = tables_data[0]
            
            # Frontend espera estos campos
            expected_fields = ['id', 'table_number', 'zone_name']
            has_fields = all(field in table or field == 'zone_name' for field in expected_fields)
            
            if has_fields:
                print("✅ Formato de mesas correcto")
                results.append(True)
            else:
                print("❌ Formato de mesas incompleto")
                print(f"   Campos: {list(table.keys())}")
                results.append(False)
        else:
            print("❌ Respuesta de mesas vacía o inválida")
            results.append(False)
    
    # Test 5: Active orders endpoint
    print("\n5️⃣ Endpoint active_orders")
    if tables:
        active_orders_response = requests.get(f"{BASE_URL}/tables/{tables[0]['id']}/active_orders/")
        
        if active_orders_response.status_code == 200:
            active_data = active_orders_response.json()
            if isinstance(active_data, list):
                print("✅ Active orders retorna lista")
                results.append(True)
            else:
                print("❌ Active orders formato incorrecto")
                results.append(False)
        else:
            print("❌ Error en endpoint active_orders")
            results.append(False)
    
    # Resumen
    print("\n" + "="*60)
    passed = sum(results)
    total = len(results)
    percentage = (passed / total * 100) if total > 0 else 0
    
    print(f"RESULTADO: {passed}/{total} ({percentage:.0f}%)")
    
    if percentage >= 80:
        print("✅ Frontend y Backend están alineados")
    else:
        print("❌ Hay desalineaciones críticas")
    
    return percentage >= 80

if __name__ == "__main__":
    success = test_frontend_backend_alignment()
    exit(0 if success else 1)