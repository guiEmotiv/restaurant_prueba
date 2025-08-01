#!/bin/bash

# Minimal EC2 Deployment Script - Optimized for 7GB space
# Only installs what's absolutely necessary

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project directory
PROJECT_DIR="/opt/restaurant-web"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo -e "${BLUE}🚀 Starting minimal deployment...${NC}"

# Function to check available space
check_disk_space() {
    local available=$(df / | tail -1 | awk '{print $4}')
    local available_gb=$((available / 1024 / 1024))
    
    echo -e "${BLUE}💾 Available space: ${available_gb}GB${NC}"
    
    if [ $available_gb -lt 2 ]; then
        echo -e "${RED}❌ Insufficient disk space ($available_gb GB available)${NC}"
        echo -e "${YELLOW}💡 Run: sudo ./deploy/cleanup-deep.sh${NC}"
        exit 1
    fi
}

# Function to build frontend efficiently
build_frontend() {
    echo -e "\n${YELLOW}🏗️ Building frontend...${NC}"
    cd "$FRONTEND_DIR"
    
    # Only install production dependencies
    echo -e "${BLUE}  📦 Installing production dependencies only${NC}"
    npm ci --only=production --silent --no-fund --no-audit
    
    # Install dev dependencies temporarily just for build
    echo -e "${BLUE}  📦 Installing build tools temporarily${NC}"
    npm install vite --save-dev --silent --no-fund --no-audit
    
    # Build
    echo -e "${BLUE}  🔨 Building application${NC}"
    NODE_ENV=production ./node_modules/.bin/vite build --mode production
    
    # Remove dev dependencies immediately after build
    echo -e "${BLUE}  🧹 Removing build tools${NC}"
    npm prune --production --silent
    
    # Verify build output
    if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
        echo -e "${RED}❌ Frontend build failed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Frontend built ($(du -sh dist | cut -f1))${NC}"
}

# Function to deploy with Docker
deploy_docker() {
    echo -e "\n${YELLOW}🐳 Deploying with Docker...${NC}"
    cd "$PROJECT_DIR"
    
    # Stop any existing containers
    docker-compose -f docker-compose.ec2.yml down --remove-orphans 2>/dev/null || true
    
    # Clean up Docker to free space
    docker system prune -f
    
    # Build and start with minimal resources
    echo -e "${BLUE}  🔨 Building optimized Docker image${NC}"
    docker-compose -f docker-compose.ec2.yml up -d --build
    
    # Wait for services to be ready
    echo -e "${BLUE}  ⏰ Waiting for services to start${NC}"
    sleep 15
    
    # Verify deployment
    if docker-compose -f docker-compose.ec2.yml ps | grep -q "Up"; then
        echo -e "${GREEN}✅ Services are running${NC}"
    else
        echo -e "${RED}❌ Services failed to start${NC}"
        docker-compose -f docker-compose.ec2.yml logs --tail=20
        exit 1
    fi
}

# Main deployment process
main() {
    echo -e "${BLUE}📍 Deploying to: $(hostname -I | awk '{print $1}')${NC}"
    
    # Change to project directory
    cd "$PROJECT_DIR"
    
    # Pull latest changes
    echo -e "\n${YELLOW}📥 Pulling latest changes...${NC}"
    git pull origin main
    
    # Check requirements
    check_disk_space
    
    # Deploy steps
    build_frontend
    deploy_docker
    
    echo -e "\n${GREEN}🎉 Minimal deployment completed!${NC}"
    echo -e "${BLUE}🌐 Access at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)${NC}"
}

# Run main function
main "$@"