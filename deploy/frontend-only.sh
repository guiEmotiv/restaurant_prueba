#!/bin/bash

# Restaurant Web - Frontend Only Deploy
# Use this for frontend changes (React components, styles, etc.)
# Much faster than full build-deploy.sh

echo "🚀 Frontend Only Deploy"
echo "======================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DOMAIN="xn--elfogndedonsoto-zrb.com"
PROJECT_DIR="/opt/restaurant-web"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# AWS Cognito Configuration
AWS_REGION="us-west-2"
COGNITO_USER_POOL_ID="us-west-2_bdCwF60ZI"
COGNITO_APP_CLIENT_ID="4i9hrd7srgbqbtun09p43ncfn0"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

echo -e "${BLUE}📝 What this script does:${NC}"
echo -e "  ✅ Builds only the frontend (React app)"
echo -e "  ✅ Restarts only nginx container"
echo -e "  ✅ Keeps backend running (no downtime)"
echo -e "  ⏱️ Takes ~2-3 minutes vs ~10+ minutes"
echo ""

# Go to frontend directory
cd "$FRONTEND_DIR"

# Recreate environment file
echo -e "${YELLOW}🔧 Setting up environment...${NC}"
cat > .env.production << EOF
# Frontend Production Environment
VITE_API_URL=http://$DOMAIN
VITE_AWS_REGION=$AWS_REGION
VITE_AWS_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
VITE_AWS_COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID
EOF

cp .env.production .env.local

# Quick build (no npm install if node_modules exists and package.json unchanged)
echo -e "${BLUE}🏗️ Building frontend...${NC}"

# Check if we need to reinstall dependencies
NEEDS_INSTALL=false
if [ ! -d "node_modules" ]; then
    NEEDS_INSTALL=true
    echo -e "${YELLOW}📦 Installing dependencies (first time)...${NC}"
elif [ "package.json" -nt "node_modules" ]; then
    NEEDS_INSTALL=true
    echo -e "${YELLOW}📦 Package.json changed, reinstalling dependencies...${NC}"
fi

if [ "$NEEDS_INSTALL" = true ]; then
    npm install --silent --no-fund --no-audit
fi

# Build frontend
echo -e "${BLUE}⚡ Building React app...${NC}"
rm -rf dist
VITE_API_URL=http://$DOMAIN \
VITE_AWS_REGION=$AWS_REGION \
VITE_AWS_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID \
VITE_AWS_COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID \
NODE_ENV=production npm run build

if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
    echo -e "${RED}❌ Frontend build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Frontend built successfully ($(du -sh dist | cut -f1))${NC}"

# Restart only nginx container (which serves the frontend)
cd "$PROJECT_DIR"
echo -e "${BLUE}🔄 Restarting nginx container...${NC}"
docker-compose -f docker-compose.ec2.yml restart nginx

# Wait for nginx to be ready
sleep 5

# Test the deployment
echo -e "${BLUE}🧪 Testing deployment...${NC}"
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN/ 2>/dev/null || echo "000")
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Frontend deployed successfully!${NC}"
else
    echo -e "${YELLOW}⚠️ Frontend status: $FRONTEND_STATUS${NC}"
    echo -e "${BLUE}Checking nginx logs:${NC}"
    docker-compose -f docker-compose.ec2.yml logs --tail=10 nginx
fi

echo -e "\n${GREEN}🎉 FRONTEND DEPLOYMENT COMPLETED!${NC}"
echo -e "${BLUE}🌐 Frontend URL: ${GREEN}http://$DOMAIN${NC}"
echo -e "${BLUE}⏱️ Total time: ~2-3 minutes${NC}"
echo -e ""
echo -e "${YELLOW}💡 Use this script when you only change:${NC}"
echo -e "  • React components (.jsx files)"
echo -e "  • CSS/Tailwind styles"
echo -e "  • Frontend logic"
echo -e "  • Dashboard updates"
echo -e ""
echo -e "${YELLOW}🔄 Need full deploy? Use: sudo ./build-deploy.sh${NC}"