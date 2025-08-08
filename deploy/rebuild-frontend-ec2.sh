#!/bin/bash

echo "=== Rebuild Frontend on EC2 ==="
echo "==============================="

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
NGINX_ROOT="/var/www/restaurant"

# AWS Cognito Configuration
AWS_REGION="us-west-2"
COGNITO_USER_POOL_ID="us-west-2_bdCwF60ZI"
COGNITO_APP_CLIENT_ID="4i9hrd7srgbqbtun09p43ncfn0"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

cd "$FRONTEND_DIR"

# 1. Clean everything
echo -e "${BLUE}🧹 Cleaning old build...${NC}"
rm -rf node_modules package-lock.json dist
rm -rf "$NGINX_ROOT"/*

# 2. Ensure correct environment file
echo -e "${BLUE}📝 Creating .env.production...${NC}"
cat > .env.production << EOF
# Frontend Production Environment
VITE_API_URL=https://www.$DOMAIN
VITE_AWS_REGION=$AWS_REGION
VITE_AWS_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
VITE_AWS_COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID
EOF

# Also create .env.local for consistency
cp .env.production .env.local

echo -e "${GREEN}✅ Environment files created${NC}"
cat .env.production

# 3. Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install --silent --no-fund --no-audit

# 4. Build with explicit environment
echo -e "${BLUE}🔨 Building frontend...${NC}"
VITE_API_URL=https://www.$DOMAIN \
VITE_AWS_REGION=$AWS_REGION \
VITE_AWS_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID \
VITE_AWS_COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID \
NODE_ENV=production npm run build

# 5. Verify build output
echo -e "${BLUE}🔍 Verifying build output...${NC}"
if [ ! -f "dist/index.html" ]; then
    echo -e "${RED}❌ Build failed - no index.html found${NC}"
    exit 1
fi

echo "Checking index.html content..."
head -5 dist/index.html

if ! head -1 dist/index.html | grep -q "<!DOCTYPE\|<html"; then
    echo -e "${RED}❌ index.html is not valid HTML${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"
echo "Build size: $(du -sh dist | cut -f1)"
echo "Files created: $(find dist -type f | wc -l)"

# 6. Deploy to nginx
echo -e "${BLUE}🚀 Deploying to nginx...${NC}"
mkdir -p "$NGINX_ROOT"
cp -r dist/* "$NGINX_ROOT/"
chown -R www-data:www-data "$NGINX_ROOT"

# 7. Verify deployment
echo -e "${BLUE}✅ Verifying deployment...${NC}"
if [ -f "$NGINX_ROOT/index.html" ]; then
    echo -e "${GREEN}✅ index.html deployed${NC}"
    echo "Deployed files:"
    ls -la "$NGINX_ROOT/" | head -10
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

# 8. Test nginx configuration
echo -e "${BLUE}🔧 Testing nginx...${NC}"
nginx -t
systemctl reload nginx

# 9. Clean node_modules to save space
echo -e "${BLUE}🧹 Cleaning up...${NC}"
npm prune --production

# 10. Final test
echo -e "${BLUE}🎯 Testing deployment...${NC}"
sleep 2

# Test index.html
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/)
echo "HTTP Status for /: $HTTP_STATUS"

# Test content type
CONTENT_TYPE=$(curl -s -I http://localhost/ | grep -i "content-type" | cut -d' ' -f2)
echo "Content-Type: $CONTENT_TYPE"

# Test actual content
CONTENT=$(curl -s http://localhost/ | head -c 50)
if echo "$CONTENT" | grep -q "<!DOCTYPE\|<html"; then
    echo -e "${GREEN}✅ Frontend is serving correct HTML${NC}"
else
    echo -e "${RED}❌ Frontend is serving wrong content${NC}"
    echo "Content: $CONTENT"
fi

echo -e "\n${GREEN}✅ Frontend rebuild complete!${NC}"
echo -e "${YELLOW}📌 Remember to:${NC}"
echo "1. Clear browser cache (Ctrl+Shift+R)"
echo "2. Try incognito/private window"
echo "3. Check browser console for errors"
echo ""
echo "URLs:"
echo "- https://www.$DOMAIN"
echo "- https://$DOMAIN"