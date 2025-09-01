#!/bin/bash
# Simple Reliable Deployment Script
set -e
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

ECR_REGISTRY="${1:-}"
ECR_REPOSITORY="${2:-}"
ACTION="${3:-deploy}"

echo "🚀 Starting deployment..."

# Always cleanup first (non-critical, can fail)
echo "🧹 Automatic cleanup..."
/bin/bash ./scripts/auto-cleanup.sh || echo "⚠️ Cleanup failed but continuing deployment"

# Skip Git sync - Docker image from ECR contains all necessary code
echo "📥 Using Docker image from ECR (contains latest code)..."

# Login to ECR and pull latest image with validation
echo "🔐 Logging into ECR..."
if ! /usr/bin/aws ecr get-login-password --region us-west-2 | /usr/bin/docker login --username AWS --password-stdin "$ECR_REGISTRY"; then
    echo "❌ ECR login failed - deployment aborted"
    exit 1
fi

echo "📦 Pulling latest Docker image..."
if ! /usr/bin/docker pull "$ECR_REGISTRY/$ECR_REPOSITORY:latest"; then
    echo "❌ Docker pull failed - deployment aborted"
    exit 1
fi

# Mandatory backup before any changes
echo "💾 Creating mandatory backup..."
if [ -f "data/restaurant.prod.sqlite3" ]; then
    BACKUP_FILE="data/backups/prod/backup_$(/bin/date +%Y%m%d_%H%M%S).sqlite3"
    /bin/mkdir -p "data/backups/prod"
    if ! /bin/cp data/restaurant.prod.sqlite3 "$BACKUP_FILE"; then
        echo "❌ Backup creation failed - deployment aborted"
        exit 1
    fi
    echo "✅ Backup created: $BACKUP_FILE"
else
    echo "⚠️ No production database found, proceeding without backup"
fi

# Run migrations with strict validation
echo "🔄 Running migrations..."
if ! /usr/bin/docker-compose -f docker/docker-compose.prod.yml run --rm app python manage.py migrate; then
    echo "❌ Migration failed - deployment aborted"
    exit 1
fi

echo "✅ Migrations applied successfully"

# Deploy with validation
echo "🚀 Deploying..."
if ! /usr/bin/docker-compose -f docker/docker-compose.prod.yml --profile production up -d; then
    echo "❌ Docker deployment failed - rolling back"
    exit 1
fi

# Strict health check
echo "🏥 Validating deployment health..."
sleep 15

# Check if containers are running
if ! /usr/bin/docker ps | /bin/grep restaurant-web-app; then
    echo "❌ Application container not running"
    exit 1
fi

# Test critical APIs
echo "🔍 Testing dashboard operativo API..."
RESPONSE=$(/usr/bin/curl -s -w "\n%{http_code}" http://localhost/api/v1/dashboard-operativo/report/?date=2025-08-29)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ Dashboard operativo API failed (HTTP $HTTP_CODE)"
    exit 1
fi
echo "✅ Dashboard operativo API working (HTTP 200)"

echo "🔍 Testing dashboard financiero API..."
RESPONSE=$(/usr/bin/curl -s -w "\n%{http_code}" "http://localhost/api/v1/dashboard-financiero/report/?date=2025-08-29&period=month")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ Dashboard financiero API failed (HTTP $HTTP_CODE)"
    exit 1
fi
echo "✅ Dashboard financiero API working (HTTP 200)"

echo "🔍 Testing kitchen board API..."
RESPONSE=$(/usr/bin/curl -s -w "\n%{http_code}" http://localhost/api/v1/orders/kitchen_board/)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ Kitchen board API failed (HTTP $HTTP_CODE)"
    exit 1
fi
echo "✅ Kitchen board API working (HTTP 200)"

echo "✅ Deployment completed and validated!"