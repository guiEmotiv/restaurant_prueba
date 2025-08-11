#!/bin/bash

# Debug API Issues Script
echo "🔍 DEBUGGING API ISSUES"
echo "======================"

cd /opt/restaurant-web

# 1. Check if Django is running
echo -e "\n1️⃣ Checking Django container..."
docker-compose -f docker-compose.simple.yml ps web

# 2. Test Django directly (bypassing nginx)
echo -e "\n2️⃣ Testing Django directly on port 8000..."
echo "   Health check:"
curl -i http://localhost:8000/api/v1/health/
echo -e "\n   Tables endpoint:"
curl -i http://localhost:8000/api/v1/tables/

# 3. Check Django logs for errors
echo -e "\n3️⃣ Django logs (last 50 lines)..."
docker-compose -f docker-compose.simple.yml logs --tail=50 web | grep -E "(ERROR|WARNING|tables|Table)"

# 4. Execute Django shell to check URLs
echo -e "\n4️⃣ Checking registered URLs in Django..."
docker-compose -f docker-compose.simple.yml exec -T web python manage.py shell << 'EOF'
from django.urls import get_resolver
from pprint import pprint

# Get all URL patterns
resolver = get_resolver()

# Check if api/v1/tables/ is registered
print("\n=== Checking for tables URL ===")
found_tables = False
for pattern in resolver.url_patterns:
    if hasattr(pattern, 'pattern'):
        pattern_str = str(pattern.pattern)
        if 'api/v1' in pattern_str:
            print(f"Found API pattern: {pattern_str}")
            if hasattr(pattern, 'url_patterns'):
                for sub_pattern in pattern.url_patterns:
                    sub_str = str(sub_pattern.pattern) if hasattr(sub_pattern, 'pattern') else str(sub_pattern)
                    if 'tables' in sub_str:
                        print(f"  ✅ Found tables: {sub_str}")
                        found_tables = True

if not found_tables:
    print("  ❌ Tables URL not found!")

# Check if TableViewSet is imported correctly
print("\n=== Checking imports ===")
try:
    from api_urls import router
    print("✅ api_urls router imported successfully")
    print(f"Registered viewsets: {list(router.registry)}")
    
    # Check specifically for tables
    tables_found = any('tables' in str(item[0]) for item in router.registry)
    if tables_found:
        print("✅ Tables viewset is registered in router")
    else:
        print("❌ Tables viewset NOT registered in router")
        
except Exception as e:
    print(f"❌ Error importing api_urls: {e}")

# Try to import TableViewSet
try:
    from config.views import TableViewSet
    print("✅ TableViewSet imported successfully")
except Exception as e:
    print(f"❌ Error importing TableViewSet: {e}")

EOF

# 5. Test nginx proxy
echo -e "\n5️⃣ Testing nginx proxy..."
echo "   Via nginx (port 80):"
curl -i http://localhost/api/v1/tables/

# 6. Check nginx configuration
echo -e "\n6️⃣ Nginx configuration check..."
docker-compose -f docker-compose.simple.yml exec -T nginx cat /etc/nginx/conf.d/default.conf | grep -A5 -B5 "location /api/"

# 7. Check for import errors
echo -e "\n7️⃣ Checking for Python import errors..."
docker-compose -f docker-compose.simple.yml exec -T web python -c "
import sys
try:
    import api_urls
    print('✅ api_urls imports successfully')
except Exception as e:
    print(f'❌ Error importing api_urls: {e}')
    import traceback
    traceback.print_exc()

try:
    from config.views import TableViewSet
    print('✅ TableViewSet imports successfully')
except Exception as e:
    print(f'❌ Error importing TableViewSet: {e}')
    import traceback
    traceback.print_exc()
"

# 8. Database check
echo -e "\n8️⃣ Database check..."
docker-compose -f docker-compose.simple.yml exec -T web python manage.py check_database | grep -E "(Tables|Recipe)"

echo -e "\n🏁 Debug complete! Check output above for issues."