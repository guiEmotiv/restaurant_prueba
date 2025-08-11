#!/bin/bash

# Simple API Test Script
echo "🧪 SIMPLE API TEST"
echo "=================="

cd /opt/restaurant-web

# 1. Show what URLs Django knows about
echo -e "\n1️⃣ Django URL patterns..."
docker-compose -f docker-compose.simple.yml exec -T web python manage.py show_urls 2>&1 | grep -E "(api/v1|tables|error)" | head -20

# 2. Try to access various endpoints
echo -e "\n2️⃣ Testing various endpoints..."

echo -e "\n   Health check (should work):"
curl -s -w "\n   Status: %{http_code}\n" http://localhost:8000/api/v1/health/

echo -e "\n   API root:"
curl -s -w "\n   Status: %{http_code}\n" http://localhost:8000/api/

echo -e "\n   API v1 root:"
curl -s -w "\n   Status: %{http_code}\n" http://localhost:8000/api/v1/

echo -e "\n   Tables (direct):"
curl -s -w "\n   Status: %{http_code}\n" http://localhost:8000/api/v1/tables/

echo -e "\n   Config tables (old URL):"
curl -s -w "\n   Status: %{http_code}\n" http://localhost:8000/api/v1/config/tables/

echo -e "\n   Zones:"
curl -s -w "\n   Status: %{http_code}\n" http://localhost:8000/api/v1/zones/

echo -e "\n   Units:"
curl -s -w "\n   Status: %{http_code}\n" http://localhost:8000/api/v1/units/

# 3. Check if Django is importing api_urls correctly
echo -e "\n3️⃣ Checking Django imports..."
docker-compose -f docker-compose.simple.yml exec -T web python -c "
import django
django.setup()
from django.urls import get_resolver
resolver = get_resolver()

# Find api/v1/ patterns
for pattern in resolver.url_patterns:
    if hasattr(pattern, 'pattern'):
        if 'api/v1' in str(pattern.pattern):
            print(f'Found: {pattern.pattern}')
            if hasattr(pattern, 'url_patterns'):
                # This should be the included api_urls
                included = pattern.url_patterns
                if included:
                    print(f'  Included module: {included}')
                else:
                    print('  ❌ No URL patterns included!')
"

# 4. Let's see what's actually running
echo -e "\n4️⃣ Container status..."
docker-compose -f docker-compose.simple.yml ps

echo -e "\n5️⃣ Recent Django errors..."
docker-compose -f docker-compose.simple.yml logs --tail=30 web | grep -E "(ERROR|error|Error|ImportError|ModuleNotFoundError)" || echo "No recent errors found"

echo -e "\n🏁 Test complete!"