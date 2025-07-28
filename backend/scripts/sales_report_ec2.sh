#!/bin/bash
# Script específico para EC2 para generar reportes de ventas en JSON

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Función para mostrar ayuda
show_help() {
    echo -e "${BLUE}🍽️  GENERADOR DE REPORTES DE VENTAS - EC2${NC}"
    echo "=============================================="
    echo ""
    echo "Uso: $0 [opciones]"
    echo ""
    echo "Opciones:"
    echo "  --today          Reporte del día de hoy"
    echo "  --month          Reporte del mes actual"
    echo "  --all            Reporte de todas las ventas (por defecto)"
    echo "  --date YYYY-MM-DD --end-date YYYY-MM-DD  Rango personalizado"
    echo "  --save-file nombre.json  Guardar en archivo específico"
    echo "  --help           Mostrar esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0                                    # Todas las ventas"
    echo "  $0 --today                           # Solo hoy"
    echo "  $0 --month                           # Este mes"
    echo "  $0 --date 2024-01-01 --end-date 2024-01-31  # Rango específico"
    echo "  $0 --today --save-file ventas_hoy.json      # Guardar en archivo"
}

# Procesar argumentos
DATE_FILTER=""
START_DATE=""
END_DATE=""
SAVE_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --today)
            DATE_FILTER="today"
            shift
            ;;
        --month)
            DATE_FILTER="month"
            shift
            ;;
        --all)
            DATE_FILTER="all"
            shift
            ;;
        --date)
            START_DATE="$2"
            shift 2
            ;;
        --end-date)
            END_DATE="$2"
            shift 2
            ;;
        --save-file)
            SAVE_FILE="$2"
            shift 2
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Opción desconocida: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Validar rango de fechas
if [[ -n "$START_DATE" && -z "$END_DATE" ]]; then
    echo -e "${RED}❌ Error: Si especifica --date, también debe especificar --end-date${NC}"
    exit 1
fi

if [[ -z "$START_DATE" && -n "$END_DATE" ]]; then
    echo -e "${RED}❌ Error: Si especifica --end-date, también debe especificar --date${NC}"
    exit 1
fi

# Si se especifica rango personalizado, usar ese filtro
if [[ -n "$START_DATE" && -n "$END_DATE" ]]; then
    DATE_FILTER="custom"
fi

# Establecer filtro por defecto
if [[ -z "$DATE_FILTER" ]]; then
    DATE_FILTER="all"
fi

echo -e "${YELLOW}🍽️  GENERADOR DE REPORTES DE VENTAS - EC2${NC}"
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

# Mostrar configuración
case $DATE_FILTER in
    "today")
        echo -e "${BLUE}📅 Período: Día de hoy${NC}"
        ;;
    "month")
        echo -e "${BLUE}📅 Período: Mes actual${NC}"
        ;;
    "custom")
        echo -e "${BLUE}📅 Período: $START_DATE al $END_DATE${NC}"
        ;;
    *)
        echo -e "${BLUE}📅 Período: Todas las ventas${NC}"
        ;;
esac

if [[ -n "$SAVE_FILE" ]]; then
    echo -e "${BLUE}💾 Guardar en: $SAVE_FILE${NC}"
fi

echo ""
echo -e "${YELLOW}Generando reporte detallado...${NC}"
echo ""

# Ejecutar script Python dentro del contenedor
PYTHON_SCRIPT="
import os
import sys
import django
import json
from datetime import datetime, date, timedelta
from decimal import Decimal

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection
from django.db.models import Sum, Count, Q
from operation.models import Order, OrderItem, Payment, PaymentItem
from inventory.models import Group

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return super().default(obj)

def generate_sales_report():
    print('=' * 60)
    print('REPORTE DE VENTAS DETALLADO')
    print('=' * 60)
    
    # Determinar filtro de fechas
    date_filter = '$DATE_FILTER'
    start_date = '$START_DATE'
    end_date = '$END_DATE'
    
    # Obtener órdenes pagadas
    orders_query = Order.objects.filter(status='PAID')
    
    if date_filter == 'today':
        today = date.today()
        orders_query = orders_query.filter(paid_at__date=today)
        period_text = f'Día de hoy ({today})'
    elif date_filter == 'month':
        today = date.today()
        start_of_month = date(today.year, today.month, 1)
        orders_query = orders_query.filter(paid_at__date__gte=start_of_month, paid_at__date__lte=today)
        period_text = f'Mes actual ({start_of_month} al {today})'
    elif date_filter == 'custom' and start_date and end_date:
        orders_query = orders_query.filter(paid_at__date__gte=start_date, paid_at__date__lte=end_date)
        period_text = f'Período personalizado ({start_date} al {end_date})'
    else:
        period_text = 'Todas las ventas'
    
    orders = orders_query.select_related('table', 'table__zone').prefetch_related(
        'orderitem_set__recipe__group',
        'orderitem_set__orderitemingredient_set__ingredient',
        'payments__payment_items'
    ).order_by('-paid_at')
    
    total_orders = orders.count()
    
    if total_orders == 0:
        print(f'❌ No hay ventas en el período: {period_text}')
        return
    
    print(f'📊 Período: {period_text}')
    print(f'📈 Total de órdenes pagadas: {total_orders}')
    print()
    
    # Calcular estadísticas generales
    total_revenue = orders.aggregate(total=Sum('total_amount'))['total'] or Decimal('0')
    avg_order_value = total_revenue / total_orders if total_orders > 0 else Decimal('0')
    
    # Estadísticas por método de pago
    payment_methods = {}
    payments = Payment.objects.filter(order__in=orders)
    for payment in payments:
        method = payment.get_payment_method_display()
        if method not in payment_methods:
            payment_methods[method] = {'count': 0, 'total': Decimal('0')}
        payment_methods[method]['count'] += 1
        payment_methods[method]['total'] += payment.amount
    
    # Ventas por zona
    zone_sales = {}
    for order in orders:
        zone = order.table.zone.name
        if zone not in zone_sales:
            zone_sales[zone] = {'count': 0, 'total': Decimal('0')}
        zone_sales[zone]['count'] += 1
        zone_sales[zone]['total'] += order.total_amount
    
    # Items más vendidos
    items_summary = {}
    all_items = OrderItem.objects.filter(order__in=orders).select_related('recipe', 'recipe__group')
    for item in all_items:
        recipe_name = item.recipe.name
        group_name = item.recipe.group.name if item.recipe.group else 'Sin Grupo'
        
        key = f'{recipe_name} ({group_name})'
        if key not in items_summary:
            items_summary[key] = {
                'recipe_name': recipe_name,
                'group_name': group_name,
                'quantity': 0,
                'revenue': Decimal('0')
            }
        items_summary[key]['quantity'] += 1
        items_summary[key]['revenue'] += item.total_price
    
    # Ordenar items por cantidad
    top_items = sorted(items_summary.items(), key=lambda x: x[1]['quantity'], reverse=True)[:10]
    
    # Ventas por grupo
    group_sales = {}
    groups = Group.objects.all()
    
    for group in groups:
        group_items = all_items.filter(recipe__group=group)
        if group_items.exists():
            group_revenue = sum(item.total_price for item in group_items)
            group_sales[group.name] = {
                'quantity': group_items.count(),
                'revenue': group_revenue
            }
    
    # Items sin grupo
    no_group_items = all_items.filter(recipe__group__isnull=True)
    if no_group_items.exists():
        no_group_revenue = sum(item.total_price for item in no_group_items)
        group_sales['Sin Grupo'] = {
            'quantity': no_group_items.count(),
            'revenue': no_group_revenue
        }
    
    # Órdenes detalladas
    detailed_orders = []
    for order in orders:
        order_data = {
            'order_id': order.id,
            'table': f'{order.table.zone.name} - {order.table.table_number}',
            'created_at': order.created_at,
            'served_at': order.served_at,
            'paid_at': order.paid_at,
            'total_amount': order.total_amount,
            'items': [],
            'payments': []
        }
        
        # Items de la orden
        for item in order.orderitem_set.all():
            item_data = {
                'recipe_name': item.recipe.name,
                'recipe_group': item.recipe.group.name if item.recipe.group else 'Sin Grupo',
                'unit_price': item.unit_price,
                'total_price': item.total_price,
                'notes': item.notes,
                'customizations': []
            }
            
            # Personalizaciones
            for custom in item.orderitemingredient_set.all():
                item_data['customizations'].append({
                    'ingredient': custom.ingredient.name,
                    'quantity': custom.quantity,
                    'unit_price': custom.unit_price,
                    'total_price': custom.total_price
                })
            
            order_data['items'].append(item_data)
        
        # Pagos de la orden
        for payment in order.payments.all():
            payment_data = {
                'payment_method': payment.get_payment_method_display(),
                'amount': payment.amount,
                'payer_name': payment.payer_name,
                'created_at': payment.created_at,
                'notes': payment.notes,
                'items_paid': []
            }
            
            # Items específicos pagados
            for payment_item in payment.payment_items.all():
                payment_data['items_paid'].append({
                    'item_recipe': payment_item.order_item.recipe.name,
                    'amount': payment_item.amount
                })
            
            order_data['payments'].append(payment_data)
        
        detailed_orders.append(order_data)
    
    # Construir reporte final
    report = {
        'metadata': {
            'generated_at': datetime.now(),
            'period': period_text,
            'total_orders': total_orders,
            'date_filter': date_filter
        },
        'summary': {
            'total_revenue': total_revenue,
            'average_order_value': avg_order_value,
            'payment_methods': dict(payment_methods),
            'zone_sales': dict(zone_sales),
            'group_sales': dict(group_sales)
        },
        'top_items': [
            {
                'recipe_name': item[1]['recipe_name'],
                'group_name': item[1]['group_name'],
                'quantity': item[1]['quantity'],
                'revenue': item[1]['revenue']
            }
            for item in top_items
        ],
        'detailed_orders': detailed_orders
    }
    
    # Convertir a JSON
    json_output = json.dumps(report, cls=DecimalEncoder, indent=2, ensure_ascii=False)
    
    # Mostrar resumen en consola
    print('📊 RESUMEN EJECUTIVO:')
    print(f'   💰 Ingresos totales: S/ {total_revenue:.2f}')
    print(f'   📋 Órdenes procesadas: {total_orders}')
    print(f'   💳 Ticket promedio: S/ {avg_order_value:.2f}')
    print()
    
    print('💳 MÉTODOS DE PAGO:')
    for method, data in payment_methods.items():
        percentage = (data['total'] / total_revenue * 100) if total_revenue > 0 else 0
        print(f'   {method}: S/ {data[\"total\"]:.2f} ({percentage:.1f}%) - {data[\"count\"]} pagos')
    print()
    
    print('📍 VENTAS POR ZONA:')
    for zone, data in zone_sales.items():
        percentage = (data['total'] / total_revenue * 100) if total_revenue > 0 else 0
        print(f'   {zone}: S/ {data[\"total\"]:.2f} ({percentage:.1f}%) - {data[\"count\"]} órdenes')
    print()
    
    print('🏆 TOP 5 ITEMS MÁS VENDIDOS:')
    for i, (_, item_data) in enumerate(top_items[:5], 1):
        print(f'   {i}. {item_data[\"recipe_name\"]} ({item_data[\"group_name\"]}): {item_data[\"quantity\"]} unidades - S/ {item_data[\"revenue\"]:.2f}')
    print()
    
    save_file = '$SAVE_FILE'
    if save_file:
        with open(save_file, 'w', encoding='utf-8') as f:
            f.write(json_output)
        print(f'💾 Reporte guardado en: {save_file}')
    else:
        # Generar nombre de archivo automático
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'reporte_ventas_{timestamp}.json'
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(json_output)
        print(f'💾 Reporte guardado automáticamente en: {filename}')
    
    print('=' * 60)
    print('✅ REPORTE GENERADO EXITOSAMENTE')
    
    return json_output

# Ejecutar generación de reporte
generate_sales_report()
"

# Reemplazar variables en el script Python
PYTHON_SCRIPT=$(echo "$PYTHON_SCRIPT" | sed "s/\$DATE_FILTER/$DATE_FILTER/g")
PYTHON_SCRIPT=$(echo "$PYTHON_SCRIPT" | sed "s/\$START_DATE/$START_DATE/g")
PYTHON_SCRIPT=$(echo "$PYTHON_SCRIPT" | sed "s/\$END_DATE/$END_DATE/g")
PYTHON_SCRIPT=$(echo "$PYTHON_SCRIPT" | sed "s/\$SAVE_FILE/$SAVE_FILE/g")

# Ejecutar en el contenedor
docker-compose -f $COMPOSE_FILE exec -T web python -c "$PYTHON_SCRIPT"

# Verificar resultado
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Reporte generado exitosamente${NC}"
    echo -e "${BLUE}📄 El archivo JSON contiene:${NC}"
    echo -e "${BLUE}   - Resumen ejecutivo con estadísticas${NC}"
    echo -e "${BLUE}   - Análisis por método de pago${NC}"
    echo -e "${BLUE}   - Ventas por zona del restaurante${NC}"
    echo -e "${BLUE}   - Top items más vendidos${NC}"
    echo -e "${BLUE}   - Desglose completo por grupos${NC}"
    echo -e "${BLUE}   - Detalle orden por orden${NC}"
    echo -e "${BLUE}   - Items con personalizaciones${NC}"
    echo -e "${BLUE}   - Información de pagos detallada${NC}"
else
    echo ""
    echo -e "${RED}❌ Error durante la generación del reporte${NC}"
    exit 1
fi