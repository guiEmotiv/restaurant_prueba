#!/bin/bash

# Restaurant Web - Build and Deploy Script with HTTPS
# Complete deployment with SSL using system nginx

echo "🚀 Restaurant Web - Build & Deploy with HTTPS"
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

# Check if we're in the right directory
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Project directory not found: $PROJECT_DIR${NC}"
    exit 1
fi

cd $PROJECT_DIR

# Update code from git
echo -e "${BLUE}📥 Updating code...${NC}"
git pull origin main

# Check if initial setup was run - exit gracefully if not
if [ ! -f "$PROJECT_DIR/.env.ec2" ]; then
    echo -e "${RED}❌ Run setup-initial.sh first${NC}"
    exit 1
fi

# Stop services and clean minimal
echo -e "${BLUE}🛑 Stopping services...${NC}"
docker-compose -f docker-compose.ec2.yml down -v
systemctl stop nginx
docker system prune -f

# Build frontend
cd "$FRONTEND_DIR"

# Create frontend environment
cat > .env.production << EOF
VITE_API_URL=https://$DOMAIN
VITE_AWS_REGION=$AWS_REGION
VITE_AWS_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
VITE_AWS_COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID
EOF
cp .env.production .env.local

# Build frontend
echo -e "${BLUE}🏗️ Building frontend...${NC}"
rm -rf node_modules dist
npm install --silent
NODE_ENV=production npm run build

[ ! -d "dist" ] && { echo -e "${RED}❌ Build failed${NC}"; exit 1; }
echo -e "${GREEN}✅ Frontend built${NC}"

cd "$PROJECT_DIR"

# Start containers
echo -e "${BLUE}🐳 Starting services...${NC}"
docker-compose -f docker-compose.ec2.yml up -d --build
sleep 15

# Configure database
echo -e "${BLUE}💾 Setting up database...${NC}"
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py migrate
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py collectstatic --noinput

# Create minimal initial data only if empty
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py shell << 'EOF'
from config.models import Unit, Zone, Table
from inventory.models import Group
if not Unit.objects.exists():
    Unit.objects.bulk_create([Unit(name=n) for n in ["kg", "litros", "unidades"]])
if not Zone.objects.exists():
    zone = Zone.objects.create(name="Principal")
    Table.objects.create(table_number="1", zone=zone)
if not Group.objects.exists():
    Group.objects.create(name="General")
EOF

# Deploy frontend and configure HTTPS
echo -e "${BLUE}🔒 Configuring HTTPS...${NC}"
systemctl stop nginx
rm -rf /var/www/restaurant
mkdir -p /var/www/restaurant
cp -r frontend/dist/* /var/www/restaurant/
chown -R www-data:www-data /var/www/restaurant

# Create nginx configuration (HTTP first)
echo -e "${BLUE}Creating nginx configuration...${NC}"
cat > /etc/nginx/sites-available/restaurant << 'EOF'
server {
    listen 80;
    server_name xn--elfogndedonsoto-zrb.com www.xn--elfogndedonsoto-zrb.com;

    root /var/www/restaurant;
    index index.html;

    # API proxy to Docker backend
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

    # Django static files
    location /static/ {
        alias /opt/restaurant-web/data/staticfiles/;
        expires 30d;
    }

    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
EOF

# Enable site and remove default
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/restaurant /etc/nginx/sites-enabled/

# Test nginx config
nginx -t

# Start nginx
systemctl start nginx
systemctl enable nginx

# Test HTTP first
echo -e "${BLUE}Testing HTTP...${NC}"
sleep 3
if curl -f http://localhost/api/v1/health/ &>/dev/null; then
    echo -e "${GREEN}✅ HTTP working${NC}"
else
    echo -e "${YELLOW}⚠️ HTTP test inconclusive, continuing...${NC}"
fi

# Install and configure certbot
apt-get remove -y certbot python3-certbot-nginx 2>/dev/null || true
python3 -m pip install --root-user-action=ignore certbot
CERTBOT_PATH=$(which certbot || find /usr/local/bin /root/.local/bin /home/ubuntu/.local/bin -name "certbot" 2>/dev/null | head -1)

if [ -z "$CERTBOT_PATH" ]; then
    echo -e "${YELLOW}⚠️ SSL setup failed, continuing HTTP${NC}"
    systemctl start nginx
    echo -e "${GREEN}✅ Application running: http://$DOMAIN${NC}"
    exit 0
fi

# Get SSL certificate
$CERTBOT_PATH certonly --standalone -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email elfogondedonsoto@gmail.com

# Check SSL certificate
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    systemctl start nginx
    echo -e "${YELLOW}⚠️ SSL failed, running HTTP: http://$DOMAIN${NC}"
    exit 0
fi

# Update nginx config with HTTPS
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

    # API proxy to Docker backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Ssl on;
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
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Ssl on;
    }

    # Django static files
    location /static/ {
        alias /opt/restaurant-web/data/staticfiles/;
        expires 30d;
    }

    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
EOF

# Start nginx with HTTPS and configure renewal
systemctl start nginx
echo "0 0,12 * * * root $CERTBOT_PATH renew --quiet --post-hook 'systemctl reload nginx'" > /etc/cron.d/certbot-renew

# Quick verification
sleep 5
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health/ || echo "000")
[ "$API_STATUS" = "200" ] && echo -e "${GREEN}✅ API ready${NC}" || echo -e "${YELLOW}⚠️ API: $API_STATUS${NC}"

echo -e "\n${GREEN}🎉 DEPLOYMENT COMPLETED!${NC}"
echo -e "${GREEN}✅ Application: https://$DOMAIN${NC}"
echo -e "${GREEN}✅ API: https://$DOMAIN/api/v1/${NC}"
echo -e "${BLUE}🔐 AWS Cognito enabled${NC}"