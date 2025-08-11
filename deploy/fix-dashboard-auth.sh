#!/bin/bash

# Fix Dashboard Authentication Issues
echo "🔐 FIXING DASHBOARD AUTHENTICATION"
echo "=================================="

cd /opt/restaurant-web

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 1. Check current permissions on dashboard
echo -e "\n1️⃣ Checking Dashboard Permissions..."
docker-compose -f docker-compose.ssl.yml exec -T web python manage.py shell << 'EOF'
from operation.views_dashboard import DashboardViewSet
from backend.cognito_permissions import CognitoWaiterAndAdminPermission

# Check current permissions
viewset = DashboardViewSet()
print(f"Current permissions: {viewset.permission_classes}")

# Check if it requires authentication
if viewset.permission_classes == []:
    print("✅ Dashboard allows anonymous access")
else:
    print("❌ Dashboard requires authentication")
    print("   This might be why it returns 400 without proper auth token")
EOF

# 2. Create a test endpoint without authentication
echo -e "\n2️⃣ Creating test endpoint..."
cat > /tmp/test_dashboard.py << 'EOF'
# Add this to test if dashboard works without auth
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from datetime import datetime, timezone

@csrf_exempt
def test_dashboard(request):
    """Test endpoint to verify dashboard data access"""
    from operation.models import Order
    
    try:
        # Get date parameter
        date_param = request.GET.get('date', datetime.now().strftime('%Y-%m-%d'))
        
        # Count orders
        total_orders = Order.objects.count()
        paid_orders = Order.objects.filter(status='PAID').count()
        
        return JsonResponse({
            'status': 'ok',
            'date': date_param,
            'total_orders': total_orders,
            'paid_orders': paid_orders,
            'message': 'Dashboard test successful'
        })
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'error': str(e)
        }, status=500)
EOF

# 3. Test with curl (simulating browser request)
echo -e "\n3️⃣ Testing Dashboard API..."

# Test without authentication
echo "Test 1 - Without auth token:"
curl -s -X GET \
  "http://localhost:8000/api/v1/dashboard/report/?date=$(date +%Y-%m-%d)" \
  -H "Accept: application/json" \
  -H "Origin: https://www.xn--elfogndedonsoto-zrb.com" | jq . 2>/dev/null || echo "Failed"

# Test with fake auth token
echo -e "\nTest 2 - With fake auth token:"
curl -s -X GET \
  "http://localhost:8000/api/v1/dashboard/report/?date=$(date +%Y-%m-%d)" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer fake-token-for-testing" \
  -H "Origin: https://www.xn--elfogndedonsoto-zrb.com" | jq . 2>/dev/null || echo "Failed"

# 4. Check Django settings for authentication
echo -e "\n4️⃣ Checking Django Authentication Settings..."
docker-compose -f docker-compose.ssl.yml exec -T web python -c "
from django.conf import settings
print('REST_FRAMEWORK settings:')
for key, value in settings.REST_FRAMEWORK.items():
    if 'AUTH' in key:
        print(f'  {key}: {value}')

print('\nAuthentication backends:')
for backend in settings.AUTHENTICATION_BACKENDS:
    print(f'  - {backend}')
"

# 5. Temporary fix - disable auth for dashboard
echo -e "\n5️⃣ Creating temporary fix..."
cat > /tmp/fix_dashboard_auth.py << 'EOF'
# This script temporarily disables authentication for dashboard
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_ec2')
django.setup()

from operation.views_dashboard import DashboardViewSet

# Check current setting
print(f"Current permission_classes: {DashboardViewSet.permission_classes}")

# If you want to temporarily disable auth, uncomment:
# DashboardViewSet.permission_classes = []
# print("Dashboard authentication temporarily disabled")
EOF

# 6. Check if there's data to show
echo -e "\n6️⃣ Checking if there's data..."
docker-compose -f docker-compose.ssl.yml exec -T web python manage.py shell << 'EOF'
from operation.models import Order
from datetime import datetime, timedelta

# Check orders
total_orders = Order.objects.count()
paid_orders = Order.objects.filter(status='PAID').count()
recent_paid = Order.objects.filter(
    status='PAID',
    paid_at__gte=datetime.now().replace(tzinfo=None) - timedelta(days=30)
).count()

print(f"Total orders: {total_orders}")
print(f"Paid orders: {paid_orders}")
print(f"Paid in last 30 days: {recent_paid}")

if paid_orders == 0:
    print("\n⚠️  No paid orders found!")
    print("The dashboard might return empty data")
    print("Create some test orders and mark them as PAID")
EOF

echo -e "\n📝 ${YELLOW}RECOMMENDATIONS:${NC}"
echo "1. If dashboard requires auth, frontend needs valid Cognito token"
echo "2. If no paid orders exist, dashboard will be empty"
echo "3. Check browser console for authentication errors"
echo "4. Verify Cognito is configured correctly in frontend"

echo -e "\n${GREEN}To populate test data:${NC}"
echo "docker-compose -f docker-compose.ssl.yml exec web python manage.py populate_production_data"