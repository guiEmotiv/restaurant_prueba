#!/bin/bash

# Restaurant Management System - Production Deployment Script
# Simple deployment script for EC2 Ubuntu

set -e

echo "🚀 Starting Restaurant Management System Deployment"
echo "=================================================="

# Check if .env.prod exists
if [ ! -f .env.prod ]; then
    echo "❌ Error: .env.prod file not found"
    echo "Please create .env.prod file with your configuration"
    exit 1
fi

# Check if required environment variables are set
source .env.prod
if [ "$DJANGO_SECRET_KEY" = "CAMBIAR_POR_CLAVE_SECRETA_REAL" ]; then
    echo "❌ Error: Please change DJANGO_SECRET_KEY in .env.prod"
    echo "Generate one with:"
    echo "python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'"
    exit 1
fi

if [ "$EC2_PUBLIC_IP" = "TU_IP_PUBLICA_EC2" ]; then
    echo "⚠️  Warning: Please set your EC2_PUBLIC_IP in .env.prod"
    echo "Get it with: curl http://169.254.169.254/latest/meta-data/public-ipv4"
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
sleep 10

# Check if container is running
if docker ps | grep -q "restaurant_web_prod"; then
    echo "✅ Application started successfully!"
    
    # Get the IP for display
    IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")
    
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
    echo ""
else
    echo "❌ Error: Application failed to start"
    echo "Check logs with: docker logs restaurant_web_prod"
    exit 1
fi