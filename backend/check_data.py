#!/usr/bin/env python
import os
import sys
import django
from pathlib import Path

# Setup Django
sys.path.append('.')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from operation.models import Order, OrderItem

print(f'Total Orders: {Order.objects.count()}')
print(f'Paid Orders: {Order.objects.filter(status="PAID").count()}')
print(f'Order Items: {OrderItem.objects.count()}')

# Show order statuses
statuses = Order.objects.values_list('status', flat=True).distinct()
print(f'Order statuses found: {list(statuses)}')

print('\nRecent Orders:')
for o in Order.objects.all()[:5]:
    print(f'  Order {o.id}: {o.status} - Total: {o.total_amount} - Created: {o.created_at}')

# Check today's data specifically
from django.utils import timezone
today = timezone.now().date()
today_orders = Order.objects.filter(created_at__date=today)
print(f'\nOrders today ({today}): {today_orders.count()}')
for o in today_orders:
    print(f'  Order {o.id}: {o.status} - Total: {o.total_amount}')