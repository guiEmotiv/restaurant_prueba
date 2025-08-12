#!/bin/bash
# Script para ELIMINAR TODOS los datos de la base de datos de producción
# Y REINICIAR contadores de auto-incremento

set -e  # Salir si hay errores

echo "🗑️  EL FOGÓN DE DON SOTO - LIMPIEZA COMPLETA DE BASE DE DATOS"
echo "=============================================================="
echo ""

# Detectar entorno
if [ -d "/opt/restaurant-web" ] || [ "$(whoami)" = "ubuntu" ]; then
    echo "🐳 Detectado: Servidor EC2 (Producción)"
    ENV_TYPE="production"
    DOCKER_CONTAINER="restaurant-web-web-1"
elif docker ps | grep -q "restaurant-web.*web"; then
    echo "🐳 Detectado: Desarrollo Docker"
    ENV_TYPE="development_docker"
    DOCKER_CONTAINER=$(docker ps --format "table {{.Names}}" | grep "restaurant-web.*web" | head -1)
else
    echo "💻 Detectado: Desarrollo local"
    ENV_TYPE="development"
fi

echo "🚨 ADVERTENCIA: Este script realizará:"
echo "   1. 🗑️  ELIMINAR TODOS los datos de la base de datos"
echo "   2. 🔄 REINICIAR contadores de auto-incremento"
echo "   3. 📊 Verificar que la base esté completamente vacía"
echo ""

# Confirmación de seguridad SUPER ESTRICTA
if [ "$ENV_TYPE" = "production" ]; then
    echo "🚨 PELIGRO EXTREMO: Esto eliminará TODOS los datos de PRODUCCIÓN"
    echo "🚨 INCLUYENDO: Todas las órdenes, pagos, inventario, mesas, configuraciones"
    echo "🚨 ESTA ACCIÓN ES IRREVERSIBLE"
    echo ""
    read -p "¿Estás ABSOLUTAMENTE SEGURO? (escribir 'ELIMINAR TODO PRODUCCION'): " confirm
    if [ "$confirm" != "ELIMINAR TODO PRODUCCION" ]; then
        echo "❌ Operación cancelada por seguridad"
        exit 1
    fi
    echo ""
    read -p "CONFIRMACIÓN FINAL - ¿PROCEDER CON ELIMINACIÓN TOTAL? (escribir 'SI ELIMINAR'): " final_confirm
    if [ "$final_confirm" != "SI ELIMINAR" ]; then
        echo "❌ Operación cancelada"
        exit 1
    fi
elif [ "$ENV_TYPE" = "development_docker" ]; then
    echo "🐳 Desarrollo Docker - Eliminando todos los datos"
    read -p "¿Proceder con eliminación completa? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "❌ Operación cancelada"
        exit 1
    fi
else
    read -p "¿Proceder con eliminación completa? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "❌ Operación cancelada"
        exit 1
    fi
fi

echo ""
echo "🚀 Iniciando ELIMINACIÓN COMPLETA de base de datos..."
echo ""

# Crear script Python para limpieza completa
if [ "$ENV_TYPE" = "production" ] || [ "$ENV_TYPE" = "development_docker" ]; then
    echo "📋 Paso 1: Creando script de eliminación completa..."
    
    # Crear el script Python de eliminación en el contenedor
    docker exec $DOCKER_CONTAINER bash -c 'cat > /app/clear_db.py << '\''PYTHON_SCRIPT'\''
#!/usr/bin/env python3
import os
import sys
import django
from django.db import connection, transaction

# Configurar entorno Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings_ec2")
django.setup()

from config.models import Unit, Zone, Table, Container
from inventory.models import Group, Ingredient, Recipe, RecipeItem
from operation.models import Order, OrderItem, Payment, PaymentItem

def show_current_data():
    """Mostrar datos actuales antes de eliminar"""
    print("📊 DATOS ACTUALES EN BASE DE DATOS:")
    print(f"   • Unidades: {Unit.objects.count()}")
    print(f"   • Zonas: {Zone.objects.count()}")
    print(f"   • Mesas: {Table.objects.count()}")
    print(f"   • Envases: {Container.objects.count()}")
    print(f"   • Grupos: {Group.objects.count()}")
    print(f"   • Ingredientes: {Ingredient.objects.count()}")
    print(f"   • Recetas: {Recipe.objects.count()}")
    print(f"   • Items de recetas: {RecipeItem.objects.count()}")
    print(f"   • Órdenes: {Order.objects.count()}")
    print(f"   • Items de órdenes: {OrderItem.objects.count()}")
    print(f"   • Pagos: {Payment.objects.count()}")
    print(f"   • Items de pagos: {PaymentItem.objects.count()}")
    print("")

def clear_all_data():
    """Elimina TODOS los datos y reinicia contadores"""
    print("🗑️  FASE 1: Eliminando todos los datos...")
    
    with transaction.atomic():
        # Orden correcto de eliminación (dependencias inversas)
        print("   🔹 Eliminando items de pagos...")
        PaymentItem.objects.all().delete()
        
        print("   🔹 Eliminando pagos...")
        Payment.objects.all().delete()
        
        print("   🔹 Eliminando items de órdenes...")
        OrderItem.objects.all().delete()
        
        print("   🔹 Eliminando órdenes...")
        Order.objects.all().delete()
        
        print("   🔹 Eliminando items de recetas...")
        RecipeItem.objects.all().delete()
        
        print("   🔹 Eliminando recetas...")
        Recipe.objects.all().delete()
        
        print("   🔹 Eliminando ingredientes...")
        Ingredient.objects.all().delete()
        
        print("   🔹 Eliminando grupos...")
        Group.objects.all().delete()
        
        print("   🔹 Eliminando envases...")
        Container.objects.all().delete()
        
        print("   🔹 Eliminando mesas...")
        Table.objects.all().delete()
        
        print("   🔹 Eliminando zonas...")
        Zone.objects.all().delete()
        
        print("   🔹 Eliminando unidades...")
        Unit.objects.all().delete()
        
    print("✅ Todos los datos eliminados")

def reset_auto_increment():
    """Reinicia los contadores de auto-incremento de todas las tablas"""
    print("\n🔄 FASE 2: Reiniciando contadores de auto-incremento...")
    
    # Lista de todas las tablas del sistema
    tables = [
        'operation_paymentitem',
        'operation_payment', 
        'operation_orderitem',
        'operation_order',
        'inventory_recipeitem',
        'inventory_recipe',
        'inventory_ingredient',
        'inventory_group',
        'config_container',
        'config_table',
        'config_zone',
        'config_unit'
    ]
    
    with connection.cursor() as cursor:
        for table in tables:
            try:
                # Para SQLite, eliminar la secuencia sqlite_sequence
                cursor.execute(f"DELETE FROM sqlite_sequence WHERE name='{table}'")
                print(f"   🔹 Reiniciado contador: {table}")
            except Exception as e:
                print(f"   ⚠️  Error reiniciando {table}: {e}")
                # Continuar con las demás tablas
                continue
    
    print("✅ Contadores reiniciados")

def verify_empty_database():
    """Verificar que la base de datos está completamente vacía"""
    print("\n📊 FASE 3: Verificando base de datos vacía...")
    
    models_to_check = [
        ('Unidades', Unit),
        ('Zonas', Zone), 
        ('Mesas', Table),
        ('Envases', Container),
        ('Grupos', Group),
        ('Ingredientes', Ingredient),
        ('Recetas', Recipe),
        ('Items de recetas', RecipeItem),
        ('Órdenes', Order),
        ('Items de órdenes', OrderItem),
        ('Pagos', Payment),
        ('Items de pagos', PaymentItem)
    ]
    
    total_records = 0
    for name, model in models_to_check:
        count = model.objects.count()
        total_records += count
        if count == 0:
            print(f"   ✅ {name}: {count} registros")
        else:
            print(f"   ❌ {name}: {count} registros (DEBE SER 0)")
    
    print(f"\n📊 TOTAL DE REGISTROS EN BASE DE DATOS: {total_records}")
    
    if total_records == 0:
        print("✅ BASE DE DATOS COMPLETAMENTE VACÍA")
        return True
    else:
        print("❌ ERROR: La base de datos NO está completamente vacía")
        return False

def verify_auto_increment_reset():
    """Verificar que los contadores se reiniciaron correctamente"""
    print("\n🔍 FASE 4: Verificando contadores reiniciados...")
    
    with connection.cursor() as cursor:
        cursor.execute("SELECT name, seq FROM sqlite_sequence ORDER BY name")
        sequences = cursor.fetchall()
        
        if not sequences:
            print("✅ No hay contadores activos - Reinicio exitoso")
            return True
        else:
            print("❌ Contadores que aún existen:")
            for name, seq in sequences:
                print(f"   • {name}: {seq}")
            return False

if __name__ == "__main__":
    print("🗑️  ELIMINACIÓN COMPLETA DE BASE DE DATOS")
    print("=" * 50)
    
    # Mostrar estado actual
    show_current_data()
    
    # Proceder con eliminación
    clear_all_data()
    
    # Reiniciar contadores
    reset_auto_increment()
    
    # Verificar resultado
    database_empty = verify_empty_database()
    counters_reset = verify_auto_increment_reset()
    
    print("\n" + "=" * 50)
    if database_empty and counters_reset:
        print("🎉 ¡ELIMINACIÓN COMPLETA EXITOSA!")
        print("✅ Base de datos completamente vacía")
        print("✅ Contadores reiniciados")
        print("📊 La base de datos está lista para nuevos datos")
    else:
        print("❌ ELIMINACIÓN INCOMPLETA")
        print("⚠️  Revisar manualmente la base de datos")
        exit(1)
PYTHON_SCRIPT'

    echo "🐍 Paso 2: Ejecutando eliminación completa..."
    docker exec $DOCKER_CONTAINER python /app/clear_db.py
    
    echo ""
    echo "🧹 Paso 3: Limpiando archivo temporal..."
    docker exec $DOCKER_CONTAINER rm -f /app/clear_db.py

else
    # Modo desarrollo local (sin Docker)
    echo "🐍 Ejecutando eliminación en modo desarrollo local..."
    echo "⚠️  NOTA: Para desarrollo se recomienda usar Docker"
    
    cd backend
    
    echo "🐍 Usando comandos Django..."
    python manage.py shell -c "
import os
from django.db import connection, transaction
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

from config.models import Unit, Zone, Table, Container
from inventory.models import Group, Ingredient, Recipe, RecipeItem  
from operation.models import Order, OrderItem, Payment, PaymentItem

print('🗑️ Eliminando todos los datos...')
with transaction.atomic():
    PaymentItem.objects.all().delete()
    Payment.objects.all().delete()
    OrderItem.objects.all().delete()
    Order.objects.all().delete()
    RecipeItem.objects.all().delete()
    Recipe.objects.all().delete()
    Ingredient.objects.all().delete()
    Group.objects.all().delete()
    Container.objects.all().delete()
    Table.objects.all().delete()
    Zone.objects.all().delete()
    Unit.objects.all().delete()

print('🔄 Reiniciando contadores...')
with connection.cursor() as cursor:
    cursor.execute(\"DELETE FROM sqlite_sequence\")

print('✅ Eliminación local completada')
"
fi

echo ""
echo "🎉 ¡ELIMINACIÓN COMPLETA FINALIZADA!"
echo "============================================"
echo ""
if [ "$ENV_TYPE" = "production" ]; then
    echo "🌐 Base de datos de producción COMPLETAMENTE VACÍA"
    echo "   http://xn--elfogndedonsoto-zrb.com"
elif [ "$ENV_TYPE" = "development_docker" ]; then
    echo "🌐 Base de datos de desarrollo COMPLETAMENTE VACÍA"
    echo "   http://localhost:3000 (Frontend)"
    echo "   http://localhost:8000 (Backend)"
else
    echo "🌐 Base de datos local COMPLETAMENTE VACÍA"
    echo "   http://localhost:8000"
fi
echo ""
echo "✅ RESULTADOS:"
echo "   • Todos los datos eliminados"
echo "   • Contadores de ID reiniciados a 0"
echo "   • Base de datos lista para nuevos datos"
echo ""
echo "💡 PRÓXIMO PASO:"
echo "   Para poblar con datos nuevos ejecuta:"
echo "   ./scripts/setup_database.sh"
echo ""
echo "🚨 RECORDATORIO: Esta acción es irreversible"
echo "   Si necesitas los datos, restaura desde backup"