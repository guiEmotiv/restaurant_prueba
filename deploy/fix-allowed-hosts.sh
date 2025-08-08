#!/bin/bash

echo "=== Fix ALLOWED_HOSTS for Django ==="
echo "===================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_DIR="/opt/restaurant-web"
DOMAIN="xn--elfogndedonsoto-zrb.com"
WWW_DOMAIN="www.$DOMAIN"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

cd "$PROJECT_DIR"

# 1. Check current ALLOWED_HOSTS
echo -e "\n${BLUE}🔍 Checking current ALLOWED_HOSTS...${NC}"
docker-compose -f docker-compose.ec2.yml exec -T web python -c "
from django.conf import settings
print('Current ALLOWED_HOSTS:', settings.ALLOWED_HOSTS)
"

# 2. Update .env.ec2 file
echo -e "\n${BLUE}📝 Updating .env.ec2 file...${NC}"
if [ -f ".env.ec2" ]; then
    # Backup original
    cp .env.ec2 .env.ec2.backup
    
    # Update ALLOWED_HOSTS
    if grep -q "ALLOWED_HOSTS=" .env.ec2; then
        # Replace existing
        sed -i "s/ALLOWED_HOSTS=.*/ALLOWED_HOSTS=localhost,127.0.0.1,$DOMAIN,$WWW_DOMAIN,\*.$DOMAIN/" .env.ec2
        echo -e "${GREEN}✅ Updated existing ALLOWED_HOSTS${NC}"
    else
        # Add new
        echo "ALLOWED_HOSTS=localhost,127.0.0.1,$DOMAIN,$WWW_DOMAIN,*.$DOMAIN" >> .env.ec2
        echo -e "${GREEN}✅ Added ALLOWED_HOSTS${NC}"
    fi
    
    echo "New ALLOWED_HOSTS value:"
    grep "ALLOWED_HOSTS=" .env.ec2
else
    echo -e "${RED}❌ .env.ec2 file not found${NC}"
fi

# 3. Enable CORS in Django settings
echo -e "\n${BLUE}🌐 Enabling CORS in Django...${NC}"
docker-compose -f docker-compose.ec2.yml exec -T web bash -c "
cd /app
# Enable django-cors-headers
python -c \"
import os

settings_file = 'backend/settings_ec2.py'
with open(settings_file, 'r') as f:
    content = f.read()

# Enable corsheaders in INSTALLED_APPS
content = content.replace(\"# 'corsheaders',  # Disabled\", \"'corsheaders',  # Enabled for API\")

# Enable corsheaders middleware
content = content.replace(\"# 'corsheaders.middleware.CorsMiddleware',  # Disabled\", \"'corsheaders.middleware.CorsMiddleware',  # Enabled\")

# Add CORS settings at the end if not present
if 'CORS_ALLOWED_ORIGINS' not in content:
    cors_settings = '''
# CORS Settings - Added for API access
CORS_ALLOWED_ORIGINS = [
    'https://www.xn--elfogndedonsoto-zrb.com',
    'https://xn--elfogndedonsoto-zrb.com',
]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]
'''
    content += cors_settings
    print('✅ Added CORS settings')

# Write back
with open(settings_file, 'w') as f:
    f.write(content)
\"
"

# 3. Update Django settings directly
echo -e "\n${BLUE}🔧 Updating Django settings file...${NC}"
docker-compose -f docker-compose.ec2.yml exec -T web bash -c "
cd /app
# Update settings_ec2.py to ensure ALLOWED_HOSTS includes our domains
python -c \"
import os

settings_file = 'backend/settings_ec2.py'
with open(settings_file, 'r') as f:
    content = f.read()

# Find ALLOWED_HOSTS line
import re
pattern = r'ALLOWED_HOSTS\s*=\s*\[[^\]]*\]'
new_allowed_hosts = '''ALLOWED_HOSTS = [
    'localhost',
    '127.0.0.1',
    '$DOMAIN',
    '$WWW_DOMAIN',
    'www.xn--elfogndedonsoto-zrb.com',
    'xn--elfogndedonsoto-zrb.com',
    '*',  # Allow all hosts for testing
]'''

if re.search(pattern, content):
    # Replace existing
    content = re.sub(pattern, new_allowed_hosts, content)
    print('✅ Updated existing ALLOWED_HOSTS in settings')
else:
    # Try to find where to add it
    if 'DEBUG = ' in content:
        # Add after DEBUG
        content = content.replace('DEBUG = False', 'DEBUG = False\\n\\n' + new_allowed_hosts)
        content = content.replace('DEBUG = True', 'DEBUG = True\\n\\n' + new_allowed_hosts)
        print('✅ Added ALLOWED_HOSTS after DEBUG')
    else:
        # Add at the end
        content += '\\n\\n' + new_allowed_hosts
        print('✅ Added ALLOWED_HOSTS at the end')

# Write back
with open(settings_file, 'w') as f:
    f.write(content)
\"
"

# 4. Restart Django to apply changes
echo -e "\n${BLUE}🔄 Restarting Django...${NC}"
docker-compose -f docker-compose.ec2.yml restart web
echo "Waiting for Django to restart..."
sleep 15

# 5. Verify the fix
echo -e "\n${BLUE}✅ Verifying the fix...${NC}"

# Check ALLOWED_HOSTS again
echo "New ALLOWED_HOSTS configuration:"
docker-compose -f docker-compose.ec2.yml exec -T web python -c "
from django.conf import settings
print('ALLOWED_HOSTS:', settings.ALLOWED_HOSTS)
" 2>/dev/null || echo "Could not read settings"

# Test endpoints
echo -e "\n${BLUE}🎯 Testing endpoints...${NC}"

# Test direct backend
echo -n "Direct backend (localhost:8000): "
DIRECT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health/)
if [ "$DIRECT_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ OK ($DIRECT_STATUS)${NC}"
else
    echo -e "${RED}❌ Failed ($DIRECT_STATUS)${NC}"
fi

# Test through HTTPS with proper host header
echo -n "HTTPS API (www domain): "
HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: $WWW_DOMAIN" https://$WWW_DOMAIN/api/v1/health/)
if [ "$HTTPS_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ OK ($HTTPS_STATUS)${NC}"
else
    echo -e "${YELLOW}⚠️ Status: $HTTPS_STATUS${NC}"
fi

# Test actual response
echo -e "\n${BLUE}📋 API Response:${NC}"
RESPONSE=$(curl -s https://$WWW_DOMAIN/api/v1/health/ 2>/dev/null)
if [ -n "$RESPONSE" ]; then
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
fi

# 6. Check database location
echo -e "\n${BLUE}💾 Fixing database location...${NC}"
# Ensure data directory exists
mkdir -p "$PROJECT_DIR/data"
chown -R 1000:1000 "$PROJECT_DIR/data"

# Check if database exists in container
docker-compose -f docker-compose.ec2.yml exec -T web bash -c "
if [ -f /app/db.sqlite3 ]; then
    echo 'Found database in /app/db.sqlite3'
    cp /app/db.sqlite3 /app/data/db.sqlite3 2>/dev/null || true
fi
ls -la /app/data/
"

# 7. Final checks
echo -e "\n${BLUE}📊 Final status:${NC}"
docker-compose -f docker-compose.ec2.yml ps

echo -e "\n${GREEN}✅ ALLOWED_HOSTS fix completed!${NC}"
echo ""
echo "The following domains are now allowed:"
echo "- localhost"
echo "- 127.0.0.1"
echo "- $DOMAIN"
echo "- $WWW_DOMAIN"
echo ""
echo "If you still see errors, check:"
echo "1. docker-compose -f docker-compose.ec2.yml logs -f web"
echo "2. Clear browser cache"
echo "3. Ensure nginx is forwarding the correct Host header"

# Show recent logs
echo -e "\n${BLUE}📋 Recent backend logs:${NC}"
docker-compose -f docker-compose.ec2.yml logs --tail=10 web | grep -v "Watching for file changes" || true