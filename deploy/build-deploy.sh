#!/bin/bash

# Restaurant Web - Build and Deploy Script
# Simple HTTP deployment that works

echo "🚀 Restaurant Web - Build & Deploy"
echo "=================================="

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

# Stop all services and clean up
echo -e "${YELLOW}🛑 Stopping all services...${NC}"
docker-compose -f docker-compose.ec2.yml down -v
systemctl stop nginx 2>/dev/null || true
systemctl stop apache2 2>/dev/null || true
fuser -k 80/tcp 2>/dev/null || true

# Clean up old database files
echo -e "${YELLOW}🧹 Cleaning up old data...${NC}"
rm -rf data/db.sqlite3 2>/dev/null || true
rm -rf data/*.db 2>/dev/null || true
docker system prune -f

# Build frontend
cd "$FRONTEND_DIR"

# Always recreate .env.production with correct Cognito variables
echo -e "${YELLOW}Creating frontend .env.production with Cognito config...${NC}"
cat > .env.production << EOF
# Frontend Production Environment - Auto-generated
# Generated: $(date)

# API Configuration
VITE_API_URL=http://$DOMAIN

# AWS Cognito Configuration - MUST match backend
VITE_AWS_REGION=$AWS_REGION
VITE_AWS_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
VITE_AWS_COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID
EOF

# Also create .env.local for consistency
cp .env.production .env.local

echo -e "${BLUE}Frontend environment variables:${NC}"
echo -e "  VITE_API_URL=http://$DOMAIN"
echo -e "  VITE_AWS_REGION=$AWS_REGION"
echo -e "  VITE_AWS_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID"
echo -e "  VITE_AWS_COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID"
echo -e "${GREEN}✅ Files created: .env.production, .env.local${NC}"

# Clean install
rm -rf node_modules package-lock.json dist 2>/dev/null || true
npm install --silent --no-fund --no-audit

# Build frontend with explicit environment variables
echo -e "${BLUE}Building frontend with Cognito configuration...${NC}"
VITE_API_URL=http://$DOMAIN \
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

cd "$PROJECT_DIR"

# Start Docker containers
echo -e "${YELLOW}🐳 Starting services with HTTP...${NC}"
docker-compose -f docker-compose.ec2.yml up -d --build

# Wait for containers
echo -e "${YELLOW}⏳ Waiting for services...${NC}"
sleep 20

show_space "After build"

# ==============================================================================
# PHASE 6: CONFIGURE DATABASE
# ==============================================================================
echo -e "\n${YELLOW}💾 PHASE 6: Configure Database${NC}"

# Verify backend is running
if ! docker-compose -f docker-compose.ec2.yml ps | grep web | grep -q Up; then
    echo -e "${RED}❌ Backend container failed to start${NC}"
    docker-compose -f docker-compose.ec2.yml logs web
    exit 1
fi

# Create migrations for all apps
echo -e "${BLUE}Creating migrations...${NC}"
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py makemigrations config
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py makemigrations inventory
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py makemigrations operation

# Apply migrations
echo -e "${BLUE}Applying migrations...${NC}"
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py migrate

# Collect static files
echo -e "${BLUE}Collecting static files...${NC}"
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py collectstatic --noinput --clear

# Create initial data
echo -e "${YELLOW}📊 Creating initial data...${NC}"
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py shell << 'EOF'
from config.models import Unit, Zone, Table
from inventory.models import Group

# Create default units
if Unit.objects.count() == 0:
    print("Creating default units...")
    Unit.objects.create(name="Kilogramo")
    Unit.objects.create(name="Litro")
    Unit.objects.create(name="Unidad")
    Unit.objects.create(name="Gramo")
    print("✅ Units created")

# Create default zone
if Zone.objects.count() == 0:
    print("Creating default zone...")
    Zone.objects.create(name="Salón Principal")
    print("✅ Zone created")

# Create default table
if Table.objects.count() == 0 and Zone.objects.exists():
    print("Creating default table...")
    zone = Zone.objects.first()
    Table.objects.create(table_number="1", zone=zone)
    print("✅ Table created")

# Create default group
if Group.objects.count() == 0:
    print("Creating default group...")
    Group.objects.create(name="General")
    print("✅ Group created")

print("✅ Initial data setup complete")
EOF

echo -e "${GREEN}✅ Database configured${NC}"

# ==============================================================================
# PHASE 7: FINAL VERIFICATION
# ==============================================================================
echo -e "\n${YELLOW}🔍 PHASE 7: Final Verification${NC}"

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

# Test specific endpoints
echo -e "${BLUE}Testing specific endpoints...${NC}"
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health/ 2>/dev/null || echo "000")
echo -e "  Health endpoint: ${HEALTH_STATUS}"

UNITS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/units/ 2>/dev/null || echo "000")
echo -e "  Units endpoint: ${UNITS_STATUS}"

# Show recent backend logs for debugging
echo -e "${BLUE}Recent backend logs (last 20 lines):${NC}"
docker-compose -f docker-compose.ec2.yml logs --tail=20 web || echo "Could not fetch logs"

# Test domain
DOMAIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN/ 2>/dev/null || echo "000")
if [ "$DOMAIN_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Domain working (Status: $DOMAIN_STATUS)${NC}"
else
    echo -e "${YELLOW}⚠️ Domain Status: $DOMAIN_STATUS${NC}"
fi

# Show container status
echo -e "${YELLOW}📊 Container status:${NC}"
docker-compose -f docker-compose.ec2.yml ps

# Clean up final
apt clean >/dev/null 2>&1

show_space "Final space"

# ==============================================================================
# DEPLOYMENT COMPLETE
# ==============================================================================
echo -e "\n${GREEN}🎉 BUILD & DEPLOYMENT COMPLETED!${NC}"
echo -e "${BLUE}════════════════════════════════════${NC}"
echo -e "${BLUE}🌐 Application URLs:${NC}"
echo -e "   Frontend: ${GREEN}http://$DOMAIN${NC}"
echo -e "   API: ${GREEN}http://$DOMAIN/api/v1/${NC}"
echo -e "   Admin: ${GREEN}http://$DOMAIN/api/v1/admin/${NC}"
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
echo -e "1. Access application at: ${GREEN}http://$DOMAIN${NC}"
echo -e "2. Login with your existing Cognito credentials"
echo -e "3. Users and groups already configured in AWS"
echo -e ""
echo -e "${GREEN}✨ Restaurant Web Application is READY!${NC}"
echo -e ""
echo -e "${YELLOW}🔍 Troubleshooting:${NC}"
echo -e "1. Check backend logs: docker-compose -f docker-compose.ec2.yml logs web"
echo -e "2. Test API manually: curl -v http://$DOMAIN/api/v1/zones/"
echo -e "3. Check container environment: docker-compose -f docker-compose.ec2.yml exec web env | grep COGNITO"
echo -e "4. Verify user groups in AWS Cognito console"
echo -e ""
echo -e "${BLUE}🔍 User Permission Debug:${NC}"
echo -e "If you get 'No tienes permiso' errors:"
echo -e "1. Verify your user is in the correct Cognito group (administradores/meseros/cocineros)"
echo -e "2. Check JWT token contains 'cognito:groups' claim"
echo -e "3. Verify user pool configuration in AWS console"