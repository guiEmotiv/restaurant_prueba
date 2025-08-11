#!/bin/bash

echo "=== Fix Frontend MIME Type Issue ==="
echo "===================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DOMAIN="xn--elfogndedonsoto-zrb.com"
NGINX_ROOT="/var/www/restaurant"
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

# 1. Check what's being served as index.html
echo -e "\n${BLUE}📄 Checking index.html content...${NC}"
if [ -f "$NGINX_ROOT/index.html" ]; then
    FILE_TYPE=$(file -b "$NGINX_ROOT/index.html")
    echo "File type: $FILE_TYPE"
    
    echo -e "\nFirst 200 characters:"
    head -c 200 "$NGINX_ROOT/index.html"
    echo -e "\n"
    
    # Check if it's actually JavaScript
    if head -1 "$NGINX_ROOT/index.html" | grep -q "function\|var\|const\|import"; then
        echo -e "${RED}❌ ERROR: index.html contains JavaScript code!${NC}"
        WRONG_INDEX=true
    else
        echo -e "${GREEN}✅ index.html appears to be HTML${NC}"
        WRONG_INDEX=false
    fi
else
    echo -e "${RED}❌ index.html not found${NC}"
    WRONG_INDEX=true
fi

# 2. Check nginx mime types
echo -e "\n${BLUE}🔧 Checking nginx MIME types...${NC}"
if grep -q "text/html" /etc/nginx/mime.types; then
    echo -e "${GREEN}✅ HTML MIME type configured${NC}"
else
    echo -e "${RED}❌ HTML MIME type missing${NC}"
fi

# 3. Look for the real index.html
echo -e "\n${BLUE}🔍 Looking for correct index.html...${NC}"
REAL_INDEX=""

# Check in dist folder
if [ -f "/opt/restaurant-web/frontend/dist/index.html" ]; then
    echo "Found in: /opt/restaurant-web/frontend/dist/index.html"
    if head -1 "/opt/restaurant-web/frontend/dist/index.html" | grep -q "<!DOCTYPE\|<html"; then
        echo -e "${GREEN}✅ This is the correct HTML file${NC}"
        REAL_INDEX="/opt/restaurant-web/frontend/dist/index.html"
    fi
fi

# Check if there's a JS file named index
if [ -z "$REAL_INDEX" ]; then
    echo -e "${YELLOW}Looking for misnamed files...${NC}"
    find "$NGINX_ROOT" -name "index.*" -type f | while read file; do
        echo "Found: $file"
        head -1 "$file" | head -c 100
        echo ""
    done
fi

# 4. Fix the issue
if [ "$WRONG_INDEX" = true ] && [ -n "$REAL_INDEX" ]; then
    echo -e "\n${YELLOW}🔧 Fixing the issue...${NC}"
    
    # Backup current files
    echo "Backing up current nginx root..."
    mv "$NGINX_ROOT" "${NGINX_ROOT}.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Create fresh nginx root
    mkdir -p "$NGINX_ROOT"
    
    # Copy all files from dist
    echo "Copying correct files..."
    cp -r /opt/restaurant-web/frontend/dist/* "$NGINX_ROOT/"
    
    # Set permissions
    chown -R www-data:www-data "$NGINX_ROOT"
    chmod -R 755 "$NGINX_ROOT"
    
    echo -e "${GREEN}✅ Files copied${NC}"
fi

# 5. Update nginx configuration to ensure correct MIME types
echo -e "\n${BLUE}📝 Updating nginx configuration...${NC}"

# Check if charset is set
if ! grep -q "charset utf-8;" "$NGINX_CONF"; then
    echo "Adding charset configuration..."
    sed -i '/server {/a\    charset utf-8;' "$NGINX_CONF"
fi

# Ensure correct location block for static files
if ! grep -q "location ~\* \\\.\(js\|css\|png\|jpg\|jpeg\|gif\|ico\|svg\)\$" "$NGINX_CONF"; then
    echo "Adding static file handling..."
    # This would need to be inserted before the last closing brace
fi

# 6. Test and reload nginx
echo -e "\n${BLUE}🔄 Testing and reloading nginx...${NC}"
nginx -t
if [ $? -eq 0 ]; then
    systemctl reload nginx
    echo -e "${GREEN}✅ Nginx reloaded${NC}"
else
    echo -e "${RED}❌ Nginx config test failed${NC}"
fi

# 7. Clear browser cache reminder
echo -e "\n${YELLOW}🌐 IMPORTANT: Clear your browser cache!${NC}"
echo "The browser may have cached the wrong content type."
echo "Try:"
echo "1. Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)"
echo "2. Open in incognito/private window"
echo "3. Clear browser cache completely"

# 8. Final test
echo -e "\n${BLUE}🎯 Final test...${NC}"
sleep 2

# Test with curl
echo "Testing with curl..."
RESPONSE=$(curl -s -I http://localhost/ | grep -i "content-type")
echo "Response: $RESPONSE"

# Check the actual content
echo -e "\nChecking served content..."
CONTENT=$(curl -s http://localhost/ | head -c 100)
if echo "$CONTENT" | grep -q "<!DOCTYPE\|<html"; then
    echo -e "${GREEN}✅ Correct HTML is being served${NC}"
else
    echo -e "${RED}❌ Still serving wrong content${NC}"
    echo "Content: $CONTENT"
fi

# 9. Additional debugging
echo -e "\n${BLUE}📊 File structure in nginx root:${NC}"
tree -L 2 "$NGINX_ROOT" 2>/dev/null || ls -la "$NGINX_ROOT"

echo -e "\n${GREEN}✅ Fix attempt complete${NC}"
echo -e "${YELLOW}Next steps if still not working:${NC}"
echo "1. Check if build process created correct files: ls -la /opt/restaurant-web/frontend/dist/"
echo "2. Rebuild frontend: cd /opt/restaurant-web/frontend && npm run build"
echo "3. Check for any .htaccess or other config files interfering"
echo "4. Look at browser Developer Tools > Network tab for exact errors"