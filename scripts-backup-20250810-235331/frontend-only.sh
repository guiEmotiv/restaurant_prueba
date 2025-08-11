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

# Pre-flight checks
echo -e "${BLUE}🔍 Pre-flight checks...${NC}"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js first.${NC}"
    echo -e "${YELLOW}💡 Install with:${NC}"
    echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "  sudo apt-get install -y nodejs"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ NPM not found. Please install npm first.${NC}"
    exit 1
fi

NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
echo -e "${GREEN}✅ Node.js: $NODE_VERSION${NC}"
echo -e "${GREEN}✅ NPM: $NPM_VERSION${NC}"

# Check if project directory exists
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Project directory not found: $PROJECT_DIR${NC}"
    exit 1
fi

# Check if frontend directory exists
if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}❌ Frontend directory not found: $FRONTEND_DIR${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All pre-flight checks passed${NC}"

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

# Verify we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found. Are we in the frontend directory?${NC}"
    echo -e "${BLUE}Current directory: $(pwd)${NC}"
    echo -e "${BLUE}Contents: $(ls -la)${NC}"
    exit 1
fi

# Check if we need to reinstall dependencies
NEEDS_INSTALL=false
if [ ! -d "node_modules" ]; then
    NEEDS_INSTALL=true
    echo -e "${YELLOW}📦 Installing dependencies (node_modules not found)...${NC}"
elif [ ! -f "node_modules/.bin/vite" ]; then
    NEEDS_INSTALL=true
    echo -e "${YELLOW}📦 Installing dependencies (vite not found in node_modules)...${NC}"
elif [ "package.json" -nt "node_modules" ]; then
    NEEDS_INSTALL=true
    echo -e "${YELLOW}📦 Package.json changed, reinstalling dependencies...${NC}"
fi

if [ "$NEEDS_INSTALL" = true ]; then
    echo -e "${BLUE}Running npm install...${NC}"
    npm install --silent --no-fund --no-audit
    
    # Verify installation
    if [ ! -f "node_modules/.bin/vite" ]; then
        echo -e "${RED}❌ Vite not installed properly${NC}"
        echo -e "${BLUE}Trying to install vite explicitly...${NC}"
        npm install vite --save-dev
    fi
fi

# Build frontend
echo -e "${BLUE}⚡ Building React app...${NC}"
rm -rf dist

# Set environment variables and build
export VITE_API_URL=http://$DOMAIN
export VITE_AWS_REGION=$AWS_REGION
export VITE_AWS_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
export VITE_AWS_COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID
export NODE_ENV=production

# Try multiple build methods
BUILD_SUCCESS=false

# Method 1: npm run build (preferred)
echo -e "${BLUE}Trying: npm run build${NC}"
if npm run build; then
    BUILD_SUCCESS=true
    echo -e "${GREEN}✅ Build successful with npm run build${NC}"
else
    echo -e "${YELLOW}⚠️ npm run build failed, trying alternative methods...${NC}"
    
    # Method 2: npx vite build
    echo -e "${BLUE}Trying: npx vite build${NC}"
    if npx vite build; then
        BUILD_SUCCESS=true
        echo -e "${GREEN}✅ Build successful with npx vite build${NC}"
    else
        echo -e "${YELLOW}⚠️ npx vite build failed, trying direct path...${NC}"
        
        # Method 3: Direct path to vite
        if [ -f "node_modules/.bin/vite" ]; then
            echo -e "${BLUE}Trying: ./node_modules/.bin/vite build${NC}"
            if ./node_modules/.bin/vite build; then
                BUILD_SUCCESS=true
                echo -e "${GREEN}✅ Build successful with direct vite path${NC}"
            fi
        fi
    fi
fi

# Check if build was successful
if [ "$BUILD_SUCCESS" = false ]; then
    echo -e "${RED}❌ All build methods failed${NC}"
    echo -e "${BLUE}Debugging information:${NC}"
    echo -e "  Node version: $(node --version 2>/dev/null || echo 'Not found')"
    echo -e "  NPM version: $(npm --version 2>/dev/null || echo 'Not found')"
    echo -e "  Vite in node_modules: $([ -f 'node_modules/.bin/vite' ] && echo 'Yes' || echo 'No')"
    echo -e "  Package.json scripts:"
    cat package.json | grep -A5 -B1 '"scripts"' || echo "Could not read package.json"
    exit 1
fi

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