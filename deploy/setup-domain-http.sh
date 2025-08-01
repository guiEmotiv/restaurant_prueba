#!/bin/bash

# Setup Domain HTTP-only Script
# Configures xn--elfogndedonsoto-zrb.com without SSL (for testing)

echo "🌐 Setting up Domain (HTTP-only)"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

DOMAIN="xn--elfogndedonsoto-zrb.com"
PROJECT_DIR="/opt/restaurant-web"

echo -e "${BLUE}🔧 Configuring domain: $DOMAIN (HTTP-only)${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

# Install nginx
echo -e "\n${YELLOW}📦 Installing Nginx...${NC}"
apt update
apt install -y nginx

# Stop any existing nginx
systemctl stop nginx 2>/dev/null || true

# Create simple Nginx configuration for HTTP
echo -e "\n${YELLOW}⚙️ Creating Nginx configuration (HTTP-only)...${NC}"
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
    EC2_PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || hostname -I | awk '{print $1}')
    if grep -q "^ALLOWED_HOSTS=" "$PROJECT_DIR/.env.ec2"; then
        sed -i "s/^ALLOWED_HOSTS=.*/ALLOWED_HOSTS=localhost,127.0.0.1,$EC2_PUBLIC_IP,$DOMAIN,www.$DOMAIN/" "$PROJECT_DIR/.env.ec2"
    fi
    
    echo -e "${GREEN}✅ Environment configuration updated${NC}"
fi

# Update frontend to use HTTP for now
echo -e "\n${YELLOW}📝 Updating frontend configuration...${NC}"
cat > "$PROJECT_DIR/frontend/.env.production" << EOF
# Frontend Production Environment Variables
# These are baked into the build at compile time

# API Configuration - Using HTTP domain (SSL can be added later)
VITE_API_URL=http://$DOMAIN/api/v1

# AWS Cognito Configuration
VITE_AWS_REGION=us-west-2
VITE_AWS_COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI
VITE_AWS_COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0
EOF

echo -e "\n${GREEN}🎉 Domain setup completed (HTTP-only)!${NC}"
echo -e "${BLUE}📋 Configuration summary:${NC}"
echo -e "  🌐 Domain: $DOMAIN"
echo -e "  🔓 SSL: Not configured (HTTP-only)"
echo -e "  🚀 Nginx: Running"

echo -e "\n${YELLOW}💡 Next steps:${NC}"
echo -e "1. ${GREEN}Rebuild application:${NC} sudo ./deploy/deploy-optimized.sh"
echo -e "2. ${GREEN}Check status:${NC} sudo ./deploy/check-domain.sh"
echo -e "3. ${GREEN}Add SSL later:${NC} sudo ./deploy/fix-certbot.sh && sudo /snap/bin/certbot --nginx -d $DOMAIN"

echo -e "\n${BLUE}🌐 Your application will be available at:${NC}"
echo -e "   http://$DOMAIN"
echo -e "   http://www.$DOMAIN"

echo -e "\n${YELLOW}⚠️ Note: Using HTTP for now. Add SSL when ready.${NC}"