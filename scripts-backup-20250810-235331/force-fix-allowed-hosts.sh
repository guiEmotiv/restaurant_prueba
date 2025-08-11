#!/bin/bash

echo "=== Force Fix ALLOWED_HOSTS ==="
echo "==============================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

cd /opt/restaurant-web

# 1. Stop the container first
echo -e "${BLUE}🛑 Stopping backend container...${NC}"
docker-compose -f docker-compose.ec2.yml stop web

# 2. Update .env.ec2 with the correct format
echo -e "\n${BLUE}📝 Updating .env.ec2 file...${NC}"
cat > .env.ec2 << 'EOF'
# EC2 Production Environment Variables
DJANGO_SECRET_KEY=django-insecure-zl02z-04_8=@cfw%c@o&5wro0uy2wls6a4b00#k#lk$=2zux+m
DEBUG=0
ALLOWED_HOSTS=localhost,127.0.0.1,44.248.47.186,xn--elfogndedonsoto-zrb.com,www.xn--elfogndedonsoto-zrb.com,*.xn--elfogndedonsoto-zrb.com,*

# Database
DATABASE_NAME=db.sqlite3
DATABASE_PATH=/app/data

# AWS Cognito
USE_COGNITO_AUTH=True
AWS_REGION=us-west-2
COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI
COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0

# CORS (if needed)
CORS_ALLOWED_ALL_ORIGINS=True
EOF

echo -e "${GREEN}✅ .env.ec2 updated${NC}"

# 3. Directly modify the settings file in the container
echo -e "\n${BLUE}🔧 Modifying settings_ec2.py directly...${NC}"
docker-compose -f docker-compose.ec2.yml run --rm web bash -c '
# First, backup the original
cp /app/backend/settings_ec2.py /app/backend/settings_ec2.py.backup

# Update ALLOWED_HOSTS line directly
sed -i "s/ALLOWED_HOSTS = .*/ALLOWED_HOSTS = [\"*\"]  # Allow all hosts temporarily/" /app/backend/settings_ec2.py

# Enable CORS
sed -i "s/# '\''corsheaders'\'',/'\''corsheaders'\'',/" /app/backend/settings_ec2.py
sed -i "s/# '\''corsheaders.middleware.CorsMiddleware'\'',/'\''corsheaders.middleware.CorsMiddleware'\'',/" /app/backend/settings_ec2.py

# Add CORS settings if not present
if ! grep -q "CORS_ALLOW_ALL_ORIGINS" /app/backend/settings_ec2.py; then
    echo "" >> /app/backend/settings_ec2.py
    echo "# CORS Settings - Allow all for now" >> /app/backend/settings_ec2.py
    echo "CORS_ALLOW_ALL_ORIGINS = True" >> /app/backend/settings_ec2.py
    echo "CORS_ALLOW_CREDENTIALS = True" >> /app/backend/settings_ec2.py
fi

echo "✅ Settings file updated"
cat /app/backend/settings_ec2.py | grep -A2 "ALLOWED_HOSTS\|CORS"
'

# 4. Start the container
echo -e "\n${BLUE}🚀 Starting backend container...${NC}"
docker-compose -f docker-compose.ec2.yml up -d web
sleep 10

# 5. Test the endpoints
echo -e "\n${BLUE}🎯 Testing endpoints...${NC}"

# Test health endpoint
echo -n "Health endpoint (direct): "
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health/)
if [ "$HEALTH_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ OK ($HEALTH_STATUS)${NC}"
else
    echo -e "${RED}❌ Failed ($HEALTH_STATUS)${NC}"
fi

# Test through HTTPS
echo -n "Health endpoint (HTTPS): "
HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/)
if [ "$HTTPS_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ OK ($HTTPS_STATUS)${NC}"
    echo "Response:"
    curl -s https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/ | jq . 2>/dev/null || curl -s https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/
else
    echo -e "${RED}❌ Failed ($HTTPS_STATUS)${NC}"
fi

# 6. Check container logs
echo -e "\n${BLUE}📋 Recent logs:${NC}"
docker-compose -f docker-compose.ec2.yml logs --tail=20 web | grep -E "ALLOWED_HOSTS|Invalid HTTP_HOST|Bad Request|ERROR" || echo "No errors found"

# 7. Alternative fix - Create a custom settings override
echo -e "\n${BLUE}🔨 Creating settings override...${NC}"
docker-compose -f docker-compose.ec2.yml exec -T web bash -c '
# Create a local settings override
cat > /app/backend/settings_override.py << EOF
# Override settings for EC2
ALLOWED_HOSTS = ["*"]
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# Ensure CORS middleware is in the right position
from backend.settings_ec2 import MIDDLEWARE
if "corsheaders.middleware.CorsMiddleware" not in MIDDLEWARE:
    MIDDLEWARE.insert(2, "corsheaders.middleware.CorsMiddleware")
EOF

# Import override at the end of settings_ec2.py
if ! grep -q "settings_override" /app/backend/settings_ec2.py; then
    echo "" >> /app/backend/settings_ec2.py
    echo "# Import local overrides" >> /app/backend/settings_ec2.py
    echo "try:" >> /app/backend/settings_ec2.py
    echo "    from .settings_override import *" >> /app/backend/settings_ec2.py
    echo "except ImportError:" >> /app/backend/settings_ec2.py
    echo "    pass" >> /app/backend/settings_ec2.py
fi

echo "✅ Settings override created"
'

# 8. Final restart
echo -e "\n${BLUE}🔄 Final restart...${NC}"
docker-compose -f docker-compose.ec2.yml restart web
sleep 10

# 9. Final test
echo -e "\n${GREEN}🎉 Final verification:${NC}"
echo -n "API Health: "
FINAL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/)
if [ "$FINAL_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ WORKING! ($FINAL_STATUS)${NC}"
    echo ""
    echo "API Response:"
    curl -s https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/ | jq . 2>/dev/null
else
    echo -e "${RED}❌ Still failing ($FINAL_STATUS)${NC}"
    echo ""
    echo "Debugging info:"
    echo "1. Container status:"
    docker-compose -f docker-compose.ec2.yml ps
    echo ""
    echo "2. Last error:"
    docker-compose -f docker-compose.ec2.yml logs --tail=5 web | grep -E "ERROR|Invalid" || echo "No errors"
fi

echo -e "\n${YELLOW}📌 Notes:${NC}"
echo "- ALLOWED_HOSTS is now set to allow all hosts (*)  "
echo "- CORS is enabled for all origins"
echo "- This is a temporary fix for production"
echo "- Monitor logs: docker-compose -f docker-compose.ec2.yml logs -f web"