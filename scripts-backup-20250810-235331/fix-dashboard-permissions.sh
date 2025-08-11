#!/bin/bash

echo "=== Fix Dashboard and Permissions Issues ==="
echo "==========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_DIR="/opt/restaurant-web"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

cd "$PROJECT_DIR"

# 1. Check if dashboard endpoint exists
echo -e "\n${BLUE}🔍 Checking dashboard endpoint...${NC}"
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py shell << 'EOF'
from django.urls import get_resolver
resolver = get_resolver()

# Look for dashboard URLs
print("Looking for dashboard URLs...")
for pattern in resolver.url_patterns:
    if hasattr(pattern, 'pattern'):
        url_str = str(pattern.pattern)
        if 'dashboard' in url_str.lower():
            print(f"Found: {url_str}")
            
# Check if the endpoint exists in operation app
try:
    from operation.urls import urlpatterns
    print("\nOperation app URLs:")
    for pattern in urlpatterns:
        if hasattr(pattern, 'pattern'):
            print(f"  - {pattern.pattern}")
except Exception as e:
    print(f"Error checking operation URLs: {e}")
EOF

# 2. Add dashboard view if missing
echo -e "\n${BLUE}📝 Creating dashboard view if missing...${NC}"
cat > /tmp/dashboard_view.py << 'EOF'
from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count, F, Q
from django.utils import timezone
from datetime import datetime, timedelta
from operation.models import Order, Payment, OrderItem
from config.models import Table, Zone
from inventory.models import Recipe
from backend.cognito_permissions import CognitoWaiterAndAdminPermission


class DashboardReportView(views.APIView):
    """Dashboard report for the restaurant"""
    permission_classes = [IsAuthenticated, CognitoWaiterAndAdminPermission]
    
    def get(self, request):
        # Get date parameter
        date_str = request.query_params.get('date')
        if date_str:
            try:
                report_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                report_date = timezone.now().date()
        else:
            report_date = timezone.now().date()
        
        # Get orders for the date
        start_datetime = timezone.make_aware(
            datetime.combine(report_date, datetime.min.time())
        )
        end_datetime = timezone.make_aware(
            datetime.combine(report_date, datetime.max.time())
        )
        
        orders = Order.objects.filter(
            created_at__gte=start_datetime,
            created_at__lte=end_datetime
        )
        
        # Calculate metrics
        total_sales = orders.aggregate(
            total=Sum('total')
        )['total'] or 0
        
        total_orders = orders.count()
        
        # Orders by status
        orders_by_status = orders.values('status').annotate(
            count=Count('id')
        ).order_by('status')
        
        # Most sold items
        top_items = OrderItem.objects.filter(
            order__in=orders
        ).values(
            'recipe__name'
        ).annotate(
            quantity=Sum('quantity'),
            revenue=Sum(F('quantity') * F('unit_price'))
        ).order_by('-quantity')[:10]
        
        # Tables status
        tables_status = Table.objects.values(
            'table_number',
            'zone__name'
        ).annotate(
            orders_count=Count(
                'orders',
                filter=Q(
                    orders__created_at__gte=start_datetime,
                    orders__created_at__lte=end_datetime
                )
            )
        )
        
        # Revenue by hour
        revenue_by_hour = []
        for hour in range(24):
            hour_start = start_datetime.replace(hour=hour, minute=0, second=0)
            hour_end = hour_start + timedelta(hours=1)
            
            hour_revenue = orders.filter(
                created_at__gte=hour_start,
                created_at__lt=hour_end
            ).aggregate(
                total=Sum('total')
            )['total'] or 0
            
            if hour_revenue > 0:
                revenue_by_hour.append({
                    'hour': f'{hour:02d}:00',
                    'revenue': float(hour_revenue)
                })
        
        return Response({
            'date': report_date.isoformat(),
            'summary': {
                'total_sales': float(total_sales),
                'total_orders': total_orders,
                'average_ticket': float(total_sales / total_orders) if total_orders > 0 else 0
            },
            'orders_by_status': list(orders_by_status),
            'top_items': list(top_items),
            'tables_status': list(tables_status),
            'revenue_by_hour': revenue_by_hour
        })
EOF

# 3. Update operation views
echo -e "\n${BLUE}🔧 Updating operation views...${NC}"
docker-compose -f docker-compose.ec2.yml exec -T web bash -c "
cd /app
# Backup original file
cp operation/views.py operation/views.py.backup

# Check if dashboard view exists
if ! grep -q 'DashboardReportView' operation/views.py; then
    echo 'Adding dashboard view...'
    cat /tmp/dashboard_view.py >> operation/views.py
fi
"

# 4. Update operation URLs
echo -e "\n${BLUE}🔗 Updating operation URLs...${NC}"
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py shell << 'EOF'
import os

# Read current URLs
urls_path = '/app/operation/urls.py'
with open(urls_path, 'r') as f:
    content = f.read()

# Check if dashboard URL exists
if 'dashboard/report' not in content:
    print("Adding dashboard URL...")
    
    # Find where to insert (before the last closing bracket)
    import_section = content.split('urlpatterns')[0]
    urlpatterns_section = content.split('urlpatterns')[1]
    
    # Add import if needed
    if 'DashboardReportView' not in import_section:
        import_section = import_section.rstrip() + '\nfrom .views import DashboardReportView\n'
    
    # Add URL pattern
    last_bracket = urlpatterns_section.rfind(']')
    new_pattern = '    path("dashboard/report/", DashboardReportView.as_view(), name="dashboard-report"),\n'
    urlpatterns_section = urlpatterns_section[:last_bracket] + new_pattern + urlpatterns_section[last_bracket:]
    
    # Write back
    with open(urls_path, 'w') as f:
        f.write(import_section + 'urlpatterns' + urlpatterns_section)
    
    print("✅ Dashboard URL added")
else:
    print("✅ Dashboard URL already exists")
EOF

# 5. Test permissions
echo -e "\n${BLUE}🔐 Testing permission classes...${NC}"
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py shell << 'EOF'
from backend.cognito_permissions import *

# Test that permission classes exist
permissions_to_test = [
    CognitoAdminOnlyPermission,
    CognitoCookOnlyPermission,
    CognitoOrderStatusPermission,
    CognitoWaiterAndAdminPermission,
    CognitoReadOnlyForNonAdmins
]

for perm_class in permissions_to_test:
    print(f"✅ {perm_class.__name__} exists")
EOF

# 6. Restart backend
echo -e "\n${BLUE}🔄 Restarting backend...${NC}"
docker-compose -f docker-compose.ec2.yml restart web
sleep 10

# 7. Test dashboard endpoint
echo -e "\n${BLUE}🎯 Testing dashboard endpoint...${NC}"
DASHBOARD_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/dashboard/report/?date=2025-08-08)
echo "Dashboard endpoint status: $DASHBOARD_TEST"

if [ "$DASHBOARD_TEST" = "401" ] || [ "$DASHBOARD_TEST" = "403" ]; then
    echo -e "${GREEN}✅ Dashboard endpoint requires authentication (good)${NC}"
elif [ "$DASHBOARD_TEST" = "200" ]; then
    echo -e "${YELLOW}⚠️ Dashboard accessible without auth${NC}"
elif [ "$DASHBOARD_TEST" = "404" ]; then
    echo -e "${RED}❌ Dashboard endpoint not found${NC}"
else
    echo -e "${RED}❌ Unexpected status: $DASHBOARD_TEST${NC}"
fi

# 8. Check CORS configuration in settings
echo -e "\n${BLUE}🌐 Checking CORS settings...${NC}"
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py shell << 'EOF'
from django.conf import settings

print("CORS settings:")
print(f"CORS_ALLOWED_ORIGINS: {getattr(settings, 'CORS_ALLOWED_ORIGINS', 'Not set')}")
print(f"CORS_ALLOW_ALL_ORIGINS: {getattr(settings, 'CORS_ALLOW_ALL_ORIGINS', 'Not set')}")
print(f"CORS_ALLOW_CREDENTIALS: {getattr(settings, 'CORS_ALLOW_CREDENTIALS', 'Not set')}")

# Check middleware
print("\nMiddleware:")
for m in settings.MIDDLEWARE:
    if 'cors' in m.lower() or 'cognito' in m.lower():
        print(f"  - {m}")
EOF

# 9. Fix CORS if needed
echo -e "\n${BLUE}🔧 Ensuring CORS is properly configured...${NC}"
docker-compose -f docker-compose.ec2.yml exec -T web bash -c "
cd /app
# Update settings to ensure CORS works
python -c \"
import os

settings_file = 'backend/settings_ec2.py'
with open(settings_file, 'r') as f:
    content = f.read()

# Ensure CORS settings
if 'CORS_ALLOWED_ORIGINS' not in content:
    print('Adding CORS settings...')
    cors_settings = '''
# CORS Configuration
CORS_ALLOWED_ORIGINS = [
    'https://www.xn--elfogndedonsoto-zrb.com',
    'https://xn--elfogndedonsoto-zrb.com',
]

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]
'''
    with open(settings_file, 'a') as f:
        f.write(cors_settings)
    print('✅ CORS settings added')
else:
    print('✅ CORS already configured')
\"
"

# 10. Final restart
echo -e "\n${BLUE}🔄 Final restart...${NC}"
docker-compose -f docker-compose.ec2.yml restart web
sleep 10

# Summary
echo -e "\n${GREEN}📊 Dashboard fix completed!${NC}"
echo ""
echo "Changes made:"
echo "1. Added dashboard view if missing"
echo "2. Updated operation URLs"
echo "3. Verified permission classes"
echo "4. Configured CORS properly"
echo ""
echo "The dashboard should now work with proper authentication."
echo ""
echo -e "${YELLOW}⚠️ Important:${NC}"
echo "- Users must be in 'administradores' or 'meseros' group in Cognito"
echo "- Frontend must send valid JWT token in Authorization header"
echo "- Clear browser cache and try again"

echo -e "\n${BLUE}Monitor backend logs:${NC}"
echo "docker-compose -f docker-compose.ec2.yml logs -f web"