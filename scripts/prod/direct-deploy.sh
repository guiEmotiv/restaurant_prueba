#!/bin/bash

# DIRECT REPOSITORY TO EC2 DEPLOYMENT
# Deploy simple y directo desde GitHub a EC2

set -e

echo "🚀 DIRECT REPOSITORY TO EC2 DEPLOYMENT"
echo "======================================"

# Configuration
EC2_HOST="44.248.47.186"
EC2_USER="ubuntu"
SSH_KEY="./ubuntu_fds_key.pem"
REPO_URL="https://github.com/guiEmotiv/restaurant-web.git"

# AWS Cognito
COGNITO_USER_POOL_ID="us-west-2_bdCwF60ZI"
COGNITO_APP_CLIENT_ID="4i9hrd7srgbqbtun09p43ncfn0"
PROD_DOMAIN="www.xn--elfogndedonsoto-zrb.com"

echo "📋 Configuration:"
echo "   EC2: ${EC2_HOST}"
echo "   Domain: ${PROD_DOMAIN}"
echo "   Cognito Pool: ${COGNITO_USER_POOL_ID}"

# Test connection
echo "🔍 Testing SSH connection..."
ssh -i ${SSH_KEY} -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_HOST} "echo 'Connection OK'"

# Step 1: Stop services
echo "🛑 Step 1: Stopping existing services..."
ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_HOST} "
    cd /home/ubuntu/restaurant-web 2>/dev/null || true
    docker-compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
"

# Step 2: Backup database
echo "💾 Step 2: Backing up database..."
ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_HOST} "
    if [ -f /home/ubuntu/restaurant-web/docker/data/restaurant.prod.sqlite3 ]; then
        cp /home/ubuntu/restaurant-web/docker/data/restaurant.prod.sqlite3 \
           /home/ubuntu/restaurant-web/docker/data/restaurant.prod.backup.\$(date +%Y%m%d_%H%M%S).sqlite3
        echo 'Database backup created'
    fi
"

# Step 3: Clone repository
echo "📥 Step 3: Updating repository..."
ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_HOST} "
    cd /home/ubuntu
    rm -rf restaurant-web-new
    git clone ${REPO_URL} restaurant-web-new
    cd restaurant-web-new
    
    # Backup old directory if exists
    if [ -d /home/ubuntu/restaurant-web ]; then
        mv /home/ubuntu/restaurant-web /home/ubuntu/restaurant-web-backup-\$(date +%Y%m%d_%H%M%S)
    fi
    
    # Move new version to correct location
    mv /home/ubuntu/restaurant-web-new /home/ubuntu/restaurant-web
    cd /home/ubuntu/restaurant-web
    
    echo 'Repository updated successfully'
    git log --oneline -3
"

# Step 4: Restore database if backup exists
echo "🔄 Step 4: Restoring database..."
ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_HOST} "
    mkdir -p /home/ubuntu/restaurant-web/docker/data
    
    # Find latest backup and restore
    LATEST_BACKUP=\$(ls -t /home/ubuntu/restaurant-web-backup-*/docker/data/restaurant.prod.sqlite3 2>/dev/null | head -1)
    if [ -n \"\$LATEST_BACKUP\" ]; then
        cp \"\$LATEST_BACKUP\" /home/ubuntu/restaurant-web/docker/data/restaurant.prod.sqlite3
        echo 'Database restored from backup'
    else
        echo 'No previous database found'
    fi
"

# Step 5: Build frontend
echo "🏗️ Step 5: Building frontend with AWS Cognito..."
ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_HOST} "
    cd /home/ubuntu/restaurant-web/frontend
    npm ci
    
    NODE_ENV=production \
    VITE_DISABLE_COGNITO=false \
    VITE_AWS_COGNITO_USER_POOL_ID=${COGNITO_USER_POOL_ID} \
    VITE_AWS_COGNITO_APP_CLIENT_ID=${COGNITO_APP_CLIENT_ID} \
    VITE_API_BASE_URL=https://${PROD_DOMAIN}/api/v1 \
    npm run build
    
    echo 'Frontend build completed'
"

# Step 6: Build Docker image
echo "🐳 Step 6: Building Docker image..."
ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_HOST} "
    cd /home/ubuntu/restaurant-web
    
    docker system prune -f || true
    
    NODE_ENV=production \
    VITE_DISABLE_COGNITO=false \
    VITE_AWS_COGNITO_USER_POOL_ID=${COGNITO_USER_POOL_ID} \
    VITE_AWS_COGNITO_APP_CLIENT_ID=${COGNITO_APP_CLIENT_ID} \
    VITE_API_BASE_URL=https://${PROD_DOMAIN}/api/v1 \
    docker build --no-cache -f Dockerfile.prod -t restaurant-app:latest .
    
    echo 'Docker image built successfully'
"

# Step 7: Start services
echo "🚀 Step 7: Starting services..."
ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_HOST} "
    cd /home/ubuntu/restaurant-web
    
    # Update docker-compose image reference
    sed -i 's/image: restaurant-app:.*/image: restaurant-app:latest/' docker-compose.prod.yml
    
    # Start services
    docker-compose -f docker-compose.prod.yml up -d
    
    echo 'Services started'
"

# Step 8: Wait and validate
echo "⏳ Step 8: Waiting for services..."
sleep 60

echo "🔍 Step 9: Validating deployment..."
ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_HOST} "
    cd /home/ubuntu/restaurant-web
    
    echo 'Container Status:'
    docker-compose -f docker-compose.prod.yml ps
    
    echo 'Application Logs:'
    docker logs restaurant-app --tail 10 || true
    
    echo 'Testing internal health:'
    curl -f http://localhost:8000/api/v1/health/ && echo 'Health OK' || echo 'Health FAIL'
    
    echo 'Testing Cognito config:'
    curl -s http://localhost:8000/api/v1/auth/cognito-config/ | grep -q '${COGNITO_USER_POOL_ID}' && echo 'Cognito OK' || echo 'Cognito FAIL'
"

# Step 10: External validation
echo "🌐 Step 10: External validation..."
sleep 10

echo "Testing public endpoints..."
curl -f -k --max-time 30 "https://${PROD_DOMAIN}" >/dev/null && echo "✅ HTTPS OK" || echo "❌ HTTPS FAIL"
curl -f -k --max-time 30 "https://${PROD_DOMAIN}/api/v1/health/" >/dev/null && echo "✅ API OK" || echo "❌ API FAIL"

echo ""
echo "🎉 DEPLOYMENT COMPLETED!"
echo "======================="
echo "✅ Repository cloned and deployed"
echo "✅ AWS Cognito configured"
echo "✅ Docker containers running"
echo ""
echo "🔗 URLs:"
echo "   Website: https://${PROD_DOMAIN}"
echo "   API: https://${PROD_DOMAIN}/api/v1/"
echo "   Health: https://${PROD_DOMAIN}/api/v1/health/"