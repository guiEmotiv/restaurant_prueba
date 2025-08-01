#!/bin/bash

# Restaurant Web - Diagnostic Script
# Use this to troubleshoot deployment issues

echo "🔍 Restaurant Web - Diagnostics"
echo "==============================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_DIR="/opt/restaurant-web"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo -e "${BLUE}📍 Current working directory:${NC}"
echo "  $(pwd)"
echo ""

echo -e "${BLUE}🛠️ System Information:${NC}"
echo "  OS: $(uname -a)"
echo "  User: $(whoami)"
echo "  Shell: $SHELL"
echo ""

echo -e "${BLUE}📦 Node.js Environment:${NC}"
NODE_VERSION=$(node --version 2>/dev/null || echo "❌ Not found")
NPM_VERSION=$(npm --version 2>/dev/null || echo "❌ Not found")
NPX_VERSION=$(npx --version 2>/dev/null || echo "❌ Not found")

echo "  Node.js: $NODE_VERSION"
echo "  NPM: $NPM_VERSION"
echo "  NPX: $NPX_VERSION"

if [ "$NODE_VERSION" = "❌ Not found" ]; then
    echo -e "${RED}❌ Node.js is not installed or not in PATH${NC}"
    echo -e "${YELLOW}💡 Try installing Node.js:${NC}"
    echo "    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "    sudo apt-get install -y nodejs"
fi
echo ""

echo -e "${BLUE}📂 Project Structure:${NC}"
if [ -d "$PROJECT_DIR" ]; then
    echo -e "${GREEN}✅ Project directory exists: $PROJECT_DIR${NC}"
    echo "  Contents:"
    ls -la "$PROJECT_DIR" | head -10
    echo ""
    
    if [ -d "$FRONTEND_DIR" ]; then
        echo -e "${GREEN}✅ Frontend directory exists: $FRONTEND_DIR${NC}"
        echo "  Contents:"
        ls -la "$FRONTEND_DIR" | head -10
        echo ""
        
        # Check frontend specifics
        cd "$FRONTEND_DIR"
        
        if [ -f "package.json" ]; then
            echo -e "${GREEN}✅ package.json exists${NC}"
            echo "  Scripts:"
            cat package.json | grep -A10 '"scripts"' | head -15
            echo ""
        else
            echo -e "${RED}❌ package.json not found in frontend directory${NC}"
        fi
        
        if [ -d "node_modules" ]; then
            echo -e "${GREEN}✅ node_modules exists${NC}"
            echo "  Size: $(du -sh node_modules | cut -f1)"
            
            if [ -f "node_modules/.bin/vite" ]; then
                echo -e "${GREEN}✅ Vite found in node_modules${NC}"
                echo "  Vite version: $(./node_modules/.bin/vite --version 2>/dev/null || echo 'Could not determine')"
            else
                echo -e "${RED}❌ Vite not found in node_modules${NC}"
            fi
        else
            echo -e "${YELLOW}⚠️ node_modules not found${NC}"
        fi
        
        if [ -d "dist" ]; then
            echo -e "${GREEN}✅ dist directory exists${NC}"
            echo "  Size: $(du -sh dist | cut -f1)"
            echo "  Files: $(ls dist | wc -l)"
        else
            echo -e "${YELLOW}⚠️ dist directory not found${NC}"
        fi
        
    else
        echo -e "${RED}❌ Frontend directory not found: $FRONTEND_DIR${NC}"
    fi
else
    echo -e "${RED}❌ Project directory not found: $PROJECT_DIR${NC}"
fi
echo ""

echo -e "${BLUE}🐳 Docker Information:${NC}"
DOCKER_VERSION=$(docker --version 2>/dev/null || echo "❌ Not found")
DOCKER_COMPOSE_VERSION=$(docker-compose --version 2>/dev/null || echo "❌ Not found")

echo "  Docker: $DOCKER_VERSION"
echo "  Docker Compose: $DOCKER_COMPOSE_VERSION"

if [ -f "$PROJECT_DIR/docker-compose.ec2.yml" ]; then
    echo -e "${GREEN}✅ docker-compose.ec2.yml exists${NC}"
    echo "  Container status:"
    cd "$PROJECT_DIR"
    docker-compose -f docker-compose.ec2.yml ps 2>/dev/null || echo "  Could not get container status"
else
    echo -e "${RED}❌ docker-compose.ec2.yml not found${NC}"
fi
echo ""

echo -e "${BLUE}🌐 Network Connectivity:${NC}"
echo "  Testing localhost:8000 (backend):"
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/zones/ 2>/dev/null || echo "000")
echo "    Status: $API_STATUS"

echo "  Testing localhost:80 (frontend):"
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/ 2>/dev/null || echo "000")
echo "    Status: $FRONTEND_STATUS"
echo ""

echo -e "${BLUE}💾 Disk Space:${NC}"
df -h / | tail -1 | awk '{print "  Available: " $4 " (" $5 " used)"}'
echo ""

echo -e "${BLUE}🔧 PATH Environment:${NC}"
echo "  PATH: $PATH"
echo ""

echo -e "${GREEN}🎯 Recommendations:${NC}"

if [ "$NODE_VERSION" = "❌ Not found" ]; then
    echo -e "${YELLOW}1. Install Node.js first${NC}"
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo -e "${YELLOW}2. Run 'npm install' in frontend directory${NC}"
fi

if [ ! -f "$FRONTEND_DIR/node_modules/.bin/vite" ]; then
    echo -e "${YELLOW}3. Install vite: 'npm install vite --save-dev'${NC}"
fi

echo -e "${BLUE}🚀 Next Steps:${NC}"
echo "  1. Fix any issues above"
echo "  2. Try: sudo ./deploy/frontend-only.sh"
echo "  3. If still failing, try: sudo ./deploy/build-deploy.sh"
echo ""
echo -e "${GREEN}✨ Diagnostics completed!${NC}"