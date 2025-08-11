#!/usr/bin/env python3
"""
VALIDACIÓN FINAL - VISTA GESTIÓN MESAS OPTIMIZADA
Verificar correcciones de cálculos y minimalismo
"""

import requests
import json
from decimal import Decimal
from datetime import datetime

BASE_URL = "https://www.xn--elfogndedonsoto-zrb.com/api/v1"

def test_calculation_fix():
    """Validar que los cálculos del backend estén corregidos"""
    print("🔧 VALIDACIÓN: Corrección cálculos backend")
    print("=" * 45)
    
    # Obtener una orden específica
    orders_response = requests.get(f"{BASE_URL}/orders/?status=CREATED")
    orders = orders_response.json()
    
    if not orders:
        print("❌ No hay órdenes para validar")
        return False
        
    order_id = orders[0]['id']
    print(f"🎯 Validando orden #{order_id}")
    
    # Obtener detalles
    order_response = requests.get(f"{BASE_URL}/orders/{order_id}/")
    order = order_response.json()
    
    # Validaciones críticas
    total_amount = Decimal(str(order.get('total_amount', 0)))
    grand_total = Decimal(str(order.get('grand_total', 0)))
    items_count = len(order.get('items', []))
    
    print(f"📊 Resultados:")
    print(f"   Items: {items_count}")
    print(f"   Total Amount: S/ {total_amount}")
    print(f"   Grand Total: S/ {grand_total}")
    
    # Criterios de validación
    validations = []
    
    # 1. total_amount no debe ser 0 si hay items
    if items_count > 0:
        validations.append(("Items con total > 0", total_amount > 0))
    
    # 2. grand_total debe ser >= total_amount
    validations.append(("Grand total >= Total", grand_total >= total_amount))
    
    # 3. Debe tener estructura completa
    required_fields = ['id', 'status', 'total_amount', 'grand_total', 'items']
    has_required = all(field in order for field in required_fields)
    validations.append(("Campos requeridos", has_required))
    
    print(f"\n✅ Validaciones:")
    all_passed = True
    for desc, result in validations:
        status = "✅" if result else "❌"
        print(f"   {status} {desc}")
        if not result:
            all_passed = False
    
    return all_passed

def test_minimalist_data_structure():
    """Validar que los datos sean mínimos pero completos"""
    print("\n🎨 VALIDACIÓN: Estructura minimalista")
    print("=" * 40)
    
    # Test endpoint de órdenes
    orders_response = requests.get(f"{BASE_URL}/orders/?status=CREATED")
    orders = orders_response.json()
    
    if not orders:
        print("ℹ️  No hay órdenes para validar estructura")
        return True
        
    order = orders[0]
    
    # Campos esenciales para frontend minimalista
    essential_fields = ['id', 'status', 'created_at', 'grand_total', 'items']
    optional_fields = ['table', 'table_number', 'waiter', 'total_amount']
    
    # Validar campos esenciales
    missing_essential = [f for f in essential_fields if f not in order]
    present_optional = [f for f in optional_fields if f in order]
    
    print(f"📋 Análisis Estructura:")
    print(f"   Campos esenciales: {len(essential_fields) - len(missing_essential)}/{len(essential_fields)}")
    print(f"   Campos opcionales presentes: {len(present_optional)}")
    
    if missing_essential:
        print(f"   ❌ Faltan esenciales: {missing_essential}")
        return False
    else:
        print(f"   ✅ Todos los campos esenciales presentes")
        return True

def test_table_status_accuracy():
    """Validar precisión de estados de mesa"""
    print("\n📊 VALIDACIÓN: Estados de mesa")
    print("=" * 35)
    
    # Obtener datos
    tables_response = requests.get(f"{BASE_URL}/tables/")
    orders_response = requests.get(f"{BASE_URL}/orders/?status=CREATED")
    
    tables = tables_response.json()
    orders = orders_response.json()
    
    # Calcular estados reales
    occupied_table_ids = set()
    for order in orders:
        table_ref = order.get('table')
        if isinstance(table_ref, dict) and 'id' in table_ref:
            occupied_table_ids.add(table_ref['id'])
        elif isinstance(table_ref, int):
            occupied_table_ids.add(table_ref)
    
    # Comparar con backend
    backend_occupied = [t['id'] for t in tables if t.get('has_active_orders')]
    
    print(f"📈 Comparación Estados:")
    print(f"   Real ocupadas: {len(occupied_table_ids)}")
    print(f"   Backend ocupadas: {len(backend_occupied)}")
    
    # Verificar consistencia
    real_set = set(occupied_table_ids)
    backend_set = set(backend_occupied)
    
    if real_set == backend_set:
        print(f"   ✅ Estados 100% consistentes")
        return True
    else:
        discrepancy = real_set.symmetric_difference(backend_set)
        print(f"   ❌ Discrepancia en mesas: {discrepancy}")
        return False

def test_performance_metrics():
    """Validar métricas de performance del sistema"""
    print("\n⚡ VALIDACIÓN: Performance y carga")
    print("=" * 38)
    
    import time
    
    # Medir tiempo de respuesta endpoints críticos
    endpoints = [
        ('/tables/', 'Mesas'),
        ('/orders/?status=CREATED', 'Órdenes activas'),
        ('/recipes/?is_active=true&is_available=true', 'Recetas disponibles'),
        ('/groups/', 'Grupos')
    ]
    
    performance_results = []
    
    for endpoint, name in endpoints:
        start_time = time.time()
        response = requests.get(f"{BASE_URL}{endpoint}")
        end_time = time.time()
        
        response_time = (end_time - start_time) * 1000  # ms
        data_size = len(response.content) if response.status_code == 200 else 0
        
        performance_results.append({
            'name': name,
            'response_time_ms': response_time,
            'data_size_bytes': data_size,
            'status_ok': response.status_code == 200
        })
        
        print(f"   {name}: {response_time:.0f}ms ({data_size} bytes)")
    
    # Criterios de performance
    avg_response_time = sum(r['response_time_ms'] for r in performance_results) / len(performance_results)
    all_endpoints_ok = all(r['status_ok'] for r in performance_results)
    
    print(f"\n📊 Métricas:")
    print(f"   Tiempo promedio: {avg_response_time:.0f}ms")
    print(f"   Todos endpoints OK: {'✅' if all_endpoints_ok else '❌'}")
    
    # Performance aceptable: < 500ms promedio
    return avg_response_time < 500 and all_endpoints_ok

def run_final_validation():
    """Ejecutar validación completa final"""
    print("🚀 VALIDACIÓN FINAL - SISTEMA OPTIMIZADO")
    print("=" * 50)
    
    results = []
    
    # Ejecutar todas las validaciones
    results.append(("Cálculos corregidos", test_calculation_fix()))
    results.append(("Estructura minimalista", test_minimalist_data_structure()))
    results.append(("Estados precisos", test_table_status_accuracy()))
    results.append(("Performance aceptable", test_performance_metrics()))
    
    print(f"\n📋 RESUMEN FINAL:")
    print("=" * 25)
    
    passed = 0
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
        if result:
            passed += 1
    
    print(f"\n🎯 SCORE: {passed}/{len(results)} ({passed/len(results)*100:.0f}%)")
    
    if passed == len(results):
        print("🎉 ¡SISTEMA COMPLETAMENTE VALIDADO!")
        return True
    else:
        print("⚠️  Requiere ajustes adicionales")
        return False

if __name__ == "__main__":
    success = run_final_validation()
    exit(0 if success else 1)