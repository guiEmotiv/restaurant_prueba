#!/bin/bash

# Restaurant Web - Backend Only Deploy
# Use this for backend changes (Django models, API endpoints, etc.)

echo "🚀 Backend Only Deploy"
echo "======================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_DIR="/opt/restaurant-web"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

echo -e "${BLUE}📝 What this script does:${NC}"
echo -e "  ✅ Applies database migrations"
echo -e "  ✅ Restarts backend container"
echo -e "  ✅ Collects static files"
echo -e "  ✅ Keeps frontend running"
echo -e "  ⏱️ Takes ~1-2 minutes"
echo ""

cd "$PROJECT_DIR"

# Check if containers are running
if ! docker-compose -f docker-compose.ec2.yml ps | grep -q "Up"; then
    echo -e "${RED}❌ Containers not running. Start them first with:${NC}"
    echo -e "   docker-compose -f docker-compose.ec2.yml up -d"
    exit 1
fi

# Apply migrations
echo -e "${BLUE}🗄️ Applying database migrations...${NC}"
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py makemigrations
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py migrate

# Collect static files
echo -e "${BLUE}📁 Collecting static files...${NC}"
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py collectstatic --noinput --clear

# Restart backend container
echo -e "${BLUE}🔄 Restarting backend container...${NC}"
docker-compose -f docker-compose.ec2.yml restart web

# Wait for backend to be ready
echo -e "${BLUE}⏳ Waiting for backend to start...${NC}"
sleep 10

# Test API
echo -e "${BLUE}🧪 Testing API...${NC}"
for i in {1..3}; do
    API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/zones/ 2>/dev/null || echo "000")
    if [ "$API_STATUS" = "200" ] || [ "$API_STATUS" = "401" ] || [ "$API_STATUS" = "403" ]; then
        echo -e "${GREEN}✅ API working (Status: $API_STATUS)${NC}"
        break
    else
        echo -e "${YELLOW}⚠️ API Status: $API_STATUS (attempt $i/3)${NC}"
        if [ $i -lt 3 ]; then
            sleep 5
        fi
    fi
done

# Show recent logs
echo -e "${BLUE}📋 Recent backend logs:${NC}"
docker-compose -f docker-compose.ec2.yml logs --tail=10 web

echo -e "\n${GREEN}🎉 BACKEND DEPLOYMENT COMPLETED!${NC}"
echo -e "${BLUE}🌐 API URL: ${GREEN}http://xn--elfogndedonsoto-zrb.com/api/v1/${NC}"
echo -e "${BLUE}⏱️ Total time: ~1-2 minutes${NC}"
echo -e ""
echo -e "${YELLOW}💡 Use this script when you only change:${NC}"
echo -e "  • Django models"
echo -e "  • API endpoints"
echo -e "  • Backend logic"
echo -e "  • Database schema"
echo -e ""
echo -e "${YELLOW}🔍 Troubleshooting:${NC}"
echo -e "  • View logs: docker-compose -f docker-compose.ec2.yml logs web"
echo -e "  • Check containers: docker-compose -f docker-compose.ec2.yml ps"