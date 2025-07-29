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

def clean_orders():
    print('=' * 60)
    print('ELIMINANDO TODOS LOS DATOS DE ÓRDENES')
    print('=' * 60)
    
    # Obtener conteos
    with connection.cursor() as cursor:
        cursor.execute('SELECT COUNT(*) FROM \"order\"')
        orders = cursor.fetchone()[0]
        cursor.execute('SELECT COUNT(*) FROM order_item')
        items = cursor.fetchone()[0]
        cursor.execute('SELECT COUNT(*) FROM payment')
        payments = cursor.fetchone()[0]
        cursor.execute('SELECT COUNT(*) FROM payment_item')
        payment_items = cursor.fetchone()[0]
        cursor.execute('SELECT COUNT(*) FROM order_item_ingredient')
        ingredients = cursor.fetchone()[0]
        
        # Verificar si existe la tabla container_sale
        cursor.execute(\"\"\"
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='operation_containersale'
        \"\"\")
        has_container_sales = cursor.fetchone() is not None
        
        container_sales = 0
        if has_container_sales:
            cursor.execute('SELECT COUNT(*) FROM operation_containersale')
            container_sales = cursor.fetchone()[0]
    
    print(f'📊 DATOS ACTUALES:')
    print(f'   Órdenes: {orders}')
    print(f'   Items: {items}')
    print(f'   Pagos: {payments}')
    print(f'   Items de pago: {payment_items}')
    print(f'   Ingredientes: {ingredients}')
    if has_container_sales:
        print(f'   Ventas de envases: {container_sales}')
    print()
    
    if orders == 0 and items == 0 and payments == 0 and container_sales == 0:
        print('✅ Base de datos ya está limpia')
        return
    
    print('🗑️  ELIMINANDO DATOS...')
    
    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                # Deshabilitar claves foráneas temporalmente para SQLite
                cursor.execute('PRAGMA foreign_keys = OFF')
                
                # Eliminar en orden correcto
                cursor.execute('DELETE FROM payment_item')
                d1 = cursor.rowcount
                print(f'   ✓ Items de pago: {d1}')
                
                cursor.execute('DELETE FROM payment')
                d2 = cursor.rowcount
                print(f'   ✓ Pagos: {d2}')
                
                cursor.execute('DELETE FROM order_item_ingredient')
                d3 = cursor.rowcount
                print(f'   ✓ Ingredientes de items: {d3}')
                
                # Eliminar ventas de envases si existe la tabla
                d6 = 0
                if has_container_sales:
                    cursor.execute('DELETE FROM operation_containersale')
                    d6 = cursor.rowcount
                    print(f'   ✓ Ventas de envases: {d6}')
                
                cursor.execute('DELETE FROM order_item')
                d4 = cursor.rowcount
                print(f'   ✓ Items de orden: {d4}')
                
                cursor.execute('DELETE FROM \"order\"')
                d5 = cursor.rowcount
                print(f'   ✓ Órdenes: {d5}')
                
                # Resetear contadores de autoincremento
                cursor.execute('DELETE FROM sqlite_sequence WHERE name IN (\"order\", \"order_item\", \"payment\", \"payment_item\", \"order_item_ingredient\", \"operation_containersale\")')
                print(f'   ✓ Contadores reseteados')
                
                # Rehabilitar claves foráneas
                cursor.execute('PRAGMA foreign_keys = ON')
                
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