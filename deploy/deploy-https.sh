#!/bin/bash

# Restaurant Web - Complete HTTPS Deployment
# Native solution using Nginx as reverse proxy with Let's Encrypt

set -e

echo "🚀 Restaurant Web - Complete HTTPS Deployment"
echo "==========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DOMAIN="xn--elfogndedonsoto-zrb.com"
EMAIL="elfogondedonsoto@gmail.com"
PROJECT_DIR="/opt/restaurant-web"

# AWS Cognito
AWS_REGION="us-west-2"
COGNITO_USER_POOL_ID="us-west-2_bdCwF60ZI"
COGNITO_APP_CLIENT_ID="4i9hrd7srgbqbtun09p43ncfn0"

# Check root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

cd $PROJECT_DIR

# Update code
echo -e "${YELLOW}📥 Updating code...${NC}"
git pull origin main

# ==============================================================================
# PHASE 1: SYSTEM PREPARATION
# ==============================================================================
echo -e "\n${YELLOW}🔧 PHASE 1: System Preparation${NC}"

# Install system dependencies
echo -e "${BLUE}Installing system dependencies...${NC}"
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx

# Stop all services
echo -e "${YELLOW}🛑 Stopping all services...${NC}"
systemctl stop nginx
docker-compose -f docker-compose.ec2.yml down -v 2>/dev/null || true
docker-compose -f docker-compose.ssl.yml down -v 2>/dev/null || true
fuser -k 80/tcp 2>/dev/null || true
fuser -k 443/tcp 2>/dev/null || true

# Clean up
rm -rf data/db.sqlite3 data/*.db 2>/dev/null || true
docker system prune -f

# ==============================================================================
# PHASE 2: BUILD FRONTEND
# ==============================================================================
echo -e "\n${YELLOW}🏗️ PHASE 2: Build Frontend${NC}"

cd frontend
rm -rf node_modules package-lock.json dist

# Create production config with HTTPS
cat > .env.production << EOF
VITE_API_URL=https://$DOMAIN
VITE_AWS_REGION=$AWS_REGION
VITE_AWS_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
VITE_AWS_COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID
EOF

echo -e "${BLUE}Installing dependencies...${NC}"
npm install --silent --no-fund --no-audit

echo -e "${BLUE}Building frontend...${NC}"
VITE_API_URL=https://$DOMAIN npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Frontend build failed${NC}"
    exit 1
fi

# Copy frontend to nginx directory
mkdir -p /var/www/restaurant
cp -r dist/* /var/www/restaurant/
chown -R www-data:www-data /var/www/restaurant

echo -e "${GREEN}✅ Frontend built and deployed${NC}"

cd $PROJECT_DIR

# ==============================================================================
# PHASE 3: CONFIGURE NGINX
# ==============================================================================
echo -e "\n${YELLOW}🔧 PHASE 3: Configure Nginx${NC}"

# Create Nginx configuration
cat > /etc/nginx/sites-available/restaurant << 'EOF'
# Restaurant Web - Nginx Configuration
upstream django_backend {
    server localhost:8000;
    keepalive 32;
}

server {
    listen 80;
    server_name xn--elfogndedonsoto-zrb.com www.xn--elfogndedonsoto-zrb.com;

    # Frontend files
    root /var/www/restaurant;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://django_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Admin proxy
    location /admin/ {
        proxy_pass http://django_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files for Django admin
    location /static/ {
        alias /opt/restaurant-web/data/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Frontend routes (React)
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/restaurant /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx config
nginx -t

# ==============================================================================
# PHASE 4: START BACKEND
# ==============================================================================
echo -e "\n${YELLOW}🐳 PHASE 4: Start Backend${NC}"

# Start only backend container
docker-compose -f docker-compose.ec2.yml up -d web

echo -e "${YELLOW}⏳ Waiting for backend...${NC}"
sleep 15

# Verify backend is running
if ! docker-compose -f docker-compose.ec2.yml ps | grep web | grep -q Up; then
    echo -e "${RED}❌ Backend failed to start${NC}"
    docker-compose -f docker-compose.ec2.yml logs web
    exit 1
fi

# ==============================================================================
# PHASE 5: DATABASE SETUP
# ==============================================================================
echo -e "\n${YELLOW}💾 PHASE 5: Database Setup${NC}"

# Create migrations
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py makemigrations config
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py makemigrations inventory
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py makemigrations operation

# Apply migrations
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py migrate

# Collect static files
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py collectstatic --noinput

# Create initial data
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py shell << 'EOF'
from config.models import Unit, Zone, Table
from inventory.models import Group

# Units
if Unit.objects.count() == 0:
    Unit.objects.create(name="Kilogramo")
    Unit.objects.create(name="Litro")
    Unit.objects.create(name="Unidad")
    Unit.objects.create(name="Gramo")
    print("✅ Units created")

# Zone
if Zone.objects.count() == 0:
    Zone.objects.create(name="Salón Principal")
    print("✅ Zone created")

# Table
if Table.objects.count() == 0 and Zone.objects.exists():
    zone = Zone.objects.first()
    Table.objects.create(table_number="1", zone=zone)
    print("✅ Table created")

# Group
if Group.objects.count() == 0:
    Group.objects.create(name="General")
    print("✅ Group created")

print("✅ Initial data complete")
EOF

echo -e "${GREEN}✅ Database configured${NC}"

# ==============================================================================
# PHASE 6: START NGINX & GET SSL
# ==============================================================================
echo -e "\n${YELLOW}🔒 PHASE 6: Configure HTTPS${NC}"

# Start Nginx
systemctl start nginx
systemctl enable nginx

# Test HTTP
echo -e "${BLUE}Testing HTTP...${NC}"
if curl -f http://localhost/health &>/dev/null; then
    echo -e "${GREEN}✅ HTTP working${NC}"
else
    echo -e "${RED}❌ HTTP not working${NC}"
    systemctl status nginx
    exit 1
fi

# Get SSL certificate
echo -e "${YELLOW}🔐 Getting SSL certificate...${NC}"
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect

# Verify HTTPS
echo -e "${BLUE}Testing HTTPS...${NC}"
if curl -fk https://localhost/health &>/dev/null; then
    echo -e "${GREEN}✅ HTTPS working${NC}"
else
    echo -e "${RED}❌ HTTPS not working${NC}"
fi

# ==============================================================================
# PHASE 7: FINAL VERIFICATION
# ==============================================================================
echo -e "\n${YELLOW}🔍 PHASE 7: Final Verification${NC}"

# Test endpoints
echo -e "${BLUE}Testing endpoints...${NC}"
echo "  HTTP redirect: $(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN/)"
echo "  HTTPS health: $(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/health)"
echo "  API endpoint: $(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/api/v1/health/)"

# Show status
echo -e "${YELLOW}📊 Service status:${NC}"
systemctl status nginx --no-pager | head -n 5
docker-compose -f docker-compose.ec2.yml ps

# Configure auto-renewal
echo -e "${YELLOW}⚙️ Configuring auto-renewal...${NC}"
systemctl enable certbot.timer
systemctl start certbot.timer

echo -e "\n${GREEN}🎉 DEPLOYMENT COMPLETE!${NC}"
echo -e "${BLUE}═══════════════════════${NC}"
echo -e "${GREEN}✅ Application: https://$DOMAIN${NC}"
echo -e "${GREEN}✅ API: https://$DOMAIN/api/v1/${NC}"
echo -e "${GREEN}✅ SSL: Auto-renewing${NC}"
echo -e ""
echo -e "${BLUE}Services running:${NC}"
echo -e "  - Nginx: System service (port 80, 443)"
echo -e "  - Backend: Docker container (port 8000)"
echo -e "  - Database: SQLite in Docker volume"
echo -e ""
echo -e "${YELLOW}Useful commands:${NC}"
echo -e "  systemctl status nginx"
echo -e "  docker-compose -f docker-compose.ec2.yml logs -f web"
echo -e "  certbot certificates"
echo -e ""
echo -e "${GREEN}✨ Restaurant Web with HTTPS is ready!${NC}"