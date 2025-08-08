#!/bin/bash

echo "=== Setup SSL HTTPS Only for www.xn--elfogndedonsoto-zrb.com ==="
echo "=============================================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DOMAIN="xn--elfogndedonsoto-zrb.com"
WWW_DOMAIN="www.$DOMAIN"
PROJECT_DIR="/opt/restaurant-web"
NGINX_ROOT="/var/www/restaurant"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

# 1. Stop nginx and clean up
echo -e "${BLUE}🛑 Stopping nginx and cleaning up...${NC}"
systemctl stop nginx 2>/dev/null || true
rm -f /etc/nginx/sites-enabled/*
rm -f /etc/nginx/sites-available/default
rm -f /etc/nginx/sites-available/restaurant*
rm -f /etc/nginx/sites-available/$DOMAIN

# 2. Check current certificates
echo -e "\n${BLUE}🔍 Checking SSL certificates...${NC}"
if [ -d "/etc/letsencrypt/live" ]; then
    echo "Current certificates:"
    ls -la /etc/letsencrypt/live/
    
    # Check for the correct certificate path
    CERT_PATH=""
    if [ -f "/etc/letsencrypt/live/$WWW_DOMAIN/fullchain.pem" ]; then
        CERT_PATH="/etc/letsencrypt/live/$WWW_DOMAIN"
        echo -e "${GREEN}✅ Found certificate for $WWW_DOMAIN${NC}"
    elif [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        CERT_PATH="/etc/letsencrypt/live/$DOMAIN"
        echo -e "${YELLOW}⚠️ Found certificate for $DOMAIN (not www)${NC}"
    else
        echo -e "${RED}❌ No valid certificates found${NC}"
    fi
else
    echo -e "${RED}❌ No letsencrypt directory found${NC}"
fi

# 3. Get or renew certificate
echo -e "\n${BLUE}🔐 Setting up SSL certificate...${NC}"
if [ -z "$CERT_PATH" ]; then
    echo "Installing certbot if needed..."
    which certbot > /dev/null || {
        apt-get update -qq
        apt-get install -y certbot
    }
    
    echo "Obtaining new certificate..."
    certbot certonly \
        --standalone \
        --non-interactive \
        --agree-tos \
        --email elfogondedonsoto@gmail.com \
        --domains "$WWW_DOMAIN,$DOMAIN" \
        --preferred-challenges http \
        --force-renewal
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Certificate obtained successfully${NC}"
        # Update cert path
        if [ -f "/etc/letsencrypt/live/$WWW_DOMAIN/fullchain.pem" ]; then
            CERT_PATH="/etc/letsencrypt/live/$WWW_DOMAIN"
        elif [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
            CERT_PATH="/etc/letsencrypt/live/$DOMAIN"
        fi
    else
        echo -e "${RED}❌ Failed to obtain certificate${NC}"
        echo "Trying alternative method..."
        
        # Try with just www domain
        certbot certonly \
            --standalone \
            --non-interactive \
            --agree-tos \
            --email elfogondedonsoto@gmail.com \
            --domains "$WWW_DOMAIN" \
            --preferred-challenges http \
            --force-renewal
            
        if [ -f "/etc/letsencrypt/live/$WWW_DOMAIN/fullchain.pem" ]; then
            CERT_PATH="/etc/letsencrypt/live/$WWW_DOMAIN"
            echo -e "${GREEN}✅ Certificate obtained for www only${NC}"
        fi
    fi
fi

# 4. Create HTTPS-only nginx configuration
echo -e "\n${BLUE}📝 Creating HTTPS-only nginx configuration...${NC}"
if [ -n "$CERT_PATH" ]; then
    cat > /etc/nginx/sites-available/restaurant-ssl << EOF
# Redirect all HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name $WWW_DOMAIN $DOMAIN;
    
    # Redirect all HTTP requests to HTTPS with www
    return 301 https://$WWW_DOMAIN\$request_uri;
}

# Redirect non-www HTTPS to www HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN;
    
    ssl_certificate $CERT_PATH/fullchain.pem;
    ssl_certificate_key $CERT_PATH/privkey.pem;
    
    # Redirect to www
    return 301 https://$WWW_DOMAIN\$request_uri;
}

# Main HTTPS server for www
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $WWW_DOMAIN;
    
    # SSL Configuration
    ssl_certificate $CERT_PATH/fullchain.pem;
    ssl_certificate_key $CERT_PATH/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    charset utf-8;
    client_max_body_size 50M;
    
    root /var/www/restaurant;
    index index.html;
    
    # Frontend routes
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
    
    # Static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Ssl on;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        
        # CORS headers
        if (\$request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '\$http_origin' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE, PATCH' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
        
        add_header 'Access-Control-Allow-Origin' '\$http_origin' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE, PATCH' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
    }
    
    # Django admin
    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Ssl on;
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
    
    # Security: deny hidden files
    location ~ /\. {
        deny all;
    }
}
EOF
else
    echo -e "${RED}❌ Cannot create HTTPS config without valid certificate${NC}"
    exit 1
fi

# 5. Enable configuration
echo -e "${BLUE}🔗 Enabling configuration...${NC}"
ln -sf /etc/nginx/sites-available/restaurant-ssl /etc/nginx/sites-enabled/

# 6. Test configuration
echo -e "${BLUE}🧪 Testing nginx configuration...${NC}"
nginx -t
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Nginx configuration test failed${NC}"
    exit 1
fi

# 7. Ensure frontend files exist
echo -e "\n${BLUE}📁 Checking frontend files...${NC}"
if [ ! -f "$NGINX_ROOT/index.html" ]; then
    echo "Deploying frontend files..."
    if [ -d "$PROJECT_DIR/frontend/dist" ]; then
        mkdir -p "$NGINX_ROOT"
        cp -r "$PROJECT_DIR/frontend/dist/"* "$NGINX_ROOT/"
        chown -R www-data:www-data "$NGINX_ROOT"
        echo -e "${GREEN}✅ Frontend deployed${NC}"
    else
        echo -e "${RED}❌ No frontend dist found${NC}"
    fi
fi

# 8. Start nginx
echo -e "\n${BLUE}🚀 Starting nginx...${NC}"
systemctl start nginx
systemctl enable nginx

if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx started successfully${NC}"
else
    echo -e "${RED}❌ Failed to start nginx${NC}"
    systemctl status nginx --no-pager
    exit 1
fi

# 9. Set up auto-renewal
echo -e "\n${BLUE}🔄 Setting up certificate auto-renewal...${NC}"
echo "0 0,12 * * * root certbot renew --quiet --post-hook 'systemctl reload nginx'" > /etc/cron.d/certbot-renew

# 10. Verify everything
echo -e "\n${BLUE}🎯 Verifying setup...${NC}"

# Test HTTPS redirect
HTTP_REDIRECT=$(curl -s -o /dev/null -w "%{http_code}" -L http://$WWW_DOMAIN/)
echo "HTTP to HTTPS redirect: $HTTP_REDIRECT"

# Test HTTPS
HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$WWW_DOMAIN/)
echo "HTTPS status: $HTTPS_STATUS"

# Test API
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$WWW_DOMAIN/api/v1/health/)
echo "API status: $API_STATUS"

# Show certificate info
echo -e "\n${BLUE}📜 Certificate information:${NC}"
echo | openssl s_client -servername $WWW_DOMAIN -connect $WWW_DOMAIN:443 2>/dev/null | openssl x509 -noout -dates -subject 2>/dev/null || echo "Could not retrieve certificate info"

# Final status
echo -e "\n${GREEN}🎉 HTTPS-only setup complete!${NC}"
echo ""
echo "✅ The application is now available ONLY at:"
echo "   ${GREEN}https://$WWW_DOMAIN${NC}"
echo ""
echo "🔒 All traffic is redirected to HTTPS with www"
echo "📍 Route 53 should point to this EC2 instance's public IP"
echo ""
echo "To check logs:"
echo "- Nginx errors: sudo tail -f /var/log/nginx/error.log"
echo "- Nginx access: sudo tail -f /var/log/nginx/access.log"
echo "- Backend logs: sudo docker-compose -f docker-compose.ec2.yml logs -f web"

# Show nginx status
echo -e "\n${BLUE}📊 Nginx status:${NC}"
systemctl status nginx --no-pager | head -10