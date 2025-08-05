#!/bin/bash

# Simple deployment script - back to working HTTP first
set -e

echo "🚀 Simple Restaurant Web Deployment"
echo "=================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DOMAIN="xn--elfogndedonsoto-zrb.com"
PROJECT_DIR="/opt/restaurant-web"

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

# Stop all services
echo -e "${YELLOW}🛑 Stopping services...${NC}"
docker-compose -f docker-compose.ec2.yml down 2>/dev/null || true
docker-compose -f docker-compose.ssl.yml down 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true
fuser -k 80/tcp 2>/dev/null || true
fuser -k 443/tcp 2>/dev/null || true

# Clean up
docker system prune -f

# Build frontend for HTTP first (we'll change to HTTPS later)
echo -e "${YELLOW}🔨 Building frontend...${NC}"
cd frontend
rm -rf node_modules package-lock.json dist 2>/dev/null || true

# Create production environment file with HTTP for now
cat > .env.production << EOF
VITE_API_URL=http://$DOMAIN
VITE_AWS_REGION=$AWS_REGION
VITE_AWS_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
VITE_AWS_COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID
EOF

npm install --silent --no-fund --no-audit
npm run build

if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
    echo -e "${RED}❌ Frontend build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Frontend built${NC}"

cd $PROJECT_DIR

# Use original working docker-compose with HTTP
echo -e "${YELLOW}🐳 Starting with original HTTP configuration...${NC}"
docker-compose -f docker-compose.ec2.yml up -d --build

sleep 15

# Wait for services
echo -e "${YELLOW}⏳ Waiting for services...${NC}"
for i in {1..10}; do
    if curl -f http://localhost:8000/api/v1/health/ &>/dev/null; then
        echo -e "${GREEN}✅ Backend ready${NC}"
        break
    else
        echo -e "${YELLOW}Waiting for backend... (attempt $i/10)${NC}"
        if [ $i -eq 10 ]; then
            echo -e "${RED}❌ Backend not responding${NC}"
            docker-compose -f docker-compose.ec2.yml logs web
            exit 1
        fi
        sleep 5
    fi
done

# Configure database
echo -e "${YELLOW}💾 Configuring database...${NC}"
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py makemigrations
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py migrate
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py collectstatic --noinput --clear

# Test domain
echo -e "${YELLOW}🔍 Testing domain...${NC}"
DOMAIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN/ 2>/dev/null || echo "000")
if [ "$DOMAIN_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Domain working (Status: $DOMAIN_STATUS)${NC}"
else
    echo -e "${YELLOW}⚠️ Domain Status: $DOMAIN_STATUS${NC}"
fi

# Show container status
echo -e "${YELLOW}📊 Container status:${NC}"
docker-compose -f docker-compose.ec2.yml ps

echo -e "\n${GREEN}🎉 BASIC DEPLOYMENT COMPLETED!${NC}"
echo -e "${BLUE}════════════════════════════════${NC}"
echo -e "${GREEN}✅ Application: http://$DOMAIN${NC}"
echo -e "${GREEN}✅ API: http://$DOMAIN/api/v1/${NC}"
echo -e "${GREEN}✅ Dashboard: http://$DOMAIN${NC}"
echo -e ""
echo -e "${BLUE}📋 Working endpoints:${NC}"
echo -e "  Frontend: http://$DOMAIN"
echo -e "  API Health: http://$DOMAIN/api/v1/health/"
echo -e "  Dashboard: http://$DOMAIN (after login)"
echo -e ""
echo -e "${YELLOW}🔐 Login with AWS Cognito credentials${NC}"
echo -e ""
echo -e "${GREEN}✨ Restaurant Web is READY!${NC}"
echo -e ""
echo -e "${BLUE}Next steps for HTTPS:${NC}"
echo -e "1. Verify application works completely on HTTP"
echo -e "2. Test all features: login, dashboard, orders"
echo -e "3. Only then proceed with SSL configuration"