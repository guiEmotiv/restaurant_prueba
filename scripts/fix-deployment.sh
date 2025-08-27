#!/bin/bash
# Quick fix for deployment issues

set -e

log() { echo -e "\033[0;32m[$(date +'%Y-%m-%d %H:%M:%S')]\033[0m $1"; }
error() { echo -e "\033[0;31m[ERROR]\033[0m $1" >&2; exit 1; }

cd /opt/restaurant-web || error "Not on EC2 instance"

log "🔧 Fixing deployment issues..."

# 1. Ensure database exists
log "Checking database..."
if [ ! -f data/restaurant_prod.sqlite3 ]; then
    log "Creating production database..."
    if [ -f data/db.sqlite3 ]; then
        cp data/db.sqlite3 data/restaurant_prod.sqlite3
    else
        touch data/restaurant_prod.sqlite3
    fi
fi

# 2. Fix permissions
log "Fixing permissions..."
chmod -R 755 data/
chown -R $(whoami):$(whoami) data/

# 3. Ensure .env.ec2 exists with all required variables
log "Creating complete environment file..."
cat > .env.ec2 << 'EOF'
# Django settings
SECRET_KEY=django-insecure-your-secret-key-here-change-in-production
DEBUG=False
USE_COGNITO_AUTH=False

# Database
DATABASE_PATH=/opt/restaurant-web/data
DATABASE_NAME=restaurant_prod.sqlite3

# AWS
AWS_REGION=us-west-2
COGNITO_USER_POOL_ID=placeholder
COGNITO_APP_CLIENT_ID=placeholder

# Hosts
ALLOWED_HOSTS=*
DOMAIN_NAME=xn--elfogndedonsoto-zrb.com

# Django settings module
DJANGO_SETTINGS_MODULE=backend.settings_ec2
EOF

# 4. Stop everything
log "Stopping services..."
docker-compose --profile production down || true
docker system prune -f || true

# 5. Pull and start with basic config first
log "Starting with basic configuration..."
docker-compose --profile production pull
docker-compose --profile production up -d app

# 6. Wait and check logs
sleep 10
log "Checking app status..."
docker-compose --profile production logs app --tail=20

# 7. If app is running, start nginx
if docker-compose --profile production ps app | grep -q "Up"; then
    log "App is running! Starting nginx..."
    docker-compose --profile production up -d nginx
    
    sleep 5
    if curl -f -s http://localhost:8000/api/v1/health/; then
        log "✅ Deployment fixed!"
        docker-compose --profile production ps
    else
        log "Health check failed, but services are running"
    fi
else
    error "App failed to start. Check logs above."
fi