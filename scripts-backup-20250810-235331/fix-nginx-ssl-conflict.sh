#!/bin/bash

echo "=== Fix Nginx SSL Conflict ==="
echo "=============================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DOMAIN="xn--elfogndedonsoto-zrb.com"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

# 1. Stop nginx to prevent conflicts
echo -e "${BLUE}🛑 Stopping nginx...${NC}"
systemctl stop nginx 2>/dev/null || true

# 2. Find all nginx configurations with SSL
echo -e "${BLUE}🔍 Finding nginx configurations with SSL...${NC}"
echo "Checking sites-enabled:"
grep -l "ssl_certificate" /etc/nginx/sites-enabled/* 2>/dev/null || echo "No SSL configs in sites-enabled"

echo -e "\nChecking sites-available:"
grep -l "ssl_certificate" /etc/nginx/sites-available/* 2>/dev/null || echo "No SSL configs in sites-available"

# 3. Remove all enabled sites
echo -e "\n${YELLOW}🧹 Cleaning nginx sites-enabled...${NC}"
rm -f /etc/nginx/sites-enabled/*

# 4. Remove old configs
echo -e "${YELLOW}🗑️ Removing old configurations...${NC}"
rm -f /etc/nginx/sites-available/default
rm -f /etc/nginx/sites-available/restaurant*
rm -f /etc/nginx/sites-available/$DOMAIN

# 5. Create new HTTP-only configuration
echo -e "\n${BLUE}📝 Creating new HTTP-only configuration...${NC}"
cat > /etc/nginx/sites-available/restaurant-http << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name www.xn--elfogndedonsoto-zrb.com xn--elfogndedonsoto-zrb.com _;
    
    charset utf-8;
    client_max_body_size 50M;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    root /var/www/restaurant;
    index index.html;
    
    # Frontend routes - MUST be first
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
    
    # Static assets with caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # API proxy to Django backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        
        # Handle OPTIONS for CORS
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '$http_origin' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE, PATCH' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '$http_origin' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE, PATCH' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
    }
    
    # Django admin
    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
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
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    # Deny access to hidden files
    location ~ /\. {
        deny all;
    }
}
EOF

# 6. Enable the new configuration
echo -e "${BLUE}🔗 Enabling new configuration...${NC}"
ln -sf /etc/nginx/sites-available/restaurant-http /etc/nginx/sites-enabled/

# 7. Test configuration
echo -e "${BLUE}🧪 Testing nginx configuration...${NC}"
nginx -t

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Configuration is valid${NC}"
else
    echo -e "${RED}❌ Configuration has errors${NC}"
    exit 1
fi

# 8. Start nginx
echo -e "${BLUE}🚀 Starting nginx...${NC}"
systemctl start nginx

if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx started successfully${NC}"
else
    echo -e "${RED}❌ Failed to start nginx${NC}"
    systemctl status nginx --no-pager
    exit 1
fi

# 9. Verify everything is working
echo -e "\n${BLUE}🎯 Verifying setup...${NC}"

# Test nginx
NGINX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/)
echo "Frontend status: $NGINX_STATUS"

# Test backend
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health/)
echo "Backend API status: $BACKEND_STATUS"

# Test frontend content
CONTENT=$(curl -s http://localhost/ | head -c 100)
if echo "$CONTENT" | grep -q "<!doctype html>\|<!DOCTYPE html>"; then
    echo -e "${GREEN}✅ Frontend serving correct HTML${NC}"
else
    echo -e "${RED}❌ Frontend content issue${NC}"
fi

# 10. Show final status
echo -e "\n${GREEN}🎉 Nginx SSL conflict resolved!${NC}"
echo -e "${BLUE}The application is now running on HTTP only.${NC}"
echo ""
echo "Access URLs:"
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "unknown")
echo "- http://$PUBLIC_IP/"
echo "- http://$DOMAIN/"
echo "- http://www.$DOMAIN/"
echo ""
echo "To enable HTTPS later, run:"
echo "sudo certbot certonly --standalone -d www.$DOMAIN -d $DOMAIN"
echo "Then update the nginx configuration to include SSL."

# Show nginx status
echo -e "\n${BLUE}📊 Final Status:${NC}"
systemctl status nginx --no-pager | head -5

echo -e "\n${GREEN}✅ Done!${NC}"