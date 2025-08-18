#!/bin/bash
set -e

# 🔧 Migration Helper Script
# Handles problematic migrations automatically

CONTAINER_NAME="${1:-restaurant-backend}"

echo "🔍 Checking migration status..."

# Function to check if migration is applied
is_migration_applied() {
    local app=$1
    local migration=$2
    docker exec $CONTAINER_NAME python /app/backend/manage.py showmigrations $app | grep -q "\[X\] $migration"
}

# Function to fake a specific migration
fake_migration() {
    local app=$1
    local migration=$2
    echo "⚠️  Faking migration: $app.$migration"
    docker exec $CONTAINER_NAME python /app/backend/manage.py migrate $app $migration --fake || true
}

# Function to apply migrations with error handling
safe_migrate() {
    echo "📊 Applying migrations..."
    
    # First attempt
    if docker exec $CONTAINER_NAME python /app/backend/manage.py migrate 2>&1 | tee /tmp/migrate_output.log; then
        echo "✅ All migrations applied successfully"
        return 0
    fi
    
    # Check for specific errors and handle them
    if grep -q "no such table: restaurant_operational_config" /tmp/migrate_output.log; then
        fake_migration "config" "0013"
    fi
    
    if grep -q "no such table: cart_item" /tmp/migrate_output.log; then
        fake_migration "operation" "0021"
    fi
    
    if grep -q "table order_item has no column named container_id" /tmp/migrate_output.log; then
        echo "⚠️  Applying missing operation migrations..."
        docker exec $CONTAINER_NAME python /app/backend/manage.py migrate operation || true
    fi
    
    # Second attempt after fixes
    echo "🔄 Retrying migrations..."
    if docker exec $CONTAINER_NAME python /app/backend/manage.py migrate; then
        echo "✅ All migrations applied after fixes"
        return 0
    else
        echo "❌ Migration failed. Manual intervention required."
        return 1
    fi
}

# Check and fix known problematic migrations
echo "🔍 Checking for problematic migrations..."

# List of known problematic migrations
PROBLEMATIC_MIGRATIONS=(
    "config:0013_delete_restaurantoperationalconfig_delete_waiter"
    "operation:0021_remove_orderitemingredient_table"
)

for migration in "${PROBLEMATIC_MIGRATIONS[@]}"; do
    IFS=':' read -r app mig <<< "$migration"
    mig_name=$(echo $mig | cut -d'_' -f1)
    
    if ! is_migration_applied "$app" "$mig_name"; then
        echo "⚠️  Found unapplied problematic migration: $app.$mig_name"
    fi
done

# Apply migrations safely
safe_migrate

# Show final status
echo ""
echo "📊 Final migration status:"
docker exec $CONTAINER_NAME python /app/backend/manage.py showmigrations | grep -E "config|operation|inventory" | tail -20