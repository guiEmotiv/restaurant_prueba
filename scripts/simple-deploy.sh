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

# Force sync latest code with validation
echo "📥 Force syncing latest code..."
if ! /usr/bin/git fetch origin main; then
    echo "❌ Git fetch failed - deployment aborted"
    exit 1
fi

if ! /usr/bin/git reset --hard origin/main; then
    echo "❌ Git reset failed - deployment aborted"
    exit 1
fi

# Login to ECR and pull latest image with validation
echo "🔐 Logging into ECR..."
if ! /usr/local/bin/aws ecr get-login-password --region us-west-2 | /usr/bin/docker login --username AWS --password-stdin "$ECR_REGISTRY"; then
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
echo "🔄 Running migrations with validation..."
if ! /usr/bin/docker-compose -f docker/docker-compose.prod.yml run --rm app python manage.py migrate --check; then
    echo "❌ Migration validation failed - deployment aborted"
    exit 1
fi

echo "✅ Migration validation passed, applying migrations..."
/usr/bin/docker-compose -f docker/docker-compose.prod.yml run --rm app python manage.py migrate

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
if ! /usr/bin/curl -f -s http://localhost/api/v1/dashboard-operativo/report/?date=2025-08-29; then
    echo "❌ Dashboard operativo API failed"
    exit 1
fi

if ! /usr/bin/curl -f -s http://localhost/api/v1/orders/kitchen_board/; then
    echo "❌ Kitchen board API failed" 
    exit 1
fi

echo "✅ Deployment completed and validated!"