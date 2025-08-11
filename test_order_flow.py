#!/usr/bin/env python3
"""
Test script para validar flujo completo de órdenes
Auditoría práctica del sistema de gestión de mesas
"""

import requests
import json
from datetime import datetime

# Configuración
BASE_URL = "https://www.xn--elfogndedonsoto-zrb.com/api/v1"
HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
}

def test_api_endpoint(endpoint, method='GET', data=None):
    """Test individual endpoint"""
    try:
        url = f"{BASE_URL}{endpoint}"
        print(f"🔍 Testing {method} {url}")
        
        if method == 'GET':
            response = requests.get(url, headers=HEADERS, timeout=10)
        elif method == 'POST':
            response = requests.post(url, headers=HEADERS, json=data, timeout=10)
        elif method == 'PUT':
            response = requests.put(url, headers=HEADERS, json=data, timeout=10)
            
        print(f"   Status: {response.status_code}")
        
        if response.status_code < 400:
            result = response.json()
            if isinstance(result, list):
                print(f"   Items: {len(result)}")
            elif isinstance(result, dict):
                print(f"   Keys: {list(result.keys())[:5]}")
            return True, result
        else:
            print(f"   Error: {response.text[:200]}")
            return False, response.text
            
    except Exception as e:
        print(f"   Exception: {e}")
        return False, str(e)

def audit_system():
    """Auditoría completa del sistema"""
    print("🚀 AUDITORÍA SISTEMA GESTIÓN MESAS")
    print("=" * 50)
    
    results = {
        'endpoints': {},
        'data_integrity': {},
        'business_logic': {}
    }
    
    # 1. Test endpoints básicos
    print("\n📋 1. VALIDACIÓN ENDPOINTS BÁSICOS")
    basic_endpoints = [
        '/health/',
        '/tables/',
        '/recipes/?is_active=true&is_available=true',
        '/containers/?is_active=true',
        '/groups/',
        '/orders/?status=CREATED'
    ]
    
    for endpoint in basic_endpoints:
        success, data = test_api_endpoint(endpoint)
        results['endpoints'][endpoint] = success
        
        if success and endpoint == '/tables/':
            # Validar estructura de tablas
            if data and len(data) > 0:
                table = data[0]
                required_fields = ['id', 'table_number', 'zone_name', 'has_active_orders']
                missing = [f for f in required_fields if f not in table]
                if missing:
                    print(f"   ⚠️  Missing fields in table: {missing}")
                else:
                    print(f"   ✅ Table structure complete")
    
    # 2. Test integridad de datos
    print("\n🔗 2. VALIDACIÓN INTEGRIDAD DATOS")
    
    # Test recipes con groups
    success, recipes = test_api_endpoint('/recipes/?is_active=true&is_available=true')
    if success and recipes:
        recipes_with_groups = [r for r in recipes if r.get('group')]
        print(f"   Recipes total: {len(recipes)}")
        print(f"   Recipes con grupo: {len(recipes_with_groups)}")
        
        if len(recipes_with_groups) > 0:
            sample_recipe = recipes_with_groups[0]
            if 'id' in sample_recipe.get('group', {}):
                print(f"   ✅ Recipe-Group relationship OK")
            else:
                print(f"   ❌ Recipe-Group relationship broken")
    
    # 3. Test lógica de negocio
    print("\n💼 3. VALIDACIÓN LÓGICA NEGOCIO")
    
    # Test estados de mesa
    success, tables = test_api_endpoint('/tables/')
    success2, orders = test_api_endpoint('/orders/?status=CREATED')
    
    if success and success2:
        occupied_tables = set()
        for order in orders:
            if order.get('table'):
                occupied_tables.add(order['table'])
        
        tables_with_orders = [t for t in tables if t.get('has_active_orders')]
        backend_occupied = set(t['id'] for t in tables_with_orders)
        
        print(f"   Mesas con pedidos (por órdenes): {len(occupied_tables)}")
        print(f"   Mesas marcadas ocupadas: {len(backend_occupied)}")
        
        if occupied_tables == backend_occupied:
            print(f"   ✅ Estados de mesa consistentes")
        else:
            print(f"   ⚠️  Inconsistencia en estados de mesa")
    
    # 4. Resumen de auditoría
    print("\n📊 RESUMEN AUDITORÍA")
    print("=" * 30)
    
    total_endpoints = len(results['endpoints'])
    working_endpoints = sum(1 for v in results['endpoints'].values() if v)
    
    print(f"Endpoints funcionando: {working_endpoints}/{total_endpoints}")
    
    for endpoint, status in results['endpoints'].items():
        status_icon = "✅" if status else "❌"
        print(f"{status_icon} {endpoint}")
    
    return results

if __name__ == "__main__":
    audit_results = audit_system()
    
    # Guardar resultados
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    with open(f'audit_results_{timestamp}.json', 'w') as f:
        json.dump(audit_results, f, indent=2)
    
    print(f"\n📄 Resultados guardados en: audit_results_{timestamp}.json")