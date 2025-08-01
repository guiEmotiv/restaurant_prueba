#!/bin/bash

# Setup Punycode Domain Script
# Configures xn--elfogndedonsoto-zrb.com with SSL

echo "🌐 Setting up Punycode Domain"
echo "============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

DOMAIN="xn--elfogndedonsoto-zrb.com"
EMAIL="admin@$DOMAIN"
PROJECT_DIR="/opt/restaurant-web"

echo -e "${BLUE}🔧 Configuring domain: $DOMAIN${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

# Install required packages
echo -e "\n${YELLOW}📦 Installing required packages...${NC}"
apt update
apt install -y nginx certbot python3-certbot-nginx

# Stop any existing nginx
systemctl stop nginx 2>/dev/null || true

# Create Nginx configuration for the domain
echo -e "\n${YELLOW}⚙️ Creating Nginx configuration...${NC}"
cat > /etc/nginx/sites-available/$DOMAIN << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Serve static files directly
    location /static/ {
        alias $PROJECT_DIR/backend/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    location /media/ {
        alias $PROJECT_DIR/data/media/;
        expires 1y;
        add_header Cache-Control "public";
    }
    
    # Serve frontend files
    location / {
        root $PROJECT_DIR/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
        add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    }
    
    # Proxy API requests to Django
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_redirect off;
        
        # CORS headers
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS, PUT, DELETE, PATCH" always;
        add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization" always;
        
        if (\$request_method = 'OPTIONS') {
            return 204;
        }
    }
    
    # Logs
    access_log /var/log/nginx/$DOMAIN.access.log;
    error_log /var/log/nginx/$DOMAIN.error.log;
}
EOF

# Remove default nginx site if exists
rm -f /etc/nginx/sites-enabled/default

# Enable the site
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/

# Test nginx configuration
echo -e "\n${YELLOW}🧪 Testing Nginx configuration...${NC}"
if nginx -t; then
    echo -e "${GREEN}✅ Nginx configuration is valid${NC}"
else
    echo -e "${RED}❌ Nginx configuration failed${NC}"
    exit 1
fi

# Start nginx
systemctl start nginx
systemctl enable nginx

echo -e "\n${YELLOW}🔒 Setting up SSL certificate...${NC}"
# Get SSL certificate
if certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect; then
    echo -e "${GREEN}✅ SSL certificate installed successfully${NC}"
else
    echo -e "${YELLOW}⚠️ SSL certificate installation failed, but HTTP is working${NC}"
    echo -e "${BLUE}💡 You can retry SSL later with: certbot --nginx -d $DOMAIN${NC}"
fi

# Update environment files
echo -e "\n${YELLOW}📝 Updating environment configuration...${NC}"
if [ -f "$PROJECT_DIR/.env.ec2" ]; then
    # Add or update DOMAIN_NAME
    if grep -q "^DOMAIN_NAME=" "$PROJECT_DIR/.env.ec2"; then
        sed -i "s/^DOMAIN_NAME=.*/DOMAIN_NAME=$DOMAIN/" "$PROJECT_DIR/.env.ec2"
    else
        echo "DOMAIN_NAME=$DOMAIN" >> "$PROJECT_DIR/.env.ec2"
    fi
    
    # Update ALLOWED_HOSTS if needed
    EC2_PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")
    if grep -q "^ALLOWED_HOSTS=" "$PROJECT_DIR/.env.ec2"; then
        sed -i "s/^ALLOWED_HOSTS=.*/ALLOWED_HOSTS=localhost,127.0.0.1,$EC2_PUBLIC_IP,$DOMAIN,www.$DOMAIN/" "$PROJECT_DIR/.env.ec2"
    fi
    
    echo -e "${GREEN}✅ Environment configuration updated${NC}"
fi

# Restart nginx to apply all changes
systemctl restart nginx

echo -e "\n${GREEN}🎉 Domain setup completed!${NC}"
echo -e "${BLUE}📋 Configuration summary:${NC}"
echo -e "  🌐 Domain: $DOMAIN"
echo -e "  🔒 SSL: $([ -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem ] && echo 'Enabled' || echo 'Pending')"
echo -e "  🚀 Nginx: Running"

echo -e "\n${YELLOW}💡 Next steps:${NC}"
echo -e "1. ${GREEN}Rebuild application:${NC} sudo ./deploy/deploy-optimized.sh"
echo -e "2. ${GREEN}Check status:${NC} sudo ./deploy/check-domain.sh"

echo -e "\n${BLUE}🌐 Your application will be available at:${NC}"
echo -e "   https://$DOMAIN"
echo -e "   https://www.$DOMAIN"