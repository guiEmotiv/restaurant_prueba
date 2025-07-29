#!/bin/bash
# Script específico para EC2 para eliminar datos de órdenes

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🍽️  LIMPIEZA DE DATOS DE ÓRDENES - EC2${NC}"
echo "=============================================="

# Detectar archivo docker-compose
if [ -f "docker-compose.ec2.yml" ]; then
    COMPOSE_FILE="docker-compose.ec2.yml"
elif [ -f "docker-compose.yml" ]; then
    COMPOSE_FILE="docker-compose.yml"
else
    echo -e "${RED}❌ Error: No se encontró archivo docker-compose${NC}"
    exit 1
fi

echo -e "${YELLOW}Usando: $COMPOSE_FILE${NC}"
echo ""

# Ejecutar script Python dentro del contenedor
echo -e "${YELLOW}Ejecutando limpieza de datos...${NC}"
echo ""

docker-compose -f $COMPOSE_FILE exec -T web python -c "
import os
import sys
import django

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection, transaction
from operation.models import Order, OrderItem, Payment, PaymentItem, OrderItemIngredient

# Intentar importar ContainerSale si existe
try:
    from operation.models import ContainerSale
    HAS_CONTAINER_SALE = True
except ImportError:
    HAS_CONTAINER_SALE = False

def clean_orders():
    print('=' * 60)
    print('ELIMINANDO TODOS LOS DATOS DE ÓRDENES')
    print('=' * 60)
    
    # Obtener conteos usando Django ORM
    orders = Order.objects.count()
    items = OrderItem.objects.count()
    payments = Payment.objects.count()
    payment_items = PaymentItem.objects.count()
    ingredients = OrderItemIngredient.objects.count()
    
    container_sales = 0
    if HAS_CONTAINER_SALE:
        container_sales = ContainerSale.objects.count()
    
    print(f'📊 DATOS ACTUALES:')
    print(f'   Órdenes: {orders}')
    print(f'   Items: {items}')
    print(f'   Pagos: {payments}')
    print(f'   Items de pago: {payment_items}')
    print(f'   Ingredientes: {ingredients}')
    if HAS_CONTAINER_SALE:
        print(f'   Ventas de envases: {container_sales}')
    print()
    
    if orders == 0 and items == 0 and payments == 0 and container_sales == 0:
        print('✅ Base de datos ya está limpia')
        return
    
    print('🗑️  ELIMINANDO DATOS...')
    
    try:
        # Método 1: Usar Django ORM (más confiable)
        print('🔄 Usando Django ORM para eliminación segura...')
        
        # Eliminar usando ORM en orden correcto
        d1 = PaymentItem.objects.all().count()
        PaymentItem.objects.all().delete()
        print(f'   ✓ Items de pago: {d1}')
        
        d2 = Payment.objects.all().count()
        Payment.objects.all().delete()
        print(f'   ✓ Pagos: {d2}')
        
        d3 = OrderItemIngredient.objects.all().count()
        OrderItemIngredient.objects.all().delete()
        print(f'   ✓ Ingredientes de items: {d3}')
        
        # Eliminar ventas de envases si existe el modelo
        d6 = 0
        if HAS_CONTAINER_SALE:
            d6 = ContainerSale.objects.all().count()
            ContainerSale.objects.all().delete()
            print(f'   ✓ Ventas de envases: {d6}')
        
        d4 = OrderItem.objects.all().count()
        OrderItem.objects.all().delete()
        print(f'   ✓ Items de orden: {d4}')
        
        d5 = Order.objects.all().count()
        Order.objects.all().delete()
        print(f'   ✓ Órdenes: {d5}')
        
        # Método 2: Resetear contadores con SQL directo
        print('🔄 Reseteando contadores de autoincremento...')
        with connection.cursor() as cursor:
            # Deshabilitar claves foráneas para este comando específico
            cursor.execute('PRAGMA foreign_keys = OFF')
            cursor.execute('DELETE FROM sqlite_sequence WHERE name IN (\"operation_order\", \"operation_orderitem\", \"operation_payment\", \"operation_paymentitem\", \"operation_orderitemingredient\", \"operation_containersale\")')
            cursor.execute('PRAGMA foreign_keys = ON')
            print(f'   ✓ Contadores reseteados')
                
        print()
        print('✅ LIMPIEZA COMPLETADA EXITOSAMENTE')
        print(f'   Total eliminado: {d1 + d2 + d3 + d4 + d5 + d6} registros')
        print('   🔄 Contadores de ID reseteados a 1')
        
    except Exception as e:
        print(f'❌ ERROR: {str(e)}')
        return
    
    print('=' * 60)

clean_orders()
"

# Verificar resultado
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Proceso completado exitosamente${NC}"
    echo -e "${GREEN}Los datos han sido eliminados de la base de datos${NC}"
    echo -e "${YELLOW}💡 Ahora puedes modificar las recetas sin restricciones${NC}"
else
    echo ""
    echo -e "${RED}❌ Error durante la ejecución${NC}"
    exit 1
fi