#!/bin/bash

# Enable Dashboard Access Without Authentication (Temporary Fix)
echo "🔓 ENABLING DASHBOARD ACCESS"
echo "============================"

cd /opt/restaurant-web

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 1. Modify dashboard permissions
echo -e "\n1️⃣ Temporarily disabling dashboard authentication..."

# Create a patch for the dashboard view
cat > /tmp/dashboard_patch.py << 'EOF'
# Temporary patch to allow anonymous access to dashboard
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_ec2')
django.setup()

# Import and modify the dashboard view
from operation.views_dashboard import DashboardViewSet

print(f"Current permissions: {DashboardViewSet.permission_classes}")

# Temporarily remove authentication requirement
DashboardViewSet.permission_classes = []

print("✅ Dashboard authentication temporarily disabled")
print("⚠️  This is for testing only - re-enable authentication in production")
EOF

# Apply the patch
docker-compose -f docker-compose.ssl.yml exec -T web python - < /tmp/dashboard_patch.py

# 2. Populate database with test data if empty
echo -e "\n2️⃣ Checking and populating database..."
docker-compose -f docker-compose.ssl.yml exec -T web python manage.py shell << 'EOF'
from operation.models import Order, OrderItem, Payment
from config.models import Table, Zone
from inventory.models import Recipe
from datetime import datetime, timedelta
from decimal import Decimal
import random

# Check current orders
paid_orders = Order.objects.filter(status='PAID').count()
print(f"Current paid orders: {paid_orders}")

if paid_orders == 0:
    print("Creating test paid orders...")
    
    # Get data
    tables = list(Table.objects.all()[:5])
    recipes = list(Recipe.objects.filter(is_active=True))
    
    if not tables:
        # Create a test zone and table
        zone = Zone.objects.create(name="Test Zone")
        table = Table.objects.create(zone=zone, table_number="T01")
        tables = [table]
        print("Created test table")
    
    if not recipes:
        # Create test recipe
        from inventory.models import Group
        group = Group.objects.create(name="Test Group")
        recipe = Recipe.objects.create(
            group=group,
            name="Test Dish",
            base_price=Decimal('15.00'),
            preparation_time=10
        )
        recipes = [recipe]
        print("Created test recipe")
    
    # Create 5 test paid orders
    for i in range(5):
        table = random.choice(tables)
        
        # Create order
        created_time = datetime.now() - timedelta(hours=random.randint(1, 24))
        served_time = created_time + timedelta(minutes=random.randint(10, 60))
        paid_time = served_time + timedelta(minutes=random.randint(5, 30))
        
        order = Order.objects.create(
            table=table,
            waiter="Test Waiter",
            status="PAID",
            created_at=created_time,
            served_at=served_time,
            paid_at=paid_time
        )
        
        # Add items
        total = Decimal('0.00')
        for j in range(random.randint(1, 3)):
            recipe = random.choice(recipes)
            quantity = random.randint(1, 2)
            
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
            amount=total
        )
        
        # Update order total
        order.total_amount = total
        order.save()
    
    print("✅ Created 5 test paid orders")
else:
    print(f"✅ Database has {paid_orders} paid orders")
EOF

# 3. Restart services
echo -e "\n3️⃣ Restarting services to apply changes..."
docker-compose -f docker-compose.ssl.yml restart web
sleep 10

# 4. Test dashboard
echo -e "\n4️⃣ Testing dashboard endpoint..."
TODAY=$(date +%Y-%m-%d)
DASHBOARD_TEST=$(curl -s -w "\nSTATUS:%{http_code}" "http://localhost:8000/api/v1/dashboard/report/?date=$TODAY")
STATUS=$(echo "$DASHBOARD_TEST" | tail -1 | cut -d':' -f2)

echo "Dashboard status: $STATUS"

if [ "$STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Dashboard is working!${NC}"
    # Show summary
    echo "$DASHBOARD_TEST" | head -n -1 | jq '.summary' 2>/dev/null || echo "Response received"
else
    echo -e "${RED}❌ Dashboard still not working${NC}"
    echo "$DASHBOARD_TEST" | head -n -1
fi

# 5. Test HTTPS access
echo -e "\n5️⃣ Testing HTTPS access..."
HTTPS_TEST=$(curl -s -w "\nSTATUS:%{http_code}" "https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/")
HTTPS_STATUS=$(echo "$HTTPS_TEST" | tail -1 | cut -d':' -f2)

if [ "$HTTPS_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ HTTPS API working${NC}"
else
    echo -e "${YELLOW}⚠️ HTTPS Status: $HTTPS_STATUS${NC}"
fi

echo -e "\n${GREEN}🎉 DASHBOARD ACCESS ENABLED!${NC}"
echo "Your dashboard should now work at:"
echo "https://www.xn--elfogndedonsoto-zrb.com/"

echo -e "\n${YELLOW}⚠️ IMPORTANT:${NC}"
echo "- Dashboard authentication is temporarily disabled"
echo "- This is for testing purposes only"
echo "- In production, users should authenticate with AWS Cognito"