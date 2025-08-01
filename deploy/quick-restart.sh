#!/bin/bash

# Restaurant Web - Quick Restart
# Use this for simple restarts without rebuilding

echo "🚀 Quick Restart"
echo "================"

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
echo -e "  ✅ Restarts all containers"
echo -e "  ✅ No rebuilding"
echo -e "  ✅ No reinstalling"
echo -e "  ⏱️ Takes ~30 seconds"
echo ""

cd "$PROJECT_DIR"

# Show current status
echo -e "${BLUE}📊 Current container status:${NC}"
docker-compose -f docker-compose.ec2.yml ps

# Restart all containers
echo -e "${BLUE}🔄 Restarting all containers...${NC}"
docker-compose -f docker-compose.ec2.yml restart

# Wait for services
echo -e "${BLUE}⏳ Waiting for services to start...${NC}"
sleep 10

# Test services
echo -e "${BLUE}🧪 Testing services...${NC}"

# Test API
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/zones/ 2>/dev/null || echo "000")
if [ "$API_STATUS" = "200" ] || [ "$API_STATUS" = "401" ] || [ "$API_STATUS" = "403" ]; then
    echo -e "${GREEN}✅ API working (Status: $API_STATUS)${NC}"
else
    echo -e "${YELLOW}⚠️ API Status: $API_STATUS${NC}"
fi

# Test frontend
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/ 2>/dev/null || echo "000")
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Frontend working (Status: $FRONTEND_STATUS)${NC}"
else
    echo -e "${YELLOW}⚠️ Frontend Status: $FRONTEND_STATUS${NC}"
fi

# Show final status
echo -e "\n${BLUE}📊 Final container status:${NC}"
docker-compose -f docker-compose.ec2.yml ps

echo -e "\n${GREEN}🎉 QUICK RESTART COMPLETED!${NC}"
echo -e "${BLUE}⏱️ Total time: ~30 seconds${NC}"
echo -e ""
echo -e "${YELLOW}💡 Use this script when you need to:${NC}"
echo -e "  • Restart hung containers"
echo -e "  • Apply environment variable changes"
echo -e "  • Clear memory issues"
echo -e "  • Quick recovery from errors"