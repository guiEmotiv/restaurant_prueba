#!/bin/bash

# Restaurant Web - Frontend Build Script for EC2
# Builds the React frontend and ensures it's served by nginx

echo "🚀 Restaurant Web - Frontend Build"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="xn--elfogndedonsoto-zrb.com"
PROJECT_DIR="/opt/restaurant-web"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

# Check if project exists
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Project directory not found at $PROJECT_DIR${NC}"
    exit 1
fi

echo -e "${YELLOW}🏗️ Building Frontend${NC}"

# Go to frontend directory
cd "$FRONTEND_DIR"

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found in $FRONTEND_DIR${NC}"
    exit 1
fi

# Clean previous build
echo -e "${BLUE}Cleaning previous build...${NC}"
rm -rf node_modules dist 2>/dev/null || true

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
npm install --silent --no-fund --no-audit

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ npm install failed${NC}"
    exit 1
fi

# Build frontend
echo -e "${BLUE}Building frontend for production...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Frontend build failed${NC}"
    exit 1
fi

# Check if dist directory was created
if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
    echo -e "${RED}❌ Build output (dist) is empty${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Frontend built successfully ($(du -sh dist | cut -f1))${NC}"

# Update nginx container to serve the new build
echo -e "${BLUE}Updating nginx container...${NC}"
cd "$PROJECT_DIR"

# Restart nginx container to pick up new files
docker-compose -f docker-compose.ec2.yml restart nginx

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to restart nginx container${NC}"
    exit 1
fi

# Wait for nginx to start
sleep 5

# Test that the frontend is accessible
echo -e "${BLUE}Testing frontend access...${NC}"
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/ 2>/dev/null || echo "000")

if [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Frontend accessible via nginx (Status: $FRONTEND_STATUS)${NC}"
else
    echo -e "${YELLOW}⚠️ Frontend Status: $FRONTEND_STATUS${NC}"
fi

# Test domain access
DOMAIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN/ 2>/dev/null || echo "000")
if [ "$DOMAIN_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Domain accessible (Status: $DOMAIN_STATUS)${NC}"
else
    echo -e "${YELLOW}⚠️ Domain Status: $DOMAIN_STATUS${NC}"
fi

# Show container status
echo -e "${BLUE}Container status:${NC}"
docker-compose -f docker-compose.ec2.yml ps

echo -e "\n${GREEN}🎉 FRONTEND BUILD COMPLETED!${NC}"
echo -e "${BLUE}════════════════════════════${NC}"
echo -e "${BLUE}🌐 Application URL:${NC}"
echo -e "   Frontend: ${GREEN}http://$DOMAIN${NC}"
echo -e ""
echo -e "${YELLOW}✅ Frontend is ready to use!${NC}"

if [ "$FRONTEND_STATUS" != "200" ] || [ "$DOMAIN_STATUS" != "200" ]; then
    echo -e "\n${YELLOW}🔍 Troubleshooting:${NC}"
    echo -e "1. Check nginx logs: docker-compose -f docker-compose.ec2.yml logs nginx"
    echo -e "2. Verify frontend files: ls -la frontend/dist/"
    echo -e "3. Check containers: docker-compose -f docker-compose.ec2.yml ps"
fi