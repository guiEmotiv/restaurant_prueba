#!/bin/bash
# Script para hacer backup de datos de configuración del restaurante
# Guarda: unidades, zonas, mesas, envases, grupos, ingredientes y recetas

set -e  # Salir si hay errores

echo "🍽️  EL FOGÓN DE DON SOTO - BACKUP DE DATOS"
echo "=========================================="
echo ""

# Detectar entorno
if [ -f "/.dockerenv" ] || [ -n "${DOCKER_CONTAINER}" ] || [ -d "/opt/restaurant-web" ] || [ "$(whoami)" = "ubuntu" ]; then
    echo "🐳 Detectado: Servidor EC2 (Producción)"
    ENV_TYPE="production"
    # En EC2, usar el contenedor correcto
    CONTAINER_NAME="restaurant-web-web-1"
    # Verificar si el contenedor existe con otro nombre
    if ! docker ps -a | grep -q "$CONTAINER_NAME"; then
        CONTAINER_NAME=$(docker ps --format "table {{.Names}}" | grep -E "restaurant|web" | head -1)
        if [ -z "$CONTAINER_NAME" ]; then
            echo "❌ Error: No se encontró el contenedor Docker"
            echo "   Contenedores disponibles:"
            docker ps --format "table {{.Names}}\t{{.Status}}"
            exit 1
        fi
        echo "📦 Usando contenedor: $CONTAINER_NAME"
    fi
else
    echo "💻 Detectado: Desarrollo local"
    ENV_TYPE="development"
fi

# Crear directorio de backups si no existe
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

# Generar nombre de archivo con timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="backup_restaurant_${TIMESTAMP}"
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.json"

echo "📊 Este script hará backup de:"
echo "   • Unidades de medida"
echo "   • Zonas del restaurante"
echo "   • Mesas"
echo "   • Envases"
echo "   • Grupos de ingredientes"
echo "   • Ingredientes"
echo "   • Recetas y sus componentes"
echo ""

# Confirmación
read -p "¿Proceder con el backup? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Operación cancelada"
    exit 1
fi

echo ""
echo "🚀 Iniciando backup de datos..."
echo ""

# Crear script Python para el backup
if [ "$ENV_TYPE" = "production" ]; then
    echo "📋 Creando script de backup en contenedor..."
    
    # Crear el script Python en el contenedor
    docker exec $CONTAINER_NAME bash -c 'cat > /app/backup_db.py << '\''PYTHON_SCRIPT'\''
#!/usr/bin/env python3
import os
import sys
import json
import django
from decimal import Decimal
from datetime import datetime

# Configurar entorno Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings_ec2")
django.setup()

from config.models import Unit, Zone, Table, Container
from inventory.models import Group, Ingredient, Recipe, RecipeItem

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return str(obj)
        return super().default(obj)

def export_data():
    """Exporta todos los datos de configuración"""
    print("📦 Exportando datos...")
    
    data = {
        "metadata": {
            "version": "1.0",
            "created_at": datetime.now().isoformat(),
            "restaurant": "El Fogón de Don Soto"
        },
        "units": [],
        "zones": [],
        "tables": [],
        "containers": [],
        "groups": [],
        "ingredients": [],
        "recipes": [],
        "recipe_items": []
    }
    
    # Exportar unidades
    print("   • Exportando unidades...")
    for unit in Unit.objects.all():
        data["units"].append({
            "id": unit.id,
            "name": unit.name
        })
    
    # Exportar zonas
    print("   • Exportando zonas...")
    for zone in Zone.objects.all():
        data["zones"].append({
            "id": zone.id,
            "name": zone.name
        })
    
    # Exportar mesas
    print("   • Exportando mesas...")
    for table in Table.objects.all():
        data["tables"].append({
            "id": table.id,
            "zone_id": table.zone_id,
            "zone_name": table.zone.name,
            "table_number": table.table_number
        })
    
    # Exportar envases
    print("   • Exportando envases...")
    for container in Container.objects.all():
        data["containers"].append({
            "id": container.id,
            "name": container.name,
            "description": container.description,
            "price": str(container.price),
            "stock": container.stock,
            "is_active": container.is_active
        })
    
    # Exportar grupos
    print("   • Exportando grupos...")
    for group in Group.objects.all():
        data["groups"].append({
            "id": group.id,
            "name": group.name
        })
    
    # Exportar ingredientes
    print("   • Exportando ingredientes...")
    for ingredient in Ingredient.objects.all():
        data["ingredients"].append({
            "id": ingredient.id,
            "name": ingredient.name,
            "unit_id": ingredient.unit_id,
            "unit_name": ingredient.unit.name,
            "current_stock": str(ingredient.current_stock),
            "unit_price": str(ingredient.unit_price),
            "is_active": ingredient.is_active
        })
    
    # Exportar recetas
    print("   • Exportando recetas...")
    for recipe in Recipe.objects.all():
        data["recipes"].append({
            "id": recipe.id,
            "name": recipe.name,
            "group_id": recipe.group_id,
            "group_name": recipe.group.name,
            "version": recipe.version,
            "base_price": str(recipe.base_price),
            "profit_percentage": str(recipe.profit_percentage),
            "is_available": recipe.is_available,
            "is_active": recipe.is_active,
            "preparation_time": recipe.preparation_time
        })
    
    # Exportar items de recetas
    print("   • Exportando componentes de recetas...")
    for item in RecipeItem.objects.all():
        data["recipe_items"].append({
            "id": item.id,
            "recipe_id": item.recipe_id,
            "recipe_name": item.recipe.name,
            "ingredient_id": item.ingredient_id,
            "ingredient_name": item.ingredient.name,
            "quantity": str(item.quantity)
        })
    
    # Mostrar resumen
    print("\n📊 RESUMEN DEL BACKUP:")
    print(f"   • Unidades: {len(data['units'])}")
    print(f"   • Zonas: {len(data['zones'])}")
    print(f"   • Mesas: {len(data['tables'])}")
    print(f"   • Envases: {len(data['containers'])}")
    print(f"   • Grupos: {len(data['groups'])}")
    print(f"   • Ingredientes: {len(data['ingredients'])}")
    print(f"   • Recetas: {len(data['recipes'])}")
    print(f"   • Items de recetas: {len(data['recipe_items'])}")
    
    return data

if __name__ == "__main__":
    try:
        data = export_data()
        # Imprimir JSON a stdout para que el script bash lo capture
        print("\n---JSON_START---")
        print(json.dumps(data, cls=DecimalEncoder, indent=2, ensure_ascii=False))
        print("---JSON_END---")
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        sys.exit(1)
PYTHON_SCRIPT'
    
    echo "🐍 Ejecutando backup..."
    # Ejecutar y capturar el output
    docker exec $CONTAINER_NAME python /app/backup_db.py > temp_backup.txt 2>&1
    
    # Verificar si el backup se ejecutó correctamente
    if ! grep -q "---JSON_START---" temp_backup.txt; then
        echo "❌ Error al ejecutar el backup:"
        cat temp_backup.txt
        rm -f temp_backup.txt
        docker exec $CONTAINER_NAME rm -f /app/backup_db.py
        exit 1
    fi
    
    # Extraer solo el JSON del output
    sed -n '/---JSON_START---/,/---JSON_END---/p' temp_backup.txt | sed '1d;$d' > "$BACKUP_FILE"
    rm temp_backup.txt
    
    echo "🧹 Limpiando archivo temporal..."
    docker exec $CONTAINER_NAME rm -f /app/backup_db.py

else
    # Modo desarrollo local
    echo "🐍 Ejecutando backup en modo desarrollo..."
    cd backend
    python << 'EOF' > "../$BACKUP_FILE"
import os
import sys
import json
import django
from decimal import Decimal
from datetime import datetime

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from config.models import Unit, Zone, Table, Container
from inventory.models import Group, Ingredient, Recipe, RecipeItem

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return str(obj)
        return super().default(obj)

def export_data():
    """Exporta todos los datos de configuración"""
    data = {
        "metadata": {
            "version": "1.0",
            "created_at": datetime.now().isoformat(),
            "restaurant": "El Fogón de Don Soto"
        },
        "units": [],
        "zones": [],
        "tables": [],
        "containers": [],
        "groups": [],
        "ingredients": [],
        "recipes": [],
        "recipe_items": []
    }
    
    # Exportar unidades
    for unit in Unit.objects.all():
        data["units"].append({
            "id": unit.id,
            "name": unit.name
        })
    
    # Exportar zonas
    for zone in Zone.objects.all():
        data["zones"].append({
            "id": zone.id,
            "name": zone.name
        })
    
    # Exportar mesas
    for table in Table.objects.all():
        data["tables"].append({
            "id": table.id,
            "zone_id": table.zone_id,
            "zone_name": table.zone.name,
            "table_number": table.table_number
        })
    
    # Exportar envases
    for container in Container.objects.all():
        data["containers"].append({
            "id": container.id,
            "name": container.name,
            "description": container.description,
            "price": str(container.price),
            "stock": container.stock,
            "is_active": container.is_active
        })
    
    # Exportar grupos
    for group in Group.objects.all():
        data["groups"].append({
            "id": group.id,
            "name": group.name
        })
    
    # Exportar ingredientes
    for ingredient in Ingredient.objects.all():
        data["ingredients"].append({
            "id": ingredient.id,
            "name": ingredient.name,
            "unit_id": ingredient.unit_id,
            "unit_name": ingredient.unit.name,
            "current_stock": str(ingredient.current_stock),
            "unit_price": str(ingredient.unit_price),
            "is_active": ingredient.is_active
        })
    
    # Exportar recetas
    for recipe in Recipe.objects.all():
        data["recipes"].append({
            "id": recipe.id,
            "name": recipe.name,
            "group_id": recipe.group_id,
            "group_name": recipe.group.name,
            "version": recipe.version,
            "base_price": str(recipe.base_price),
            "profit_percentage": str(recipe.profit_percentage),
            "is_available": recipe.is_available,
            "is_active": recipe.is_active,
            "preparation_time": recipe.preparation_time
        })
    
    # Exportar items de recetas
    for item in RecipeItem.objects.all():
        data["recipe_items"].append({
            "id": item.id,
            "recipe_id": item.recipe_id,
            "recipe_name": item.recipe.name,
            "ingredient_id": item.ingredient_id,
            "ingredient_name": item.ingredient.name,
            "quantity": str(item.quantity)
        })
    
    return data

if __name__ == "__main__":
    data = export_data()
    print(json.dumps(data, cls=DecimalEncoder, indent=2, ensure_ascii=False))
EOF
    cd ..
fi

echo ""

# Verificar que el archivo se creó correctamente
if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    FILE_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
    echo "✅ ¡BACKUP COMPLETADO!"
    echo "============================================"
    echo ""
    echo "📁 Archivo guardado en: $BACKUP_FILE ($FILE_SIZE)"
    
    # Verificar que es un JSON válido
    if python -m json.tool "$BACKUP_FILE" > /dev/null 2>&1; then
        echo "✅ JSON válido"
    else
        echo "⚠️  Advertencia: El archivo podría no ser un JSON válido"
    fi
else
    echo "❌ Error: El archivo de backup no se creó o está vacío"
    exit 1
fi

echo ""

# Mostrar lista de backups disponibles
echo "📋 Backups disponibles:"
ls -lh "$BACKUP_DIR" | grep "backup_restaurant_" | awk '{print "   • " $9 " (" $5 ")"}'
echo ""
echo "💡 Para restaurar este backup usa:"
echo "   ./scripts/restore_database.sh"