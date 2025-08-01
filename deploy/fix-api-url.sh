#!/bin/bash

# Fix API URL Duplication Issue
# Corrects VITE_API_URL to avoid /api/v1/api/v1 duplication

echo "🔧 Fixing API URL Duplication"
echo "============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="/opt/restaurant-web"
DOMAIN="xn--elfogndedonsoto-zrb.com"

echo -e "${BLUE}🔍 Problem: API URLs like /api/v1/api/v1/zones/ (duplicated)${NC}"
echo -e "${BLUE}🎯 Solution: Fix VITE_API_URL to not include /api/v1${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

echo -e "\n${YELLOW}📝 Updating frontend .env.production...${NC}"
cat > "$PROJECT_DIR/frontend/.env.production" << EOF
# Frontend Production Environment Variables
# These are baked into the build at compile time

# API Configuration - Using HTTP domain
# IMPORTANT: Do NOT include /api/v1 here as it's added automatically in api.js
VITE_API_URL=http://$DOMAIN

# AWS Cognito Configuration
VITE_AWS_REGION=us-west-2
VITE_AWS_COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI
VITE_AWS_COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0
EOF

echo -e "${GREEN}✅ Frontend configuration updated${NC}"

echo -e "\n${YELLOW}🏗️ Rebuilding frontend with correct API URL...${NC}"
cd "$PROJECT_DIR/frontend"

# Quick rebuild with production settings
NODE_ENV=production npm run build --if-present

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend rebuilt successfully${NC}"
    
    # Show build size
    if [ -d "dist" ]; then
        build_size=$(du -sh dist | cut -f1)
        echo -e "${BLUE}📊 Build size: $build_size${NC}"
    fi
else
    echo -e "${RED}❌ Frontend build failed${NC}"
    exit 1
fi

echo -e "\n${YELLOW}🔄 Restarting Docker containers...${NC}"
cd "$PROJECT_DIR"
docker-compose -f docker-compose.ec2.yml restart web

echo -e "\n${GREEN}🎉 API URL fix completed!${NC}"
echo -e "${BLUE}🌐 Test your application: http://$DOMAIN${NC}"

echo -e "\n${YELLOW}💡 Expected API calls should now be:${NC}"
echo -e "   ✅ http://$DOMAIN/api/v1/zones/"
echo -e "   ✅ http://$DOMAIN/api/v1/units/"
echo -e "   ✅ http://$DOMAIN/api/v1/tables/"

echo -e "\n${BLUE}🔍 Check browser console for corrected API calls${NC}"