#!/bin/bash

# Domain Configuration Check Script
# Verifies domain, SSL, and Nginx setup

echo "🌐 Domain Configuration Check"
echo "============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

DOMAIN="xn--elfogndedonsoto-zrb.com"
PROJECT_DIR="/opt/restaurant-web"

echo -e "${BLUE}🔍 Checking domain: $DOMAIN${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check DNS resolution
echo -e "\n${YELLOW}1. DNS Resolution${NC}"
if command_exists dig; then
    dig_result=$(dig +short $DOMAIN)
    if [ -n "$dig_result" ]; then
        echo -e "${GREEN}✅ DNS resolves to: $dig_result${NC}"
    else
        echo -e "${RED}❌ DNS resolution failed${NC}"
    fi
else
    # Fallback to nslookup or ping
    if ping -c 1 $DOMAIN >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Domain is reachable${NC}"
    else
        echo -e "${RED}❌ Domain is not reachable${NC}"
    fi
fi

# Check SSL certificate
echo -e "\n${YELLOW}2. SSL Certificate${NC}"
ssl_check=$(echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ SSL certificate exists${NC}"
    echo "$ssl_check" | sed 's/^/  /'
else
    echo -e "${RED}❌ SSL certificate check failed${NC}"
fi

# Check HTTP/HTTPS responses
echo -e "\n${YELLOW}3. HTTP/HTTPS Responses${NC}"
http_code=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN/ 2>/dev/null || echo "000")
https_code=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/ 2>/dev/null || echo "000")

if [ "$http_code" = "301" ] || [ "$http_code" = "302" ]; then
    echo -e "${GREEN}✅ HTTP redirects properly ($http_code)${NC}"
elif [ "$http_code" = "200" ]; then
    echo -e "${YELLOW}⚠️ HTTP responds directly ($http_code) - consider HTTPS redirect${NC}"
else
    echo -e "${RED}❌ HTTP response: $http_code${NC}"
fi

if [ "$https_code" = "200" ]; then
    echo -e "${GREEN}✅ HTTPS responds correctly ($https_code)${NC}"
else
    echo -e "${RED}❌ HTTPS response: $https_code${NC}"
fi

# Check Nginx configuration
echo -e "\n${YELLOW}4. Nginx Configuration${NC}"
if command_exists nginx; then
    if nginx -t >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Nginx configuration is valid${NC}"
    else
        echo -e "${RED}❌ Nginx configuration has errors${NC}"
        nginx -t 2>&1 | sed 's/^/  /'
    fi
    
    # Check if domain config exists
    if [ -f "/etc/nginx/sites-available/$DOMAIN" ]; then
        echo -e "${GREEN}✅ Domain Nginx config exists${NC}"
    else
        echo -e "${YELLOW}⚠️ Domain Nginx config not found${NC}"
        echo -e "${BLUE}  💡 You may need to run: sudo ./deploy/configure-domain.sh $DOMAIN${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Nginx not installed or not in PATH${NC}"
fi

# Check environment configuration
echo -e "\n${YELLOW}5. Environment Configuration${NC}"
if [ -f "$PROJECT_DIR/.env.ec2" ]; then
    if grep -q "DOMAIN_NAME=$DOMAIN" "$PROJECT_DIR/.env.ec2"; then
        echo -e "${GREEN}✅ Domain configured in .env.ec2${NC}"
    else
        echo -e "${YELLOW}⚠️ Domain not configured in .env.ec2${NC}"
        echo -e "${BLUE}  💡 Run: sudo ./deploy/fix-env-ec2.sh${NC}"
    fi
else
    echo -e "${RED}❌ .env.ec2 file not found${NC}"
fi

# Check CORS configuration
echo -e "\n${YELLOW}6. Application Status${NC}"
api_check=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/api/v1/units/ 2>/dev/null || echo "000")
if [ "$api_check" = "200" ]; then
    echo -e "${GREEN}✅ API responds correctly${NC}"
elif [ "$api_check" = "403" ] || [ "$api_check" = "401" ]; then
    echo -e "${YELLOW}⚠️ API responds but requires authentication ($api_check)${NC}"
else
    echo -e "${RED}❌ API response: $api_check${NC}"
fi

# Summary and recommendations
echo -e "\n${BLUE}=====================================${NC}"
echo -e "${BLUE}📋 Summary and Recommendations:${NC}"

if [ "$https_code" = "200" ] && [ "$api_check" = "200" -o "$api_check" = "403" -o "$api_check" = "401" ]; then
    echo -e "\n${GREEN}🎉 Domain configuration looks good!${NC}"
    echo -e "${BLUE}🌐 Access your application at: https://$DOMAIN${NC}"
else
    echo -e "\n${YELLOW}⚠️ Some issues found. Recommendations:${NC}"
    
    if [ "$https_code" != "200" ]; then
        echo -e "${BLUE}1. Configure SSL/Domain: sudo ./deploy/configure-domain.sh $DOMAIN${NC}"
    fi
    
    if [ "$api_check" = "000" ]; then
        echo -e "${BLUE}2. Check if application is running: docker-compose -f docker-compose.ec2.yml ps${NC}"
        echo -e "${BLUE}3. Rebuild application: sudo ./deploy/deploy-optimized.sh${NC}"
    fi
fi

echo -e "\n${GREEN}✅ Domain check completed!${NC}"