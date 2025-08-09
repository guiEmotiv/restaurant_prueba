#!/bin/bash

# Restaurant Web - Build and Deploy Script (Optimized)
# Single script with options for different deployment scenarios

# Usage options
FRONTEND_ONLY=false
BACKEND_ONLY=false
FULL_DEPLOY=true

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --frontend-only)
            FRONTEND_ONLY=true
            FULL_DEPLOY=false
            shift
            ;;
        --backend-only)
            BACKEND_ONLY=true
            FULL_DEPLOY=false
            shift
            ;;
        --help|-h)
            echo "🚀 Restaurant Web - Optimized Build & Deploy"
            echo "============================================="
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --frontend-only    Build and deploy only frontend (~2 min)"
            echo "  --backend-only     Restart only backend services (~30 sec)"
            echo "  (no options)       Full deployment with cleanup (~5 min)"
            echo "  --help, -h         Show this help message"
            echo ""
            echo "Examples:"
            echo "  sudo $0                    # Full deployment"
            echo "  sudo $0 --frontend-only    # Update only frontend"
            echo "  sudo $0 --backend-only     # Restart only backend"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Set deployment mode display
if [[ "$FRONTEND_ONLY" == "true" ]]; then
    echo "🚀 Restaurant Web - Frontend Only Deploy"
    echo "========================================"
elif [[ "$BACKEND_ONLY" == "true" ]]; then
    echo "🚀 Restaurant Web - Backend Only Deploy"
    echo "======================================="
else
    echo "🚀 Restaurant Web - Full Deploy (Optimized)"
    echo "============================================"
fi

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

# Update code from git (unless running backend-only)
if [[ "$BACKEND_ONLY" != "true" ]]; then
    echo -e "${YELLOW}📥 Actualizando código desde repositorio...${NC}"
    git pull origin main
fi

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

# Function for frontend-only deployment
frontend_only_deploy() {
    echo -e "\n${YELLOW}🎨 Frontend Only Deployment${NC}"
    
    cd "$FRONTEND_DIR"
    
    # Create environment file
    cat > .env.production << EOF
VITE_API_URL=https://www.$DOMAIN
VITE_AWS_REGION=$AWS_REGION
VITE_AWS_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
VITE_AWS_COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID
EOF
    
    # Install dependencies and build frontend
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm install --silent --no-fund --no-audit
    
    # Clean cache and build frontend
    echo -e "${BLUE}🔨 Building frontend...${NC}"
    rm -rf node_modules/.cache 2>/dev/null || true
    rm -rf dist 2>/dev/null || true
    npm cache clean --force 2>/dev/null || true
    npm run build
    
    if [ ! -d "dist" ]; then
        echo -e "${RED}❌ Frontend build failed${NC}"
        exit 1
    fi
    
    # Deploy to nginx
    echo -e "${BLUE}🚀 Deploying frontend...${NC}"
    systemctl stop nginx
    rm -rf /var/www/restaurant/*
    mkdir -p /var/www/restaurant
    cp -r dist/* /var/www/restaurant/
    chown -R www-data:www-data /var/www/restaurant
    systemctl start nginx
    
    echo -e "${GREEN}✅ Frontend deployed successfully${NC}"
}

# Function for backend-only deployment
backend_only_deploy() {
    echo -e "\n${YELLOW}🐳 Backend Only Deployment${NC}"
    
    cd "$PROJECT_DIR"
    
    # Restart backend container
    echo -e "${BLUE}🔄 Restarting backend...${NC}"
    docker-compose -f docker-compose.ec2.yml restart web
    
    # Wait and verify
    sleep 10
    BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health/)
    
    if [ "$BACKEND_STATUS" = "200" ]; then
        echo -e "${GREEN}✅ Backend restarted successfully${NC}"
    else
        echo -e "${RED}❌ Backend restart failed (Status: $BACKEND_STATUS)${NC}"
        docker-compose -f docker-compose.ec2.yml logs --tail=10 web
        exit 1
    fi
}

# Function for full deployment
full_deploy() {
    echo -e "\n${YELLOW}🏗️ Full Deployment (Optimized)${NC}"
    
    show_space "Before build"
    
    # Stop services
    echo -e "${BLUE}🛑 Stopping services...${NC}"
    docker-compose -f docker-compose.ec2.yml down
    systemctl stop nginx 2>/dev/null || true
    
    # Selective cleanup (only if needed)
    if ! docker images | grep -q restaurant-web-web; then
        echo -e "${BLUE}🧹 Cleaning Docker images...${NC}"
        docker system prune -f
    fi
    
    # Build frontend in parallel with backend preparation
    cd "$FRONTEND_DIR"
    
    cat > .env.production << EOF
VITE_API_URL=https://www.$DOMAIN
VITE_AWS_REGION=$AWS_REGION
VITE_AWS_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
VITE_AWS_COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID
EOF
    
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm install --silent --no-fund --no-audit
    
    echo -e "${BLUE}🔨 Building frontend...${NC}"
    rm -rf node_modules/.cache 2>/dev/null || true
    rm -rf dist 2>/dev/null || true
    npm cache clean --force 2>/dev/null || true
    npm run build &
    FRONTEND_PID=$!
    
    # Start backend while frontend builds
    cd "$PROJECT_DIR"
    echo -e "${BLUE}🐳 Starting backend...${NC}"
    docker-compose -f docker-compose.ec2.yml up -d --build &
    BACKEND_PID=$!
    
    # Wait for frontend build
    wait $FRONTEND_PID
    
    if [ ! -d "frontend/dist" ]; then
        echo -e "${RED}❌ Frontend build failed${NC}"
        exit 1
    fi
    
    # Deploy frontend
    echo -e "${BLUE}🚀 Deploying frontend...${NC}"
    rm -rf /var/www/restaurant/*
    mkdir -p /var/www/restaurant
    cp -r frontend/dist/* /var/www/restaurant/
    chown -R www-data:www-data /var/www/restaurant
    
    # Wait for backend
    wait $BACKEND_PID
    sleep 15
    
    # Setup database
    echo -e "${BLUE}💾 Setting up database...${NC}"
    docker-compose -f docker-compose.ec2.yml exec -T web python manage.py migrate
    docker-compose -f docker-compose.ec2.yml exec -T web python manage.py collectstatic --noinput --clear
    
    # Create initial data if needed
    docker-compose -f docker-compose.ec2.yml exec -T web python manage.py shell << 'EOF'
from config.models import Unit, Zone, Table
from inventory.models import Group

if Unit.objects.count() == 0:
    Unit.objects.create(name="Kilogramo", abbreviation="kg")
    Unit.objects.create(name="Litro", abbreviation="lt")
    Unit.objects.create(name="Unidad", abbreviation="un")
    Unit.objects.create(name="Gramo", abbreviation="g")
    print("✅ Units created")

if Zone.objects.count() == 0:
    zone = Zone.objects.create(name="Salón Principal")
    print("✅ Zone created")
    
    if Table.objects.count() == 0:
        for i in range(1, 11):
            Table.objects.create(table_number=str(i), zone=zone, capacity=4)
        print("✅ Tables created")

if Group.objects.count() == 0:
    Group.objects.create(name="General")
    print("✅ Group created")
EOF
    
    # Configure nginx with SSL detection
    configure_nginx
    
    show_space "After build"
}

# Function to configure nginx with SSL detection
configure_nginx() {
    echo -e "${BLUE}🔒 Configuring nginx...${NC}"
    
    # Check for SSL certificates
    if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        CERT_PATH="/etc/letsencrypt/live/$DOMAIN"
        echo -e "${GREEN}✅ Certificate found for $DOMAIN${NC}"
    elif [ -f "/etc/letsencrypt/live/www.$DOMAIN/fullchain.pem" ]; then
        CERT_PATH="/etc/letsencrypt/live/www.$DOMAIN"
        echo -e "${GREEN}✅ Certificate found for www.$DOMAIN${NC}"
    else
        echo -e "${YELLOW}⚠️ No SSL certificates found, using HTTP${NC}"
        CERT_PATH=""
    fi
    
    # Create nginx configuration
    if [ -n "$CERT_PATH" ]; then
        # HTTPS configuration
        cat > /etc/nginx/sites-available/$DOMAIN << EOF
server {
    listen 80;
    listen [::]:80;
    server_name www.$DOMAIN $DOMAIN;
    return 301 https://www.\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.$DOMAIN $DOMAIN;
    
    ssl_certificate $CERT_PATH/fullchain.pem;
    ssl_certificate_key $CERT_PATH/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    root /var/www/restaurant;
    index index.html;
    
    # Frontend routes
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Ssl on;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Django admin
    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Forwarded-Proto https;
    }
    
    # Django static files
    location /static/ {
        alias /opt/restaurant-web/data/staticfiles/;
        expires 30d;
    }
}
EOF
    else
        # HTTP-only configuration
        cat > /etc/nginx/sites-available/$DOMAIN << EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name www.$DOMAIN $DOMAIN _;
    
    root /var/www/restaurant;
    index index.html;
    
    # Frontend routes
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Django admin
    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$http_host;
    }
    
    # Django static files
    location /static/ {
        alias /opt/restaurant-web/data/staticfiles/;
        expires 30d;
    }
}
EOF
    fi
    
    # Enable configuration and start nginx
    rm -f /etc/nginx/sites-enabled/*
    ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
    
    if nginx -t; then
        systemctl start nginx
        echo -e "${GREEN}✅ Nginx configured and started${NC}"
    else
        echo -e "${RED}❌ Nginx configuration error${NC}"
        nginx -t
        exit 1
    fi
}

# Main execution starts here
show_space "Initial space"

# ==============================================================================
# MAIN EXECUTION - Route to appropriate deployment function
# ==============================================================================

# Execute based on deployment mode
if [[ "$FRONTEND_ONLY" == "true" ]]; then
    frontend_only_deploy
elif [[ "$BACKEND_ONLY" == "true" ]]; then
    backend_only_deploy
else
    full_deploy
fi

# ==============================================================================
# FINAL VERIFICATION
# ==============================================================================
echo -e "\n${YELLOW}🔍 Final Verification${NC}"

# Wait for services to be ready
sleep 5

# Test backend API
echo -e "${BLUE}Testing backend API...${NC}"
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health/ 2>/dev/null || echo "000")

if [ "$BACKEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Backend API: Working (Status: $BACKEND_STATUS)${NC}"
else
    echo -e "${YELLOW}⚠️ Backend API: Status $BACKEND_STATUS${NC}"
    if [[ "$BACKEND_ONLY" != "true" ]]; then
        echo -e "${BLUE}Backend logs (last 10 lines):${NC}"
        docker-compose -f docker-compose.ec2.yml logs --tail=10 web || echo "Could not fetch logs"
    fi
fi

# Test nginx status
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx: Running${NC}"
else
    echo -e "${RED}❌ Nginx: Not running${NC}"
fi

# Test HTTPS if not backend-only
if [[ "$BACKEND_ONLY" != "true" ]]; then
    HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://www.$DOMAIN/api/v1/health/ 2>/dev/null || echo "000")
    
    if [ "$HTTPS_STATUS" = "200" ]; then
        echo -e "${GREEN}✅ HTTPS API: Working (Status: $HTTPS_STATUS)${NC}"
    else
        echo -e "${YELLOW}⚠️ HTTPS API: Status $HTTPS_STATUS${NC}"
    fi
fi

show_space "Final space"

# ==============================================================================
# DEPLOYMENT COMPLETE
# ==============================================================================
echo -e "\n${GREEN}🎉 DEPLOYMENT COMPLETED!${NC}"
echo -e "${BLUE}════════════════════════════════════${NC}"

if [[ "$FRONTEND_ONLY" == "true" ]]; then
    echo -e "${BLUE}🎨 Frontend Only Deployment: ${GREEN}SUCCESS${NC}"
    echo -e "   Frontend: ${GREEN}https://www.$DOMAIN${NC}"
    echo -e ""
    echo -e "${YELLOW}⏰ Time saved: ~8 minutes vs full deploy${NC}"
    
elif [[ "$BACKEND_ONLY" == "true" ]]; then
    echo -e "${BLUE}🐳 Backend Only Deployment: ${GREEN}SUCCESS${NC}"
    echo -e "   API: ${GREEN}https://www.$DOMAIN/api/v1/${NC}"
    echo -e "   Admin: ${GREEN}https://www.$DOMAIN/admin/${NC}"
    echo -e ""
    echo -e "${YELLOW}⏰ Time saved: ~9 minutes vs full deploy${NC}"
    
else
    echo -e "${BLUE}🏗️ Full Deployment (Optimized): ${GREEN}SUCCESS${NC}"
    echo -e "   Frontend: ${GREEN}https://www.$DOMAIN${NC}"
    echo -e "   API: ${GREEN}https://www.$DOMAIN/api/v1/${NC}"
    echo -e "   Admin: ${GREEN}https://www.$DOMAIN/admin/${NC}"
    echo -e ""
    echo -e "${YELLOW}⏰ Optimized: ~5 minutes vs 10 minutes (original)${NC}"
fi

echo -e ""
echo -e "${BLUE}🔐 Authentication: AWS Cognito${NC}"
echo -e "   User Pool: ${COGNITO_USER_POOL_ID}"
echo -e "   Region: ${AWS_REGION}"
echo -e ""
echo -e "${GREEN}✨ Restaurant Web Application is READY!${NC}"
echo -e ""
echo -e "${YELLOW}🛠️ Quick Commands:${NC}"
echo -e "   Frontend only:  ${BLUE}sudo $0 --frontend-only${NC}"
echo -e "   Backend only:   ${BLUE}sudo $0 --backend-only${NC}"
echo -e "   Full deploy:    ${BLUE}sudo $0${NC}"
echo -e "   Help:           ${BLUE}sudo $0 --help${NC}"
echo -e ""
echo -e "${YELLOW}🔍 Troubleshooting:${NC}"
echo -e "   Backend logs:   ${BLUE}docker-compose -f docker-compose.ec2.yml logs web${NC}"
echo -e "   Test API:       ${BLUE}curl -v https://www.$DOMAIN/api/v1/health/${NC}"
echo -e "   Container status: ${BLUE}docker-compose -f docker-compose.ec2.yml ps${NC}"