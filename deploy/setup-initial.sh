#!/bin/bash

# Restaurant Web - Initial Setup Script (Phases 1-4)
# Setup environment, cleanup, install essentials, configure nginx
# Run this first to prepare the server

echo "🚀 Restaurant Web - Initial Setup"
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="xn--elfogndedonsoto-zrb.com"
PROJECT_DIR="/opt/restaurant-web"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# AWS Cognito Configuration
AWS_REGION="us-west-2"
COGNITO_USER_POOL_ID="us-west-2_bdCwF60ZI"
COGNITO_APP_CLIENT_ID="4i9hrd7srgbqbtun09p43ncfn0"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi


# System cleanup
echo -e "${BLUE}🧹 Cleaning system...${NC}"
docker-compose -f docker-compose.ec2.yml down 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true
docker system prune -af 2>/dev/null || true
apt remove --purge -y snapd cloud-init landscape-common unattended-upgrades 2>/dev/null || true
apt autoremove --purge -y && apt clean
rm -rf /var/cache/apt/archives/* /tmp/* /var/tmp/* 2>/dev/null || true

# Install essentials
echo -e "${BLUE}🔧 Installing nginx...${NC}"
apt update -qq && apt install -y nginx
mkdir -p "$PROJECT_DIR/data"/{media,logs,backups}
chown -R 1000:1000 "$PROJECT_DIR/data"

# Configure environment
echo -e "${BLUE}⚙️ Creating environment...${NC}"
DJANGO_SECRET_KEY=$(python3 -c "import secrets; print(''.join(secrets.choice('abcdefghijklmnopqrstuvwxyz0123456789!@#\$%^&*(-_=+)') for i in range(50)))" || echo "fallback-$(date +%s)")
EC2_IP=$(hostname -I | awk '{print $1}')

cat > "$PROJECT_DIR/.env.ec2" << EOF
DJANGO_SECRET_KEY=$DJANGO_SECRET_KEY
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,$EC2_IP,$DOMAIN,www.$DOMAIN
DATABASE_URL=sqlite:///data/restaurant.sqlite3
TIME_ZONE=America/Lima
USE_COGNITO_AUTH=True
AWS_REGION=$AWS_REGION
COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID
VITE_AWS_REGION=$AWS_REGION
VITE_AWS_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
VITE_AWS_COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID
EOF
chmod 600 "$PROJECT_DIR/.env.ec2"

cp "$PROJECT_DIR/.env.ec2" "$BACKEND_DIR/.env"

# Configure Nginx (basic HTTP config that will be overwritten by build-deploy.sh)
echo -e "${BLUE}🌐 Configuring nginx...${NC}"
rm -f /etc/nginx/sites-enabled/default

cat > /etc/nginx/sites-available/$DOMAIN << 'EOF'
server {
    listen 80;
    server_name xn--elfogndedonsoto-zrb.com;
    
    location / {
        root /var/www/restaurant;
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /static/ {
        alias /opt/restaurant-web/data/staticfiles/;
        expires 1d;
    }
}
EOF

ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
nginx -t && systemctl enable nginx

echo -e "\n${GREEN}✅ INITIAL SETUP COMPLETED!${NC}"
echo -e "${YELLOW}Next: sudo ./deploy/build-deploy.sh${NC}"