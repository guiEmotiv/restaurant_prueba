#!/bin/bash

# Optimized EC2 Deployment Script
# Efficiently builds and deploys the restaurant web application

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

echo -e "${BLUE}🚀 Starting optimized deployment...${NC}"

# Function to check available space
check_disk_space() {
    local available=$(df / | tail -1 | awk '{print $4}')
    local available_gb=$((available / 1024 / 1024))
    
    if [ $available_gb -lt 1 ]; then
        echo -e "${RED}❌ Insufficient disk space ($available_gb GB available)${NC}"
        echo -e "${YELLOW}💡 Run: sudo ./deploy/cleanup-ec2.sh${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Disk space check passed ($available_gb GB available)${NC}"
}

# Function to install frontend dependencies efficiently
install_frontend_deps() {
    echo -e "\n${YELLOW}📦 Installing frontend dependencies...${NC}"
    cd "$FRONTEND_DIR"
    
    # Clean previous installations if they exist but are broken
    if [ -d "node_modules" ] && [ ! -f "node_modules/.bin/vite" ]; then
        echo -e "${BLUE}  🧹 Cleaning broken node_modules${NC}"
        rm -rf node_modules package-lock.json
    fi
    
    # Install dependencies (including dev dependencies for build tools)
    if [ -f "package-lock.json" ] && [ -d "node_modules" ]; then
        echo -e "${BLUE}  📦 Using npm ci (faster)${NC}"
        npm ci --silent --no-fund --no-audit
    else
        echo -e "${BLUE}  📦 Using npm install${NC}"
        npm install --silent --no-fund --no-audit
    fi
    
    # Verify critical build tools are installed
    if [ ! -f "node_modules/.bin/vite" ]; then
        echo -e "${YELLOW}  🔧 Installing vite explicitly${NC}"
        npm install vite --save-dev --silent
    fi
    
    # Verify vite is available
    if [ -f "node_modules/.bin/vite" ]; then
        echo -e "${GREEN}  ✅ Vite build tool available${NC}"
    else
        echo -e "${YELLOW}  ⚠️ Vite not found, will use npx fallback${NC}"
    fi
    
    echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
}

# Function to build frontend
build_frontend() {
    echo -e "\n${YELLOW}🏗️ Building frontend...${NC}"
    cd "$FRONTEND_DIR"
    
    # Set production environment
    export NODE_ENV=production
    
    # Try multiple build methods in order of preference
    local build_success=false
    
    # Method 1: Try local vite binary
    if [ -f "./node_modules/.bin/vite" ]; then
        echo -e "${BLUE}  📦 Using local vite binary${NC}"
        if ./node_modules/.bin/vite build --mode production; then
            build_success=true
        fi
    fi
    
    # Method 2: Try npm run build
    if [ "$build_success" = false ]; then
        echo -e "${BLUE}  📦 Trying npm run build${NC}"
        if npm run build; then
            build_success=true
        fi
    fi
    
    # Method 3: Try npx vite
    if [ "$build_success" = false ]; then
        echo -e "${BLUE}  📦 Trying npx vite${NC}"
        if npx vite build --mode production; then
            build_success=true
        fi
    fi
    
    # Method 4: Install vite and try again
    if [ "$build_success" = false ]; then
        echo -e "${YELLOW}  📦 Installing vite and retrying...${NC}"
        npm install vite --save-dev --silent
        if [ -f "./node_modules/.bin/vite" ]; then
            if ./node_modules/.bin/vite build --mode production; then
                build_success=true
            fi
        fi
    fi
    
    # Check if build was successful
    if [ "$build_success" = false ]; then
        echo -e "${RED}❌ All build methods failed${NC}"
        exit 1
    fi
    
    # Verify build output
    if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
        echo -e "${RED}❌ Frontend build completed but output is empty${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Frontend built successfully${NC}"
    echo -e "${BLUE}  📊 Build size: $(du -sh dist | cut -f1)${NC}"
}

# Function to prepare backend
prepare_backend() {
    echo -e "\n${YELLOW}🐍 Preparing backend...${NC}"
    cd "$BACKEND_DIR"
    
    # For Docker deployment, we don't need host virtual environment
    # Docker will handle Python dependencies internally
    echo -e "${BLUE}  🐳 Using Docker-based Python environment${NC}"
    
    # Just verify that our requirements.txt exists
    if [ ! -f "requirements.txt" ]; then
        echo -e "${RED}❌ requirements.txt not found${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Backend prepared for Docker build${NC}"
}

# Function to restart services
restart_services() {
    echo -e "\n${YELLOW}🔄 Restarting services...${NC}"
    cd "$PROJECT_DIR"
    
    # Stop services
    docker-compose -f docker-compose.ec2.yml down --remove-orphans
    
    # Clean up unused docker resources
    docker system prune -f
    
    # Start services
    docker-compose -f docker-compose.ec2.yml up -d --build
    
    echo -e "${GREEN}✅ Services restarted${NC}"
}

# Function to verify deployment
verify_deployment() {
    echo -e "\n${YELLOW}🔍 Verifying deployment...${NC}"
    
    # Wait for services to be ready
    sleep 10
    
    # Check if containers are running
    if ! docker-compose -f docker-compose.ec2.yml ps | grep -q "Up"; then
        echo -e "${RED}❌ Services not running properly${NC}"
        docker-compose -f docker-compose.ec2.yml logs --tail=20
        exit 1
    fi
    
    # Test backend health
    local backend_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health/ || echo "000")
    if [ "$backend_status" != "200" ]; then
        echo -e "${YELLOW}⚠️ Backend health check: $backend_status${NC}"
    else
        echo -e "${GREEN}✅ Backend is healthy${NC}"
    fi
    
    # Test frontend
    if curl -s http://localhost | grep -q "<!doctype html>"; then
        echo -e "${GREEN}✅ Frontend is serving${NC}"
    else
        echo -e "${YELLOW}⚠️ Frontend check failed${NC}"
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
    install_frontend_deps
    build_frontend
    prepare_backend
    restart_services
    verify_deployment
    
    echo -e "\n${GREEN}🎉 Deployment completed successfully!${NC}"
    echo -e "${BLUE}🌐 Access your application at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)${NC}"
}

# Run main function
main "$@"