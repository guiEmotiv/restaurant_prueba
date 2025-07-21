#!/bin/bash
# Script to clean development data from production database

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running in production
if [ ! -f .env.ec2 ]; then
    print_error "This script should only be run on EC2 production server"
    exit 1
fi

print_warning "🚨 PRODUCTION DATABASE CLEANUP 🚨"
print_warning "This will remove all sample/development data from production"
echo ""
print_status "What will be cleaned:"
echo "  - All orders and order items"
echo "  - All payments" 
echo "  - All recipe items (but keep recipes)"
echo "  - All ingredients stock reset to 0"
echo "  - Keep: Categories, Units, Zones, Tables, Groups, Recipes structure"
echo ""

read -p "Are you sure you want to proceed? (type 'YES' exactly): " confirm

if [ "$confirm" != "YES" ]; then
    print_status "Operation cancelled (you typed: '$confirm', expected: 'YES')"
    exit 0
fi

print_status "🗂️ Creating database backup before cleanup..."
BACKUP_NAME="backup-before-cleanup-$(date +%Y%m%d-%H%M%S).sqlite3"
docker-compose -f docker-compose.ec2.yml exec -T web cp /app/data/db.sqlite3 /app/data/$BACKUP_NAME
docker cp restaurant_web_ec2:/app/data/$BACKUP_NAME ./data/ 2>/dev/null || mkdir -p data && docker cp restaurant_web_ec2:/app/data/$BACKUP_NAME ./data/
print_success "Backup created: ./data/$BACKUP_NAME"

print_status "🧹 Cleaning production data..."

# Clean orders and related data
docker-compose -f docker-compose.ec2.yml exec web python manage.py shell << 'EOF'
from operation.models import Order, OrderItem, OrderItemIngredient, Payment
from inventory.models import Ingredient, RecipeItem

# Delete all order-related data
print("Deleting orders and related data...")
OrderItemIngredient.objects.all().delete()
OrderItem.objects.all().delete() 
Payment.objects.all().delete()
Order.objects.all().delete()
print("✅ Orders, payments, and order items deleted")

# Delete all recipe items (but keep recipes structure)
print("Deleting recipe items...")
RecipeItem.objects.all().delete()
print("✅ Recipe items deleted")

# Reset all ingredient stock to 0
print("Resetting ingredient stock...")
ingredients_updated = Ingredient.objects.update(current_stock=0.0)
print(f"✅ Reset stock for {ingredients_updated} ingredients")

print("🎉 Production data cleanup completed!")
EOF

print_success "Production database cleaned!"
print_status "📊 Current database state:"

# Show current counts
docker-compose -f docker-compose.ec2.yml exec web python manage.py shell << 'EOF'
from django.db import models
from config.models import Category, Unit, Zone, Table
from inventory.models import Group, Ingredient, Recipe, RecipeItem  
from operation.models import Order, OrderItem, Payment

print("\n📈 Current counts:")
print(f"  Categories: {Category.objects.count()}")
print(f"  Units: {Unit.objects.count()}")
print(f"  Zones: {Zone.objects.count()}")  
print(f"  Tables: {Table.objects.count()}")
print(f"  Groups: {Group.objects.count()}")
print(f"  Ingredients: {Ingredient.objects.count()}")
print(f"  Recipes: {Recipe.objects.count()}")
print(f"  Recipe Items: {RecipeItem.objects.count()}")
print(f"  Orders: {Order.objects.count()}")
print(f"  Order Items: {OrderItem.objects.count()}")
print(f"  Payments: {Payment.objects.count()}")
print("\n✨ Ready for production use!")
EOF

print_status "💡 Next steps:"
echo "  1. Your application is now clean and ready for production"
echo "  2. Categories, Units, Zones, Tables, Groups, and Recipes are preserved"  
echo "  3. You can now add real ingredients, create real recipes, and take real orders"
echo "  4. Backup is available at: ./data/$BACKUP_NAME"

print_success "🎉 Production cleanup completed successfully!"