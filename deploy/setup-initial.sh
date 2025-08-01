#!/bin/bash

# Restaurant Web - Initial Setup Script (Phases 1-4)
# Setup environment, cleanup, install essentials, configure nginx
# Run this first to prepare the server

echo "🚀 Restaurant Web - Initial Setup (Phases 1-4)"
echo "=============================================="

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

# Function to show space
show_space() {
    local label="$1"
    local space=$(df / | tail -1 | awk '{print int($4/1024/1024)}')
    echo -e "${BLUE}💾 ${label}: ${space}GB${NC}"
}

show_space "Initial space"

# ==============================================================================
# PHASE 1: ULTRA CLEANUP
# ==============================================================================
echo -e "\n${YELLOW}🧹 PHASE 1: Ultra Cleanup${NC}"

# Stop all services
docker-compose -f docker-compose.ec2.yml down 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true

# Nuclear Docker cleanup
docker system prune -a --volumes -f 2>/dev/null || true
docker builder prune -a -f 2>/dev/null || true
docker rmi $(docker images -q) -f 2>/dev/null || true

# Remove unnecessary packages
apt remove --purge -y snapd certbot python3-certbot-nginx cloud-init landscape-common \
    update-notifier-common command-not-found ubuntu-advantage-tools unattended-upgrades \
    whoopsie popularity-contest apport python3-apport 2>/dev/null || true

apt autoremove --purge -y
apt clean

# Clean caches and logs
rm -rf /var/cache/apt/archives/* /var/lib/apt/lists/* /tmp/* /var/tmp/* \
    /root/.cache/* /home/*/.cache/* /usr/share/doc/* /usr/share/man/* \
    /usr/share/info/* /usr/share/locale/* 2>/dev/null || true

# Clean project artifacts
rm -rf "$FRONTEND_DIR/node_modules" "$FRONTEND_DIR/package-lock.json" \
    "$BACKEND_DIR/venv" "$FRONTEND_DIR/dist" 2>/dev/null || true

# Clean Python/Node caches
find / -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find / -name "*.pyc" -delete 2>/dev/null || true

# Clean logs aggressively
journalctl --vacuum-time=1h 2>/dev/null || true
find /var/log -type f \( -name "*.log" -o -name "*.gz" -o -name "*.old" \) -delete 2>/dev/null || true

show_space "After cleanup"

# ==============================================================================
# PHASE 2: INSTALL ESSENTIALS
# ==============================================================================
echo -e "\n${YELLOW}🔧 PHASE 2: Install Essentials${NC}"

# Install only what we need
apt update >/dev/null 2>&1
apt install -y --no-install-recommends nginx >/dev/null 2>&1

# Ensure project directory exists
mkdir -p "$PROJECT_DIR" "$PROJECT_DIR/data" "$PROJECT_DIR/data/media" \
    "$PROJECT_DIR/data/logs" "$PROJECT_DIR/data/backups"

# Set correct permissions
chown -R 1000:1000 "$PROJECT_DIR/data" 2>/dev/null || true
chmod -R 755 "$PROJECT_DIR/data" 2>/dev/null || true

show_space "After installs"

# ==============================================================================
# PHASE 3: CONFIGURE ENVIRONMENT
# ==============================================================================
echo -e "\n${YELLOW}⚙️ PHASE 3: Configure Environment${NC}"

# Generate secure Django secret key
DJANGO_SECRET_KEY=$(python3 -c "import secrets; print(''.join(secrets.choice('abcdefghijklmnopqrstuvwxyz0123456789!@#\$%^&*(-_=+)') for i in range(50)))" 2>/dev/null || echo "fallback-secret-key-$(date +%s)")

# Get EC2 IP
EC2_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "127.0.0.1")

# ==============================================================================
# 1. ROOT .env.ec2 - Main configuration file
# ==============================================================================
echo -e "${BLUE}Creating root .env.ec2...${NC}"
cat > "$PROJECT_DIR/.env.ec2" << EOF
# Restaurant Web - Production Configuration
# Generated: $(date)

# Django Configuration
DJANGO_SECRET_KEY=$DJANGO_SECRET_KEY
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,$EC2_IP,$DOMAIN,www.$DOMAIN
DATABASE_URL=sqlite:///data/restaurant.sqlite3
TIME_ZONE=America/Lima
LANGUAGE_CODE=es-pe

# AWS Cognito Configuration (Backend) - ENABLED
USE_COGNITO_AUTH=True
AWS_REGION=$AWS_REGION
COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID

# Frontend Environment
VITE_AWS_REGION=$AWS_REGION
VITE_AWS_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
VITE_AWS_COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID

# Domain Configuration
EC2_PUBLIC_IP=$EC2_IP
DOMAIN_NAME=$DOMAIN
EOF

chmod 600 "$PROJECT_DIR/.env.ec2"

# ==============================================================================
# 2. BACKEND .env - Link to root .env.ec2 for consistency
# ==============================================================================
echo -e "${BLUE}Creating backend .env...${NC}"
cat > "$BACKEND_DIR/.env" << EOF
# Backend Production Configuration
# This file links to root .env.ec2 for production

# Django Configuration
DJANGO_SECRET_KEY=$DJANGO_SECRET_KEY
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,$EC2_IP,$DOMAIN,www.$DOMAIN
DATABASE_URL=sqlite:///data/restaurant.sqlite3
TIME_ZONE=America/Lima
LANGUAGE_CODE=es-pe

# AWS Cognito Configuration - ENABLED
USE_COGNITO_AUTH=True
AWS_REGION=$AWS_REGION
COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID

# Domain Configuration
EC2_PUBLIC_IP=$EC2_IP
DOMAIN_NAME=$DOMAIN
EOF

chmod 600 "$BACKEND_DIR/.env"

echo -e "${GREEN}✅ All environment files configured${NC}"
echo -e "${BLUE}  - Root: .env.ec2${NC}"
echo -e "${BLUE}  - Backend: backend/.env${NC}"
echo -e "${BLUE}  - Frontend: frontend/.env.production (during build phase)${NC}"

# ==============================================================================
# PHASE 4: CONFIGURE NGINX
# ==============================================================================
echo -e "\n${YELLOW}🌐 PHASE 4: Configure Nginx${NC}"

# Remove default nginx config
rm -f /etc/nginx/sites-enabled/default

# Create optimized nginx config
cat > /etc/nginx/sites-available/$DOMAIN << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name xn--elfogndedonsoto-zrb.com www.xn--elfogndedonsoto-zrb.com _;
    
    # Frontend
    location / {
        root /opt/restaurant-web/frontend/dist;
        try_files $uri $uri/ /index.html;
        add_header X-Frame-Options "SAMEORIGIN";
        add_header X-Content-Type-Options "nosniff";
    }
    
    # API
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
    echo -e "${GREEN}✅ Nginx configured${NC}"
else
    echo -e "${RED}❌ Nginx configuration error${NC}"
    exit 1
fi

show_space "After initial setup"

# ==============================================================================
# INITIAL SETUP COMPLETE
# ==============================================================================
echo -e "\n${GREEN}🎉 INITIAL SETUP COMPLETED!${NC}"
echo -e "${BLUE}═════════════════════════════${NC}"
echo -e "${BLUE}📊 Setup Summary:${NC}"
echo -e "   ✅ System cleaned and optimized"
echo -e "   ✅ Essential packages installed"
echo -e "   ✅ Environment files configured"
echo -e "   ✅ Nginx configured and running"
echo -e ""
echo -e "${YELLOW}🔗 Next Step:${NC}"
echo -e "   Run: ${GREEN}sudo ./deploy/build-deploy.sh${NC}"
echo -e ""
echo -e "${BLUE}🔐 Configured for:${NC}"
echo -e "   Domain: ${DOMAIN}"
echo -e "   AWS Cognito: ${COGNITO_USER_POOL_ID}"
echo -e "   Region: ${AWS_REGION}"