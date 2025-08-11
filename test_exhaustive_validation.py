#!/usr/bin/env python3
"""
VALIDACIÓN EXHAUSTIVA - VISTA GESTIÓN MESAS
Escenarios críticos de inicio a fin para identificar errores
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

def test_1_initial_load():
    """ESCENARIO 1: Carga inicial - validar todos los endpoints críticos"""
    print_test("🚀 ESCENARIO 1: Carga inicial del sistema", "INFO")
    print("=" * 60)
    
    errors = []
    performance_issues = []
    
    # Endpoints críticos que debe cargar el frontend
    endpoints = [
        ('/tables/', 'Mesas'),
        ('/recipes/?is_active=true&is_available=true', 'Recetas activas'),
        ('/containers/?is_active=true', 'Envases activos'),
        ('/groups/', 'Grupos de recetas'),
        ('/orders/?status=CREATED', 'Órdenes activas')
    ]
    
    for endpoint, name in endpoints:
        try:
            start_time = time.time()
            response = requests.get(f"{BASE_URL}{endpoint}")
            end_time = time.time()
            
            response_time = (end_time - start_time) * 1000
            
            if response.status_code != 200:
                errors.append(f"{name}: HTTP {response.status_code}")
                print_test(f"{name}: ERROR {response.status_code}", "FAIL")
                continue
                
            data = response.json()
            
            # Validar estructura básica
            if not isinstance(data, list):
                errors.append(f"{name}: No es lista")
                print_test(f"{name}: Estructura incorrecta", "FAIL")
                continue
                
            # Performance check
            if response_time > 1000:  # > 1 segundo es crítico
                performance_issues.append(f"{name}: {response_time:.0f}ms")
                print_test(f"{name}: LENTO ({response_time:.0f}ms)", "WARNING")
            else:
                print_test(f"{name}: OK ({response_time:.0f}ms, {len(data)} items)", "PASS")
                
        except Exception as e:
            errors.append(f"{name}: Exception {e}")
            print_test(f"{name}: EXCEPCIÓN {e}", "FAIL")
    
    print(f"\n📊 Resultado Escenario 1:")
    print(f"   Errores críticos: {len(errors)}")
    print(f"   Problemas performance: {len(performance_issues)}")
    
    if errors:
        print("   ❌ ERRORES ENCONTRADOS:")
        for error in errors:
            print(f"     - {error}")
    
    return len(errors) == 0

def test_2_table_status_consistency():
    """ESCENARIO 2: Consistencia estados mesa - backend vs datos reales"""
    print_test("\n🎯 ESCENARIO 2: Consistencia estados mesa", "INFO")
    print("=" * 50)
    
    try:
        # Obtener datos
        tables_response = requests.get(f"{BASE_URL}/tables/")
        orders_response = requests.get(f"{BASE_URL}/orders/?status=CREATED")
        
        if tables_response.status_code != 200 or orders_response.status_code != 200:
            print_test("Error obteniendo datos básicos", "FAIL")
            return False
            
        tables = tables_response.json()
        orders = orders_response.json()
        
        # Calcular estados reales basados en órdenes
        occupied_table_ids = set()
        table_order_count = {}
        
        for order in orders:
            table_ref = order.get('table')
            table_id = None
            
            if isinstance(table_ref, dict) and 'id' in table_ref:
                table_id = table_ref['id']
            elif isinstance(table_ref, int):
                table_id = table_ref
                
            if table_id:
                occupied_table_ids.add(table_id)
                table_order_count[table_id] = table_order_count.get(table_id, 0) + 1
        
        # Validar consistencia con backend
        backend_discrepancies = []
        data_issues = []
        
        for table in tables:
            table_id = table['id']
            table_number = table.get('table_number', 'N/A')
            
            # Estados calculados vs backend
            real_occupied = table_id in occupied_table_ids
            backend_occupied = table.get('has_active_orders', False)
            
            if real_occupied != backend_occupied:
                backend_discrepancies.append({
                    'table': table_number,
                    'real': 'ocupada' if real_occupied else 'libre',
                    'backend': 'ocupada' if backend_occupied else 'libre'
                })
            
            # Validar estructura datos mesa
            required_fields = ['id', 'table_number']
            missing_fields = [f for f in required_fields if f not in table or table[f] is None]
            if missing_fields:
                data_issues.append(f"Mesa {table_number}: faltan campos {missing_fields}")
            
            # Validar zona
            if not table.get('zone_name') and not table.get('zone', {}).get('name'):
                data_issues.append(f"Mesa {table_number}: sin zona asignada")
        
        print(f"📈 Análisis estados:")
        print(f"   Total mesas: {len(tables)}")
        print(f"   Mesas ocupadas (real): {len(occupied_table_ids)}")
        print(f"   Total órdenes activas: {len(orders)}")
        
        if backend_discrepancies:
            print_test(f"INCONSISTENCIAS ESTADOS: {len(backend_discrepancies)}", "FAIL")
            for disc in backend_discrepancies[:3]:  # Mostrar solo primeras 3
                print(f"     Mesa {disc['table']}: Real={disc['real']} vs Backend={disc['backend']}")
        else:
            print_test("Estados 100% consistentes", "PASS")
            
        if data_issues:
            print_test(f"PROBLEMAS DATOS: {len(data_issues)}", "FAIL") 
            for issue in data_issues[:3]:  # Mostrar solo primeros 3
                print(f"     {issue}")
        else:
            print_test("Estructura datos correcta", "PASS")
        
        return len(backend_discrepancies) == 0 and len(data_issues) == 0
        
    except Exception as e:
        print_test(f"Excepción en test: {e}", "FAIL")
        return False

def test_3_order_creation_flow():
    """ESCENARIO 3: Flujo creación pedido completo"""
    print_test("\n📝 ESCENARIO 3: Creación pedido end-to-end", "INFO")
    print("=" * 50)
    
    try:
        # 1. Obtener mesa libre
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
            print_test("No hay mesas disponibles para test", "WARNING")
            return True  # No es error crítico
            
        test_table = available_tables[0]
        print(f"🎯 Usando mesa: {test_table['table_number']} (ID: {test_table['id']})")
        
        # 2. Obtener recetas disponibles
        recipes_response = requests.get(f"{BASE_URL}/recipes/?is_active=true&is_available=true")
        recipes = recipes_response.json()
        
        if not recipes:
            print_test("No hay recetas disponibles", "FAIL")
            return False
            
        # Usar primera receta disponible
        test_recipe = recipes[0]
        print(f"🍽️ Usando receta: {test_recipe['name']} (S/ {test_recipe['base_price']})")
        
        # 3. Crear pedido
        order_data = {
            "table": test_table['id'],
            "waiter": "TEST_USER",
            "items": [
                {
                    "recipe": test_recipe['id'],
                    "quantity": 2,
                    "notes": "Test order",
                    "is_takeaway": False
                }
            ]
        }
        
        print("📤 Creando pedido...")
        create_response = requests.post(
            f"{BASE_URL}/orders/",
            json=order_data,
            headers={'Content-Type': 'application/json'}
        )
        
        if create_response.status_code not in [200, 201]:
            print_test(f"Error creando pedido: {create_response.status_code}", "FAIL")
            print(f"   Response: {create_response.text}")
            return False
            
        created_order = create_response.json()
        order_id = created_order['id']
        print_test(f"Pedido creado: #{order_id}", "PASS")
        
        # 4. Validar pedido creado
        detail_response = requests.get(f"{BASE_URL}/orders/{order_id}/")
        if detail_response.status_code != 200:
            print_test("Error obteniendo detalles del pedido", "FAIL")
            return False
            
        order_detail = detail_response.json()
        
        # Validaciones críticas
        validations = []
        
        # Validar items
        expected_items = 1
        actual_items = len(order_detail.get('items', []))
        validations.append(("Items count", actual_items == expected_items))
        
        # Validar total > 0
        total_amount = float(order_detail.get('total_amount', 0))
        grand_total = float(order_detail.get('grand_total', 0))
        expected_total = float(test_recipe['base_price']) * 2
        
        validations.append(("Total amount > 0", total_amount > 0))
        validations.append(("Grand total > 0", grand_total > 0))
        validations.append(("Cálculo correcto", abs(total_amount - expected_total) < 0.01))
        
        # Validar estado
        validations.append(("Status CREATED", order_detail.get('status') == 'CREATED'))
        
        # Validar mesa asignada
        order_table = order_detail.get('table')
        table_id_matches = False
        if isinstance(order_table, dict):
            table_id_matches = order_table.get('id') == test_table['id']
        elif isinstance(order_table, int):
            table_id_matches = order_table == test_table['id']
            
        validations.append(("Mesa asignada correctamente", table_id_matches))
        
        print("\n✅ Validaciones pedido:")
        all_passed = True
        for desc, result in validations:
            status = "PASS" if result else "FAIL"
            print_test(f"   {desc}", status)
            if not result:
                all_passed = False
        
        # 5. Limpiar - eliminar pedido test
        try:
            delete_response = requests.delete(f"{BASE_URL}/orders/{order_id}/")
            if delete_response.status_code in [200, 204]:
                print_test("Pedido test eliminado correctamente", "PASS")
            else:
                print_test("WARNING: No se pudo eliminar pedido test", "WARNING")
        except:
            print_test("WARNING: Error eliminando pedido test", "WARNING")
            
        return all_passed
        
    except Exception as e:
        print_test(f"Excepción en test creación: {e}", "FAIL")
        return False

def test_4_order_calculation_accuracy():
    """ESCENARIO 4: Precisión cálculos pedidos existentes"""
    print_test("\n🧮 ESCENARIO 4: Precisión cálculos pedidos", "INFO")
    print("=" * 50)
    
    try:
        # Obtener órdenes activas
        orders_response = requests.get(f"{BASE_URL}/orders/?status=CREATED")
        orders = orders_response.json()
        
        if not orders:
            print_test("No hay órdenes para validar cálculos", "WARNING")
            return True
            
        calculation_errors = []
        
        for order in orders[:3]:  # Validar primeras 3 órdenes
            order_id = order['id']
            
            # Obtener detalles completos
            detail_response = requests.get(f"{BASE_URL}/orders/{order_id}/")
            if detail_response.status_code != 200:
                calculation_errors.append(f"Orden #{order_id}: No se pudo obtener detalles")
                continue
                
            order_detail = detail_response.json()
            
            # Extraer valores
            backend_total = Decimal(str(order_detail.get('total_amount', 0)))
            backend_grand = Decimal(str(order_detail.get('grand_total', 0)))
            backend_containers = Decimal(str(order_detail.get('containers_total', 0)))
            
            # Calcular manual items
            manual_items_total = Decimal('0')
            items = order_detail.get('items', [])
            
            for item in items:
                item_total = Decimal(str(item.get('total_price', 0)))
                manual_items_total += item_total
            
            # Calcular manual containers  
            manual_containers_total = Decimal('0')
            containers = order_detail.get('container_sales', [])
            
            for container in containers:
                container_total = Decimal(str(container.get('total_price', 0)))
                manual_containers_total += container_total
            
            # Validaciones
            errors_this_order = []
            
            if backend_total != manual_items_total:
                errors_this_order.append(f"Items: Backend={backend_total} vs Manual={manual_items_total}")
                
            if backend_containers != manual_containers_total:
                errors_this_order.append(f"Containers: Backend={backend_containers} vs Manual={manual_containers_total}")
                
            expected_grand = manual_items_total + manual_containers_total
            if backend_grand != expected_grand:
                errors_this_order.append(f"Grand total: Backend={backend_grand} vs Expected={expected_grand}")
            
            if errors_this_order:
                calculation_errors.extend([f"Orden #{order_id}: {error}" for error in errors_this_order])
                print_test(f"Orden #{order_id}: ERRORES CÁLCULO", "FAIL")
            else:
                print_test(f"Orden #{order_id}: Cálculos correctos", "PASS")
        
        if calculation_errors:
            print_test(f"ERRORES CÁLCULO ENCONTRADOS: {len(calculation_errors)}", "FAIL")
            for error in calculation_errors[:5]:  # Mostrar solo primeros 5
                print(f"   {error}")
            return False
        else:
            print_test("Todos los cálculos son precisos", "PASS")
            return True
            
    except Exception as e:
        print_test(f"Excepción en test cálculos: {e}", "FAIL")
        return False

def test_5_recipe_group_filters():
    """ESCENARIO 5: Filtros grupos recetas funcionando"""
    print_test("\n🔍 ESCENARIO 5: Filtros grupos recetas", "INFO")
    print("=" * 45)
    
    try:
        # Obtener todas las recetas y grupos
        recipes_response = requests.get(f"{BASE_URL}/recipes/?is_active=true&is_available=true")
        groups_response = requests.get(f"{BASE_URL}/groups/")
        
        if recipes_response.status_code != 200 or groups_response.status_code != 200:
            print_test("Error obteniendo recetas/grupos", "FAIL")
            return False
            
        recipes = recipes_response.json()
        groups = groups_response.json()
        
        filter_issues = []
        
        # Validar que cada receta tenga grupo asignado
        recipes_without_group = [r for r in recipes if not r.get('group')]
        if recipes_without_group:
            filter_issues.append(f"{len(recipes_without_group)} recetas sin grupo")
        
        # Validar que grupos referenciados existen
        referenced_group_ids = set()
        for recipe in recipes:
            if recipe.get('group') and isinstance(recipe['group'], dict):
                referenced_group_ids.add(recipe['group']['id'])
        
        existing_group_ids = {g['id'] for g in groups}
        orphaned_references = referenced_group_ids - existing_group_ids
        
        if orphaned_references:
            filter_issues.append(f"Referencias grupos inexistentes: {orphaned_references}")
        
        # Validar estructura grupo en recetas
        for recipe in recipes:
            if recipe.get('group'):
                group_obj = recipe['group']
                if not isinstance(group_obj, dict) or 'id' not in group_obj or 'name' not in group_obj:
                    filter_issues.append(f"Receta {recipe['name']}: estructura grupo incorrecta")
        
        print(f"📊 Análisis filtros:")
        print(f"   Total recetas: {len(recipes)}")
        print(f"   Total grupos: {len(groups)}")
        print(f"   Recetas con grupo: {len(recipes) - len(recipes_without_group)}")
        
        if filter_issues:
            print_test(f"PROBLEMAS FILTROS: {len(filter_issues)}", "FAIL")
            for issue in filter_issues:
                print(f"   {issue}")
            return False
        else:
            print_test("Filtros grupos funcionando correctamente", "PASS")
            return True
            
    except Exception as e:
        print_test(f"Excepción en test filtros: {e}", "FAIL")
        return False

def run_exhaustive_validation():
    """Ejecutar toda la batería de tests exhaustivos"""
    print(f"{Colors.BOLD}🚀 VALIDACIÓN EXHAUSTIVA - GESTIÓN MESAS{Colors.END}")
    print(f"{Colors.BOLD}Identificación errores críticos inicio a fin{Colors.END}")
    print("=" * 80)
    
    start_time = time.time()
    
    # Ejecutar todos los escenarios
    test_results = [
        ("Carga inicial endpoints", test_1_initial_load()),
        ("Consistencia estados mesa", test_2_table_status_consistency()),
        ("Creación pedido completa", test_3_order_creation_flow()),
        ("Precisión cálculos", test_4_order_calculation_accuracy()),
        ("Filtros grupos recetas", test_5_recipe_group_filters())
    ]
    
    end_time = time.time()
    execution_time = end_time - start_time
    
    # Resultados finales
    print(f"\n{Colors.BOLD}📋 RESUMEN VALIDACIÓN EXHAUSTIVA{Colors.END}")
    print("=" * 50)
    
    passed = 0
    critical_failures = []
    
    for test_name, result in test_results:
        if result:
            print_test(f"✅ {test_name}", "PASS")
            passed += 1
        else:
            print_test(f"❌ {test_name}", "FAIL")
            critical_failures.append(test_name)
    
    score_percentage = (passed / len(test_results)) * 100
    
    print(f"\n🎯 SCORE FINAL: {passed}/{len(test_results)} ({score_percentage:.0f}%)")
    print(f"⏱️  Tiempo ejecución: {execution_time:.1f}s")
    
    if critical_failures:
        print(f"\n🚨 ERRORES CRÍTICOS IDENTIFICADOS:")
        for i, failure in enumerate(critical_failures, 1):
            print(f"   {i}. {failure}")
        print(f"\n⚠️  ACCIÓN REQUERIDA: Corregir {len(critical_failures)} problemas críticos")
        return False
    else:
        print(f"\n🎉 ¡SISTEMA VALIDADO COMPLETAMENTE!")
        print("✅ No se encontraron errores críticos")
        return True

if __name__ == "__main__":
    success = run_exhaustive_validation()
    exit(0 if success else 1)