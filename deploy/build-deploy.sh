#!/bin/bash

# Restaurant Web - Unified Build & Deploy Script with HTTPS
# Build frontend, deploy containers with SSL, configure database, verify deployment
# This script replaces both build-deploy.sh and setup-ssl-production.sh

echo "🚀 Restaurant Web - Unified Build & Deploy with HTTPS"
echo "===================================================="

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

# Check if we're in the right directory
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Project directory not found: $PROJECT_DIR${NC}"
    exit 1
fi

cd $PROJECT_DIR

# Update code from git
echo -e "${YELLOW}📥 Actualizando código desde repositorio...${NC}"
git pull origin main

# Check if initial setup was run
if [ ! -f "$PROJECT_DIR/.env.ec2" ]; then
    echo -e "${RED}❌ Initial setup not found. Run setup-initial.sh first${NC}"
    exit 1
fi

# Function to show space
show_space() {
    local label="$1"
    local space=$(df / | tail -1 | awk '{print int($4/1024/1024)}')
    echo -e "${BLUE}💾 ${label}: ${space}GB${NC}"
}

show_space "Before build"

# ==============================================================================
# PHASE 5: BUILD AND DEPLOY
# ==============================================================================
echo -e "\n${YELLOW}🏗️ PHASE 5: Build and Deploy${NC}"

# Build frontend efficiently
cd "$FRONTEND_DIR"

# Always recreate .env.production with correct Cognito variables
echo -e "${YELLOW}Creating frontend .env.production with Cognito config...${NC}"
cat > .env.production << EOF
# Frontend Production Environment - Auto-generated
# Generated: $(date)

# API Configuration
VITE_API_URL=https://$DOMAIN

# AWS Cognito Configuration - MUST match backend
VITE_AWS_REGION=$AWS_REGION
VITE_AWS_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
VITE_AWS_COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID
EOF

# Also create .env.local for consistency
cp .env.production .env.local

echo -e "${BLUE}Frontend environment variables:${NC}"
echo -e "  VITE_API_URL=https://$DOMAIN"
echo -e "  VITE_AWS_REGION=$AWS_REGION"
echo -e "  VITE_AWS_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID"
echo -e "  VITE_AWS_COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID"
echo -e "${GREEN}✅ Files created: .env.production, .env.local${NC}"

# Clean install
rm -rf node_modules package-lock.json dist 2>/dev/null || true
npm install --silent --no-fund --no-audit

# Build frontend with explicit environment variables
echo -e "${BLUE}Building frontend with Cognito configuration...${NC}"
VITE_API_URL=https://$DOMAIN \
VITE_AWS_REGION=$AWS_REGION \
VITE_AWS_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID \
VITE_AWS_COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID \
NODE_ENV=production npm run build

# Clean dev dependencies after build
npm prune --production --silent

if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
    echo -e "${RED}❌ Frontend build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Frontend built ($(du -sh dist | cut -f1))${NC}"

# Stop existing containers and free ports
cd "$PROJECT_DIR"
echo -e "${YELLOW}🛑 Deteniendo servicios existentes...${NC}"
docker-compose -f docker-compose.ec2.yml down 2>/dev/null || true
docker-compose -f docker-compose.ssl.yml down 2>/dev/null || true

# Check and free ports 80 and 443
echo -e "${YELLOW}🔍 Verificando puertos 80 y 443...${NC}"
if lsof -i :80 | grep -q LISTEN; then
    echo -e "${YELLOW}⚠️ Puerto 80 en uso. Deteniendo procesos...${NC}"
    # Kill any process using port 80 (usually nginx or apache)
    fuser -k 80/tcp 2>/dev/null || true
    sleep 2
fi

if lsof -i :443 | grep -q LISTEN; then
    echo -e "${YELLOW}⚠️ Puerto 443 en uso. Deteniendo procesos...${NC}"
    # Kill any process using port 443
    fuser -k 443/tcp 2>/dev/null || true
    sleep 2
fi

# Stop system nginx if running
systemctl stop nginx 2>/dev/null || true
systemctl stop apache2 2>/dev/null || true

echo -e "${GREEN}✅ Puertos liberados${NC}"

# Create directories for SSL
echo -e "${YELLOW}📁 Creando estructura de directorios SSL...${NC}"
mkdir -p data/certbot/conf
mkdir -p data/certbot/www
mkdir -p data/nginx/logs
mkdir -p nginx/ssl-certs
chown -R 1000:1000 data/ 2>/dev/null || true

# Use temporary HTTP-only configuration first
echo -e "${YELLOW}📝 Configurando Nginx temporal (solo HTTP)...${NC}"
cp nginx/conf.d/restaurant-temp.conf nginx/conf.d/restaurant.conf

# Start Docker containers with temporary HTTP config
echo -e "${YELLOW}🐳 Iniciando contenedores (HTTP temporal)...${NC}"
docker-compose -f docker-compose.ssl.yml up -d --build

# Wait for containers
sleep 20

show_space "After build"

# ==============================================================================
# PHASE 6: CONFIGURE SSL CERTIFICATES
# ==============================================================================
echo -e "\n${YELLOW}🔐 PHASE 6: Configure SSL Certificates${NC}"

# Verify Nginx is responding on port 80
echo -e "${BLUE}Verificando que Nginx responde...${NC}"
for i in {1..6}; do
    if curl -f http://localhost/health &>/dev/null; then
        echo -e "${GREEN}✅ Nginx respondiendo correctamente${NC}"
        break
    else
        echo -e "${YELLOW}⏳ Esperando Nginx... (intento $i/6)${NC}"
        if [ $i -eq 6 ]; then
            echo -e "${RED}❌ Error: Nginx no responde${NC}"
            docker-compose -f docker-compose.ssl.yml logs nginx
            exit 1
        fi
        sleep 10
    fi
done

# Get SSL certificates
echo -e "${YELLOW}🔐 Obteniendo certificados SSL de Let's Encrypt...${NC}"
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
    echo -e "${RED}❌ Error obteniendo certificados SSL${NC}"
    echo -e "${YELLOW}Verifica:${NC}"
    echo -e "${YELLOW}1. DNS: $DOMAIN apunta a esta IP${NC}"
    echo -e "${YELLOW}2. Puertos 80 y 443 están abiertos${NC}"
    echo -e "${YELLOW}3. No hay otros servicios en estos puertos${NC}"
    exit 1
fi

# Copy certificates to Nginx location
echo -e "${YELLOW}📋 Copiando certificados SSL...${NC}"
cp data/certbot/conf/live/$DOMAIN/fullchain.pem nginx/ssl-certs/
cp data/certbot/conf/live/$DOMAIN/privkey.pem nginx/ssl-certs/
cp data/certbot/conf/live/$DOMAIN/chain.pem nginx/ssl-certs/

# Restore HTTPS configuration
echo -e "${YELLOW}🔄 Restaurando configuración HTTPS...${NC}"
cp nginx/conf.d/restaurant-temp.conf /tmp/restaurant-temp.conf
cat > nginx/conf.d/restaurant.conf << 'EOF'
# Upstream para el backend Django
upstream django_backend {
    server web:8000;
    keepalive 32;
}

# Configuración para el dominio (reemplazar con tu dominio real)
server {
    listen 80;
    server_name xn--elfogndedonsoto-zrb.com www.xn--elfogndedonsoto-zrb.com;
    
    # Redirección permanente a HTTPS
    return 301 https://$server_name$request_uri;
}

# Configuración HTTPS principal
server {
    listen 443 ssl http2;
    server_name xn--elfogndedonsoto-zrb.com www.xn--elfogndedonsoto-zrb.com;

    # Configuración SSL
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    
    # Configuraciones SSL optimizadas
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:DHE-RSA-AES128-SHA256:DHE-RSA-AES256-SHA256:DHE-RSA-AES128-SHA:DHE-RSA-AES256-SHA:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA;
    ssl_prefer_server_ciphers off;
    ssl_dhparam /etc/nginx/ssl/dhparam.pem;
    
    # SSL optimizations
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;
    
    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/nginx/ssl/chain.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logs específicos del dominio
    access_log /var/log/nginx/restaurant_access.log;
    error_log /var/log/nginx/restaurant_error.log;

    # Configuraciones del servidor
    client_max_body_size 100M;
    client_body_timeout 60s;
    client_header_timeout 60s;

    # Configuración de proxy para el backend Django
    location /api/ {
        # Rate limiting para API
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://django_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Configuración para admin de Django
    location /admin/ {
        # Rate limiting más estricto para admin
        limit_req zone=login burst=5 nodelay;
        
        proxy_pass http://django_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Servir archivos estáticos del frontend directamente desde Nginx
    location /assets/ {
        alias /var/www/html/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Vary Accept-Encoding;
        
        # Compresión para archivos estáticos
        gzip_static on;
    }

    # Favicon y robots.txt
    location = /favicon.ico {
        alias /var/www/html/favicon.ico;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location = /robots.txt {
        alias /var/www/html/robots.txt;
        expires 1d;
    }

    # Health check para el load balancer
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Configuración para Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Todas las demás rutas van al frontend (React Router)
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
        
        # Headers para el frontend
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # Configuración para WebSocket (si es necesario en el futuro)
    location /ws/ {
        proxy_pass http://django_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Restart Nginx with real certificates
echo -e "${YELLOW}🔄 Reiniciando Nginx con certificados de producción...${NC}"
docker-compose -f docker-compose.ssl.yml restart nginx

sleep 10

# Verify HTTPS
echo -e "${YELLOW}🔍 Verificando configuración HTTPS...${NC}"
if curl -f https://localhost/health &>/dev/null; then
    echo -e "${GREEN}✅ HTTPS configurado correctamente!${NC}"
else
    echo -e "${RED}❌ Error: HTTPS no está funcionando${NC}"
    docker-compose -f docker-compose.ssl.yml logs nginx
    exit 1
fi

# Configure automatic renewal
echo -e "${YELLOW}⚙️ Configurando renovación automática de certificados...${NC}"
cat > /usr/local/bin/ssl-renewal.sh << EOF
#!/bin/bash
cd $PROJECT_DIR
docker-compose -f docker-compose.ssl.yml run --rm certbot renew --quiet
if [ \$? -eq 0 ]; then
    # Copy updated certificates
    cp data/certbot/conf/live/$DOMAIN/fullchain.pem nginx/ssl-certs/
    cp data/certbot/conf/live/$DOMAIN/privkey.pem nginx/ssl-certs/
    cp data/certbot/conf/live/$DOMAIN/chain.pem nginx/ssl-certs/
    # Restart Nginx
    docker-compose -f docker-compose.ssl.yml restart nginx
    echo "\$(date): Certificados SSL renovados exitosamente" >> /var/log/ssl-renewal.log
else
    echo "\$(date): Error renovando certificados SSL" >> /var/log/ssl-renewal.log
fi
EOF

chmod +x /usr/local/bin/ssl-renewal.sh

# Configure cron job for renewal (daily at 3:00 AM)
(crontab -l 2>/dev/null; echo "0 3 * * * /usr/local/bin/ssl-renewal.sh") | crontab -

echo -e "${GREEN}✅ SSL configurado y renovación automática habilitada${NC}"

# ==============================================================================
# PHASE 7: CONFIGURE DATABASE
# ==============================================================================
echo -e "\n${YELLOW}💾 PHASE 7: Configure Database${NC}"

# Verify backend configuration with detailed logging
echo -e "${BLUE}Verifying backend Cognito configuration...${NC}"
CONFIG_CHECK=$(docker-compose -f docker-compose.ssl.yml exec -T web python -c "
import os
from pathlib import Path

print('=== Environment Variables in Container ===')
print('COGNITO_USER_POOL_ID:', os.getenv('COGNITO_USER_POOL_ID', 'NOT_SET'))
print('COGNITO_APP_CLIENT_ID:', os.getenv('COGNITO_APP_CLIENT_ID', 'NOT_SET'))
print('USE_COGNITO_AUTH:', os.getenv('USE_COGNITO_AUTH', 'NOT_SET'))
print('AWS_REGION:', os.getenv('AWS_REGION', 'NOT_SET'))

print('\\n=== Files Check ===')
print('.env.ec2 exists:', Path('/app/.env.ec2').exists())
print('backend/.env exists:', Path('/app/.env').exists())

# Show contents of env files
if Path('/app/.env.ec2').exists():
    print('\\n=== .env.ec2 Contents ===')
    with open('/app/.env.ec2', 'r') as f:
        for line in f:
            if 'COGNITO' in line or 'AWS_REGION' in line or 'USE_COGNITO' in line:
                print('  ', line.strip())

# Try to load settings
try:
    import django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_ec2')
    django.setup()
    from django.conf import settings
    print('\\n=== Django Settings ===')
    print('COGNITO_ENABLED:', getattr(settings, 'COGNITO_ENABLED', 'NOT_SET'))
    print('USE_COGNITO_AUTH:', getattr(settings, 'USE_COGNITO_AUTH', 'NOT_SET'))
    print('COGNITO_USER_POOL_ID:', getattr(settings, 'COGNITO_USER_POOL_ID', 'NOT_SET'))
    print('COGNITO_APP_CLIENT_ID:', getattr(settings, 'COGNITO_APP_CLIENT_ID', 'NOT_SET'))
    print('AWS_REGION:', getattr(settings, 'AWS_REGION', 'NOT_SET'))
except Exception as e:
    print('Could not load Django settings:', str(e))
" 2>/dev/null || echo "Could not verify backend config")
echo "$CONFIG_CHECK"

# Create and apply migrations
docker-compose -f docker-compose.ssl.yml exec -T web python manage.py makemigrations
docker-compose -f docker-compose.ssl.yml exec -T web python manage.py migrate

# Collect static files
docker-compose -f docker-compose.ssl.yml exec -T web python manage.py collectstatic --noinput --clear

# Note: No superuser or test data creation - using AWS Cognito authentication

echo -e "${GREEN}✅ Database configured${NC}"

# ==============================================================================
# PHASE 8: FINAL VERIFICATION
# ==============================================================================
echo -e "\n${YELLOW}🔍 PHASE 8: Final Verification${NC}"

# Wait for services to be ready
sleep 10

# Test API (expect 401 with Cognito enabled, no auth header)
echo -e "${BLUE}Testing API without authentication...${NC}"
for i in {1..3}; do
    API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/zones/ 2>/dev/null || echo "000")
    if [ "$API_STATUS" = "200" ] || [ "$API_STATUS" = "401" ] || [ "$API_STATUS" = "403" ]; then
        if [ "$API_STATUS" = "401" ]; then
            echo -e "${GREEN}✅ API working with Cognito auth - requires authentication (Status: $API_STATUS)${NC}"
        elif [ "$API_STATUS" = "403" ]; then
            echo -e "${GREEN}✅ API working with Cognito auth - forbidden (Status: $API_STATUS)${NC}"
        else
            echo -e "${GREEN}✅ API working without auth (Status: $API_STATUS)${NC}"
        fi
        break
    else
        echo -e "${YELLOW}⚠️ API Status: $API_STATUS (attempt $i/3)${NC}"
        if [ $i -lt 3 ]; then
            sleep 5
        fi
    fi
done

# Show recent backend logs for debugging
echo -e "${BLUE}Recent backend logs (last 20 lines):${NC}"
docker-compose -f docker-compose.ssl.yml logs --tail=20 web || echo "Could not fetch logs"

# Test HTTPS domain
echo -e "${BLUE}Testing HTTPS domain...${NC}"
HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/ 2>/dev/null || echo "000")
if [ "$HTTPS_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ HTTPS Domain working (Status: $HTTPS_STATUS)${NC}"
else
    echo -e "${YELLOW}⚠️ HTTPS Domain Status: $HTTPS_STATUS${NC}"
fi

# Test HTTP redirect
echo -e "${BLUE}Testing HTTP to HTTPS redirect...${NC}"
HTTP_REDIRECT=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN/ 2>/dev/null || echo "000")
if [ "$HTTP_REDIRECT" = "301" ] || [ "$HTTP_REDIRECT" = "302" ]; then
    echo -e "${GREEN}✅ HTTP redirect working (Status: $HTTP_REDIRECT)${NC}"
else
    echo -e "${YELLOW}⚠️ HTTP redirect Status: $HTTP_REDIRECT${NC}"
fi

# Clean up final
apt clean >/dev/null 2>&1

show_space "Final space"

# ==============================================================================
# DEPLOYMENT COMPLETE
# ==============================================================================
echo -e "\n${GREEN}🎉 BUILD & DEPLOYMENT WITH HTTPS COMPLETED!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}🌐 Application URLs (HTTPS):${NC}"
echo -e "   Frontend: ${GREEN}https://$DOMAIN${NC}"
echo -e "   API: ${GREEN}https://$DOMAIN/api/v1/${NC}"
echo -e "   Admin: ${GREEN}https://$DOMAIN/api/v1/admin/${NC}"
echo -e ""
echo -e "${BLUE}🔐 Login Access:${NC}"
echo -e "   Use AWS Cognito credentials${NC}"
echo -e ""
echo -e "${BLUE}🔐 Authentication:${NC}"
echo -e "   AWS Cognito: ${GREEN}ENABLED${NC}"
echo -e "   User Pool: ${COGNITO_USER_POOL_ID}"
echo -e "   Region: ${AWS_REGION}"
echo -e ""
echo -e "${YELLOW}✅ Ready to use:${NC}"
echo -e "1. Access application at: ${GREEN}https://$DOMAIN${NC}"
echo -e "2. Login with your existing Cognito credentials"
echo -e "3. Users and groups already configured in AWS"
echo -e "4. SSL certificates auto-renew daily at 3:00 AM"
echo -e ""
echo -e "${GREEN}✨ Restaurant Web Application with HTTPS is READY!${NC}"
echo -e ""
echo -e "${YELLOW}🔍 Troubleshooting:${NC}"
echo -e "1. Check backend logs: docker-compose -f docker-compose.ssl.yml logs web"
echo -e "2. Check nginx logs: docker-compose -f docker-compose.ssl.yml logs nginx"
echo -e "3. Test API manually: curl -v https://$DOMAIN/api/v1/zones/"
echo -e "4. Check container environment: docker-compose -f docker-compose.ssl.yml exec web env | grep COGNITO"
echo -e "5. Verify user groups in AWS Cognito console"
echo -e "6. Check SSL certificates: openssl x509 -in nginx/ssl-certs/fullchain.pem -text -noout"
echo -e ""
echo -e "${BLUE}🔍 User Permission Debug:${NC}"
echo -e "If you get 'No tienes permiso' errors:"
echo -e "1. Verify your user is in the correct Cognito group (administradores/meseros/cocineros)"
echo -e "2. Check JWT token contains 'cognito:groups' claim"
echo -e "3. Verify user pool configuration in AWS console"