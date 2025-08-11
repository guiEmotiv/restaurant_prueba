#!/bin/bash

# Fix Django URLs Script
echo "🔧 FIXING DJANGO URLS ISSUE"
echo "==========================="

cd /opt/restaurant-web

# 1. First, let's check what's actually in api_urls.py
echo -e "\n1️⃣ Checking api_urls.py content..."
docker-compose -f docker-compose.simple.yml exec -T web cat api_urls.py | head -50

# 2. Check if config app is in INSTALLED_APPS
echo -e "\n2️⃣ Checking INSTALLED_APPS..."
docker-compose -f docker-compose.simple.yml exec -T web python -c "
from django.conf import settings
print('INSTALLED_APPS:')
for app in settings.INSTALLED_APPS:
    if 'config' in app or 'inventory' in app or 'operation' in app:
        print(f'  ✅ {app}')
"

# 3. Try to manually register the URLs
echo -e "\n3️⃣ Testing manual URL registration..."
docker-compose -f docker-compose.simple.yml exec -T web python << 'EOF'
import os
import sys
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_ec2')
django.setup()

try:
    # Import the router
    from api_urls import router
    print(f"✅ Router imported successfully")
    print(f"Registered viewsets: {len(router.registry)}")
    
    # List all registered viewsets
    for prefix, viewset, basename in router.registry:
        print(f"  - {prefix}: {viewset.__name__} (basename: {basename})")
    
    # Check if tables is registered
    tables_registered = any(prefix == 'tables' for prefix, _, _ in router.registry)
    if tables_registered:
        print("\n✅ Tables viewset is registered!")
    else:
        print("\n❌ Tables viewset NOT registered!")
        
        # Try to register it manually
        print("Attempting to register TableViewSet...")
        from config.views import TableViewSet
        router.register(r'tables', TableViewSet, basename='table')
        print("✅ TableViewSet registered successfully!")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
EOF

# 4. Check if there's a circular import
echo -e "\n4️⃣ Checking for circular imports..."
docker-compose -f docker-compose.simple.yml exec -T web python -c "
import sys
sys.path.insert(0, '/app')

# Try importing in order
try:
    print('Importing config.models...')
    import config.models
    print('✅ config.models imported')
except Exception as e:
    print(f'❌ Error importing config.models: {e}')

try:
    print('Importing config.serializers...')
    import config.serializers
    print('✅ config.serializers imported')
except Exception as e:
    print(f'❌ Error importing config.serializers: {e}')

try:
    print('Importing config.views...')
    import config.views
    print('✅ config.views imported')
except Exception as e:
    print(f'❌ Error importing config.views: {e}')

try:
    print('Importing api_urls...')
    import api_urls
    print('✅ api_urls imported')
except Exception as e:
    print(f'❌ Error importing api_urls: {e}')
"

# 5. Force collect static and restart
echo -e "\n5️⃣ Force collecting static files..."
docker-compose -f docker-compose.simple.yml exec -T web python manage.py collectstatic --noinput --clear

# 6. Restart the web container
echo -e "\n6️⃣ Restarting Django container..."
docker-compose -f docker-compose.simple.yml restart web

# Wait for it to start
sleep 10

# 7. Test again
echo -e "\n7️⃣ Testing endpoints after restart..."
echo "Direct Django test:"
curl -s http://localhost:8000/api/v1/tables/ | head -100
echo -e "\n\nVia nginx:"
curl -s http://localhost/api/v1/tables/ | head -100

echo -e "\n\n🏁 Fix attempt complete! Check if tables endpoint works now."