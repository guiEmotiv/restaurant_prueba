#!/bin/bash

# Enable SSL for Restaurant Web
echo "🔒 ENABLING SSL FOR RESTAURANT WEB"
echo "==================================="

cd /opt/restaurant-web

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 1. Check if SSL certificates exist
echo -e "\n1️⃣ Checking SSL certificates..."
if [ -d "/etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com" ]; then
    echo -e "${GREEN}✅ SSL certificates found${NC}"
    ls -la /etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com/
else
    echo -e "${RED}❌ SSL certificates not found${NC}"
    echo "Please run certbot first to generate certificates"
    exit 1
fi

# 2. Pull latest changes
echo -e "\n2️⃣ Pulling latest changes..."
git pull

# 3. Stop current containers
echo -e "\n3️⃣ Stopping current containers..."
docker-compose -f docker-compose.simple.yml down

# 4. Start with SSL configuration
echo -e "\n4️⃣ Starting with SSL configuration..."
docker-compose -f docker-compose.ssl.yml up -d

# 5. Wait for services
echo -e "\n5️⃣ Waiting for services to start..."
sleep 10

# 6. Test HTTPS
echo -e "\n6️⃣ Testing HTTPS..."
echo "Testing local HTTPS:"
curl -k -s -o /dev/null -w "Status: %{http_code}\n" https://localhost/ || echo "Local HTTPS not responding"

echo -e "\nTesting domain HTTPS:"
curl -s -o /dev/null -w "Status: %{http_code}\n" https://www.xn--elfogndedonsoto-zrb.com/ || echo "Domain HTTPS not responding"

echo -e "\nTesting API via HTTPS:"
curl -s -o /dev/null -w "Status: %{http_code}\n" https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/ || echo "API HTTPS not responding"

# 7. Show container status
echo -e "\n7️⃣ Container status:"
docker-compose -f docker-compose.ssl.yml ps

echo -e "\n${GREEN}🎉 SSL ENABLED!${NC}"
echo -e "Your site should now be accessible at:"
echo -e "${GREEN}https://www.xn--elfogndedonsoto-zrb.com/${NC}"
echo -e "\nIf you have issues, check logs with:"
echo -e "docker-compose -f docker-compose.ssl.yml logs nginx"