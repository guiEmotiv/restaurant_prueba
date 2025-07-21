#!/usr/bin/env python3
"""
Debug script to check the restaurant system status in EC2 deployment.
Run this script to quickly verify if the system has proper data configured.
"""

import subprocess
import json
import sys

def run_docker_command(cmd):
    """Run a docker-compose command in the EC2 environment"""
    full_cmd = f"docker-compose -f docker-compose.ec2.yml exec web python manage.py shell -c \"{cmd}\""
    try:
        result = subprocess.run(full_cmd, shell=True, capture_output=True, text=True)
        return result.stdout, result.stderr, result.returncode
    except Exception as e:
        return "", str(e), 1

def check_system_status():
    """Check the overall system status"""
    print("🔍 Restaurant Management System - Status Check")
    print("=" * 50)
    
    # Check database tables
    cmd = '''
from config.models import Category, Unit, Zone, Table
from inventory.models import Group, Ingredient, Recipe, RecipeItem
from operation.models import Order, OrderItem
from django.contrib.auth.models import User

print("📊 DATABASE STATUS")
print(f"Users: {User.objects.count()}")
print(f"Categories: {Category.objects.count()}")
print(f"Units: {Unit.objects.count()}")
print(f"Zones: {Zone.objects.count()}")
print(f"Tables: {Table.objects.count()}")
print(f"Groups: {Group.objects.count()}")
print(f"Ingredients: {Ingredient.objects.count()}")
print(f"Recipes: {Recipe.objects.count()}")
print(f"Recipe Items: {RecipeItem.objects.count()}")
print(f"Orders: {Order.objects.count()}")
print(f"Order Items: {OrderItem.objects.count()}")

print("\\n🍽️ AVAILABLE RECIPES")
if Recipe.objects.count() > 0:
    for recipe in Recipe.objects.all():
        availability = recipe.check_availability()
        status = "✅" if availability else "❌"
        print(f"{status} {recipe.name} - Available: {recipe.is_available}, Stock Check: {availability}")
else:
    print("❌ No recipes found")

print("\\n🏪 TABLES")
if Table.objects.count() > 0:
    for table in Table.objects.all():
        print(f"🪑 {table}")
else:
    print("❌ No tables found")

print("\\n📦 INGREDIENTS WITH LOW STOCK")
low_stock_ingredients = Ingredient.objects.filter(current_stock__lt=1.0)
if low_stock_ingredients.count() > 0:
    for ingredient in low_stock_ingredients:
        print(f"⚠️ {ingredient.name}: {ingredient.current_stock}")
else:
    print("✅ All ingredients have sufficient stock")
'''
    
    stdout, stderr, returncode = run_docker_command(cmd)
    
    if returncode != 0:
        print(f"❌ Error running status check: {stderr}")
        return False
    
    print(stdout)
    return True

def test_order_creation():
    """Test if order creation works"""
    print("\n🧪 TESTING ORDER CREATION")
    print("=" * 30)
    
    cmd = '''
from operation.serializers import OrderCreateSerializer
from config.models import Table
from inventory.models import Recipe

if Table.objects.count() == 0 or Recipe.objects.count() == 0:
    print("❌ Cannot test order creation - missing tables or recipes")
else:
    table = Table.objects.first()
    recipe = Recipe.objects.first()
    
    order_data = {
        'table': table.id,
        'items': [{'recipe': recipe.id, 'notes': 'Test order'}]
    }
    
    serializer = OrderCreateSerializer(data=order_data)
    if serializer.is_valid():
        print("✅ Order validation passed")
        print(f"📋 Test data: Table {table.table_number}, Recipe {recipe.name}")
    else:
        print("❌ Order validation failed")
        print(f"Errors: {serializer.errors}")
'''
    
    stdout, stderr, returncode = run_docker_command(cmd)
    
    if returncode != 0:
        print(f"❌ Error testing order creation: {stderr}")
        return False
    
    print(stdout)
    return True

def main():
    """Main function"""
    print("Starting Restaurant System Status Check...\n")
    
    success = True
    success &= check_system_status()
    success &= test_order_creation()
    
    print("\n" + "=" * 50)
    if success:
        print("✅ Status check completed successfully")
        print("\n💡 If order creation is still failing in the frontend:")
        print("   1. Check that the frontend is sending valid table and recipe IDs")
        print("   2. Verify that recipes have sufficient ingredient stock")
        print("   3. Check browser network tab for exact error details")
    else:
        print("❌ Status check failed - see errors above")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())