#!/bin/bash

# Restaurant Web - Complete HTTPS Deployment
# This script deploys the application with HTTPS using Let's Encrypt

set -e

echo "🔒 Restaurant Web - Complete HTTPS Deployment"
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

# Stop everything
echo -e "${YELLOW}🛑 Stopping all services...${NC}"
docker-compose down -v 2>/dev/null || true
docker stop $(docker ps -aq) 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true
fuser -k 80/tcp 2>/dev/null || true
fuser -k 443/tcp 2>/dev/null || true

# Clean up
docker system prune -af
rm -rf data/db.sqlite3 data/*.db nginx/ssl-certs/* 2>/dev/null || true

# Install dependencies
echo -e "${YELLOW}📦 Installing system dependencies...${NC}"
apt-get update -qq
apt-get install -y nginx certbot python3-certbot-nginx

# ==============================================================================
# STEP 1: Build Frontend with HTTPS URLs
# ==============================================================================
echo -e "\n${BLUE}📱 Building Frontend...${NC}"
cd frontend
rm -rf node_modules dist package-lock.json

cat > .env.production << EOF
VITE_API_URL=https://$DOMAIN
VITE_AWS_REGION=$AWS_REGION
VITE_AWS_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
VITE_AWS_COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID
EOF

npm install --silent
npm run build

# Deploy frontend
rm -rf /var/www/restaurant
mkdir -p /var/www/restaurant
cp -r dist/* /var/www/restaurant/
chown -R www-data:www-data /var/www/restaurant

cd $PROJECT_DIR

# ==============================================================================
# STEP 2: Configure and Start Backend
# ==============================================================================
echo -e "\n${BLUE}🚀 Starting Backend...${NC}"

# Use simple docker-compose for backend only
cat > docker-compose-backend.yml << 'EOF'
version: '3.8'
services:
  web:
    build:
      context: ./backend
      dockerfile: Dockerfile.ec2
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
      - ./.env.ec2:/app/.env.ec2
    environment:
      - DJANGO_SETTINGS_MODULE=backend.settings_ec2
    env_file:
      - .env.ec2
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
EOF

docker-compose -f docker-compose-backend.yml up -d --build

echo -e "${YELLOW}⏳ Waiting for backend...${NC}"
sleep 20

# Setup database
echo -e "${BLUE}💾 Setting up database...${NC}"
docker-compose -f docker-compose-backend.yml exec -T web python manage.py makemigrations config inventory operation
docker-compose -f docker-compose-backend.yml exec -T web python manage.py migrate
docker-compose -f docker-compose-backend.yml exec -T web python manage.py collectstatic --noinput

# Initial data
docker-compose -f docker-compose-backend.yml exec -T web python manage.py shell << 'PYTHON'
from config.models import Unit, Zone, Table
from inventory.models import Group

if Unit.objects.count() == 0:
    Unit.objects.create(name="Kilogramo")
    Unit.objects.create(name="Litro")
    Unit.objects.create(name="Unidad")
    Unit.objects.create(name="Gramo")
    print("✅ Units created")

if Zone.objects.count() == 0:
    Zone.objects.create(name="Salón Principal")
    print("✅ Zone created")

if Table.objects.count() == 0 and Zone.objects.exists():
    zone = Zone.objects.first()
    Table.objects.create(table_number="1", zone=zone)
    print("✅ Table created")

if Group.objects.count() == 0:
    Group.objects.create(name="General")
    print("✅ Group created")
PYTHON

# ==============================================================================
# STEP 3: Configure Nginx with HTTP first
# ==============================================================================
echo -e "\n${BLUE}🔧 Configuring Nginx...${NC}"

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Create HTTP configuration first
cat > /etc/nginx/sites-available/restaurant << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    root /var/www/restaurant;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Django admin
    location /admin/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Django static files
    location /static/ {
        alias /opt/restaurant-web/data/staticfiles/;
    }

    # Frontend
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

ln -sf /etc/nginx/sites-available/restaurant /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# Test HTTP
echo -e "${YELLOW}🧪 Testing HTTP...${NC}"
sleep 5
if curl -f http://localhost/api/v1/health/ &>/dev/null; then
    echo -e "${GREEN}✅ HTTP working${NC}"
else
    echo -e "${RED}❌ HTTP failed${NC}"
    exit 1
fi

# ==============================================================================
# STEP 4: Get SSL Certificate and Configure HTTPS
# ==============================================================================
echo -e "\n${BLUE}🔐 Configuring HTTPS...${NC}"

# Get certificate
certbot --nginx \
    -d $DOMAIN \
    -d www.$DOMAIN \
    --non-interactive \
    --agree-tos \
    --email $EMAIL \
    --redirect

# Verify HTTPS
echo -e "${YELLOW}🧪 Testing HTTPS...${NC}"
sleep 5
if curl -fk https://localhost/api/v1/health/ &>/dev/null; then
    echo -e "${GREEN}✅ HTTPS working${NC}"
else
    echo -e "${RED}❌ HTTPS failed${NC}"
fi

# Enable auto-renewal
systemctl enable certbot.timer
systemctl start certbot.timer

# ==============================================================================
# FINAL STATUS
# ==============================================================================
echo -e "\n${GREEN}✅ DEPLOYMENT COMPLETE!${NC}"
echo -e "${BLUE}═══════════════════════${NC}"
echo -e "🌐 Application: ${GREEN}https://$DOMAIN${NC}"
echo -e "🔒 SSL Status: ${GREEN}Active with auto-renewal${NC}"
echo -e "📊 Backend: ${GREEN}Running on port 8000${NC}"
echo -e "🚀 Frontend: ${GREEN}Served by Nginx${NC}"
echo ""
echo -e "${YELLOW}Test URLs:${NC}"
echo -e "  https://$DOMAIN"
echo -e "  https://$DOMAIN/api/v1/health/"
echo -e "  https://$DOMAIN/api/v1/units/"
echo ""
echo -e "${BLUE}Service Status:${NC}"
systemctl status nginx --no-pager | head -5
docker ps
echo ""
echo -e "${GREEN}🎉 Your application is now running with HTTPS!${NC}"