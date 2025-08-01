#!/bin/bash

# Minimal Domain Setup - No SSL, Maximum Efficiency
# Configures domain with minimal resources for 7GB EC2

echo "🚀 Minimal Domain Setup (No SSL)"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

DOMAIN="xn--elfogndedonsoto-zrb.com"
PROJECT_DIR="/opt/restaurant-web"

echo -e "${BLUE}⚡ Ultra-efficient setup for: $DOMAIN${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

# Check available space
available_gb=$(df / | tail -1 | awk '{print int($4/1024/1024)}')
echo -e "${BLUE}💾 Available space: ${available_gb}GB${NC}"

if [ $available_gb -lt 1 ]; then
    echo -e "${RED}❌ Insufficient space. Run cleanup first.${NC}"
    exit 1
fi

# Install only nginx (no certbot, no SSL tools)
echo -e "\n${YELLOW}📦 Installing minimal Nginx...${NC}"
apt update >/dev/null 2>&1
apt install -y nginx --no-install-recommends >/dev/null 2>&1

# Remove default nginx content to save space
rm -rf /var/www/html/* 2>/dev/null || true
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# Stop nginx for configuration
systemctl stop nginx 2>/dev/null || true

# Create ultra-minimal Nginx config
echo -e "\n${YELLOW}⚙️ Creating minimal Nginx config...${NC}"
cat > /etc/nginx/sites-available/$DOMAIN << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name xn--elfogndedonsoto-zrb.com www.xn--elfogndedonsoto-zrb.com _;
    
    # Serve frontend
    location / {
        root /opt/restaurant-web/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # Basic headers
        add_header X-Frame-Options "SAMEORIGIN";
        add_header X-Content-Type-Options "nosniff";
    }
    
    # Proxy API to Django
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS, PUT, DELETE, PATCH" always;
        add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization" always;
        
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }
    
    # Static files
    location /static/ {
        alias /opt/restaurant-web/backend/staticfiles/;
        expires 1d;
    }
    
    location /media/ {
        alias /opt/restaurant-web/data/media/;
        expires 1d;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/

# Test and start nginx
if nginx -t >/dev/null 2>&1; then
    systemctl start nginx
    systemctl enable nginx >/dev/null 2>&1
    echo -e "${GREEN}✅ Nginx configured and started${NC}"
else
    echo -e "${RED}❌ Nginx configuration error${NC}"
    nginx -t
    exit 1
fi

# Update .env.ec2 efficiently
echo -e "\n${YELLOW}📝 Updating configuration...${NC}"
if [ -f "$PROJECT_DIR/.env.ec2" ]; then
    # Update domain and hosts in one go
    sed -i "s/^DOMAIN_NAME=.*/DOMAIN_NAME=$DOMAIN/" "$PROJECT_DIR/.env.ec2" 2>/dev/null || echo "DOMAIN_NAME=$DOMAIN" >> "$PROJECT_DIR/.env.ec2"
    
    # Get IP efficiently
    EC2_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "127.0.0.1")
    sed -i "s/^ALLOWED_HOSTS=.*/ALLOWED_HOSTS=localhost,127.0.0.1,$EC2_IP,$DOMAIN,www.$DOMAIN/" "$PROJECT_DIR/.env.ec2" 2>/dev/null
    
    echo -e "${GREEN}✅ Environment updated${NC}"
fi

# Update frontend config for HTTP
echo -e "\n${YELLOW}🌐 Setting frontend for HTTP...${NC}"
cat > "$PROJECT_DIR/frontend/.env.production" << EOF
# Frontend Production Environment Variables
# Note: Do NOT include /api/v1 here as it's added automatically in api.js
VITE_API_URL=http://$DOMAIN
VITE_AWS_REGION=us-west-2
VITE_AWS_COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI
VITE_AWS_COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0
EOF

echo -e "${GREEN}✅ Frontend configured${NC}"

# Clean up to save space
apt clean >/dev/null 2>&1
apt autoremove -y >/dev/null 2>&1

final_space=$(df / | tail -1 | awk '{print int($4/1024/1024)}')
space_used=$((available_gb - final_space))

echo -e "\n${GREEN}🎉 Minimal domain setup completed!${NC}"
echo -e "${BLUE}📊 Space used: ${space_used}GB${NC}"
echo -e "${BLUE}📊 Space remaining: ${final_space}GB${NC}"
echo -e "${BLUE}🌐 Domain: http://$DOMAIN${NC}"

echo -e "\n${YELLOW}💡 Next steps:${NC}"
echo -e "1. ${GREEN}Deploy app:${NC} sudo ./deploy/deploy-optimized.sh"
echo -e "2. ${GREEN}Test:${NC} curl -I http://$DOMAIN"

echo -e "\n${BLUE}✨ No SSL = No complexity = It just works!${NC}"