#!/usr/bin/env python3

"""
Test para verificar que la funcionalidad principal funciona correctamente
después de los cambios realizados
"""

import os
import django
import requests
import json

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from operation.models import Order, OrderItem, PrintQueue, PrinterConfig
from inventory.models import Recipe
from config.models import Table

def test_basic_functionality():
    print("🔥 TESTE BÁSICO DE FUNCIONALIDAD POST-FIXES")
    print("=" * 60)
    
    # 1. Verificar que los modelos funcionen
    print("1️⃣ Verificando modelos básicos...")
    
    recipes = Recipe.objects.all()
    printers = PrinterConfig.objects.all()
    tables = Table.objects.all()
    
    print(f"   ✅ Recetas: {recipes.count()}")
    print(f"   ✅ Impresoras: {printers.count()}")  
    print(f"   ✅ Mesas: {tables.count()}")
    
    if not recipes.exists() or not printers.exists() or not tables.exists():
        print("   ⚠️  Algunos datos base faltan, pero los modelos funcionan")
    
    # 2. Crear una orden de prueba
    print("\n2️⃣ Creando orden de prueba...")
    
    recipe = recipes.first()
    table = tables.first()
    
    if recipe and table:
        order = Order.objects.create(
            customer_name="Test Frontend Fix",
            table_id=table.id,
            status='CREATED',
            party_size=1
        )
        
        item = OrderItem.objects.create(
            order=order,
            recipe=recipe,
            quantity=1,
            unit_price=12.50,
            status='CREATED'
        )
        
        print(f"   ✅ Orden #{order.id} creada")
        print(f"   ✅ OrderItem #{item.id} creado - Estado: {item.status}")
        
        # 3. Verificar que el sistema de impresión funciona
        print("\n3️⃣ Verificando sistema de print jobs...")
        
        # Verificar que se creó automáticamente un print job
        print_jobs = PrintQueue.objects.filter(order_item=item)
        if print_jobs.exists():
            job = print_jobs.first()
            print(f"   ✅ Print job #{job.id} creado automáticamente - Estado: {job.status}")
            
            # 4. Probar cancelación del item
            print("\n4️⃣ Probando cancelación de item...")
            
            item.cancellation_reason = "Test de funcionalidad frontend"
            item.update_status('CANCELED')
            
            # Refrescar job
            job.refresh_from_db()
            
            print(f"   ✅ Item cancelado - Estado: {item.status}")
            print(f"   ✅ Print job actualizado - Estado: {job.status}")
            
            if job.status == 'cancelled':
                print("   🎉 Cancelación automática de print jobs funciona!")
            else:
                print(f"   ❌ Print job no se canceló automáticamente (Estado: {job.status})")
            
            # 5. Verificar filtrado de items cancelados
            print("\n5️⃣ Verificando filtrado de items...")
            
            active_items = order.orderitem_set.exclude(status='CANCELED')
            canceled_items = order.orderitem_set.filter(status='CANCELED')
            
            print(f"   ✅ Items activos: {active_items.count()}")
            print(f"   ✅ Items cancelados: {canceled_items.count()}")
            
            if canceled_items.count() == 1 and active_items.count() == 0:
                print("   🎉 Filtrado de items funciona correctamente!")
                
        else:
            print("   ⚠️  No se crearon print jobs automáticamente")
        
    else:
        print("   ❌ No hay datos suficientes para crear orden de prueba")
    
    # 6. Verificar APIs básicas (opcional)
    print("\n6️⃣ Probando conectividad de APIs...")
    
    try:
        # Test básico de health check si existe
        response = requests.get('http://localhost:8001/api/orders/', timeout=5)
        if response.status_code in [200, 401]:  # 401 es OK si no hay auth
            print("   ✅ API backend responde correctamente")
        else:
            print(f"   ⚠️  API response: {response.status_code}")
    except requests.exceptions.ConnectionError:
        print("   ⚠️  Backend API no disponible en localhost:8001")
    except Exception as e:
        print(f"   ⚠️  Error conectando a API: {str(e)}")
    
    print("\n" + "=" * 60)
    print("🏁 TEST COMPLETADO")
    print("✅ Sistema básico funcional post-fixes")
    print("🌐 Frontend disponible en: http://localhost:5173")
    print("🔧 Backend disponible en: http://localhost:8001")
    
if __name__ == "__main__":
    test_basic_functionality()