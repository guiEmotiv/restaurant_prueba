#!/bin/bash
# Script para restaurar datos desde un backup
# Restaura: unidades, zonas, mesas, envases, grupos, ingredientes y recetas

set -e  # Salir si hay errores

echo "🍽️  EL FOGÓN DE DON SOTO - RESTAURAR DESDE BACKUP"
echo "==============================================="
echo ""

# Detectar entorno
if [ -d "/opt/restaurant-web" ] || [ "$(whoami)" = "ubuntu" ] || [ -f "/usr/bin/docker-compose" ]; then
    echo "🐳 Detectado: Servidor EC2 (Producción)"
    ENV_TYPE="production"
    
    # Buscar contenedor web activo
    CONTAINER_NAME=$(docker ps --format "{{.Names}}" | grep -E "web|restaurant" | head -1)
    
    if [ -z "$CONTAINER_NAME" ]; then
        echo "❌ Error: No se encontró contenedor web activo"
        echo "📦 Contenedores disponibles:"
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
        echo ""
        echo "🔧 Intentando usar docker-compose..."
        cd /opt/restaurant-web 2>/dev/null || cd .
        CONTAINER_NAME=$(docker-compose -f docker-compose.ec2.yml ps -q web 2>/dev/null | head -1)
        if [ -z "$CONTAINER_NAME" ]; then
            echo "❌ Error: No se pudo detectar contenedor web"
            exit 1
        fi
    fi
    
    echo "📦 Usando contenedor: $CONTAINER_NAME"
else
    echo "💻 Detectado: Desarrollo local"
    ENV_TYPE="development"
fi

# Verificar que existe el directorio de backups
BACKUP_DIR="backups"
if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ Error: No existe el directorio de backups"
    echo "   Primero debes hacer un backup con: ./scripts/backup_database.sh"
    exit 1
fi

# Listar backups disponibles
echo "📋 Backups disponibles:"
echo ""
BACKUPS=($(ls "$BACKUP_DIR" | grep "backup_restaurant_" | grep ".json$"))

if [ ${#BACKUPS[@]} -eq 0 ]; then
    echo "❌ No hay backups disponibles"
    echo "   Primero debes hacer un backup con: ./scripts/backup_database.sh"
    exit 1
fi

# Mostrar lista numerada
for i in "${!BACKUPS[@]}"; do
    FILE_SIZE=$(ls -lh "$BACKUP_DIR/${BACKUPS[$i]}" | awk '{print $5}')
    echo "   $((i+1)). ${BACKUPS[$i]} ($FILE_SIZE)"
done

echo ""
read -p "Selecciona el número del backup a restaurar (1-${#BACKUPS[@]}): " selection

# Validar selección
if ! [[ "$selection" =~ ^[0-9]+$ ]] || [ "$selection" -lt 1 ] || [ "$selection" -gt ${#BACKUPS[@]} ]; then
    echo "❌ Selección inválida"
    exit 1
fi

# Obtener archivo seleccionado
BACKUP_FILE="$BACKUP_DIR/${BACKUPS[$((selection-1))]}"
echo ""
echo "📁 Backup seleccionado: ${BACKUPS[$((selection-1))]}"

# Mostrar advertencia
echo ""
echo "⚠️  ADVERTENCIA: Esta operación:"
echo "   • Eliminará TODOS los datos actuales"
echo "   • Restaurará los datos del backup seleccionado"
echo "   • NO se puede deshacer"
echo ""

# Confirmación de seguridad
if [ "$ENV_TYPE" = "production" ]; then
    echo "⚠️  ADVERTENCIA: Esto reemplazará TODOS los datos de PRODUCCIÓN"
    read -p "¿Estás ABSOLUTAMENTE SEGURO? (escribir 'RESTAURAR BACKUP'): " confirm
    if [ "$confirm" != "RESTAURAR BACKUP" ]; then
        echo "❌ Operación cancelada"
        exit 1
    fi
else
    read -p "¿Proceder con la restauración? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "❌ Operación cancelada"
        exit 1
    fi
fi

echo ""
echo "🚀 Iniciando restauración desde backup..."
echo ""

# Crear script Python para la restauración
if [ "$ENV_TYPE" = "production" ]; then
    echo "📋 Preparando restauración en contenedor..."
    
    # Copiar archivo de backup al contenedor
    docker cp "$BACKUP_FILE" $CONTAINER_NAME:/app/backup_to_restore.json
    
    # Crear el script Python en el contenedor
    docker exec $CONTAINER_NAME bash -c 'cat > /app/restore_db.py << '\''PYTHON_SCRIPT'\''
#!/usr/bin/env python3
import os
import sys
import json
import django
from decimal import Decimal
from datetime import datetime

# Configurar entorno Django
import sys
sys.path.append("/app")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings_ec2")
django.setup()

try:
    from django.db import transaction
    from config.models import Unit, Zone, Table, Container
    from inventory.models import Group, Ingredient, Recipe, RecipeItem
    print("✅ Modelos básicos importados correctamente")
    
    # Intentar importar modelos de operación (pueden no existir en algunos casos)
    try:
        from operation.models import Order, OrderItem, Payment, PaymentItem
        print("✅ Modelos de operación también disponibles")
    except ImportError as e:
        print(f"⚠️ Modelos de operación no disponibles: {e}")
        
except ImportError as e:
    print(f"❌ Error importando modelos: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

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
    
    # Reiniciar contadores de autoincremento
    from django.db import connection
    with connection.cursor() as cursor:
        # SQLite usa diferentes comandos para reiniciar secuencias
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='config_unit';")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='config_zone';")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='config_table';")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='config_container';")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='inventory_group';")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='inventory_ingredient';")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='inventory_recipe';")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='inventory_recipeitem';")
    
    print("✅ Base de datos limpiada y contadores reiniciados")

def restore_data(filename):
    """Restaura los datos desde el archivo JSON"""
    print(f"📂 Leyendo archivo: {filename}")
    
    with open(filename, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"📋 Versión del backup: {data['metadata']['version']}")
    print(f"📅 Fecha del backup: {data['metadata']['created_at']}")
    print(f"🏪 Restaurante: {data['metadata']['restaurant']}")
    print("")
    
    # Mapeo de IDs antiguos a nuevos
    id_map = {
        'units': {},
        'zones': {},
        'groups': {},
        'ingredients': {},
        'recipes': {}
    }
    
    # Restaurar unidades
    print("📏 Restaurando unidades...")
    for item in data['units']:
        obj = Unit.objects.create(name=item['name'])
        id_map['units'][item['id']] = obj.id
    
    # Restaurar zonas
    print("🏪 Restaurando zonas...")
    for item in data['zones']:
        obj = Zone.objects.create(name=item['name'])
        id_map['zones'][item['id']] = obj.id
    
    # Restaurar mesas
    print("🪑 Restaurando mesas...")
    for item in data['tables']:
        Table.objects.create(
            zone_id=id_map['zones'][item['zone_id']],
            table_number=item['table_number']
        )
    
    # Restaurar envases
    print("📦 Restaurando envases...")
    for item in data['containers']:
        Container.objects.create(
            name=item['name'],
            description=item['description'],
            price=Decimal(item['price']),
            stock=item['stock'],
            is_active=item['is_active']
        )
    
    # Restaurar grupos
    print("🏷️  Restaurando grupos...")
    for item in data['groups']:
        obj = Group.objects.create(name=item['name'])
        id_map['groups'][item['id']] = obj.id
    
    # Restaurar ingredientes
    print("🥩 Restaurando ingredientes...")
    for item in data['ingredients']:
        obj = Ingredient.objects.create(
            name=item['name'],
            unit_id=id_map['units'][item['unit_id']],
            current_stock=Decimal(item['current_stock']),
            unit_price=Decimal(item['unit_price']),
            is_active=item['is_active']
        )
        id_map['ingredients'][item['id']] = obj.id
    
    # Restaurar recetas
    print("👨‍🍳 Restaurando recetas...")
    for item in data['recipes']:
        obj = Recipe.objects.create(
            name=item['name'],
            group_id=id_map['groups'][item['group_id']],
            version=item['version'],
            base_price=Decimal(item['base_price']),
            profit_percentage=Decimal(item['profit_percentage']),
            is_available=item['is_available'],
            is_active=item['is_active'],
            preparation_time=item['preparation_time']
        )
        id_map['recipes'][item['id']] = obj.id
    
    # Restaurar items de recetas
    print("🍖 Restaurando componentes de recetas...")
    for item in data['recipe_items']:
        RecipeItem.objects.create(
            recipe_id=id_map['recipes'][item['recipe_id']],
            ingredient_id=id_map['ingredients'][item['ingredient_id']],
            quantity=Decimal(item['quantity'])
        )
    
    print("\n✅ Datos restaurados exitosamente")

def show_summary():
    """Mostrar resumen de datos restaurados"""
    print("\n📊 RESUMEN DE DATOS RESTAURADOS:")
    print(f"   • Unidades: {Unit.objects.count()}")
    print(f"   • Zonas: {Zone.objects.count()}")
    print(f"   • Mesas: {Table.objects.count()}")
    print(f"   • Envases: {Container.objects.count()}")
    print(f"   • Grupos: {Group.objects.count()}")
    print(f"   • Ingredientes: {Ingredient.objects.count()}")
    print(f"   • Recetas: {Recipe.objects.count()}")
    print(f"   • Items de recetas: {RecipeItem.objects.count()}")

if __name__ == "__main__":
    print("🔄 RESTAURACIÓN DESDE BACKUP")
    print("=" * 50)
    
    try:
        with transaction.atomic():
            clean_database()
            restore_data('/app/backup_to_restore.json')
        
        show_summary()
        print("\n✅ ¡RESTAURACIÓN COMPLETADA EXITOSAMENTE!")
    except Exception as e:
        print(f"\n❌ Error durante la restauración: {str(e)}")
        sys.exit(1)
PYTHON_SCRIPT'
    
    echo "🐍 Ejecutando restauración..."
    if docker exec $CONTAINER_NAME python /app/restore_db.py; then
        echo "✅ Restauración completada exitosamente"
    else
        echo "❌ Error durante la restauración"
        docker exec $CONTAINER_NAME rm -f /app/restore_db.py /app/backup_to_restore.json
        exit 1
    fi
    
    echo ""
    echo "🧹 Limpiando archivos temporales..."
    docker exec $CONTAINER_NAME rm -f /app/restore_db.py /app/backup_to_restore.json

else
    # Modo desarrollo local
    echo "🐍 Ejecutando restauración en modo desarrollo..."
    cd backend
    python << EOF
import os
import sys
import json
import django
from decimal import Decimal
from datetime import datetime

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import transaction
from config.models import Unit, Zone, Table, Container
from inventory.models import Group, Ingredient, Recipe, RecipeItem

def clean_database():
    """Limpia la base de datos en orden correcto"""
    print("🗑️  Limpiando base de datos...")
    
    # Orden correcto de limpieza (dependencias inversas)
    try:
        from operation.models import Order, OrderItem, Payment, PaymentItem
        PaymentItem.objects.all().delete()
        Payment.objects.all().delete()
        OrderItem.objects.all().delete()
        Order.objects.all().delete()
        print("✅ Limpieza de datos de operación completada")
    except ImportError:
        print("⚠️  Saltando limpieza de datos de operación (tablas no existen)")
    
    RecipeItem.objects.all().delete()
    Recipe.objects.all().delete()
    Ingredient.objects.all().delete()
    Group.objects.all().delete()
    Container.objects.all().delete()
    Table.objects.all().delete()
    Zone.objects.all().delete()
    Unit.objects.all().delete()
    
    # Reiniciar contadores de autoincremento
    from django.db import connection
    with connection.cursor() as cursor:
        # SQLite usa diferentes comandos para reiniciar secuencias
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='config_unit';")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='config_zone';")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='config_table';")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='config_container';")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='inventory_group';")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='inventory_ingredient';")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='inventory_recipe';")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='inventory_recipeitem';")
    
    print("✅ Base de datos limpiada y contadores reiniciados")

def restore_data(filename):
    """Restaura los datos desde el archivo JSON"""
    print(f"📂 Leyendo archivo: {filename}")
    
    with open(filename, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"📋 Versión del backup: {data['metadata']['version']}")
    print(f"📅 Fecha del backup: {data['metadata']['created_at']}")
    print(f"🏪 Restaurante: {data['metadata']['restaurant']}")
    print("")
    
    # Mapeo de IDs antiguos a nuevos
    id_map = {
        'units': {},
        'zones': {},
        'groups': {},
        'ingredients': {},
        'recipes': {}
    }
    
    # Restaurar unidades
    print("📏 Restaurando unidades...")
    for item in data['units']:
        obj = Unit.objects.create(name=item['name'])
        id_map['units'][item['id']] = obj.id
    
    # Restaurar zonas
    print("🏪 Restaurando zonas...")
    for item in data['zones']:
        obj = Zone.objects.create(name=item['name'])
        id_map['zones'][item['id']] = obj.id
    
    # Restaurar mesas
    print("🪑 Restaurando mesas...")
    for item in data['tables']:
        Table.objects.create(
            zone_id=id_map['zones'][item['zone_id']],
            table_number=item['table_number']
        )
    
    # Restaurar envases
    print("📦 Restaurando envases...")
    for item in data['containers']:
        Container.objects.create(
            name=item['name'],
            description=item['description'],
            price=Decimal(item['price']),
            stock=item['stock'],
            is_active=item['is_active']
        )
    
    # Restaurar grupos
    print("🏷️  Restaurando grupos...")
    for item in data['groups']:
        obj = Group.objects.create(name=item['name'])
        id_map['groups'][item['id']] = obj.id
    
    # Restaurar ingredientes
    print("🥩 Restaurando ingredientes...")
    for item in data['ingredients']:
        obj = Ingredient.objects.create(
            name=item['name'],
            unit_id=id_map['units'][item['unit_id']],
            current_stock=Decimal(item['current_stock']),
            unit_price=Decimal(item['unit_price']),
            is_active=item['is_active']
        )
        id_map['ingredients'][item['id']] = obj.id
    
    # Restaurar recetas
    print("👨‍🍳 Restaurando recetas...")
    for item in data['recipes']:
        obj = Recipe.objects.create(
            name=item['name'],
            group_id=id_map['groups'][item['group_id']],
            version=item['version'],
            base_price=Decimal(item['base_price']),
            profit_percentage=Decimal(item['profit_percentage']),
            is_available=item['is_available'],
            is_active=item['is_active'],
            preparation_time=item['preparation_time']
        )
        id_map['recipes'][item['id']] = obj.id
    
    # Restaurar items de recetas
    print("🍖 Restaurando componentes de recetas...")
    for item in data['recipe_items']:
        RecipeItem.objects.create(
            recipe_id=id_map['recipes'][item['recipe_id']],
            ingredient_id=id_map['ingredients'][item['ingredient_id']],
            quantity=Decimal(item['quantity'])
        )
    
    print("\n✅ Datos restaurados exitosamente")

def show_summary():
    """Mostrar resumen de datos restaurados"""
    print("\n📊 RESUMEN DE DATOS RESTAURADOS:")
    print(f"   • Unidades: {Unit.objects.count()}")
    print(f"   • Zonas: {Zone.objects.count()}")
    print(f"   • Mesas: {Table.objects.count()}")
    print(f"   • Envases: {Container.objects.count()}")
    print(f"   • Grupos: {Group.objects.count()}")
    print(f"   • Ingredientes: {Ingredient.objects.count()}")
    print(f"   • Recetas: {Recipe.objects.count()}")
    print(f"   • Items de recetas: {RecipeItem.objects.count()}")

if __name__ == "__main__":
    print("🔄 RESTAURACIÓN DESDE BACKUP")
    print("=" * 50)
    
    try:
        with transaction.atomic():
            clean_database()
            restore_data('../$BACKUP_FILE')
        
        show_summary()
        print("\n✅ ¡RESTAURACIÓN COMPLETADA EXITOSAMENTE!")
    except Exception as e:
        print(f"\n❌ Error durante la restauración: {str(e)}")
        sys.exit(1)
EOF
    cd ..
fi

echo ""
echo "🎉 ¡RESTAURACIÓN COMPLETADA!"
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
echo "✨ Los datos del backup han sido restaurados exitosamente"