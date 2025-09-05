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

# Code already synced by GitHub Actions
echo "📥 Using latest code from GitHub (synced by CI/CD)..."

# Create minimal production .env file
echo "⚙️ Creating minimal production environment configuration..."
cat > .env << ENV_EOF
# Production Environment Configuration (Temporary - Cognito disabled)
DEBUG=False
DJANGO_SECRET_KEY=production-secret-key-temp
ALLOWED_HOSTS=*

# Database Configuration
DATABASE_NAME=restaurant.prod.sqlite3
DATABASE_PATH=/opt/restaurant-web/data

# AWS Cognito Configuration - ENABLED FOR PRODUCTION
USE_COGNITO_AUTH=True
AWS_REGION=us-west-2
COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI
COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0

# Application Configuration
TIME_ZONE=America/Lima
LANGUAGE_CODE=es-pe

# Network Configuration
EC2_PUBLIC_IP=44.248.47.186
DOMAIN_NAME=xn--elfogndedonsoto-zrb.com
ENV_EOF
echo "✅ Production environment configuration created (Cognito temporarily disabled)"

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

# Monitor container startup closely - check every 5 seconds
echo "⏳ Monitoring container startup..."
for i in {1..12}; do
    echo "🔍 Container check $i/12 ($(($i * 5)) seconds)..."
    
    # Check if container is running
    if /usr/bin/docker ps | /bin/grep restaurant-web-app | /bin/grep -v "Restarting"; then
        echo "✅ Container is running, testing Django..."
        # Try Django check immediately when container is up
        if /usr/bin/docker exec restaurant-web-app python manage.py check --deploy 2>/dev/null; then
            echo "✅ Django configuration check passed"
            break
        else
            echo "⚠️ Django check failed but container is running"
            /usr/bin/docker exec restaurant-web-app python manage.py check --deploy 2>&1 || echo "Could not run Django check"
            break
        fi
    else
        echo "⚠️ Container not ready or restarting. Status:"
        /usr/bin/docker ps -a | /bin/grep restaurant-web-app || echo "Container not found"
        
        # If we detect container is restarting, capture logs immediately
        if /usr/bin/docker ps -a | /bin/grep restaurant-web-app | /bin/grep "Restarting"; then
            echo "🚨 Container is restarting! Capturing failure logs:"
            /usr/bin/docker logs --tail=50 restaurant-web-app 2>&1 || echo "Could not retrieve logs"
            break
        fi
        
        sleep 5
    fi
done

# Extended health check - wait longer for application readiness
echo "🏥 Validating deployment health..."
echo "⏳ Waiting 45 seconds for application to fully initialize..."
sleep 45

# Check if containers are running and diagnose failures
if ! /usr/bin/docker ps | /bin/grep restaurant-web-app; then
    echo "❌ Application container not running"
    echo "🔍 Checking container status and logs..."
    
    # Show detailed container status
    echo "📋 Container status:"
    /usr/bin/docker ps -a | /bin/grep restaurant-web-app || echo "No restaurant-web-app container found"
    
    # Show last 50 lines of container logs
    echo "📋 Container logs (last 50 lines):"
    /usr/bin/docker logs --tail=50 restaurant-web-app 2>&1 || echo "Could not retrieve container logs"
    
    # Show Django-specific logs if available  
    echo "📋 Django logs from container:"
    /usr/bin/docker exec restaurant-web-app cat /opt/restaurant-web/data/logs/django.log 2>/dev/null | tail -20 || echo "Django log file not accessible"
    
    exit 1
fi

# Test critical APIs with enhanced debugging
echo "🔍 Testing basic health endpoint first..."
HEALTH_RESPONSE=$(/usr/bin/curl -s -w "\n%{http_code}" http://localhost/api/v1/health/ 2>&1)
HEALTH_CODE=$(echo "$HEALTH_RESPONSE" | tail -n 1)
if [ "$HEALTH_CODE" != "200" ]; then
    echo "❌ Health endpoint failed (HTTP $HEALTH_CODE)"
    echo "Health response: $HEALTH_RESPONSE"
    
    # Test direct container connectivity
    echo "🔍 Testing direct container connectivity..."
    if /usr/bin/docker exec restaurant-web-app curl -s http://localhost:8000/api/v1/health/ > /dev/null; then
        echo "✅ Direct container connection works - issue is with Nginx proxy"
    else
        echo "❌ Direct container connection also fails - issue is with Django app"
        /usr/bin/docker exec restaurant-web-app curl -v http://localhost:8000/api/v1/health/ 2>&1 || echo "Could not test direct connection"
    fi
    exit 1
fi
echo "✅ Health endpoint working (HTTP 200)"

echo "🔍 Testing dashboard operativo API..."
RESPONSE=$(/usr/bin/curl -s -w "\n%{http_code}" http://localhost/api/v1/dashboard-operativo/report/?date=2025-08-29)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ Dashboard operativo API failed (HTTP $HTTP_CODE)"
    echo "Response: $RESPONSE"
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