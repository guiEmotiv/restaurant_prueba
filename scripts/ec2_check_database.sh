#!/bin/bash
# Script para VERIFICAR el contenido actual de la base de datos de producción

echo "🔍 VERIFICACIÓN DE BASE DE DATOS DE PRODUCCIÓN"
echo "============================================="
echo ""

# Verificar conteo de registros usando Django shell
echo "📊 Conteo actual de registros:"
echo ""

docker exec restaurant-web-web-1 python manage.py shell << 'EOF'
from config.models import Zone, Table, Unit, Container
from inventory.models import Group, Ingredient, Recipe
from operation.models import Order, Payment

print(f"Zonas: {Zone.objects.count()}")
print(f"Mesas: {Table.objects.count()}")
print(f"Unidades: {Unit.objects.count()}")
print(f"Envases: {Container.objects.count()}")
print(f"Grupos: {Group.objects.count()}")
print(f"Ingredientes: {Ingredient.objects.count()}")
print(f"Recetas: {Recipe.objects.count()}")
print(f"Órdenes: {Order.objects.count()}")
print(f"Pagos: {Payment.objects.count()}")
print("")
print("Últimas 5 órdenes:")
for order in Order.objects.all().order_by('-created_at')[:5]:
    print(f"  - Orden #{order.id}: Mesa {order.table.table_number} - {order.status} - ${order.total_amount}")
EOF

echo ""
echo "✅ Verificación completada"
echo ""
echo "💡 Si necesitas limpiar estos datos, ejecuta:"
echo "   sudo ./scripts/ec2_clean_database.sh"