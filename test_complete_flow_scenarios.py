#!/usr/bin/env python3
"""
TEST DE FLUJOS COMPLETOS - GESTIÓN DE MESAS
Escenarios exhaustivos inicio a fin con validación de errores críticos
"""

import requests
import json
import time
from decimal import Decimal
from datetime import datetime

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

def scenario_1_complete_order_flow():
    """ESCENARIO 1: Flujo completo - Mesa vacía → Crear pedido → Agregar items → Guardar"""
    print_test("🔥 ESCENARIO 1: Flujo completo creación pedido", "INFO")
    print("=" * 60)
    
    try:
        # 1. Obtener mesas disponibles
        tables_response = requests.get(f"{BASE_URL}/tables/")
        tables = tables_response.json()
        
        # Buscar mesa sin pedidos
        orders_response = requests.get(f"{BASE_URL}/orders/?status=CREATED")
        orders = orders_response.json()
        occupied_table_ids = set()
        
        for order in orders:
            table_ref = order.get('table')
            if isinstance(table_ref, dict) and 'id' in table_ref:
                occupied_table_ids.add(table_ref['id'])
            elif isinstance(table_ref, int):
                occupied_table_ids.add(table_ref)
        
        available_tables = [t for t in tables if t['id'] not in occupied_table_ids]
        
        if not available_tables:
            print_test("No hay mesas disponibles", "WARNING")
            return None
            
        test_table = available_tables[0]
        print_test(f"Mesa seleccionada: {test_table['table_number']} (ID: {test_table['id']})", "PASS")
        
        # 2. Verificar estado inicial de mesa
        table_orders_response = requests.get(f"{BASE_URL}/tables/{test_table['id']}/active_orders/")
        initial_orders = table_orders_response.json()
        
        if len(initial_orders) > 0:
            print_test("Mesa tiene pedidos (error de consistencia)", "FAIL")
            return None
        else:
            print_test("Mesa confirmada vacía", "PASS")
        
        # 3. Obtener recetas disponibles
        recipes_response = requests.get(f"{BASE_URL}/recipes/?is_active=true&is_available=true")
        recipes = recipes_response.json()
        
        if len(recipes) < 2:
            print_test("Insuficientes recetas para test", "FAIL")
            return None
            
        print_test(f"Recetas disponibles: {len(recipes)}", "PASS")
        
        # 4. Crear pedido con múltiples items
        order_data = {
            "table": test_table['id'],
            "waiter": "TEST_FLOW",
            "items": [
                {
                    "recipe": recipes[0]['id'],
                    "quantity": 2,
                    "notes": "Sin cebolla",
                    "is_takeaway": False
                },
                {
                    "recipe": recipes[1]['id'],
                    "quantity": 1,
                    "notes": "",
                    "is_takeaway": True
                }
            ]
        }
        
        print_test("Creando pedido con 2 items...", "INFO")
        create_response = requests.post(
            f"{BASE_URL}/orders/",
            json=order_data,
            headers={'Content-Type': 'application/json'}
        )
        
        if create_response.status_code not in [200, 201]:
            print_test(f"Error creando pedido: {create_response.status_code}", "FAIL")
            print(f"   Response: {create_response.text}")
            return None
            
        created_order = create_response.json()
        order_id = created_order['id']
        print_test(f"Pedido creado exitosamente: #{order_id}", "PASS")
        
        # 5. Validar detalles del pedido
        detail_response = requests.get(f"{BASE_URL}/orders/{order_id}/")
        order_detail = detail_response.json()
        
        # Validar estructura
        validations = []
        validations.append(("Items count", len(order_detail.get('items', [])) == 2))
        validations.append(("Status CREATED", order_detail.get('status') == 'CREATED'))
        validations.append(("Mesa correcta", order_detail.get('table_number') == test_table['table_number']))
        
        # Validar cálculos
        expected_total = (
            Decimal(str(recipes[0]['base_price'])) * 2 +
            Decimal(str(recipes[1]['base_price'])) * 1
        )
        actual_total = Decimal(str(order_detail.get('total_amount', 0)))
        validations.append(("Cálculo total correcto", abs(actual_total - expected_total) < Decimal('0.01')))
        
        # Validar items individuales
        items = order_detail.get('items', [])
        if len(items) >= 2:
            validations.append(("Item 1 quantity", items[0].get('quantity') == 2))
            validations.append(("Item 1 notes", items[0].get('notes') == "Sin cebolla"))
            validations.append(("Item 2 takeaway", items[1].get('is_takeaway') == True))
        
        print("\n📊 Validaciones:")
        all_passed = True
        for desc, result in validations:
            status = "PASS" if result else "FAIL"
            print_test(f"   {desc}", status)
            if not result:
                all_passed = False
        
        # 6. Verificar estado de mesa actualizado
        table_orders_final = requests.get(f"{BASE_URL}/tables/{test_table['id']}/active_orders/")
        final_orders = table_orders_final.json()
        
        if len(final_orders) == 1 and final_orders[0]['id'] == order_id:
            print_test("Estado mesa actualizado correctamente", "PASS")
        else:
            print_test("Estado mesa no actualizado", "FAIL")
            all_passed = False
        
        # Limpiar
        try:
            delete_response = requests.delete(f"{BASE_URL}/orders/{order_id}/")
            if delete_response.status_code in [200, 204]:
                print_test("Pedido test eliminado", "PASS")
        except:
            pass
            
        return all_passed
        
    except Exception as e:
        print_test(f"Excepción en escenario: {e}", "FAIL")
        return False

def scenario_2_modify_existing_order():
    """ESCENARIO 2: Modificar pedido existente - Agregar/Eliminar items"""
    print_test("\n🔄 ESCENARIO 2: Modificar pedido existente", "INFO")
    print("=" * 50)
    
    try:
        # 1. Obtener un pedido existente
        orders_response = requests.get(f"{BASE_URL}/orders/?status=CREATED")
        orders = orders_response.json()
        
        if not orders:
            print_test("No hay pedidos para modificar", "WARNING")
            return True  # No es error
            
        test_order = orders[0]
        order_id = test_order['id']
        print_test(f"Modificando pedido #{order_id}", "INFO")
        
        # 2. Obtener detalles completos
        detail_response = requests.get(f"{BASE_URL}/orders/{order_id}/")
        if detail_response.status_code != 200:
            print_test("Error obteniendo detalles", "FAIL")
            return False
            
        order_detail = detail_response.json()
        original_items_count = len(order_detail.get('items', []))
        original_total = Decimal(str(order_detail.get('total_amount', 0)))
        
        print(f"   Items originales: {original_items_count}")
        print(f"   Total original: S/ {original_total}")
        
        # 3. Obtener recetas para agregar
        recipes_response = requests.get(f"{BASE_URL}/recipes/?is_active=true&is_available=true")
        recipes = recipes_response.json()
        
        if not recipes:
            print_test("No hay recetas disponibles", "FAIL")
            return False
        
        # 4. Preparar modificación - Mantener items existentes y agregar uno nuevo
        items_data = []
        
        # Mantener items existentes
        for item in order_detail.get('items', []):
            items_data.append({
                "recipe": item.get('recipe') if isinstance(item.get('recipe'), int) else item.get('recipe', {}).get('id'),
                "quantity": item.get('quantity', 1),
                "notes": item.get('notes', ''),
                "is_takeaway": item.get('is_takeaway', False),
                "has_taper": item.get('has_taper', False)
            })
        
        # Agregar nuevo item
        new_recipe = recipes[0]
        items_data.append({
            "recipe": new_recipe['id'],
            "quantity": 3,
            "notes": "Extra picante",
            "is_takeaway": False,
            "has_taper": False
        })
        
        update_data = {
            "items_data": items_data
        }
        
        print_test(f"Agregando 1 item nuevo (total items: {len(items_data)})", "INFO")
        
        # 5. Ejecutar actualización
        update_response = requests.put(
            f"{BASE_URL}/orders/{order_id}/",
            json=update_data,
            headers={'Content-Type': 'application/json'}
        )
        
        if update_response.status_code not in [200, 202]:
            print_test(f"Error actualizando: {update_response.status_code}", "FAIL")
            print(f"   Response: {update_response.text}")
            return False
        
        print_test("Pedido actualizado exitosamente", "PASS")
        
        # 6. Validar cambios
        updated_response = requests.get(f"{BASE_URL}/orders/{order_id}/")
        updated_order = updated_response.json()
        
        validations = []
        new_items_count = len(updated_order.get('items', []))
        new_total = Decimal(str(updated_order.get('total_amount', 0)))
        
        validations.append(("Items aumentados", new_items_count == original_items_count + 1))
        validations.append(("Total aumentado", new_total > original_total))
        
        # Buscar el nuevo item
        found_new_item = False
        for item in updated_order.get('items', []):
            if item.get('notes') == "Extra picante" and item.get('quantity') == 3:
                found_new_item = True
                break
                
        validations.append(("Nuevo item encontrado", found_new_item))
        
        print("\n📊 Validaciones modificación:")
        all_passed = True
        for desc, result in validations:
            status = "PASS" if result else "FAIL"
            print_test(f"   {desc}", status)
            if not result:
                all_passed = False
                
        print(f"   Nuevo total: S/ {new_total} (+{new_total - original_total})")
        
        return all_passed
        
    except Exception as e:
        print_test(f"Excepción en modificación: {e}", "FAIL")
        return False

def scenario_3_table_state_transitions():
    """ESCENARIO 3: Transiciones de estado mesa - Libre → Ocupada → Libre"""
    print_test("\n🔀 ESCENARIO 3: Transiciones estado mesa", "INFO")
    print("=" * 50)
    
    try:
        # 1. Encontrar mesa libre
        tables_response = requests.get(f"{BASE_URL}/tables/")
        orders_response = requests.get(f"{BASE_URL}/orders/?status=CREATED")
        
        tables = tables_response.json()
        orders = orders_response.json()
        
        occupied_ids = set()
        for order in orders:
            table_ref = order.get('table')
            if isinstance(table_ref, dict):
                occupied_ids.add(table_ref['id'])
            elif isinstance(table_ref, int):
                occupied_ids.add(table_ref)
        
        free_tables = [t for t in tables if t['id'] not in occupied_ids]
        
        if not free_tables:
            print_test("No hay mesas libres para test", "WARNING")
            return True
            
        test_table = free_tables[0]
        table_id = test_table['id']
        print_test(f"Mesa test: {test_table['table_number']} (ID: {table_id})", "INFO")
        
        # 2. Verificar estado inicial LIBRE
        if test_table.get('has_active_orders'):
            print_test("Mesa marcada ocupada incorrectamente", "FAIL")
            return False
        else:
            print_test("Estado inicial: LIBRE ✓", "PASS")
        
        # 3. Crear pedido → Mesa OCUPADA
        recipes_response = requests.get(f"{BASE_URL}/recipes/?is_active=true&is_available=true")
        recipes = recipes_response.json()
        
        order_data = {
            "table": table_id,
            "waiter": "TEST_STATES",
            "items": [{
                "recipe": recipes[0]['id'],
                "quantity": 1,
                "notes": "",
                "is_takeaway": False
            }]
        }
        
        create_response = requests.post(f"{BASE_URL}/orders/", json=order_data)
        if create_response.status_code not in [200, 201]:
            print_test("Error creando pedido", "FAIL")
            return False
            
        created_order = create_response.json()
        order_id = created_order['id']
        
        # 4. Verificar mesa ahora OCUPADA
        time.sleep(1)  # Dar tiempo al backend
        
        updated_table_response = requests.get(f"{BASE_URL}/tables/{table_id}/")
        updated_table = updated_table_response.json()
        
        if updated_table.get('has_active_orders'):
            print_test("Estado después crear: OCUPADA ✓", "PASS")
        else:
            print_test("Mesa no cambió a ocupada", "FAIL")
            return False
        
        # 5. Eliminar pedido → Mesa LIBRE
        delete_response = requests.delete(f"{BASE_URL}/orders/{order_id}/")
        if delete_response.status_code not in [200, 204]:
            print_test("Error eliminando pedido", "FAIL")
            return False
        
        time.sleep(1)  # Dar tiempo al backend
        
        # 6. Verificar mesa nuevamente LIBRE
        final_table_response = requests.get(f"{BASE_URL}/tables/{table_id}/")
        final_table = final_table_response.json()
        
        if not final_table.get('has_active_orders'):
            print_test("Estado después eliminar: LIBRE ✓", "PASS")
            return True
        else:
            print_test("Mesa sigue marcada ocupada", "FAIL")
            return False
            
    except Exception as e:
        print_test(f"Excepción en transiciones: {e}", "FAIL")
        return False

def scenario_4_concurrent_orders_same_table():
    """ESCENARIO 4: Múltiples pedidos en misma mesa - Acumulación correcta"""
    print_test("\n👥 ESCENARIO 4: Múltiples pedidos misma mesa", "INFO")
    print("=" * 50)
    
    try:
        # Usar mesa específica para test
        tables_response = requests.get(f"{BASE_URL}/tables/")
        tables = tables_response.json()
        
        if not tables:
            print_test("No hay mesas disponibles", "FAIL")
            return False
            
        test_table = tables[0]
        table_id = test_table['id']
        print_test(f"Mesa test: {test_table['table_number']}", "INFO")
        
        # Obtener recetas
        recipes_response = requests.get(f"{BASE_URL}/recipes/?is_active=true&is_available=true")
        recipes = recipes_response.json()
        
        created_order_ids = []
        total_expected = Decimal('0')
        
        # Crear 3 pedidos
        for i in range(3):
            order_data = {
                "table": table_id,
                "waiter": f"TEST_USER_{i+1}",
                "items": [{
                    "recipe": recipes[i % len(recipes)]['id'],
                    "quantity": i + 1,
                    "notes": f"Pedido {i+1}",
                    "is_takeaway": False
                }]
            }
            
            create_response = requests.post(f"{BASE_URL}/orders/", json=order_data)
            
            if create_response.status_code in [200, 201]:
                order = create_response.json()
                created_order_ids.append(order['id'])
                item_total = Decimal(str(recipes[i % len(recipes)]['base_price'])) * (i + 1)
                total_expected += item_total
                print_test(f"Pedido {i+1} creado: #{order['id']} (S/ {item_total})", "PASS")
            else:
                print_test(f"Error creando pedido {i+1}", "FAIL")
        
        if len(created_order_ids) != 3:
            print_test("No se crearon todos los pedidos", "FAIL")
            return False
        
        # Validar acumulación
        table_orders_response = requests.get(f"{BASE_URL}/tables/{table_id}/active_orders/")
        table_orders = table_orders_response.json()
        
        validations = []
        validations.append(("3 pedidos en mesa", len(table_orders) == 3))
        
        # Calcular total acumulado
        actual_total = Decimal('0')
        for order in table_orders:
            actual_total += Decimal(str(order.get('grand_total', 0) or order.get('total_amount', 0)))
        
        validations.append(("Total acumulado correcto", abs(actual_total - total_expected) < Decimal('0.01')))
        
        print(f"\n📊 Acumulación:")
        print(f"   Pedidos activos: {len(table_orders)}")
        print(f"   Total esperado: S/ {total_expected}")
        print(f"   Total real: S/ {actual_total}")
        
        all_passed = True
        for desc, result in validations:
            status = "PASS" if result else "FAIL"
            print_test(f"   {desc}", status)
            if not result:
                all_passed = False
        
        # Limpiar pedidos creados
        for order_id in created_order_ids:
            try:
                requests.delete(f"{BASE_URL}/orders/{order_id}/")
            except:
                pass
                
        return all_passed
        
    except Exception as e:
        print_test(f"Excepción en múltiples pedidos: {e}", "FAIL")
        return False

def scenario_5_error_handling():
    """ESCENARIO 5: Manejo de errores - Datos inválidos"""
    print_test("\n⚠️  ESCENARIO 5: Manejo de errores", "INFO")
    print("=" * 40)
    
    error_tests = []
    
    # Test 1: Crear pedido sin items
    try:
        tables_response = requests.get(f"{BASE_URL}/tables/")
        tables = tables_response.json()
        
        if tables:
            order_data = {
                "table": tables[0]['id'],
                "waiter": "ERROR_TEST",
                "items": []  # Sin items
            }
            
            response = requests.post(f"{BASE_URL}/orders/", json=order_data)
            
            if response.status_code >= 400:
                print_test("Rechaza pedido sin items ✓", "PASS")
                error_tests.append(True)
            else:
                print_test("Acepta pedido sin items (ERROR)", "FAIL")
                error_tests.append(False)
    except:
        error_tests.append(False)
    
    # Test 2: Actualizar pedido inexistente
    try:
        fake_order_id = 99999
        update_data = {"items_data": []}
        
        response = requests.put(f"{BASE_URL}/orders/{fake_order_id}/", json=update_data)
        
        if response.status_code == 404:
            print_test("Maneja pedido inexistente ✓", "PASS")
            error_tests.append(True)
        else:
            print_test("No detecta pedido inexistente", "FAIL")
            error_tests.append(False)
    except:
        error_tests.append(False)
    
    # Test 3: Recipe ID inválido
    try:
        if tables:
            order_data = {
                "table": tables[0]['id'],
                "waiter": "ERROR_TEST",
                "items": [{
                    "recipe": 99999,  # ID inválido
                    "quantity": 1,
                    "notes": "",
                    "is_takeaway": False
                }]
            }
            
            response = requests.post(f"{BASE_URL}/orders/", json=order_data)
            
            if response.status_code >= 400:
                print_test("Rechaza recipe inválido ✓", "PASS")
                error_tests.append(True)
            else:
                print_test("Acepta recipe inválido (ERROR)", "FAIL")
                error_tests.append(False)
    except:
        error_tests.append(False)
    
    return all(error_tests)

def run_complete_flow_tests():
    """Ejecutar todos los escenarios de flujo completo"""
    print(f"{Colors.BOLD}🚀 TESTS DE FLUJO COMPLETO - GESTIÓN MESAS{Colors.END}")
    print(f"{Colors.BOLD}Validación exhaustiva de escenarios inicio a fin{Colors.END}")
    print("=" * 80)
    
    start_time = time.time()
    
    # Ejecutar escenarios
    test_results = [
        ("Flujo creación completo", scenario_1_complete_order_flow()),
        ("Modificar pedido existente", scenario_2_modify_existing_order()),
        ("Transiciones estado mesa", scenario_3_table_state_transitions()),
        ("Múltiples pedidos concurrentes", scenario_4_concurrent_orders_same_table()),
        ("Manejo de errores", scenario_5_error_handling())
    ]
    
    end_time = time.time()
    execution_time = end_time - start_time
    
    # Resumen
    print(f"\n{Colors.BOLD}📋 RESUMEN TESTS DE FLUJO{Colors.END}")
    print("=" * 40)
    
    passed = 0
    failed = []
    
    for test_name, result in test_results:
        if result:
            print_test(f"✅ {test_name}", "PASS")
            passed += 1
        elif result is False:
            print_test(f"❌ {test_name}", "FAIL")
            failed.append(test_name)
        else:
            print_test(f"⚠️  {test_name} (skip)", "WARNING")
    
    score_percentage = (passed / len(test_results)) * 100
    
    print(f"\n🎯 SCORE: {passed}/{len(test_results)} ({score_percentage:.0f}%)")
    print(f"⏱️  Tiempo total: {execution_time:.1f}s")
    
    if failed:
        print(f"\n🚨 ESCENARIOS CON ERRORES:")
        for i, failure in enumerate(failed, 1):
            print(f"   {i}. {failure}")
        return False
    else:
        print(f"\n🎉 ¡TODOS LOS FLUJOS VALIDADOS!")
        print("✅ Sistema funcionando correctamente de inicio a fin")
        return True

if __name__ == "__main__":
    success = run_complete_flow_tests()
    exit(0 if success else 1)