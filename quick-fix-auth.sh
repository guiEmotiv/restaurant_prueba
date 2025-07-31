#!/bin/bash

# ============================================================================
# Quick Authentication Fix Script
# Run this on your EC2 instance to disable AWS Cognito authentication
# ============================================================================

set -e  # Exit on any error

echo "🔧 Quick Authentication Fix for EC2"
echo "====================================="

# Check if running on EC2
if [ ! -d "/opt/restaurant-web" ]; then
    echo "❌ This script must be run on the EC2 instance"
    echo "   Expected directory: /opt/restaurant-web"
    exit 1
fi

cd /opt/restaurant-web

echo "📋 Step 1: Update .env.ec2 to disable Cognito authentication..."

# Backup current .env.ec2
if [ -f .env.ec2 ]; then
    cp .env.ec2 .env.ec2.backup.$(date +%Y%m%d-%H%M%S)
    echo "✅ Backup created: .env.ec2.backup.$(date +%Y%m%d-%H%M%S)"
fi

# Update USE_COGNITO_AUTH to False
if grep -q "USE_COGNITO_AUTH=True" .env.ec2; then
    sed -i 's/USE_COGNITO_AUTH=True/USE_COGNITO_AUTH=False/' .env.ec2
    echo "✅ Set USE_COGNITO_AUTH=False in .env.ec2"
else
    echo "ℹ️  USE_COGNITO_AUTH is already set to False"
fi

echo "📋 Step 2: Pull latest changes from repository..."
git pull origin main

echo "📋 Step 3: Build frontend with authentication disabled..."
cd frontend

# Clean previous build
rm -rf dist node_modules || true

# Install dependencies with memory optimization
echo "📦 Installing frontend dependencies..."
export NODE_OPTIONS="--max-old-space-size=512"
npm install --no-package-lock --no-audit --no-fund --prefer-offline

# Build frontend
echo "🔨 Building frontend..."
npm run build

# Clean up to save space
rm -rf node_modules
cd ..

echo "📋 Step 4: Restart Docker containers..."

# Stop containers
echo "🛑 Stopping containers..."
docker-compose -f docker-compose.ec2.yml down || true

# Build and start containers
echo "🔨 Building Docker images..."
docker-compose -f docker-compose.ec2.yml build --no-cache

echo "🚀 Starting containers..."
docker-compose -f docker-compose.ec2.yml up -d

echo "⏳ Waiting for services to start..."
sleep 15

echo "🗄️  Running database migrations..."
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py migrate

echo "📊 Collecting static files..."
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py collectstatic --noinput

echo "📋 Step 5: Health check..."
sleep 5

if curl -f http://localhost/admin/ > /dev/null 2>&1; then
    echo "✅ Backend is responding"
else
    echo "❌ Backend is not responding"
    echo "📋 Container logs:"
    docker-compose -f docker-compose.ec2.yml logs web --tail=20
fi

if curl -f http://localhost/ > /dev/null 2>&1; then
    echo "✅ Frontend is responding"
else
    echo "❌ Frontend is not responding"
    echo "📋 Container logs:"
    docker-compose -f docker-compose.ec2.yml logs nginx --tail=20
fi

echo ""
echo "🎉 Authentication fix completed!"
echo ""
echo "📍 Your application should now be accessible at:"
echo "   http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)/"
echo ""
echo "ℹ️  Authentication is now DISABLED - direct access enabled"
echo "⚠️  TODO: Configure real AWS Cognito settings and re-enable authentication"
echo ""
echo "🔍 To check status:"
echo "   sudo ./deploy/ec2-deploy.sh status"