#!/bin/bash

echo "=== EC2 Frontend Fix Script ==="
echo "=============================="

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

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

# 1. Check frontend files location
echo -e "\n${BLUE}📁 Checking frontend files...${NC}"
if [ -d "$NGINX_ROOT" ]; then
    echo -e "${GREEN}✅ Nginx root exists: $NGINX_ROOT${NC}"
    echo "Contents:"
    ls -la $NGINX_ROOT | head -10
    echo "Total files: $(find $NGINX_ROOT -type f | wc -l)"
    
    # Check index.html
    if [ -f "$NGINX_ROOT/index.html" ]; then
        echo -e "${GREEN}✅ index.html found${NC}"
        echo "First 5 lines:"
        head -5 $NGINX_ROOT/index.html
    else
        echo -e "${RED}❌ index.html NOT found${NC}"
    fi
else
    echo -e "${RED}❌ Nginx root NOT found: $NGINX_ROOT${NC}"
fi

# 2. Check if frontend dist exists
echo -e "\n${BLUE}📦 Checking frontend build...${NC}"
if [ -d "$FRONTEND_DIR/dist" ]; then
    echo -e "${GREEN}✅ Frontend dist exists${NC}"
    echo "Size: $(du -sh $FRONTEND_DIR/dist | cut -f1)"
    echo "Files: $(find $FRONTEND_DIR/dist -type f | wc -l)"
else
    echo -e "${RED}❌ Frontend dist NOT found${NC}"
fi

# 3. Check nginx configuration
echo -e "\n${BLUE}⚙️ Checking nginx configuration...${NC}"
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
if [ -f "$NGINX_CONF" ]; then
    echo -e "${GREEN}✅ Nginx config found${NC}"
    echo "Root directive:"
    grep -E "^\s*root" $NGINX_CONF
    echo "Server names:"
    grep -E "^\s*server_name" $NGINX_CONF
else
    echo -e "${RED}❌ Nginx config NOT found${NC}"
    echo "Available sites:"
    ls -la /etc/nginx/sites-available/
fi

# 4. Check if nginx is running
echo -e "\n${BLUE}🌐 Checking nginx status...${NC}"
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx is running${NC}"
    systemctl status nginx --no-pager | head -10
else
    echo -e "${RED}❌ Nginx is NOT running${NC}"
fi

# 5. Check nginx error logs
echo -e "\n${BLUE}❌ Nginx error logs (last 20 lines)...${NC}"
tail -20 /var/log/nginx/error.log 2>/dev/null || echo "No error logs found"

# 6. Check nginx access logs
echo -e "\n${BLUE}✅ Nginx access logs (last 10 lines)...${NC}"
tail -10 /var/log/nginx/access.log 2>/dev/null || echo "No access logs found"

# 7. Test nginx configuration
echo -e "\n${BLUE}🔧 Testing nginx configuration...${NC}"
nginx -t

# 8. Check ports
echo -e "\n${BLUE}🔌 Checking ports...${NC}"
netstat -tlnp | grep -E ":80|:443|:8000" || ss -tlnp | grep -E ":80|:443|:8000"

# 9. Check backend API
echo -e "\n${BLUE}🔗 Testing backend API...${NC}"
curl -s http://localhost:8000/api/v1/health/ | jq . 2>/dev/null || echo "Backend API not responding"

# 10. Fix attempt
echo -e "\n${YELLOW}🔧 Attempting fixes...${NC}"

# Ensure nginx root exists
if [ ! -d "$NGINX_ROOT" ]; then
    echo "Creating nginx root directory..."
    mkdir -p $NGINX_ROOT
fi

# Copy frontend files if they exist but are not in nginx root
if [ -d "$FRONTEND_DIR/dist" ] && [ ! -f "$NGINX_ROOT/index.html" ]; then
    echo "Copying frontend files to nginx root..."
    cp -r $FRONTEND_DIR/dist/* $NGINX_ROOT/
    chown -R www-data:www-data $NGINX_ROOT
    echo -e "${GREEN}✅ Frontend files copied${NC}"
fi

# Restart nginx
echo "Restarting nginx..."
systemctl restart nginx

# Final test
echo -e "\n${BLUE}🎯 Final test...${NC}"
sleep 2
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/)
echo "HTTP Status for /: $HTTP_STATUS"

API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/health/)
echo "HTTP Status for /api/v1/health/: $API_STATUS"

# Check environment variables
echo -e "\n${BLUE}🔧 Frontend environment check...${NC}"
if [ -f "$NGINX_ROOT/assets"/*.js ]; then
    echo "Checking for API URL in built files..."
    grep -h "VITE_API_URL\|api\..*\.com" $NGINX_ROOT/assets/*.js | head -5 || echo "No API URL found in JS files"
fi

echo -e "\n${GREEN}✅ Debug and fix attempt complete${NC}"
echo -e "${YELLOW}If frontend still not working, check:${NC}"
echo "1. DNS resolution for $DOMAIN"
echo "2. SSL certificate status"
echo "3. Browser console for JavaScript errors"
echo "4. Network tab for failed API requests"