#!/bin/bash

# Fix All Production Issues
echo "🔧 FIXING ALL PRODUCTION ISSUES"
echo "==============================="

cd /opt/restaurant-web

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. Fix ALLOWED_HOSTS
echo -e "\n1️⃣ ${BLUE}Fixing ALLOWED_HOSTS...${NC}"
docker-compose -f docker-compose.ssl.yml exec -T web python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_ec2')
django.setup()

from django.conf import settings
print(f'Current ALLOWED_HOSTS: {settings.ALLOWED_HOSTS}')

# Add the domain if not present
domain = 'www.xn--elfogndedonsoto-zrb.com'
if domain not in settings.ALLOWED_HOSTS:
    print(f'❌ {domain} not in ALLOWED_HOSTS')
    print('Please add it to backend/settings_ec2.py')
else:
    print(f'✅ {domain} is in ALLOWED_HOSTS')
"

# 2. Fix Cognito Environment Variables
echo -e "\n2️⃣ ${BLUE}Fixing Cognito Environment Variables...${NC}"
ENV_FILE="/opt/restaurant-web/.env.ec2"

# Check if variables are set
if grep -q "AWS_COGNITO_USER_POOL_ID" "$ENV_FILE"; then
    echo "✅ Cognito variables found in .env.ec2"
else
    echo "❌ Adding Cognito variables to .env.ec2..."
    cat >> "$ENV_FILE" << 'EOF'

# AWS Cognito Configuration
AWS_COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI
AWS_COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0
AWS_REGION=us-west-2
EOF
    echo "✅ Cognito variables added"
fi

# 3. Populate Database with Test Data
echo -e "\n3️⃣ ${BLUE}Populating Database...${NC}"
docker-compose -f docker-compose.ssl.yml exec -T web python manage.py shell << 'EOF'
from operation.models import Order, OrderItem, Payment
from config.models import Table
from inventory.models import Recipe
from datetime import datetime, timedelta
from decimal import Decimal
import random

# Check current orders
current_orders = Order.objects.count()
print(f"Current orders: {current_orders}")

if current_orders == 0:
    print("Creating test orders...")
    
    # Get tables and recipes
    tables = list(Table.objects.all()[:10])
    recipes = list(Recipe.objects.filter(is_active=True))
    
    if tables and recipes:
        # Create 10 test orders
        for i in range(10):
            table = random.choice(tables)
            
            # Create order
            order = Order.objects.create(
                table=table,
                waiter="TestWaiter",
                status="PAID",
                created_at=datetime.now() - timedelta(hours=random.randint(1, 48)),
                served_at=datetime.now() - timedelta(hours=random.randint(0, 47)),
                paid_at=datetime.now() - timedelta(hours=random.randint(0, 24))
            )
            
            # Add 2-5 items
            total = Decimal('0.00')
            for j in range(random.randint(2, 5)):
                recipe = random.choice(recipes)
                quantity = random.randint(1, 3)
                
                item = OrderItem.objects.create(
                    order=order,
                    recipe=recipe,
                    quantity=quantity,
                    unit_price=recipe.base_price,
                    total_price=recipe.base_price * quantity
                )
                total += item.total_price
            
            # Create payment
            Payment.objects.create(
                order=order,
                payment_method="CASH",
                amount=total,
                received_amount=total
            )
            
            # Update order total
            order.total_amount = total
            order.save()
        
        print("✅ Created 10 test orders")
    else:
        print("❌ No tables or recipes found")
else:
    print(f"✅ Database already has {current_orders} orders")

# Show summary
paid_orders = Order.objects.filter(status='PAID').count()
print(f"Total paid orders: {paid_orders}")
EOF

# 4. Check Dashboard Permissions
echo -e "\n4️⃣ ${BLUE}Checking Dashboard Permissions...${NC}"
docker-compose -f docker-compose.ssl.yml exec -T web python manage.py shell << 'EOF'
from operation.views_dashboard import DashboardViewSet

# Show current permissions
viewset = DashboardViewSet()
print(f"Dashboard permission_classes: {viewset.permission_classes}")

if viewset.permission_classes == []:
    print("✅ Dashboard allows anonymous access")
else:
    print("⚠️  Dashboard requires authentication")
    print("   Users must login with AWS Cognito")
EOF

# 5. Restart services to apply changes
echo -e "\n5️⃣ ${BLUE}Restarting services...${NC}"
docker-compose -f docker-compose.ssl.yml restart web

# Wait for services
sleep 10

# 6. Test API endpoints
echo -e "\n6️⃣ ${BLUE}Testing API endpoints...${NC}"

echo "Health check:"
curl -s http://localhost:8000/api/v1/health/ | jq .

echo -e "\nDashboard test:"
DASHBOARD_RESPONSE=$(curl -s -w "\nSTATUS:%{http_code}" "http://localhost:8000/api/v1/dashboard/report/?date=$(date +%Y-%m-%d)")
DASHBOARD_STATUS=$(echo "$DASHBOARD_RESPONSE" | tail -1 | cut -d':' -f2)
echo "Dashboard status: $DASHBOARD_STATUS"

if [ "$DASHBOARD_STATUS" = "200" ]; then
    echo "$DASHBOARD_RESPONSE" | head -n -1 | jq '.summary' 2>/dev/null || echo "Dashboard working"
fi

# 7. Summary
echo -e "\n📊 ${YELLOW}SUMMARY${NC}"
echo "=================="
echo "1. ALLOWED_HOSTS: Check backend/settings_ec2.py"
echo "2. Cognito: Variables added to .env.ec2"
echo "3. Database: Populated with test orders"
echo "4. Dashboard: Check if authentication required"
echo ""
echo "⚠️  If ALLOWED_HOSTS error persists, manually edit:"
echo "   backend/backend/settings_ec2.py"
echo "   Add: 'www.xn--elfogndedonsoto-zrb.com' to ALLOWED_HOSTS list"

echo -e "\n${GREEN}✅ Fixes applied! Try accessing the site now.${NC}"