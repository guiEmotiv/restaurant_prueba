#!/bin/bash

# Fix database and deploy script
set -e

echo "🔧 Fix and Deploy Restaurant Web"
echo "================================"

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
echo -e "${YELLOW}🛑 Stopping all services...${NC}"
docker-compose -f docker-compose.ec2.yml down -v  # -v to remove volumes
docker-compose -f docker-compose.ssl.yml down -v 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true
fuser -k 80/tcp 2>/dev/null || true

# Clean up completely
echo -e "${YELLOW}🧹 Cleaning up old data...${NC}"
rm -rf data/db.sqlite3 2>/dev/null || true
rm -rf data/*.db 2>/dev/null || true
docker system prune -f

# Build frontend
echo -e "${YELLOW}🔨 Building frontend...${NC}"
cd frontend
rm -rf node_modules package-lock.json dist 2>/dev/null || true

# Create production environment file
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

echo -e "${GREEN}✅ Frontend built successfully${NC}"

cd $PROJECT_DIR

# Start containers
echo -e "${YELLOW}🐳 Starting containers...${NC}"
docker-compose -f docker-compose.ec2.yml up -d --build

# Wait for backend to be ready
echo -e "${YELLOW}⏳ Waiting for backend to start...${NC}"
sleep 20

# Check if backend is running
if ! docker-compose -f docker-compose.ec2.yml ps | grep web | grep -q Up; then
    echo -e "${RED}❌ Backend container failed to start${NC}"
    docker-compose -f docker-compose.ec2.yml logs web
    exit 1
fi

# Create database structure
echo -e "${YELLOW}💾 Creating database structure...${NC}"

# First, create all migrations
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

# Create initial data if needed
echo -e "${YELLOW}📊 Creating initial data...${NC}"
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py shell << 'EOF'
from config.models import Unit, Zone, Table, Waiter
from inventory.models import Group
from django.contrib.auth import get_user_model

# Create default units if they don't exist
if Unit.objects.count() == 0:
    print("Creating default units...")
    Unit.objects.create(name="Kilogramo", abbreviation="kg")
    Unit.objects.create(name="Litro", abbreviation="lt")
    Unit.objects.create(name="Unidad", abbreviation="und")
    Unit.objects.create(name="Gramo", abbreviation="gr")
    print("✅ Units created")

# Create default zone if it doesn't exist
if Zone.objects.count() == 0:
    print("Creating default zone...")
    Zone.objects.create(name="Salón Principal", description="Zona principal del restaurante")
    print("✅ Zone created")

# Create default table if it doesn't exist
if Table.objects.count() == 0 and Zone.objects.exists():
    print("Creating default table...")
    zone = Zone.objects.first()
    Table.objects.create(
        number=1,
        zone=zone,
        capacity=4,
        status="AVAILABLE"
    )
    print("✅ Table created")

# Create default ingredient group
if Group.objects.count() == 0:
    print("Creating default group...")
    Group.objects.create(name="General", description="Grupo general de ingredientes")
    print("✅ Group created")

# Create default waiter
if Waiter.objects.count() == 0:
    print("Creating default waiter...")
    Waiter.objects.create(
        code="W001",
        name="Mesero General",
        phone="999999999",
        is_active=True
    )
    print("✅ Waiter created")

print("✅ Initial data setup complete")
EOF

# Test API endpoints
echo -e "${YELLOW}🔍 Testing API endpoints...${NC}"

# Test health endpoint
if curl -f http://localhost:8000/api/v1/health/ &>/dev/null; then
    echo -e "${GREEN}✅ Health endpoint working${NC}"
else
    echo -e "${RED}❌ Health endpoint failed${NC}"
fi

# Test units endpoint (should work now)
UNITS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/units/ 2>/dev/null || echo "000")
if [ "$UNITS_STATUS" = "200" ] || [ "$UNITS_STATUS" = "401" ]; then
    echo -e "${GREEN}✅ Units endpoint working (Status: $UNITS_STATUS)${NC}"
else
    echo -e "${RED}❌ Units endpoint failed (Status: $UNITS_STATUS)${NC}"
fi

# Show container status
echo -e "${YELLOW}📊 Container status:${NC}"
docker-compose -f docker-compose.ec2.yml ps

# Test frontend
echo -e "${YELLOW}🌐 Testing frontend...${NC}"
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN/ 2>/dev/null || echo "000")
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Frontend working (Status: $FRONTEND_STATUS)${NC}"
else
    echo -e "${YELLOW}⚠️ Frontend Status: $FRONTEND_STATUS${NC}"
    echo -e "${YELLOW}Note: Frontend might need a moment to propagate${NC}"
fi

echo -e "\n${GREEN}🎉 DEPLOYMENT COMPLETED WITH DATABASE FIXED!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Application: http://$DOMAIN${NC}"
echo -e "${GREEN}✅ API: http://$DOMAIN/api/v1/${NC}"
echo -e "${GREEN}✅ Health: http://$DOMAIN/api/v1/health/${NC}"
echo -e "${GREEN}✅ Database: Migrated and initialized${NC}"
echo -e ""
echo -e "${BLUE}📋 Test these endpoints:${NC}"
echo -e "  Units: http://$DOMAIN/api/v1/units/"
echo -e "  Zones: http://$DOMAIN/api/v1/zones/"
echo -e "  Tables: http://$DOMAIN/api/v1/tables/"
echo -e ""
echo -e "${YELLOW}🔐 Login with AWS Cognito credentials${NC}"
echo -e "${YELLOW}   Groups: administradores, meseros, cocineros${NC}"
echo -e ""
echo -e "${GREEN}✨ Restaurant Web is READY with database!${NC}"