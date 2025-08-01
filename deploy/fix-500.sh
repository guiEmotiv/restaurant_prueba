#!/bin/bash

# Fix 500 Error Script
# Applies common fixes for Django 500 errors

echo "🔧 Fixing 500 Internal Server Error"
echo "==================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="/opt/restaurant-web"

echo -e "${BLUE}🎯 Applying common fixes for 500 errors...${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

cd "$PROJECT_DIR"

echo -e "\n${YELLOW}1. Checking and fixing database migrations${NC}"
echo -e "${BLUE}Running migrations...${NC}"
if docker-compose -f docker-compose.ec2.yml exec -T web python manage.py migrate; then
    echo -e "${GREEN}✅ Migrations completed${NC}"
else
    echo -e "${YELLOW}⚠️ Migration issues detected, trying to fix...${NC}"
    
    # Try to create database if it doesn't exist
    docker-compose -f docker-compose.ec2.yml exec -T web python manage.py migrate --run-syncdb
fi

echo -e "\n${YELLOW}2. Collecting static files${NC}"
echo -e "${BLUE}Collecting static files...${NC}"
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py collectstatic --noinput --clear

echo -e "\n${YELLOW}3. Fixing file permissions${NC}"
echo -e "${BLUE}Setting correct permissions...${NC}"
# Fix ownership of data directory
chown -R 1000:1000 "$PROJECT_DIR/data" 2>/dev/null || true
chmod -R 755 "$PROJECT_DIR/data" 2>/dev/null || true

# Make sure database file is writable
if [ -f "$PROJECT_DIR/data/restaurant.sqlite3" ]; then
    chmod 664 "$PROJECT_DIR/data/restaurant.sqlite3"
    echo -e "${GREEN}✅ Database file permissions fixed${NC}"
fi

echo -e "\n${YELLOW}4. Checking environment configuration${NC}"
if [ ! -f "$PROJECT_DIR/.env.ec2" ]; then
    echo -e "${RED}❌ .env.ec2 file missing${NC}"
    echo -e "${BLUE}Creating minimal .env.ec2...${NC}"
    
    cat > "$PROJECT_DIR/.env.ec2" << EOF
# Minimal EC2 Configuration
DJANGO_SECRET_KEY=$(python3 -c "import secrets; print(''.join(secrets.choice('abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*(-_=+)') for i in range(50)))")
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,xn--elfogndedonsoto-zrb.com,www.xn--elfogndedonsoto-zrb.com
DATABASE_URL=sqlite:///data/restaurant.sqlite3
TIME_ZONE=America/Lima
LANGUAGE_CODE=es-pe
DOMAIN_NAME=xn--elfogndedonsoto-zrb.com
EOF
    
    chmod 600 "$PROJECT_DIR/.env.ec2"
    echo -e "${GREEN}✅ Minimal .env.ec2 created${NC}"
else
    echo -e "${GREEN}✅ .env.ec2 exists${NC}"
fi

echo -e "\n${YELLOW}5. Creating superuser if needed${NC}"
echo -e "${BLUE}Checking if superuser exists...${NC}"
SUPERUSER_CHECK=$(docker-compose -f docker-compose.ec2.yml exec -T web python manage.py shell -c "
from django.contrib.auth.models import User
if User.objects.filter(is_superuser=True).exists():
    print('EXISTS')
else:
    print('NONE')
" 2>/dev/null || echo "ERROR")

if [ "$SUPERUSER_CHECK" = "NONE" ]; then
    echo -e "${BLUE}Creating superuser...${NC}"
    docker-compose -f docker-compose.ec2.yml exec -T web python manage.py shell -c "
from django.contrib.auth.models import User
User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
print('Superuser created: admin/admin123')
" 2>/dev/null || echo "Failed to create superuser"
fi

echo -e "\n${YELLOW}6. Restarting containers${NC}"
echo -e "${BLUE}Restarting Django container...${NC}"
docker-compose -f docker-compose.ec2.yml restart web

# Wait for container to be ready
echo -e "${BLUE}Waiting for container to start...${NC}"
sleep 10

echo -e "\n${YELLOW}7. Testing API endpoint${NC}"
echo -e "${BLUE}Testing zones endpoint...${NC}"
for i in {1..3}; do
    API_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" http://localhost:8000/api/v1/zones/ 2>/dev/null)
    HTTP_STATUS=$(echo $API_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    
    if [ "$HTTP_STATUS" = "200" ]; then
        echo -e "${GREEN}✅ API working! Status: $HTTP_STATUS${NC}"
        break
    elif [ "$HTTP_STATUS" = "500" ]; then
        echo -e "${YELLOW}⚠️ Still getting 500, attempt $i/3${NC}"
        if [ $i -lt 3 ]; then
            sleep 5
        fi
    else
        echo -e "${BLUE}Status: $HTTP_STATUS (attempt $i/3)${NC}"
        if [ $i -lt 3 ]; then
            sleep 5
        fi
    fi
done

echo -e "\n${GREEN}🎉 500 Error fix completed!${NC}"
echo -e "${BLUE}🌐 Test your application: http://xn--elfogndedonsoto-zrb.com${NC}"

if [ "$HTTP_STATUS" = "500" ]; then
    echo -e "\n${YELLOW}💡 If still getting 500 errors:${NC}"
    echo -e "${BLUE}1. Run: sudo ./deploy/diagnose-500.sh${NC}"
    echo -e "${BLUE}2. Check logs: docker-compose -f docker-compose.ec2.yml logs web${NC}"
    echo -e "${BLUE}3. Restart system: sudo reboot${NC}"
fi