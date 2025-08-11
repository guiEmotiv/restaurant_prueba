#!/bin/bash

echo "=== Fix Backend API Connection Issues ==="
echo "========================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_DIR="/opt/restaurant-web"
BACKEND_DIR="$PROJECT_DIR/backend"
DATA_DIR="$PROJECT_DIR/data"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

cd "$PROJECT_DIR"

# 1. Check Docker backend status
echo -e "\n${BLUE}🐳 Checking Docker backend...${NC}"
BACKEND_STATUS=$(docker-compose -f docker-compose.ec2.yml ps 2>/dev/null | grep web | grep -c Up || echo "0")

if [ "$BACKEND_STATUS" -eq "0" ]; then
    echo -e "${RED}❌ Backend is NOT running${NC}"
    echo "Starting backend..."
    docker-compose -f docker-compose.ec2.yml up -d
    sleep 10
else
    echo -e "${GREEN}✅ Backend container is running${NC}"
fi

# Show container status
docker-compose -f docker-compose.ec2.yml ps

# 2. Check backend logs for errors
echo -e "\n${BLUE}📋 Recent backend logs:${NC}"
docker-compose -f docker-compose.ec2.yml logs --tail=30 web | grep -E "ERROR|WARNING|CRITICAL|Traceback|Error|error" || echo "No errors in recent logs"

# 3. Test backend directly
echo -e "\n${BLUE}🔍 Testing backend endpoints directly:${NC}"

# Health check
echo -n "Health check: "
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health/)
if [ "$HEALTH" = "200" ]; then
    echo -e "${GREEN}✅ OK ($HEALTH)${NC}"
else
    echo -e "${RED}❌ Failed ($HEALTH)${NC}"
fi

# Test API root
echo -n "API root: "
API_ROOT=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/)
echo "Status $API_ROOT"

# Test without auth (should return 401 with Cognito)
echo -n "Zones endpoint (no auth): "
ZONES=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/zones/)
if [ "$ZONES" = "401" ] || [ "$ZONES" = "403" ]; then
    echo -e "${GREEN}✅ Auth required ($ZONES) - Cognito is working${NC}"
elif [ "$ZONES" = "200" ]; then
    echo -e "${YELLOW}⚠️ No auth required ($ZONES) - Cognito might be disabled${NC}"
else
    echo -e "${RED}❌ Error ($ZONES)${NC}"
fi

# 4. Check database
echo -e "\n${BLUE}💾 Checking database...${NC}"
if [ -f "$DATA_DIR/db.sqlite3" ]; then
    echo -e "${GREEN}✅ Database file exists${NC}"
    DB_SIZE=$(du -h "$DATA_DIR/db.sqlite3" | cut -f1)
    echo "Size: $DB_SIZE"
    
    # Check if tables exist
    echo "Checking tables..."
    docker-compose -f docker-compose.ec2.yml exec -T web python manage.py shell << 'EOF' 2>/dev/null || echo "Error checking tables"
from django.db import connection
tables = connection.introspection.table_names()
print(f"Total tables: {len(tables)}")
if tables:
    print("Sample tables:", tables[:5])
else:
    print("No tables found!")
EOF
else
    echo -e "${RED}❌ Database file not found${NC}"
fi

# 5. Run migrations if needed
echo -e "\n${BLUE}🔄 Checking migrations...${NC}"
MIGRATION_CHECK=$(docker-compose -f docker-compose.ec2.yml exec -T web python manage.py showmigrations --plan 2>&1)
if echo "$MIGRATION_CHECK" | grep -q "\[ \]"; then
    echo -e "${YELLOW}⚠️ Pending migrations found${NC}"
    echo "Running migrations..."
    docker-compose -f docker-compose.ec2.yml exec -T web python manage.py migrate --noinput
else
    echo -e "${GREEN}✅ All migrations applied${NC}"
fi

# 6. Check environment variables
echo -e "\n${BLUE}🔧 Checking environment variables...${NC}"
echo "Cognito configuration:"
docker-compose -f docker-compose.ec2.yml exec -T web printenv | grep -E "COGNITO|AWS_REGION" || echo "No Cognito vars found"

# 7. Check nginx proxy configuration
echo -e "\n${BLUE}🌐 Checking nginx API proxy...${NC}"
NGINX_CONFIG=$(grep -A 5 "location /api/" /etc/nginx/sites-enabled/* 2>/dev/null | head -10)
if [ -n "$NGINX_CONFIG" ]; then
    echo -e "${GREEN}✅ API proxy configured${NC}"
    echo "$NGINX_CONFIG"
else
    echo -e "${RED}❌ No API proxy found in nginx${NC}"
fi

# 8. Test API through nginx (HTTPS)
echo -e "\n${BLUE}🔐 Testing API through HTTPS:${NC}"
PUBLIC_DOMAIN="https://www.xn--elfogndedonsoto-zrb.com"

echo -n "Health through HTTPS: "
HTTPS_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$PUBLIC_DOMAIN/api/v1/health/")
if [ "$HTTPS_HEALTH" = "200" ]; then
    echo -e "${GREEN}✅ OK ($HTTPS_HEALTH)${NC}"
else
    echo -e "${RED}❌ Failed ($HTTPS_HEALTH)${NC}"
fi

# 9. Check CORS headers
echo -e "\n${BLUE}🔒 Checking CORS headers...${NC}"
CORS_CHECK=$(curl -s -I -X OPTIONS \
    -H "Origin: https://www.xn--elfogndedonsoto-zrb.com" \
    -H "Access-Control-Request-Method: GET" \
    "$PUBLIC_DOMAIN/api/v1/zones/" 2>/dev/null | grep -i "access-control")
    
if [ -n "$CORS_CHECK" ]; then
    echo -e "${GREEN}✅ CORS headers present${NC}"
    echo "$CORS_CHECK"
else
    echo -e "${YELLOW}⚠️ No CORS headers found${NC}"
fi

# 10. Create test data if database is empty
echo -e "\n${BLUE}📊 Checking data...${NC}"
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py shell << 'EOF' 2>/dev/null || echo "Error checking data"
from config.models import Unit, Zone, Table
from inventory.models import Group

# Check if we have data
units = Unit.objects.count()
zones = Zone.objects.count()
tables = Table.objects.count()
groups = Group.objects.count()

print(f"Units: {units}, Zones: {zones}, Tables: {tables}, Groups: {groups}")

if units == 0:
    print("Creating default units...")
    Unit.objects.create(name="Kilogramo")
    Unit.objects.create(name="Litro")
    Unit.objects.create(name="Unidad")
    print("✅ Units created")

if zones == 0:
    print("Creating default zone...")
    zone = Zone.objects.create(name="Salón Principal")
    print("✅ Zone created")
    
    if tables == 0:
        print("Creating default tables...")
        for i in range(1, 6):
            Table.objects.create(table_number=str(i), zone=zone)
        print("✅ Tables created")

if groups == 0:
    print("Creating default group...")
    Group.objects.create(name="General")
    print("✅ Group created")
EOF

# 11. Restart backend
echo -e "\n${BLUE}🔄 Restarting backend...${NC}"
docker-compose -f docker-compose.ec2.yml restart web
sleep 10

# 12. Final verification
echo -e "\n${BLUE}🎯 Final verification...${NC}"

# Check if backend is responding
FINAL_CHECK=$(curl -s "$PUBLIC_DOMAIN/api/v1/health/" 2>/dev/null)
if [ -n "$FINAL_CHECK" ]; then
    echo -e "${GREEN}✅ Backend API is accessible${NC}"
    echo "Response: $FINAL_CHECK"
else
    echo -e "${RED}❌ Backend API still not accessible${NC}"
fi

# Show container logs if there are issues
if [ "$HTTPS_HEALTH" != "200" ]; then
    echo -e "\n${RED}Recent error logs:${NC}"
    docker-compose -f docker-compose.ec2.yml logs --tail=20 web
fi

# Summary
echo -e "\n${BLUE}📊 Summary:${NC}"
echo "- Backend container: $(docker-compose -f docker-compose.ec2.yml ps | grep -c "Up.*web" || echo "0") running"
echo "- Database: $([ -f "$DATA_DIR/db.sqlite3" ] && echo "exists" || echo "missing")"
echo "- Direct API (8000): $HEALTH"
echo "- HTTPS API: $HTTPS_HEALTH"
echo "- Cognito auth: $([ "$ZONES" = "401" ] || [ "$ZONES" = "403" ] && echo "enabled" || echo "disabled/error")"

echo -e "\n${YELLOW}📌 Troubleshooting tips:${NC}"
echo "1. Check browser console for detailed errors"
echo "2. Try with a valid Cognito token in headers"
echo "3. Check Security Groups allow port 8000 from nginx"
echo "4. Monitor logs: docker-compose -f docker-compose.ec2.yml logs -f web"

echo -e "\n${GREEN}✅ Backend fix script completed${NC}"