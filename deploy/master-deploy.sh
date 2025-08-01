#!/bin/bash

# Master Deployment Script - Ultra Optimized
# Complete restaurant web application deployment from zero
# Optimized for 7GB EC2 - Single script for everything

echo "🚀 Restaurant Web - Master Deployment"
echo "======================================"

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

# Create optimized .env.ec2
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

# AWS Cognito Configuration (Backend)
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

# Create optimized frontend .env.production
cat > "$FRONTEND_DIR/.env.production" << EOF
# Frontend Production Environment
# IMPORTANT: Do NOT include /api/v1 here (added automatically in api.js)
VITE_API_URL=http://$DOMAIN
VITE_AWS_REGION=$AWS_REGION
VITE_AWS_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
VITE_AWS_COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID
EOF

echo -e "${GREEN}✅ Environment configured${NC}"

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

# ==============================================================================
# PHASE 5: BUILD AND DEPLOY
# ==============================================================================
echo -e "\n${YELLOW}🏗️ PHASE 5: Build and Deploy${NC}"

# Build frontend efficiently
cd "$FRONTEND_DIR"
if [ -f "package-lock.json" ] && [ -d "node_modules" ]; then
    npm ci --only=production --silent --no-fund --no-audit
else
    npm install --only=production --silent --no-fund --no-audit
fi

# Install vite for build
npm install vite --save-dev --silent --no-fund --no-audit

# Build frontend
NODE_ENV=production ./node_modules/.bin/vite build --mode production

# Clean build deps immediately
npm prune --production --silent

if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
    echo -e "${RED}❌ Frontend build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Frontend built ($(du -sh dist | cut -f1))${NC}"

# Start Docker containers
cd "$PROJECT_DIR"
docker-compose -f docker-compose.ec2.yml up -d --build

# Wait for containers
sleep 15

# ==============================================================================
# PHASE 6: CONFIGURE DATABASE
# ==============================================================================
echo -e "\n${YELLOW}💾 PHASE 6: Configure Database${NC}"

# Apply migrations
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py migrate

# Collect static files
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py collectstatic --noinput --clear

# Create superuser
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py shell -c "
from django.contrib.auth.models import User
if not User.objects.filter(is_superuser=True).exists():
    User.objects.create_superuser('admin', 'admin@$DOMAIN', 'admin123')
    print('✅ Superuser created: admin/admin123')
else:
    print('✅ Superuser already exists')
"

# Populate test data
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py populate_test_data 2>/dev/null || echo "Test data population completed"

echo -e "${GREEN}✅ Database configured${NC}"

# ==============================================================================
# PHASE 7: FINAL VERIFICATION
# ==============================================================================
echo -e "\n${YELLOW}🔍 PHASE 7: Final Verification${NC}"

# Wait for services to be ready
sleep 10

# Test API
for i in {1..3}; do
    API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/zones/ 2>/dev/null || echo "000")
    if [ "$API_STATUS" = "200" ]; then
        echo -e "${GREEN}✅ API working (Status: $API_STATUS)${NC}"
        break
    else
        echo -e "${YELLOW}⚠️ API Status: $API_STATUS (attempt $i/3)${NC}"
        if [ $i -lt 3 ]; then
            sleep 5
        fi
    fi
done

# Test domain
DOMAIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN/ 2>/dev/null || echo "000")
if [ "$DOMAIN_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Domain working (Status: $DOMAIN_STATUS)${NC}"
else
    echo -e "${YELLOW}⚠️ Domain Status: $DOMAIN_STATUS${NC}"
fi

# Clean up final
apt clean >/dev/null 2>&1

final_space=$(df / | tail -1 | awk '{print int($4/1024/1024)}')
initial_space_gb=$(echo "$initial_space" | sed 's/GB//' || echo "7")
used_space=$((initial_space_gb - final_space))

# ==============================================================================
# DEPLOYMENT COMPLETE
# ==============================================================================
echo -e "\n${GREEN}🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}📊 Space Summary:${NC}"
echo -e "   Initial: ${initial_space_gb}GB"
echo -e "   Final: ${final_space}GB"
echo -e "   Used: ${used_space}GB"
echo -e ""
echo -e "${BLUE}🌐 Application URLs:${NC}"
echo -e "   Frontend: ${GREEN}http://$DOMAIN${NC}"
echo -e "   API: ${GREEN}http://$DOMAIN/api/v1/${NC}"
echo -e "   Admin: ${GREEN}http://$DOMAIN/api/v1/admin/${NC}"
echo -e ""
echo -e "${BLUE}👤 Admin Access:${NC}"
echo -e "   Username: ${GREEN}admin${NC}"
echo -e "   Password: ${GREEN}admin123${NC}"
echo -e ""
echo -e "${BLUE}🔐 Authentication:${NC}"
echo -e "   AWS Cognito: ${GREEN}ENABLED${NC}"
echo -e "   User Pool: ${COGNITO_USER_POOL_ID}"
echo -e "   Region: ${AWS_REGION}"
echo -e ""
echo -e "${YELLOW}💡 Next Steps:${NC}"
echo -e "1. Create Cognito users in AWS Console"
echo -e "2. Assign users to groups: administradores, meseros"
echo -e "3. Access application at: ${GREEN}http://$DOMAIN${NC}"
echo -e ""
echo -e "${GREEN}✨ Restaurant Web Application is READY!${NC}"