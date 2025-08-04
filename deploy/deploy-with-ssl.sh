#!/bin/bash

# Restaurant Web - Standard SSL Deployment
# Uses industry standard approach with Let's Encrypt

set -e

echo "🚀 Restaurant Web - Standard SSL Deployment"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DOMAIN="xn--elfogndedonsoto-zrb.com"
PROJECT_DIR="/opt/restaurant-web"
EMAIL="elfogondedonsoto@gmail.com"

# AWS Cognito Configuration
AWS_REGION="us-west-2"
COGNITO_USER_POOL_ID="us-west-2_bdCwF60ZI"
COGNITO_APP_CLIENT_ID="4i9hrd7srgbqbtun09p43ncfn0"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

cd $PROJECT_DIR

# Update code
echo -e "${YELLOW}📥 Updating code...${NC}"
git pull origin main

# Stop all services and free ports
echo -e "${YELLOW}🛑 Stopping all services...${NC}"
docker-compose -f docker-compose.ec2.yml down 2>/dev/null || true
docker-compose -f docker-compose.ssl.yml down 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true
systemctl stop apache2 2>/dev/null || true
fuser -k 80/tcp 2>/dev/null || true
fuser -k 443/tcp 2>/dev/null || true

# Clean up old containers
docker system prune -f

# Build frontend
echo -e "${YELLOW}🔨 Building frontend...${NC}"
cd frontend
rm -rf node_modules package-lock.json dist 2>/dev/null || true

# Create production environment file
cat > .env.production << EOF
VITE_API_URL=https://$DOMAIN
VITE_AWS_REGION=$AWS_REGION
VITE_AWS_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
VITE_AWS_COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID
EOF

npm install --silent --no-fund --no-audit
VITE_API_URL=https://$DOMAIN npm run build

if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
    echo -e "${RED}❌ Frontend build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Frontend built successfully${NC}"

cd $PROJECT_DIR

# Create directories
echo -e "${YELLOW}📁 Creating directories...${NC}"
mkdir -p data/certbot/conf
mkdir -p data/certbot/www
mkdir -p data/nginx/logs
mkdir -p nginx/ssl-certs

# Start with basic HTTP configuration
echo -e "${YELLOW}🐳 Starting services (HTTP only)...${NC}"
docker-compose -f docker-compose.ssl.yml up -d --build

sleep 15

# Check if nginx is running
if ! docker-compose -f docker-compose.ssl.yml ps | grep nginx | grep -q Up; then
    echo -e "${RED}❌ Nginx container failed to start${NC}"
    docker-compose -f docker-compose.ssl.yml logs nginx
    exit 1
fi

# Test health endpoint
echo -e "${YELLOW}🔍 Testing health endpoint...${NC}"
for i in {1..10}; do
    if curl -f http://localhost/health &>/dev/null; then
        echo -e "${GREEN}✅ HTTP health check passed${NC}"
        break
    else
        echo -e "${YELLOW}⏳ Waiting for HTTP... (attempt $i/10)${NC}"
        if [ $i -eq 10 ]; then
            echo -e "${RED}❌ HTTP health check failed${NC}"
            docker-compose -f docker-compose.ssl.yml logs nginx
            exit 1
        fi
        sleep 5
    fi
done

# Get SSL certificates with staging first (test)
echo -e "${YELLOW}🔐 Getting SSL certificates (staging test)...${NC}"
docker-compose -f docker-compose.ssl.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --staging \
    -d $DOMAIN \
    -d www.$DOMAIN

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to get staging certificates${NC}"
    echo -e "${YELLOW}Check:${NC}"
    echo -e "${YELLOW}1. DNS: $DOMAIN points to this IP${NC}"
    echo -e "${YELLOW}2. Ports 80 and 443 are open${NC}"
    echo -e "${YELLOW}3. Domain is accessible from internet${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Staging certificates obtained${NC}"

# Get production certificates
echo -e "${YELLOW}🔐 Getting production SSL certificates...${NC}"
docker-compose -f docker-compose.ssl.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d $DOMAIN \
    -d www.$DOMAIN

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to get production certificates${NC}"
    exit 1
fi

# Copy certificates
echo -e "${YELLOW}📋 Copying SSL certificates...${NC}"
cp data/certbot/conf/live/$DOMAIN/fullchain.pem nginx/ssl-certs/
cp data/certbot/conf/live/$DOMAIN/privkey.pem nginx/ssl-certs/
cp data/certbot/conf/live/$DOMAIN/chain.pem nginx/ssl-certs/

# Create HTTPS configuration
echo -e "${YELLOW}🔄 Creating HTTPS configuration...${NC}"
cat > nginx/conf.d/default.conf << 'EOF'
upstream django_backend {
    server web:8000;
    keepalive 32;
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name xn--elfogndedonsoto-zrb.com www.xn--elfogndedonsoto-zrb.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name xn--elfogndedonsoto-zrb.com www.xn--elfogndedonsoto-zrb.com;

    # SSL certificates
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    
    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_dhparam /etc/nginx/ssl/dhparam.pem;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # API proxy
    location /api/ {
        proxy_pass http://django_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static files
    location /assets/ {
        alias /var/www/html/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Frontend
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
EOF

# Restart nginx with HTTPS config
echo -e "${YELLOW}🔄 Restarting with HTTPS configuration...${NC}"
docker-compose -f docker-compose.ssl.yml restart nginx

sleep 10

# Verify HTTPS
echo -e "${YELLOW}🔍 Verifying HTTPS...${NC}"
if curl -f -k https://localhost/health &>/dev/null; then
    echo -e "${GREEN}✅ HTTPS working!${NC}"
else
    echo -e "${RED}❌ HTTPS verification failed${NC}"
    docker-compose -f docker-compose.ssl.yml logs nginx
    exit 1
fi

# Configure database
echo -e "${YELLOW}💾 Configuring database...${NC}"
docker-compose -f docker-compose.ssl.yml exec -T web python manage.py makemigrations
docker-compose -f docker-compose.ssl.yml exec -T web python manage.py migrate
docker-compose -f docker-compose.ssl.yml exec -T web python manage.py collectstatic --noinput --clear

# Setup auto-renewal
echo -e "${YELLOW}⚙️ Setting up auto-renewal...${NC}"
cat > /usr/local/bin/ssl-renewal.sh << EOF
#!/bin/bash
cd $PROJECT_DIR
docker-compose -f docker-compose.ssl.yml run --rm certbot renew --quiet
if [ \$? -eq 0 ]; then
    cp data/certbot/conf/live/$DOMAIN/fullchain.pem nginx/ssl-certs/
    cp data/certbot/conf/live/$DOMAIN/privkey.pem nginx/ssl-certs/
    cp data/certbot/conf/live/$DOMAIN/chain.pem nginx/ssl-certs/
    docker-compose -f docker-compose.ssl.yml restart nginx
    echo "\$(date): SSL certificates renewed" >> /var/log/ssl-renewal.log
fi
EOF

chmod +x /usr/local/bin/ssl-renewal.sh
(crontab -l 2>/dev/null; echo "0 3 * * * /usr/local/bin/ssl-renewal.sh") | crontab -

# Final verification
echo -e "${YELLOW}🔍 Final verification...${NC}"
HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/health 2>/dev/null || echo "000")
HTTP_REDIRECT=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN/ 2>/dev/null || echo "000")

if [ "$HTTPS_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ HTTPS working (Status: $HTTPS_STATUS)${NC}"
else
    echo -e "${YELLOW}⚠️ HTTPS Status: $HTTPS_STATUS${NC}"
fi

if [ "$HTTP_REDIRECT" = "301" ]; then
    echo -e "${GREEN}✅ HTTP redirect working (Status: $HTTP_REDIRECT)${NC}"
else
    echo -e "${YELLOW}⚠️ HTTP redirect Status: $HTTP_REDIRECT${NC}"
fi

echo -e "\n${GREEN}🎉 DEPLOYMENT COMPLETED!${NC}"
echo -e "${BLUE}═══════════════════════${NC}"
echo -e "${GREEN}✅ Application: https://$DOMAIN${NC}"
echo -e "${GREEN}✅ API: https://$DOMAIN/api/v1/${NC}"
echo -e "${GREEN}✅ SSL certificates installed and auto-renewing${NC}"
echo -e ""
echo -e "${YELLOW}📋 Useful commands:${NC}"
echo -e "  docker-compose -f docker-compose.ssl.yml logs nginx"
echo -e "  docker-compose -f docker-compose.ssl.yml ps"
echo -e "  openssl x509 -in nginx/ssl-certs/fullchain.pem -text -noout"
echo -e ""
echo -e "${GREEN}🚀 Restaurant Web with HTTPS is ready!${NC}"