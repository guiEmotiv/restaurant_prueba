#!/bin/bash

# Restaurant Management System - Production Deployment Script
# Simple deployment script for EC2 Ubuntu

set -euo pipefail

echo "🚀 Starting Restaurant Management System Deployment"
echo "=================================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed"
    echo "Please install Docker first. See DEPLOYMENT-STEPS.md for instructions"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Error: Docker Compose is not installed"
    echo "Please install Docker Compose first. See DEPLOYMENT-STEPS.md for instructions"
    exit 1
fi

# Check if user can access Docker
if ! docker ps &> /dev/null; then
    echo "❌ Error: Cannot access Docker"
    echo "Please add your user to docker group: sudo usermod -aG docker \$USER"
    echo "Then logout and login again"
    exit 1
fi

# Check if .env.prod exists
if [ ! -f .env.prod ]; then
    echo "❌ Error: .env.prod file not found"
    echo "Please create .env.prod file with your configuration"
    echo "You can copy from: cp .env.prod .env.prod && nano .env.prod"
    exit 1
fi

# Load environment variables
set -a
source .env.prod
set +a

# Check if required environment variables are set
if [ -z "${DJANGO_SECRET_KEY:-}" ] || [ "$DJANGO_SECRET_KEY" = "CAMBIAR_POR_CLAVE_SECRETA_REAL" ]; then
    echo "❌ Error: Please change DJANGO_SECRET_KEY in .env.prod"
    echo "Generate one with:"
    echo "python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'"
    exit 1
fi

if [ -z "${EC2_PUBLIC_IP:-}" ] || [ "$EC2_PUBLIC_IP" = "TU_IP_PUBLICA_EC2" ]; then
    echo "⚠️  Warning: Please set your EC2_PUBLIC_IP in .env.prod"
    echo "Get it with: curl http://169.254.169.254/latest/meta-data/public-ipv4"
    echo "Application will only be accessible locally"
fi

if [ -z "${DJANGO_SUPERUSER_PASSWORD:-}" ] || [ "$DJANGO_SUPERUSER_PASSWORD" = "tu-password-seguro" ]; then
    echo "⚠️  Warning: Please set a secure DJANGO_SUPERUSER_PASSWORD in .env.prod"
fi

# Create data directory
echo "📁 Creating data directory..."
mkdir -p data

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

# Build and start
echo "🔨 Building application..."
docker-compose -f docker-compose.prod.yml build --no-cache

echo "🚀 Starting application..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for container to be ready
echo "⏳ Waiting for application to start..."
sleep 15

# Check if container is running with timeout
TIMEOUT=60
COUNTER=0
while [ $COUNTER -lt $TIMEOUT ]; do
    if docker ps | grep -q "restaurant_web_prod"; then
        echo "✅ Container is running!"
        break
    fi
    echo "Waiting for container... ($COUNTER/$TIMEOUT)"
    sleep 5
    COUNTER=$((COUNTER + 5))
done

if [ $COUNTER -ge $TIMEOUT ]; then
    echo "❌ Error: Container failed to start within $TIMEOUT seconds"
    echo "Check logs with: docker logs restaurant_web_prod"
    exit 1
fi

# Wait a bit more for the application to fully start
echo "⏳ Waiting for application to be ready..."
sleep 10

# Get the IP for display
if curl -s --connect-timeout 5 http://169.254.169.254/latest/meta-data/public-ipv4 &>/dev/null; then
    IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
else
    IP="${EC2_PUBLIC_IP:-localhost}"
fi

# Final verification
if docker ps | grep -q "restaurant_web_prod" && docker logs restaurant_web_prod 2>&1 | grep -q "Starting.*server" 2>/dev/null; then
    echo ""
    echo "🎉 Deployment Complete!"
    echo "======================"
    echo "📱 Application: http://$IP"
    echo "🔧 Admin Panel: http://$IP/admin/"
    echo "📖 API Docs: http://$IP/api/docs/"
    echo ""
    echo "📋 Useful commands:"
    echo "   View logs: docker logs -f restaurant_web_prod"
    echo "   Stop app: docker-compose -f docker-compose.prod.yml down"
    echo "   Restart: docker-compose -f docker-compose.prod.yml restart"
    echo "   Check status: docker ps"
    echo ""
    echo "✅ Application started successfully!"
else
    echo "❌ Error: Application may not have started properly"
    echo "Check logs with: docker logs restaurant_web_prod"
    echo "Check container status: docker ps -a"
    exit 1
fi