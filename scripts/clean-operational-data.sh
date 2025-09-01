#!/bin/bash

# Restaurant Management System - Clean Operational Data
# Removes orders, payments while preserving configuration and menu

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[CLEAN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; exit 1; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Environment detection
ENV="${1:-dev}"
BACKUP_DIR="./backups/operational"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Database configuration based on environment
if [[ "$ENV" == "prod" ]]; then
    DB_CONTAINER="restaurant-app"
    DB_NAME="restaurant_db"
    warning "Production cleaning - this will remove ALL operational data!"
    read -p "Are you ABSOLUTELY sure? Type 'yes-clean-production': " confirmation
    [[ "$confirmation" != "yes-clean-production" ]] && exit 1
else
    DB_CONTAINER="restaurant-backend"
    DB_NAME="restaurant_db"
    log "Development environment cleaning"
fi

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    error "Container ${DB_CONTAINER} is not running"
fi

log "Creating backup before cleaning..."
docker exec "$DB_CONTAINER" python manage.py dumpdata \
    operation.Order operation.OrderItem operation.Payment \
    --format=json --indent=2 > "${BACKUP_DIR}/operational_${ENV}_${TIMESTAMP}.json" || {
    warning "Backup failed, but continuing with cleaning"
}

log "Cleaning operational data..."

# Execute Django management command to clean data
docker exec "$DB_CONTAINER" python manage.py shell << 'CLEAN_SCRIPT'
from django.db import transaction
from operation.models import Order, OrderItem, Payment
from django.utils import timezone

print("Starting operational data cleanup...")

with transaction.atomic():
    # Count records before deletion
    orders_count = Order.objects.count()
    items_count = OrderItem.objects.count()
    payments_count = Payment.objects.count()
    
    print(f"Found {orders_count} orders, {items_count} items, {payments_count} payments")
    
    # Delete all operational data
    Payment.objects.all().delete()
    OrderItem.objects.all().delete()
    Order.objects.all().delete()
    
    print("✓ All operational data removed")
    
    # Reset sequences if PostgreSQL
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT setval(pg_get_serial_sequence('operation_order', 'id'), 1, false);
            SELECT setval(pg_get_serial_sequence('operation_orderitem', 'id'), 1, false);
            SELECT setval(pg_get_serial_sequence('operation_payment', 'id'), 1, false);
        """)
    
    print("✓ Sequences reset")

print("Cleanup completed successfully!")
CLEAN_SCRIPT

success "Operational data cleaned"

# Show remaining data summary
log "Remaining data summary:"
docker exec "$DB_CONTAINER" python manage.py shell << 'SUMMARY'
from config.models import Unit, Container, Table, Zone
from inventory.models import Group, Ingredient, Recipe

print(f"Configuration preserved:")
print(f"  - Units: {Unit.objects.count()}")
print(f"  - Containers: {Container.objects.count()}")
print(f"  - Tables: {Table.objects.count()}")
print(f"  - Zones: {Zone.objects.count()}")

print(f"\nInventory preserved:")
print(f"  - Groups: {Group.objects.count()}")
print(f"  - Ingredients: {Ingredient.objects.count()}")
print(f"  - Recipes: {Recipe.objects.count()}")
SUMMARY

if [[ -f "${BACKUP_DIR}/operational_${ENV}_${TIMESTAMP}.json" ]]; then
    success "Backup saved to: ${BACKUP_DIR}/operational_${ENV}_${TIMESTAMP}.json"
fi

log "To restore data, use:"
echo "  docker exec $DB_CONTAINER python manage.py loaddata ${BACKUP_DIR}/operational_${ENV}_${TIMESTAMP}.json"