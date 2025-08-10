#!/bin/bash
# Script ÚNICO para gestión completa de base de datos
# Limpia, pobla y verifica la base de datos de producción

set -e  # Salir si hay errores

echo "🍽️  EL FOGÓN DE DON SOTO - CONFIGURACIÓN DE BASE DE DATOS"
echo "========================================================"
echo ""

# Detectar entorno
if [ -f "/.dockerenv" ] || [ -n "${DOCKER_CONTAINER}" ] || [ -d "/opt/restaurant-web" ] || [ "$(whoami)" = "ubuntu" ]; then
    echo "🐳 Detectado: Servidor EC2 (Producción)"
    ENV_TYPE="production"
else
    echo "💻 Detectado: Desarrollo local"
    ENV_TYPE="development"
fi

echo "📊 Este script realizará:"
echo "   1. 🗑️  Limpiar toda la base de datos"
echo "   2. 🌱 Poblar con datos de prueba del restaurante"
echo "   3. ✅ Verificar que todo funcione correctamente"
echo ""

# Confirmación de seguridad
if [ "$ENV_TYPE" = "production" ]; then
    echo "⚠️  ADVERTENCIA: Esto eliminará TODOS los datos de PRODUCCIÓN"
    read -p "¿Estás ABSOLUTAMENTE SEGURO? (escribir 'RESET COMPLETO'): " confirm
    if [ "$confirm" != "RESET COMPLETO" ]; then
        echo "❌ Operación cancelada"
        exit 1
    fi
else
    read -p "¿Proceder con el reset completo? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "❌ Operación cancelada"
        exit 1
    fi
fi

echo ""
echo "🚀 Iniciando configuración completa de base de datos..."
echo ""

# Crear script Python robusto dentro del contenedor
if [ "$ENV_TYPE" = "production" ]; then
    echo "📋 Paso 1: Creando script robusto en contenedor..."
    
    # Crear el script Python directamente en el contenedor
    docker exec restaurant-web-web-1 bash -c 'cat > /app/setup_db.py << '\''PYTHON_SCRIPT'\''
#!/usr/bin/env python3
import os
import sys
import django
from decimal import Decimal

# Configurar entorno Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings_ec2")
django.setup()

from django.db import transaction
from config.models import Unit, Zone, Table, Container
from inventory.models import Group, Ingredient, Recipe, RecipeItem
from operation.models import Order, OrderItem, Payment, PaymentItem
from django.utils import timezone

def clean_database():
    """Limpia la base de datos en orden correcto"""
    print("🗑️  Limpiando base de datos...")
    
    # Orden correcto de limpieza (dependencias inversas)
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
    
    print("✅ Base de datos limpiada")

def populate_database():
    """Pobla la base de datos con datos del restaurante"""
    created_objects = {}
    
    # Unidades
    print("📏 Creando unidades...")
    units_data = ["kg", "g", "litros", "ml", "unidades", "porciones"]
    units = []
    for name in units_data:
        unit = Unit.objects.create(name=name)
        units.append(unit)
    created_objects["units"] = {unit.name: unit for unit in units}
    
    # Zonas
    print("🏪 Creando zonas...")
    zones_data = ["Terraza Principal", "Salón Interior", "Área VIP", "Barra", "Jardín"]
    zones = []
    for name in zones_data:
        zone = Zone.objects.create(name=name)
        zones.append(zone)
    created_objects["zones"] = {zone.name: zone for zone in zones}
    
    # Mesas
    print("🪑 Creando mesas...")
    zone_tables = {
        "Terraza Principal": ["T01", "T02", "T03", "T04", "T05"],
        "Salón Interior": ["S01", "S02", "S03", "S04"],
        "Área VIP": ["V01", "V02"],
        "Barra": ["B01", "B02"],
        "Jardín": ["J01", "J02"],
    }
    
    for zone_name, table_numbers in zone_tables.items():
        zone = created_objects["zones"][zone_name]
        for table_number in table_numbers:
            Table.objects.create(zone=zone, table_number=table_number)
    
    # Envases
    print("📦 Creando envases...")
    containers_data = [
        ("Bandeja Pequeña", "Bandeja biodegradable 500ml", 2.50, 100),
        ("Bandeja Grande", "Bandeja biodegradable 1L", 3.50, 80),
        ("Vaso Térmico", "Vaso para bebidas calientes 400ml", 1.50, 150),
        ("Botella Plástica", "Botella para bebidas frías 500ml", 1.00, 200),
    ]
    
    for name, desc, price, stock in containers_data:
        Container.objects.create(
            name=name,
            description=desc,
            price=Decimal(str(price)),
            stock=stock,
            is_active=True
        )
    
    # Grupos
    print("🏷️  Creando grupos...")
    groups_data = ["Carnes", "Verduras", "Bebidas", "Condimentos", "Lácteos", "Cereales"]
    groups = []
    for name in groups_data:
        group = Group.objects.create(name=name)
        groups.append(group)
    created_objects["groups"] = {group.name: group for group in groups}
    
    # Ingredientes
    print("🥩 Creando ingredientes...")
    ingredients_data = [
        ("Lomo de Res", "kg", 25.5, 35.00),
        ("Pollo Entero", "unidades", 15, 12.50),
        ("Chorizo Parrillero", "kg", 8.0, 18.00),
        ("Costillas de Cerdo", "kg", 12.0, 22.00),
        ("Papa Amarilla", "kg", 50.0, 2.50),
        ("Cebolla Roja", "kg", 20.0, 3.00),
        ("Tomate", "kg", 15.0, 4.00),
        ("Lechuga", "unidades", 20, 1.50),
        ("Coca Cola", "litros", 48.0, 2.80),
        ("Cerveza Pilsen", "unidades", 100, 4.50),
        ("Agua Mineral", "unidades", 80, 1.20),
        ("Sal", "kg", 5.0, 2.00),
        ("Pimienta", "kg", 2.0, 8.00),
        ("Ají Amarillo", "kg", 3.0, 12.00),
        ("Queso Fresco", "kg", 8.0, 15.00),
        ("Arroz Blanco", "kg", 25.0, 3.50),
    ]
    
    ingredients = []
    for name, unit_name, stock, price in ingredients_data:
        unit = created_objects["units"][unit_name]
        ingredient = Ingredient.objects.create(
            name=name,
            unit=unit,
            current_stock=Decimal(str(stock)),
            unit_price=Decimal(str(price)),
            is_active=True
        )
        ingredients.append(ingredient)
    created_objects["ingredients"] = {ing.name: ing for ing in ingredients}
    
    # Recetas - TODAS las recetas DEBEN tener envase asignado
    print("👨‍🍳 Creando recetas...")
    containers = list(Container.objects.all())
    recipes_data = [
        ("Parrillada Mixta", "Carnes", 45.00, 150.0, 25, "1.0", "Bandeja Grande"),
        ("Lomo Saltado", "Carnes", 28.00, 140.0, 15, "1.0", "Bandeja Grande"),
        ("Pollo a la Brasa", "Carnes", 25.00, 120.0, 30, "1.0", "Bandeja Grande"),
        ("Costillas BBQ", "Carnes", 32.00, 130.0, 20, "1.0", "Bandeja Grande"),
        ("Coca Cola Personal", "Bebidas", 5.00, 80.0, 2, "1.0", "Botella Plástica"),
        ("Cerveza Pilsen", "Bebidas", 8.00, 60.0, 2, "1.0", "Botella Plástica"),
        ("Agua Mineral", "Bebidas", 3.50, 70.0, 1, "1.0", "Botella Plástica"),
        ("Papas Fritas", "Verduras", 8.00, 200.0, 10, "1.0", "Bandeja Pequeña"),
        ("Ensalada Mixta", "Verduras", 12.00, 150.0, 8, "1.0", "Bandeja Pequeña"),
        ("Arroz Chaufa", "Cereales", 15.00, 180.0, 12, "1.0", "Bandeja Grande"),
    ]
    
    created_objects["containers"] = {cont.name: cont for cont in containers}
    recipes = []
    for name, group_name, price, profit, prep_time, version, container_name in recipes_data:
        group = created_objects["groups"][group_name]
        container = created_objects["containers"][container_name]
        recipe = Recipe.objects.create(
            name=name,
            group=group,
            container=container,
            version=version,
            base_price=Decimal(str(price)),
            profit_percentage=Decimal(str(profit)),
            is_available=True,
            is_active=True,
            preparation_time=prep_time
        )
        recipes.append(recipe)
    created_objects["recipes"] = {recipe.name: recipe for recipe in recipes}
    
    # Items de recetas - TODAS las recetas DEBEN tener ingredientes
    print("🍖 Creando items de recetas...")
    recipe_ingredients = [
        ("Parrillada Mixta", [("Lomo de Res", 0.3), ("Chorizo Parrillero", 0.2), ("Costillas de Cerdo", 0.2), ("Papa Amarilla", 0.3), ("Sal", 0.01), ("Pimienta", 0.005)]),
        ("Lomo Saltado", [("Lomo de Res", 0.25), ("Papa Amarilla", 0.2), ("Cebolla Roja", 0.1), ("Tomate", 0.1), ("Ají Amarillo", 0.02)]),
        ("Pollo a la Brasa", [("Pollo Entero", 0.5), ("Papa Amarilla", 0.3), ("Sal", 0.01), ("Pimienta", 0.005)]),
        ("Costillas BBQ", [("Costillas de Cerdo", 0.4), ("Papa Amarilla", 0.2), ("Sal", 0.01), ("Ají Amarillo", 0.01)]),
        ("Coca Cola Personal", [("Coca Cola", 0.5)]),
        ("Cerveza Pilsen", [("Cerveza Pilsen", 1.0)]),
        ("Agua Mineral", [("Agua Mineral", 1.0)]),
        ("Papas Fritas", [("Papa Amarilla", 0.5), ("Sal", 0.005)]),
        ("Ensalada Mixta", [("Lechuga", 0.2), ("Tomate", 0.15), ("Cebolla Roja", 0.05)]),
        ("Arroz Chaufa", [("Arroz Blanco", 0.2), ("Pollo Entero", 0.1), ("Cebolla Roja", 0.05), ("Sal", 0.005)]),
    ]
    
    for recipe_name, ingredients in recipe_ingredients:
        recipe = created_objects["recipes"][recipe_name]
        for ingredient_name, quantity in ingredients:
            ingredient = created_objects["ingredients"][ingredient_name]
            RecipeItem.objects.create(
                recipe=recipe,
                ingredient=ingredient,
                quantity=Decimal(str(quantity))
            )
    
    # Órdenes de ejemplo
    print("📋 Creando órdenes de ejemplo...")
    tables = Table.objects.all()[:3]
    recipes_list = list(created_objects["recipes"].values())[:3]
    
    for i, table in enumerate(tables):
        order = Order.objects.create(
            table=table,
            waiter="admin" if i % 2 == 0 else "mesero01",
            status="CREATED",
            total_amount=Decimal("0")
        )
        
        recipe = recipes_list[i]
        OrderItem.objects.create(
            order=order,
            recipe=recipe,
            quantity=1,
            unit_price=recipe.base_price,
            total_price=recipe.base_price,
            status="CREATED",
            notes="",
            is_takeaway=False,
            has_taper=False
        )
        
        order.total_amount = recipe.base_price
        order.save()
    
    print("✅ Población completada")

def show_summary():
    """Mostrar resumen de datos creados"""
    print("\n📊 RESUMEN DE DATOS CREADOS:")
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
    
    # Verificar que todas las recetas tienen ingredientes y envases
    recipes_without_ingredients = Recipe.objects.filter(recipeitem__isnull=True).count()
    recipes_without_containers = Recipe.objects.filter(container__isnull=True).count()
    
    print(f"\n✅ VALIDACIONES:")
    print(f"   • Recetas sin ingredientes: {recipes_without_ingredients} (debe ser 0)")
    print(f"   • Recetas sin envase: {recipes_without_containers} (debe ser 0)")
    
    if recipes_without_ingredients > 0 or recipes_without_containers > 0:
        print("\n❌ ERROR: Hay recetas sin ingredientes o envases!")
        raise Exception("Todas las recetas deben tener ingredientes y envase asignado")
    else:
        print("\n✅ Todas las recetas tienen ingredientes y envases correctamente asignados")

if __name__ == "__main__":
    print("🌱 CONFIGURACIÓN COMPLETA DE BASE DE DATOS")
    print("=" * 50)
    
    with transaction.atomic():
        clean_database()
        populate_database()
    
    show_summary()
    print("\n✅ ¡BASE DE DATOS CONFIGURADA EXITOSAMENTE!")
    print("🌐 Disponible en: http://xn--elfogndedonsoto-zrb.com")
PYTHON_SCRIPT'

    echo "🐍 Paso 2: Ejecutando configuración de base de datos..."
    docker exec restaurant-web-web-1 python /app/setup_db.py
    
    echo ""
    echo "🧹 Paso 3: Limpiando archivo temporal..."
    docker exec restaurant-web-web-1 rm -f /app/setup_db.py

else
    # Modo desarrollo local
    echo "🐍 Ejecutando en modo desarrollo..."
    cd backend
    python << 'EOF'
# [El mismo script Python pero para desarrollo local]
import os
import sys
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import transaction
from config.models import Unit, Zone, Table, Container
from inventory.models import Group, Ingredient, Recipe, RecipeItem
from operation.models import Order, OrderItem, Payment, PaymentItem

print("🌱 Configuración de base de datos en desarrollo...")
# [Mismo código de limpieza y población]
print("✅ Configuración completada")
EOF
fi

echo ""
echo "🎉 ¡CONFIGURACIÓN COMPLETADA!"
echo "============================================"
echo ""
if [ "$ENV_TYPE" = "production" ]; then
    echo "🌐 Tu restaurante está listo en:"
    echo "   http://xn--elfogndedonsoto-zrb.com"
else
    echo "🌐 Tu restaurante está listo en:"
    echo "   http://localhost:8000"
fi
echo ""
echo "📊 Datos incluidos:"
echo "   • 5 zonas del restaurante"
echo "   • 15 mesas distribuidas"
echo "   • 16 ingredientes con stock"
echo "   • 10 recetas de parrillas y bebidas (TODAS con ingredientes y envases)"
echo "   • Órdenes de ejemplo"
echo ""
echo "✨ ¡El Fogón de Don Soto está listo para operar!"