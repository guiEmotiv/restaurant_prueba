#!/bin/bash

# Fix SSL Configuration Now
echo "🔧 FIXING SSL CONFIGURATION"
echo "==========================="

cd /opt/restaurant-web

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. Check current setup
echo -e "\n1️⃣ Current setup check..."
CURRENT_COMPOSE=""
if docker-compose -f docker-compose.ssl.yml ps 2>/dev/null | grep -q "Up"; then
    CURRENT_COMPOSE="docker-compose.ssl.yml"
    echo "Currently using: docker-compose.ssl.yml"
elif docker-compose -f docker-compose.simple.yml ps 2>/dev/null | grep -q "Up"; then
    CURRENT_COMPOSE="docker-compose.simple.yml"
    echo "Currently using: docker-compose.simple.yml"
else
    echo "No docker-compose running"
fi

# 2. Stop current setup
if [ -n "$CURRENT_COMPOSE" ]; then
    echo -e "\n2️⃣ Stopping current containers..."
    docker-compose -f $CURRENT_COMPOSE down
fi

# 3. Check if we should use SSL
echo -e "\n3️⃣ Checking SSL certificate availability..."
if [ -d "/etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com" ]; then
    echo -e "${GREEN}✅ SSL certificates found${NC}"
    USE_SSL=true
    
    # Check certificate files
    CERT_PATH="/etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com"
    if [ -f "$CERT_PATH/fullchain.pem" ] && [ -f "$CERT_PATH/privkey.pem" ]; then
        echo -e "${GREEN}✅ Certificate files exist${NC}"
    else
        echo -e "${RED}❌ Certificate files missing${NC}"
        USE_SSL=false
    fi
else
    echo -e "${YELLOW}⚠️ No SSL certificates found${NC}"
    USE_SSL=false
fi

# 4. Choose configuration
if [ "$USE_SSL" = true ]; then
    echo -e "\n4️⃣ Starting with SSL configuration..."
    
    # Ensure SSL compose file uses correct certificate paths
    if [ -f "docker-compose.ssl.yml" ]; then
        docker-compose -f docker-compose.ssl.yml up -d
        COMPOSE_USED="docker-compose.ssl.yml"
    else
        echo -e "${RED}❌ docker-compose.ssl.yml not found${NC}"
        exit 1
    fi
else
    echo -e "\n4️⃣ Starting without SSL (HTTP only)..."
    docker-compose -f docker-compose.simple.yml up -d
    COMPOSE_USED="docker-compose.simple.yml"
fi

# 5. Wait for services
echo -e "\n5️⃣ Waiting for services to start..."
sleep 10

# 6. Verify setup
echo -e "\n6️⃣ Verifying setup..."
echo "Container status:"
docker-compose -f $COMPOSE_USED ps

echo -e "\nPort listeners:"
sudo netstat -tlnp | grep -E ':80|:443|:8000' | grep LISTEN

# 7. Test endpoints
echo -e "\n7️⃣ Testing endpoints..."
echo "Backend health:"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:8000/api/v1/health/

echo -e "\nFrontend (HTTP):"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost/

if [ "$USE_SSL" = true ]; then
    echo -e "\nFrontend (HTTPS):"
    curl -k -s -o /dev/null -w "Status: %{http_code}\n" https://localhost/ || echo "HTTPS not working locally"
fi

# 8. AWS Security Group reminder
echo -e "\n${YELLOW}⚠️  IMPORTANT: AWS Security Group${NC}"
echo "Make sure your EC2 security group allows:"
echo "  - Port 80 (HTTP) from 0.0.0.0/0"
if [ "$USE_SSL" = true ]; then
    echo "  - Port 443 (HTTPS) from 0.0.0.0/0"
fi
echo ""
echo "To add port 443:"
echo "1. Go to AWS Console > EC2 > Security Groups"
echo "2. Find your instance's security group"
echo "3. Edit inbound rules"
echo "4. Add rule: Type=HTTPS, Port=443, Source=0.0.0.0/0"

echo -e "\n${GREEN}✅ Setup complete!${NC}"
echo "Your site should be accessible at:"
if [ "$USE_SSL" = true ]; then
    echo -e "${GREEN}https://www.xn--elfogndedonsoto-zrb.com/${NC}"
else
    echo -e "${YELLOW}http://www.xn--elfogndedonsoto-zrb.com/${NC} (no HTTPS)"
fi

# 9. Show logs command
echo -e "\nTo view logs:"
echo "docker-compose -f $COMPOSE_USED logs -f"