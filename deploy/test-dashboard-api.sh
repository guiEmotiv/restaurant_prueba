#!/bin/bash

# Test Dashboard API
echo "📊 TESTING DASHBOARD API"
echo "========================"

cd /opt/restaurant-web

# 1. Test dashboard endpoint with different date formats
echo -e "\n1️⃣ Testing dashboard endpoint..."

# Try different date formats
echo "Test 1 - Date format YYYY-MM-DD:"
curl -s -w "\nStatus: %{http_code}\n" "http://localhost:8000/api/v1/dashboard/report/?date=2025-08-11"

echo -e "\nTest 2 - Without date parameter:"
curl -s -w "\nStatus: %{http_code}\n" "http://localhost:8000/api/v1/dashboard/report/"

echo -e "\nTest 3 - Date format DD-MM-YYYY:"
curl -s -w "\nStatus: %{http_code}\n" "http://localhost:8000/api/v1/dashboard/report/?date=11-08-2025"

echo -e "\nTest 4 - Today's date:"
TODAY=$(date +%Y-%m-%d)
curl -s -w "\nStatus: %{http_code}\n" "http://localhost:8000/api/v1/dashboard/report/?date=$TODAY"

# 2. Check Django logs for the error
echo -e "\n2️⃣ Checking Django logs for dashboard errors..."
docker-compose -f docker-compose.ssl.yml logs --tail=30 web | grep -E "(dashboard|report|400|Bad Request)" || echo "No dashboard errors in recent logs"

# 3. Test if it's an authentication issue
echo -e "\n3️⃣ Testing other API endpoints..."
echo "Health check (no auth required):"
curl -s "http://localhost:8000/api/v1/health/" | jq .

echo -e "\nTables endpoint:"
curl -s -w "\nStatus: %{http_code}\n" "http://localhost:8000/api/v1/tables/" | head -50

# 4. Check dashboard view configuration
echo -e "\n4️⃣ Checking dashboard configuration..."
docker-compose -f docker-compose.ssl.yml exec -T web python -c "
from django.urls import get_resolver
resolver = get_resolver()
print('Dashboard URL patterns:')
for pattern in resolver.url_patterns:
    if hasattr(pattern, 'pattern'):
        pattern_str = str(pattern.pattern)
        if 'dashboard' in pattern_str:
            print(f'  Found: {pattern_str}')
"

# 5. Test direct Django shell
echo -e "\n5️⃣ Testing dashboard directly in Django..."
docker-compose -f docker-compose.ssl.yml exec -T web python manage.py shell << 'EOF'
from datetime import datetime, date
from operation.views_dashboard import DashboardViewSet

# Check if dashboard view expects specific date format
print("Testing date parsing...")
test_dates = [
    "2025-08-11",
    "11-08-2025", 
    "2025/08/11",
    "11/08/2025"
]

for date_str in test_dates:
    try:
        parsed = datetime.strptime(date_str, '%Y-%m-%d').date()
        print(f"✅ {date_str} -> {parsed}")
    except:
        try:
            parsed = datetime.strptime(date_str, '%d-%m-%Y').date()
            print(f"✅ {date_str} -> {parsed}")
        except:
            print(f"❌ {date_str} -> Failed to parse")

# Check if there's any authentication requirement
from rest_framework.permissions import AllowAny
print("\nChecking permissions...")
try:
    viewset = DashboardViewSet()
    perms = viewset.get_permissions()
    print(f"Dashboard permissions: {[p.__class__.__name__ for p in perms]}")
except Exception as e:
    print(f"Error checking permissions: {e}")
EOF

echo -e "\n📝 Summary:"
echo "- If all tests return 400, the dashboard expects authentication"
echo "- If date format is wrong, try YYYY-MM-DD format"
echo "- Check if user needs to be logged in to access dashboard"