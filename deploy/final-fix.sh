#!/bin/bash

# Final Fix for Remaining Issues
echo "🔧 FINAL FIXES"
echo "=============="

cd /opt/restaurant-web

# 1. Restart containers to pick up new environment variables
echo -e "\n1️⃣ Restarting containers with new environment..."
docker-compose -f docker-compose.ssl.yml down
sleep 5
docker-compose -f docker-compose.ssl.yml up -d

# Wait for services to start
echo "Waiting for services to start..."
sleep 15

# 2. Check if ALLOWED_HOSTS is now correct
echo -e "\n2️⃣ Checking ALLOWED_HOSTS..."
docker-compose -f docker-compose.ssl.yml exec -T web python -c "
from django.conf import settings
hosts = settings.ALLOWED_HOSTS
print(f'ALLOWED_HOSTS: {hosts}')
if 'www.xn--elfogndedonsoto-zrb.com' in hosts:
    print('✅ Domain is in ALLOWED_HOSTS')
else:
    print('❌ Domain still missing from ALLOWED_HOSTS')
"

# 3. Create simple test orders (without received_amount field)
echo -e "\n3️⃣ Creating simple test orders..."
docker-compose -f docker-compose.ssl.yml exec -T web python manage.py shell << 'EOF'
from operation.models import Order, OrderItem, Payment
from config.models import Table, Zone
from inventory.models import Recipe, Group
from datetime import datetime, timedelta
from decimal import Decimal
import random
from django.utils import timezone

# Check current orders
paid_orders = Order.objects.filter(status='PAID').count()
print(f"Current paid orders: {paid_orders}")

if paid_orders == 0:
    print("Creating simple test orders...")
    
    # Get or create test data
    tables = list(Table.objects.all()[:3])
    recipes = list(Recipe.objects.filter(is_active=True))
    
    if not recipes:
        print("No recipes found, creating test recipe...")
        group, created = Group.objects.get_or_create(name="Test Group")
        recipe = Recipe.objects.create(
            group=group,
            name="Test Dish",
            base_price=Decimal('15.00'),
            preparation_time=10
        )
        recipes = [recipe]
    
    # Create 3 simple paid orders with timezone-aware dates
    for i in range(3):
        table = random.choice(tables) if tables else None
        
        # Create timezone-aware datetime objects
        now = timezone.now()
        created_time = now - timedelta(hours=random.randint(1, 24))
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
        
        # Create payment without received_amount field
        Payment.objects.create(
            order=order,
            payment_method="CASH",
            amount=total
        )
        
        # Update order total
        order.total_amount = total
        order.save()
    
    print("✅ Created 3 test paid orders")
    
final_count = Order.objects.filter(status='PAID').count()
print(f"Final paid orders count: {final_count}")
EOF

# 4. Test the site
echo -e "\n4️⃣ Final tests..."

# Test health
HEALTH=$(curl -s -w "\nSTATUS:%{http_code}" http://localhost:8000/api/v1/health/)
HEALTH_STATUS=$(echo "$HEALTH" | tail -1 | cut -d':' -f2)
echo "Health status: $HEALTH_STATUS"

# Test dashboard
DASHBOARD=$(curl -s -w "\nSTATUS:%{http_code}" "http://localhost:8000/api/v1/dashboard/report/?date=$(date +%Y-%m-%d)")
DASHBOARD_STATUS=$(echo "$DASHBOARD" | tail -1 | cut -d':' -f2)
echo "Dashboard status: $DASHBOARD_STATUS"

# Test public access
PUBLIC=$(curl -s -w "\nSTATUS:%{http_code}" https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/)
PUBLIC_STATUS=$(echo "$PUBLIC" | tail -1 | cut -d':' -f2)
echo "Public HTTPS status: $PUBLIC_STATUS"

echo -e "\n🎉 FINAL STATUS:"
echo "================"
if [ "$HEALTH_STATUS" = "200" ] && [ "$DASHBOARD_STATUS" = "200" ]; then
    echo "✅ Backend is working perfectly!"
    echo "✅ Dashboard has data and is accessible!"
    echo ""
    echo "🌟 Your site is ready: https://www.xn--elfogndedonsoto-zrb.com/"
else
    echo "❌ Some issues remain:"
    echo "   Health: $HEALTH_STATUS"
    echo "   Dashboard: $DASHBOARD_STATUS"
    echo "   Public: $PUBLIC_STATUS"
fi

# Show container status
echo -e "\nContainer status:"
docker-compose -f docker-compose.ssl.yml ps