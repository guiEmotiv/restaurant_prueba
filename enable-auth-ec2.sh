#!/bin/bash

# ============================================================================
# Enable Authentication Script for EC2
# Run this after setting up AWS Cognito to enable login functionality
# ============================================================================

set -e  # Exit on any error

echo "🔐 Enabling Authentication on EC2"
echo "================================="
echo ""

# Check if running on EC2
if [ ! -d "/opt/restaurant-web" ]; then
    echo "❌ This script must be run on the EC2 instance"
    echo "   Expected directory: /opt/restaurant-web"
    exit 1
fi

cd /opt/restaurant-web

echo "📋 Step 1: Check if Cognito configuration exists..."

if [ ! -f ".env.ec2" ]; then
    echo "❌ .env.ec2 file not found!"
    echo "   Please run the Cognito setup script first."
    exit 1
fi

# Check if we have real Cognito values
if grep -q "us-east-1_XXXXXXXXX" .env.ec2 || grep -q "xxxxxxxxxxxxxxxxxxxxxxxxxx" .env.ec2; then
    echo "❌ .env.ec2 still contains placeholder values!"
    echo "   Please configure real AWS Cognito values first."
    echo ""
    echo "   Required values:"
    echo "   - COGNITO_USER_POOL_ID=us-east-1_REALVALUE"
    echo "   - COGNITO_APP_CLIENT_ID=realvalue"
    exit 1
fi

echo "✅ Real Cognito configuration found"

echo "📋 Step 2: Enable authentication in backend..."

# Backup current .env.ec2
cp .env.ec2 .env.ec2.backup.$(date +%Y%m%d-%H%M%S)
echo "✅ Backup created"

# Set USE_COGNITO_AUTH to True
if grep -q "USE_COGNITO_AUTH=False" .env.ec2; then
    sed -i 's/USE_COGNITO_AUTH=False/USE_COGNITO_AUTH=True/' .env.ec2
    echo "✅ Enabled USE_COGNITO_AUTH=True in .env.ec2"
elif grep -q "USE_COGNITO_AUTH=True" .env.ec2; then
    echo "ℹ️  USE_COGNITO_AUTH is already enabled"
else
    echo "USE_COGNITO_AUTH=True" >> .env.ec2
    echo "✅ Added USE_COGNITO_AUTH=True to .env.ec2"
fi

echo "📋 Step 3: Pull latest changes and enable frontend authentication..."
git pull origin main

# Check if frontend configuration exists
if [ ! -f "frontend/.env.production" ]; then
    echo "❌ frontend/.env.production file not found!"
    echo "   Please configure the frontend environment file."
    exit 1
fi

# Update frontend App.jsx to enable authentication
echo "📋 Step 4: Enable authentication in frontend..."

# Create a temporary script to update App.jsx
cat > /tmp/update_app.js << 'EOFJS'
const fs = require('fs');
const path = 'frontend/src/App.jsx';

if (!fs.existsSync(path)) {
    console.log('❌ App.jsx not found');
    process.exit(1);
}

let content = fs.readFileSync(path, 'utf8');

// Replace isCognitoConfigured = false with true
const updated = content.replace(
    /const isCognitoConfigured = false;/g,
    'const isCognitoConfigured = true;'
);

if (content !== updated) {
    fs.writeFileSync(path, updated);
    console.log('✅ Enabled authentication in App.jsx');
} else {
    console.log('ℹ️  Authentication already enabled in App.jsx');
}
EOFJS

node /tmp/update_app.js
rm /tmp/update_app.js

echo "📋 Step 5: Build frontend with authentication enabled..."
cd frontend

# Clean previous build
rm -rf dist node_modules || true

# Install dependencies with memory optimization
echo "📦 Installing frontend dependencies..."
export NODE_OPTIONS="--max-old-space-size=512"
npm install --no-package-lock --no-audit --no-fund --prefer-offline

# Load production environment variables
if [ -f ".env.production" ]; then
    echo "✅ Loading .env.production variables"
    set -a
    source .env.production
    set +a
else
    echo "⚠️  .env.production not found, using default values"
fi

# Build frontend
echo "🔨 Building frontend with authentication..."
npm run build

# Clean up to save space
rm -rf node_modules
cd ..

echo "📋 Step 6: Restart Docker containers with authentication..."

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

echo "📋 Step 7: Health check..."
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

# Get current EC2 public IP
EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "your-ec2-ip")

echo ""
echo "🎉 Authentication enabled successfully!"
echo ""
echo "🔐 Your application now requires login:"
echo "   http://$EC2_IP/"
echo ""
echo "👥 Available Users:"
echo "   Username: admin"
echo "   Password: AdminPass123!"
echo "   Role: Administrator (full access)"
echo ""
echo "   Username: mesero01"
echo "   Password: MeseroPass123!"
echo "   Role: Waiter (limited access)"
echo ""
echo "🔍 To check status:"
echo "   sudo ./deploy/ec2-deploy.sh status"
echo ""
echo "⚠️  Note: Users will be prompted to change their password on first login"