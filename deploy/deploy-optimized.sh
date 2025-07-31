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
    
    # Use npm ci for faster, reliable installs in production
    if [ -f "package-lock.json" ]; then
        npm ci --only=production --silent
    else
        npm install --only=production --silent --no-fund --no-audit
    fi
    
    echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
}

# Function to build frontend
build_frontend() {
    echo -e "\n${YELLOW}🏗️ Building frontend...${NC}"
    cd "$FRONTEND_DIR"
    
    # Set production environment
    export NODE_ENV=production
    
    # Build with local vite
    ./node_modules/.bin/vite build --mode production
    
    # Verify build
    if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
        echo -e "${RED}❌ Frontend build failed or empty${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Frontend built successfully${NC}"
}

# Function to prepare backend
prepare_backend() {
    echo -e "\n${YELLOW}🐍 Preparing backend...${NC}"
    cd "$BACKEND_DIR"
    
    # Activate virtual environment if it exists
    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
    fi
    
    # Install/update Python dependencies
    pip install -r requirements.txt --quiet --no-cache-dir
    
    # Collect static files
    python manage.py collectstatic --noinput --clear
    
    echo -e "${GREEN}✅ Backend prepared${NC}"
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