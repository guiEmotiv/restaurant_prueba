#!/bin/bash

echo "=== EC2 Complete Fix Script ==="
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
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

# 1. Fix SSL Certificate issue first
echo -e "\n${BLUE}🔐 Fixing SSL certificate issue...${NC}"

# Check if certificate exists
if [ ! -f "/etc/letsencrypt/live/www.$DOMAIN/fullchain.pem" ]; then
    echo -e "${YELLOW}SSL certificate not found. Switching to HTTP only...${NC}"
    
    # Create HTTP-only nginx config
    cat > "$NGINX_CONF" << 'EOF'
server {
    listen 80;
    server_name www.xn--elfogndedonsoto-zrb.com xn--elfogndedonsoto-zrb.com;
    
    charset utf-8;
    
    root /var/www/restaurant;
    index index.html;
    
    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    # Static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # API proxy to Docker backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # CORS headers for API
        add_header 'Access-Control-Allow-Origin' '$http_origin' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE, PATCH' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,Expires' always;
    }
    
    # Django admin
    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Django static files
    location /static/ {
        alias /opt/restaurant-web/data/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF
    
    echo -e "${GREEN}✅ HTTP-only configuration created${NC}"
else
    echo -e "${GREEN}✅ SSL certificate found${NC}"
fi

# 2. Check if frontend is already correct
echo -e "\n${BLUE}📄 Checking current frontend status...${NC}"
if [ -f "$NGINX_ROOT/index.html" ]; then
    if grep -q "<!doctype html>\|<!DOCTYPE html>" "$NGINX_ROOT/index.html"; then
        echo -e "${GREEN}✅ Frontend already has valid HTML${NC}"
        FRONTEND_OK=true
    else
        echo -e "${RED}❌ Frontend has invalid content${NC}"
        FRONTEND_OK=false
    fi
else
    echo -e "${RED}❌ No frontend files found${NC}"
    FRONTEND_OK=false
fi

# 3. Deploy frontend if needed
if [ "$FRONTEND_OK" = false ]; then
    echo -e "\n${BLUE}🚀 Deploying frontend...${NC}"
    
    # Check if dist exists and is valid
    if [ -f "$FRONTEND_DIR/dist/index.html" ]; then
        echo "Using existing dist folder..."
    else
        echo -e "${YELLOW}No valid dist found. Building frontend...${NC}"
        cd "$FRONTEND_DIR"
        npm run build
    fi
    
    # Clear nginx root and copy files
    rm -rf "$NGINX_ROOT"/*
    mkdir -p "$NGINX_ROOT"
    cp -r "$FRONTEND_DIR/dist/"* "$NGINX_ROOT/"
    chown -R www-data:www-data "$NGINX_ROOT"
    chmod -R 755 "$NGINX_ROOT"
    
    echo -e "${GREEN}✅ Frontend deployed${NC}"
fi

# 4. Test and reload nginx
echo -e "\n${BLUE}🔄 Testing nginx configuration...${NC}"
nginx -t
if [ $? -eq 0 ]; then
    systemctl reload nginx
    echo -e "${GREEN}✅ Nginx reloaded successfully${NC}"
else
    echo -e "${RED}❌ Nginx configuration has errors${NC}"
    # Try to fix by removing SSL config
    echo -e "${YELLOW}Attempting to fix...${NC}"
    ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
    systemctl restart nginx
fi

# 5. Verify everything is working
echo -e "\n${BLUE}🎯 Running final checks...${NC}"

# Check nginx is running
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx is running${NC}"
else
    echo -e "${RED}❌ Nginx is not running${NC}"
    systemctl status nginx --no-pager | head -10
fi

# Check backend
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health/)
if [ "$BACKEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Backend is responding (status: $BACKEND_STATUS)${NC}"
else
    echo -e "${YELLOW}⚠️ Backend status: $BACKEND_STATUS${NC}"
fi

# Check frontend
FRONTEND_CONTENT=$(curl -s http://localhost/ | head -c 50)
if echo "$FRONTEND_CONTENT" | grep -q "<!doctype html>\|<!DOCTYPE html>"; then
    echo -e "${GREEN}✅ Frontend is serving HTML correctly${NC}"
else
    echo -e "${RED}❌ Frontend issue detected${NC}"
fi

# Show access URLs
echo -e "\n${GREEN}🌐 Access URLs:${NC}"
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || hostname -I | awk '{print $1}')
echo "- Local: http://localhost/"
echo "- IP: http://$PUBLIC_IP/"
echo "- Domain: http://$DOMAIN/"
echo "- Domain (www): http://www.$DOMAIN/"

# Show what to check in browser
echo -e "\n${YELLOW}📱 Browser troubleshooting:${NC}"
echo "1. Clear cache: Ctrl+Shift+R"
echo "2. Try incognito/private window"
echo "3. Check Console for errors (F12)"
echo "4. Check Network tab for failed requests"

# Check logs for errors
echo -e "\n${BLUE}📋 Recent nginx errors:${NC}"
tail -5 /var/log/nginx/error.log 2>/dev/null | grep -v "favicon.ico" || echo "No recent errors"

echo -e "\n${GREEN}✅ Fix script completed!${NC}"

# Final status summary
echo -e "\n${BLUE}📊 Status Summary:${NC}"
echo "- Nginx: $(systemctl is-active nginx)"
echo "- Backend: http://localhost:8000/api/v1/health/ returns $BACKEND_STATUS"
echo "- Frontend files: $(find $NGINX_ROOT -type f | wc -l) files"
echo "- SSL: $([ -f "/etc/letsencrypt/live/www.$DOMAIN/fullchain.pem" ] && echo "Configured" || echo "Not configured (HTTP only)")"

echo -e "\n${YELLOW}If still having issues, run:${NC}"
echo "sudo tail -f /var/log/nginx/error.log"
echo "sudo docker-compose -f docker-compose.ec2.yml logs -f web"