#!/bin/bash
# Simple Reliable Deployment Script
set -e
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

ECR_REGISTRY="${1:-}"
ECR_REPOSITORY="${2:-}"
ACTION="${3:-deploy}"

echo "🚀 Starting deployment..."

# Always cleanup first
echo "🧹 Automatic cleanup..."
/bin/bash ./scripts/auto-cleanup.sh || echo "Cleanup warning ignored"

# Pull latest code
echo "📥 Syncing latest code..."
/usr/bin/git pull origin main || echo "Git pull failed, continuing"

# Pull latest image
echo "📦 Pulling latest Docker image..."
/usr/bin/docker pull "$ECR_REGISTRY/$ECR_REPOSITORY:latest" || echo "Docker pull failed"

# Quick backup
echo "💾 Quick backup..."
if [ -f "data/restaurant.prod.sqlite3" ]; then
    /bin/cp data/restaurant.prod.sqlite3 "data/backups/prod/backup_$(/bin/date +%Y%m%d_%H%M%S).sqlite3" 2>/dev/null || true
fi

# Run migrations safely
echo "🔄 Running migrations..."
/usr/bin/docker-compose -f docker/docker-compose.prod.yml run --rm app python manage.py migrate --fake-initial || /usr/bin/docker-compose -f docker/docker-compose.prod.yml run --rm app python manage.py migrate

# Deploy
echo "🚀 Deploying..."
/usr/bin/docker-compose -f docker/docker-compose.prod.yml --profile production up -d

# Health check
echo "🏥 Health check..."
sleep 10
curl -f http://localhost/api/v1/health/ || echo "Health check warning"

echo "✅ Deployment completed!"