#!/usr/bin/env python3
"""
Test específico para verificar que el mecanismo de bloqueo funciona.
Simula el flujo que estaba causando cambios automáticos CREATED -> PREPARING
"""
import os
import sys
import django

# Configurar Django
sys.path.append('/Users/guillermosotozuniga/restaurant-web/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from operation.models import OrderItem, Order
from inventory.models import Recipe
from config.models import Table, Container

def test_blocking_mechanism():
    print("🔒 PROBANDO MECANISMO DE BLOQUEO\n")
    
    # Obtener OrderItem existente en estado CREATED
    order_item = OrderItem.objects.filter(status='CREATED').first()
    
    if not order_item:
        print("❌ No hay OrderItems en estado CREATED para probar")
        return
    
    print(f"📋 OrderItem #{order_item.id} - Estado actual: {order_item.status}")
    
    print("\n1. Probando cambio automático CREATED -> PREPARING (DEBE SER BLOQUEADO)...")
    
    # Simular lo que hacía send_to_kitchen antes de nuestro fix
    order_item.update_status('PREPARING', allow_automatic=False)
    
    # Recargar desde DB para verificar
    order_item.refresh_from_db()
    
    if order_item.status == 'CREATED':
        print("   ✅ ÉXITO: El cambio automático fue BLOQUEADO")
        print(f"   ✅ OrderItem permanece en estado: {order_item.status}")
    else:
        print(f"   ❌ ERROR: El OrderItem cambió a: {order_item.status}")
        print("   ❌ El mecanismo de bloqueo NO funcionó")
    
    print("\n2. Probando cambio manual CREATED -> PREPARING (DEBE PERMITIRSE)...")
    
    # Simular cambio manual desde frontend
    order_item.update_status('PREPARING', allow_automatic=True)
    
    # Recargar desde DB para verificar
    order_item.refresh_from_db()
    
    if order_item.status == 'PREPARING':
        print("   ✅ ÉXITO: El cambio manual fue PERMITIDO")
        print(f"   ✅ OrderItem cambió a estado: {order_item.status}")
    else:
        print(f"   ❌ ERROR: El OrderItem no cambió, estado: {order_item.status}")
        print("   ❌ Los cambios manuales no funcionan")
    
    print(f"\n📊 Estado final:")
    print(f"   OrderItem #{order_item.id}: {order_item.status}")

if __name__ == '__main__':
    test_blocking_mechanism()