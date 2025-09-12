#!/usr/bin/env python3
"""
Test completo del flujo de impresión con logs detallados
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.append('/Users/guillermosotozuniga/restaurant-web/backend')
django.setup()

from operation.models import Order, OrderItem, PrintQueue, PrinterConfig
from config.models import Table
from inventory.models import Recipe
from django.utils import timezone

def clean_test_data():
    """Limpiar datos de prueba anteriores"""
    print("🧹 LIMPIANDO DATOS DE PRUEBA ANTERIORES")
    print("=" * 60)
    
    # Eliminar órdenes de prueba
    Order.objects.filter(id__gte=1).delete()
    PrintQueue.objects.all().delete()
    
    print("✅ Datos de prueba anteriores eliminados")
    print()

def create_test_order():
    """Crear una nueva orden de prueba con logs detallados"""
    print("🆕 CREANDO NUEVA ORDEN DE PRUEBA")
    print("=" * 60)
    
    # Obtener datos necesarios
    table = Table.objects.first()
    recipes = Recipe.objects.filter(printer__isnull=False)[:2]  # Solo recetas con impresora
    
    print(f"📋 Mesa seleccionada: {table}")
    print(f"🍽️ Recetas seleccionadas: {[r.name for r in recipes]}")
    print()
    
    # Crear la orden
    print("📝 Creando Order...")
    order = Order.objects.create(
        table=table,
        waiter="Test User",
        customer_name="Cliente Prueba",
        party_size=2,
        status='CREATED'
    )
    print(f"✅ Order #{order.id} creada exitosamente")
    print()
    
    # Crear OrderItems (esto debería disparar automáticamente los PrintQueue jobs)
    order_items = []
    for recipe in recipes:
        print(f"📝 Creando OrderItem para {recipe.name}...")
        item = OrderItem.objects.create(
            order=order,
            recipe=recipe,
            unit_price=recipe.base_price,
            quantity=1,
            status='CREATED'  # Estado inicial
        )
        order_items.append(item)
        print(f"✅ OrderItem #{item.id} creado exitosamente")
    
    print()
    return order, order_items

def analyze_results(order, order_items):
    """Analizar los resultados después de crear la orden"""
    print("🔍 ANÁLISIS DE RESULTADOS")
    print("=" * 60)
    
    print(f"📋 Order #{order.id}:")
    print(f"   • Estado: {order.status}")
    print()
    
    print("📝 OrderItems creados:")
    for item in order_items:
        item.refresh_from_db()  # Refrescar desde DB
        print(f"   • Item #{item.id} ({item.recipe.name}):")
        print(f"     - Estado: {item.status}")
        print(f"     - Impresora asignada: {item.recipe.printer.name}")
    print()
    
    print("🖨️ PrintQueue jobs generados:")
    print_jobs = PrintQueue.objects.filter(order_item__in=order_items)
    for job in print_jobs:
        print(f"   • Job #{job.id}:")
        print(f"     - OrderItem: #{job.order_item.id} ({job.order_item.recipe.name})")
        print(f"     - Estado: {job.status}")
        print(f"     - Impresora: {job.printer.name}")
        print(f"     - Creado: {job.created_at}")
    
    if not print_jobs:
        print("   ❌ No se generaron PrintQueue jobs!")
    
    print()
    return print_jobs

def simulate_printing(print_jobs):
    """Simular el proceso de impresión"""
    print("🖨️ SIMULANDO PROCESO DE IMPRESIÓN")
    print("=" * 60)
    
    for job in print_jobs:
        print(f"🔄 Procesando Job #{job.id}...")
        
        # Simular que la impresión física fue exitosa
        job.mark_completed()
        
        print(f"✅ Job #{job.id} marcado como completado")
        
        # Verificar estado del OrderItem después
        job.order_item.refresh_from_db()
        print(f"📝 Estado del OrderItem #{job.order_item.id} después del print: {job.order_item.status}")
        print()

def main():
    """Función principal"""
    print("🧪 TEST COMPLETO DEL FLUJO DE IMPRESIÓN CON LOGS")
    print("=" * 80)
    print()
    
    # Paso 1: Limpiar datos anteriores
    clean_test_data()
    
    # Paso 2: Crear orden de prueba
    order, order_items = create_test_order()
    
    # Paso 3: Analizar resultados iniciales
    print_jobs = analyze_results(order, order_items)
    
    # Paso 4: Simular proceso de impresión
    if print_jobs:
        simulate_printing(print_jobs)
        
        # Paso 5: Análisis final
        print("📊 ESTADO FINAL:")
        print("=" * 40)
        analyze_results(order, order_items)
    else:
        print("❌ No se pudieron crear PrintQueue jobs. Revisar configuración de impresoras.")
    
    print()
    print("🎯 CONCLUSIÓN:")
    print("=" * 40)
    print("Los logs detallados en Django y el frontend mostrarán")
    print("exactamente dónde está el problema en el flujo de impresión.")
    print()
    print("Para ver los logs del frontend, abre la consola del navegador")
    print("y navega a la vista de gestión de pedidos.")

if __name__ == "__main__":
    main()