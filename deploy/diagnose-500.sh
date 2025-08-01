#!/bin/bash

# Diagnose 500 Error Script
# Checks Django backend for internal server errors

echo "🔍 Diagnosing 500 Internal Server Error"
echo "======================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="/opt/restaurant-web"

echo -e "${BLUE}🎯 Checking Django backend for 500 errors...${NC}"

echo -e "\n${YELLOW}1. Docker Container Status${NC}"
docker-compose -f docker-compose.ec2.yml ps

echo -e "\n${YELLOW}2. Django Application Logs${NC}"
echo -e "${BLUE}Last 30 lines of Django logs:${NC}"
docker-compose -f docker-compose.ec2.yml logs --tail=30 web

echo -e "\n${YELLOW}3. Direct API Test${NC}"
echo -e "${BLUE}Testing API endpoint directly:${NC}"
API_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" http://localhost:8000/api/v1/zones/)
HTTP_STATUS=$(echo $API_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
RESPONSE_BODY=$(echo $API_RESPONSE | sed -E 's/HTTPSTATUS\:[0-9]{3}$//')

echo -e "  Status Code: $HTTP_STATUS"
if [ "$HTTP_STATUS" = "500" ]; then
    echo -e "${RED}  ❌ Internal Server Error confirmed${NC}"
    echo -e "  Response: $RESPONSE_BODY"
else
    echo -e "${GREEN}  ✅ Direct API works (Status: $HTTP_STATUS)${NC}"
fi

echo -e "\n${YELLOW}4. Database Check${NC}"
echo -e "${BLUE}Checking database connection:${NC}"
DB_CHECK=$(docker-compose -f docker-compose.ec2.yml exec -T web python manage.py check --database default 2>&1)
if echo "$DB_CHECK" | grep -q "ERROR"; then
    echo -e "${RED}  ❌ Database issues found:${NC}"
    echo "$DB_CHECK" | sed 's/^/    /'
else
    echo -e "${GREEN}  ✅ Database connection OK${NC}"
fi

echo -e "\n${YELLOW}5. Migration Status${NC}"
echo -e "${BLUE}Checking migration status:${NC}"
MIGRATION_STATUS=$(docker-compose -f docker-compose.ec2.yml exec -T web python manage.py showmigrations --verbosity=0 2>&1)
if echo "$MIGRATION_STATUS" | grep -q "\[ \]"; then
    echo -e "${RED}  ❌ Unapplied migrations found${NC}"
    echo "$MIGRATION_STATUS" | grep "\[ \]" | sed 's/^/    /'
    echo -e "${BLUE}  💡 Run: docker-compose -f docker-compose.ec2.yml exec web python manage.py migrate${NC}"
else
    echo -e "${GREEN}  ✅ All migrations applied${NC}"
fi

echo -e "\n${YELLOW}6. Environment Variables${NC}"
echo -e "${BLUE}Checking critical environment variables:${NC}"
docker-compose -f docker-compose.ec2.yml exec -T web python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_ec2')
django.setup()

print('  DEBUG:', os.getenv('DEBUG', 'Not set'))
print('  DJANGO_SETTINGS_MODULE:', os.getenv('DJANGO_SETTINGS_MODULE', 'Not set'))
print('  ALLOWED_HOSTS:', os.getenv('ALLOWED_HOSTS', 'Not set'))
print('  DATABASE_URL:', 'Set' if os.getenv('DATABASE_URL') else 'Not set')
print('  COGNITO_ENABLED:', os.getenv('COGNITO_USER_POOL_ID', 'Not set') != '')
"

echo -e "\n${YELLOW}7. Django Admin Test${NC}"
echo -e "${BLUE}Testing Django admin endpoint:${NC}"
ADMIN_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" http://localhost:8000/api/v1/admin/)
ADMIN_STATUS=$(echo $ADMIN_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
echo -e "  Admin Status: $ADMIN_STATUS"

echo -e "\n${YELLOW}8. Static Files Check${NC}"
echo -e "${BLUE}Checking static files collection:${NC}"
STATIC_CHECK=$(docker-compose -f docker-compose.ec2.yml exec -T web python manage.py collectstatic --noinput --dry-run 2>&1)
if echo "$STATIC_CHECK" | grep -q "ERROR"; then
    echo -e "${RED}  ❌ Static files issues${NC}"
    echo "$STATIC_CHECK" | sed 's/^/    /'
else
    echo -e "${GREEN}  ✅ Static files OK${NC}"
fi

echo -e "\n${BLUE}=====================================${NC}"
echo -e "${BLUE}📋 Diagnosis Summary:${NC}"

if [ "$HTTP_STATUS" = "500" ]; then
    echo -e "\n${RED}🚨 500 Error Confirmed - Common Solutions:${NC}"
    echo -e "${BLUE}1. Check Django logs above for specific error${NC}"
    echo -e "${BLUE}2. Run migrations: docker-compose -f docker-compose.ec2.yml exec web python manage.py migrate${NC}"
    echo -e "${BLUE}3. Check database file permissions${NC}"
    echo -e "${BLUE}4. Verify .env.ec2 configuration${NC}"
    echo -e "${BLUE}5. Restart containers: docker-compose -f docker-compose.ec2.yml restart${NC}"
else
    echo -e "\n${GREEN}✅ API appears to be working${NC}"
    echo -e "${BLUE}The 500 error might be intermittent or already resolved${NC}"
fi

echo -e "\n${GREEN}🔍 Diagnosis completed!${NC}"