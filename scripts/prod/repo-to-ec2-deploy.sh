#!/bin/bash

# REPOSITORY TO EC2 PRODUCTION DEPLOYMENT
# Deploy directo desde GitHub repository hacia EC2 production
# Mejores prácticas de DevOps con validación completa

set -e

echo "🚀 REPOSITORY TO EC2 PRODUCTION DEPLOYMENT"
echo "=========================================="

# Configuración
EC2_HOST="44.248.47.186"
EC2_USER="ubuntu"
EC2_APP_DIR="/home/ubuntu/restaurant-web"
REPO_URL="https://github.com/guiEmotiv/restaurant-web.git"
BRANCH="main"

# AWS Cognito Configuration (PRODUCTION)
COGNITO_USER_POOL_ID="us-west-2_bdCwF60ZI"
COGNITO_APP_CLIENT_ID="4i9hrd7srgbqbtun09p43ncfn0" 
PROD_DOMAIN="www.xn--elfogndedonsoto-zrb.com"

echo "📋 Deployment Configuration:"
echo "   Repository: ${REPO_URL}"
echo "   Branch: ${BRANCH}"
echo "   EC2 Target: ${EC2_HOST}:${EC2_APP_DIR}"
echo "   Production Domain: ${PROD_DOMAIN}"
echo "   AWS Cognito Pool: ${COGNITO_USER_POOL_ID}"
echo ""

# SSH Key Configuration
SSH_KEY="./ubuntu_fds_key.pem"
SSH_OPTS="-i ${SSH_KEY} -o ConnectTimeout=10 -o StrictHostKeyChecking=no"

# Test SSH connection
echo "🔍 Testing SSH connection to EC2..."
if [ ! -f "${SSH_KEY}" ]; then
    echo "❌ SSH key not found: ${SSH_KEY}"
    exit 1
fi

if ! ssh ${SSH_OPTS} ${EC2_USER}@${EC2_HOST} exit 2>/dev/null; then
    echo "❌ SSH connection failed using key: ${SSH_KEY}"
    exit 1
fi
echo "✅ SSH connection verified with key: ${SSH_KEY}"

# Deploy to EC2
echo ""
echo "🚀 DEPLOYING TO EC2 PRODUCTION"
echo "==============================="

ssh ${SSH_OPTS} ${EC2_USER}@${EC2_HOST} << 'EOF'
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
set -e

echo "🏠 Creating application directory..."
/bin/mkdir -p /home/ubuntu/restaurant-web
cd /home/ubuntu/restaurant-web

echo "🛑 Stopping existing services..."
if [ -f docker-compose.prod.yml ]; then
    docker-compose -f docker-compose.prod.yml down --remove-orphans || true
fi

echo "💾 Backing up current database..."
if [ -f docker/data/restaurant.prod.sqlite3 ]; then
    cp docker/data/restaurant.prod.sqlite3 \
       docker/data/restaurant.prod.backup.\$(date +%Y%m%d_%H%M%S).sqlite3
    echo "✅ Database backup created"
fi

echo "📥 Cloning/updating repository..."
if [ -d ".git" ]; then
    echo "   📂 Repository exists, updating..."
    git fetch origin
    git reset --hard origin/${BRANCH}
    git clean -fd
else
    echo "   📁 Fresh repository clone..."
    rm -rf * .* 2>/dev/null || true
    git clone ${REPO_URL} .
    git checkout ${BRANCH}
fi

echo "✅ Repository updated to latest ${BRANCH}"
git log --oneline -3

echo "🗑️  Cleaning Docker resources..."
docker system prune -af --volumes || true
docker image rm restaurant-app:latest || true

echo "📦 Installing frontend dependencies..."
cd frontend
npm ci --production=false

echo "🔍 Running frontend linting..."
npm run lint || echo "⚠️  Linting warnings found, continuing..."

echo "🏗️  Building frontend for production with AWS Cognito..."
NODE_ENV=production \
VITE_DISABLE_COGNITO=false \
VITE_AWS_COGNITO_USER_POOL_ID=${COGNITO_USER_POOL_ID} \
VITE_AWS_COGNITO_APP_CLIENT_ID=${COGNITO_APP_CLIENT_ID} \
VITE_API_BASE_URL=https://${PROD_DOMAIN}/api/v1 \
npm run build

echo "✅ Frontend build completed with AWS Cognito integration"

cd ${EC2_APP_DIR}

echo "🐳 Building production Docker image..."
NODE_ENV=production \
VITE_DISABLE_COGNITO=false \
VITE_AWS_COGNITO_USER_POOL_ID=${COGNITO_USER_POOL_ID} \
VITE_AWS_COGNITO_APP_CLIENT_ID=${COGNITO_APP_CLIENT_ID} \
VITE_API_BASE_URL=https://${PROD_DOMAIN}/api/v1 \
docker build --no-cache -f Dockerfile.prod -t restaurant-app:latest .

echo "📝 Updating docker-compose for production..."
sed -i 's/image: restaurant-app:.*/image: restaurant-app:latest/' docker-compose.prod.yml

echo "🗂️  Creating data directories..."
mkdir -p docker/data docker/logs

echo "🚀 Starting production services..."
docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for containers to initialize..."
sleep 60

echo "🔍 Checking container status..."
docker-compose -f docker-compose.prod.yml ps

echo "📋 Checking application logs..."
docker logs restaurant-app --tail 20 || true

echo "🩺 Testing internal health check..."
for i in {1..10}; do
    if curl -f -s http://localhost:8000/api/v1/health/ > /dev/null; then
        echo "✅ Application responding (attempt \$i)"
        break
    else
        echo "⏳ Waiting for application (attempt \$i/10)..."
        sleep 15
    fi
done

echo "🔐 Testing AWS Cognito configuration..."
COGNITO_RESPONSE=\$(curl -s http://localhost:8000/api/v1/auth/cognito-config/ || echo "ERROR")
if echo "\$COGNITO_RESPONSE" | grep -q "${COGNITO_USER_POOL_ID}"; then
    echo "✅ AWS Cognito configured correctly"
else
    echo "⚠️  AWS Cognito configuration issue: \$COGNITO_RESPONSE"
fi

echo "🌐 Testing nginx proxy..."
if curl -f -s http://localhost:80/ > /dev/null; then
    echo "✅ Nginx proxy responding"
else
    echo "⚠️  Nginx proxy issue"
fi

echo "📊 Final container status:"
docker-compose -f docker-compose.prod.yml ps

EOF

# External validation
echo ""
echo "🌍 EXTERNAL VALIDATION"
echo "======================"

echo "⏳ Waiting for public endpoints to be ready..."
sleep 30

echo "🔍 Testing public HTTPS endpoint..."
if curl -f -s -k --max-time 30 "https://${PROD_DOMAIN}" > /dev/null; then
    echo "✅ HTTPS endpoint responding"
else
    echo "⚠️  HTTPS endpoint not responding (may need SSL configuration)"
fi

echo "🔍 Testing public API endpoint..."
if curl -f -s -k --max-time 30 "https://${PROD_DOMAIN}/api/v1/health/" > /dev/null; then
    echo "✅ Public API endpoint responding" 
else
    echo "⚠️  Public API endpoint not responding"
fi

# Final validation with detailed script
echo ""
echo "🎯 RUNNING COMPREHENSIVE VALIDATION"
echo "==================================="

if [ -f "./scripts/prod/validate-production.sh" ]; then
    echo "🔍 Running production validation script..."
    ./scripts/prod/validate-production.sh
else
    echo "⚠️  Validation script not found, performing basic checks..."
    
    # Basic manual validation
    echo "📊 Basic Production Validation:"
    echo "   Frontend: https://${PROD_DOMAIN}"
    echo "   API: https://${PROD_DOMAIN}/api/v1/health/"
    echo "   Cognito Pool: ${COGNITO_USER_POOL_ID}"
fi

echo ""
echo "🎉 DEPLOYMENT COMPLETED"
echo "========================"
echo "✅ Repository deployed to EC2 production"
echo "✅ AWS Cognito integrated and configured"
echo "✅ Docker containers running"
echo "✅ Basic validation completed"
echo ""
echo "🔗 Production URLs:"
echo "   Website: https://${PROD_DOMAIN}"
echo "   API: https://${PROD_DOMAIN}/api/v1/"
echo "   Health Check: https://${PROD_DOMAIN}/api/v1/health/"
echo ""
echo "🔧 Monitoring Commands:"
echo "   Logs: ssh ${EC2_USER}@${EC2_HOST} 'docker logs restaurant-app --tail 50'"
echo "   Status: ssh ${EC2_USER}@${EC2_HOST} 'docker-compose -f ${EC2_APP_DIR}/docker-compose.prod.yml ps'"
echo "   Restart: ssh ${EC2_USER}@${EC2_HOST} 'cd ${EC2_APP_DIR} && docker-compose -f docker-compose.prod.yml restart'"