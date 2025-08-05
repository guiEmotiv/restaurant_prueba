#!/bin/bash

# Restaurant Web - HTTPS Deployment (Fixed Version)
# Solves certbot issues and uses a cleaner approach

set -e

echo "🔒 Restaurant Web - HTTPS Deployment (Fixed)"
echo "=========================================="

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
# STEP 1: Clean Everything
# ==============================================================================
echo -e "\n${YELLOW}🧹 Cleaning up...${NC}"

# Stop all services
docker-compose down -v 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true
apt-get remove -y certbot python3-certbot-nginx 2>/dev/null || true
apt-get autoremove -y

# Kill processes using ports
fuser -k 80/tcp 2>/dev/null || true
fuser -k 443/tcp 2>/dev/null || true

# Clean up
rm -rf /etc/nginx/sites-enabled/*
rm -rf /etc/nginx/sites-available/restaurant*
rm -rf /etc/letsencrypt/live/$DOMAIN*
rm -rf data/db.sqlite3 data/*.db

# ==============================================================================
# STEP 2: Install Fresh Dependencies
# ==============================================================================
echo -e "\n${YELLOW}📦 Installing dependencies...${NC}"
apt-get update
apt-get install -y nginx snapd

# Install certbot via snap (more reliable)
snap install core
snap refresh core
snap install --classic certbot
ln -sf /snap/bin/certbot /usr/bin/certbot

# ==============================================================================
# STEP 3: Build Frontend
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

npm install
npm run build

# Deploy frontend
rm -rf /var/www/restaurant
mkdir -p /var/www/restaurant
cp -r dist/* /var/www/restaurant/
chown -R www-data:www-data /var/www/restaurant

cd $PROJECT_DIR

# ==============================================================================
# STEP 4: Start Backend Only
# ==============================================================================
echo -e "\n${BLUE}🚀 Starting Backend...${NC}"

# Create minimal docker-compose
cat > docker-compose-backend.yml << 'EOF'
version: '3.8'
services:
  web:
    build:
      context: ./backend
      dockerfile: Dockerfile.ec2
    ports:
      - "127.0.0.1:8000:8000"
    volumes:
      - ./data:/app/data
      - ./.env.ec2:/app/.env.ec2
    environment:
      - DJANGO_SETTINGS_MODULE=backend.settings_ec2
    env_file:
      - .env.ec2
    restart: unless-stopped
EOF

docker-compose -f docker-compose-backend.yml up -d --build

echo -e "${YELLOW}⏳ Waiting for backend...${NC}"
for i in {1..30}; do
    if curl -f http://localhost:8000/api/v1/health/ &>/dev/null; then
        echo -e "${GREEN}✅ Backend ready${NC}"
        break
    fi
    echo -n "."
    sleep 2
done

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
# STEP 5: Configure Nginx (HTTP only first)
# ==============================================================================
echo -e "\n${BLUE}🔧 Configuring Nginx...${NC}"

# Create clean Nginx config
cat > /etc/nginx/sites-available/restaurant << 'EOF'
server {
    listen 80;
    server_name xn--elfogndedonsoto-zrb.com www.xn--elfogndedonsoto-zrb.com;

    root /var/www/restaurant;
    index index.html;

    # API proxy
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

    # Django static
    location /static/ {
        alias /opt/restaurant-web/data/staticfiles/;
        expires 30d;
    }

    # Frontend
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/restaurant /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload
nginx -t
systemctl restart nginx
systemctl enable nginx

# Test HTTP
echo -e "${YELLOW}🧪 Testing HTTP...${NC}"
sleep 3
if curl -f http://$DOMAIN/api/v1/health/ &>/dev/null; then
    echo -e "${GREEN}✅ HTTP working${NC}"
else
    echo -e "${YELLOW}⚠️  HTTP test failed, but continuing...${NC}"
fi

# ==============================================================================
# STEP 6: Get SSL Certificate
# ==============================================================================
echo -e "\n${BLUE}🔐 Getting SSL Certificate...${NC}"

# Stop nginx temporarily for certbot standalone
systemctl stop nginx

# Get certificate using standalone mode
certbot certonly \
    --standalone \
    -d $DOMAIN \
    -d www.$DOMAIN \
    --non-interactive \
    --agree-tos \
    --email $EMAIL

# Update Nginx config with SSL
cat > /etc/nginx/sites-available/restaurant << 'EOF'
server {
    listen 80;
    server_name xn--elfogndedonsoto-zrb.com www.xn--elfogndedonsoto-zrb.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name xn--elfogndedonsoto-zrb.com www.xn--elfogndedonsoto-zrb.com;

    ssl_certificate /etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    root /var/www/restaurant;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Ssl on;
    }

    # Django admin
    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Ssl on;
    }

    # Django static
    location /static/ {
        alias /opt/restaurant-web/data/staticfiles/;
        expires 30d;
    }

    # Frontend
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }
}
EOF

# Start nginx with SSL
systemctl start nginx

# Setup auto-renewal
echo "0 0,12 * * * root certbot renew --quiet --post-hook 'systemctl reload nginx'" > /etc/cron.d/certbot-renew

# ==============================================================================
# FINAL VERIFICATION
# ==============================================================================
echo -e "\n${YELLOW}🧪 Final Testing...${NC}"
sleep 3

# Test HTTPS
if curl -fk https://$DOMAIN/api/v1/health/ &>/dev/null; then
    echo -e "${GREEN}✅ HTTPS API working${NC}"
else
    echo -e "${RED}❌ HTTPS API failed${NC}"
fi

if curl -fk https://$DOMAIN/ &>/dev/null; then
    echo -e "${GREEN}✅ HTTPS Frontend working${NC}"
else
    echo -e "${RED}❌ HTTPS Frontend failed${NC}"
fi

# Show status
echo -e "\n${GREEN}✅ DEPLOYMENT COMPLETE!${NC}"
echo -e "${BLUE}════════════════════════${NC}"
echo -e "🌐 Application: ${GREEN}https://$DOMAIN${NC}"
echo -e "🔒 SSL: ${GREEN}Let's Encrypt (auto-renewing)${NC}"
echo -e ""
echo -e "${YELLOW}Services:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
systemctl status nginx --no-pager | head -n 5
echo ""
echo -e "${GREEN}🎉 Your application is running with HTTPS!${NC}"
echo -e ""
echo -e "${YELLOW}If you have any issues, check:${NC}"
echo -e "  - Nginx logs: journalctl -u nginx -f"
echo -e "  - Backend logs: docker-compose -f docker-compose-backend.yml logs -f"
echo -e "  - SSL cert: certbot certificates"