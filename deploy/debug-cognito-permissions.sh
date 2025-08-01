#!/bin/bash

# Debug Cognito Permissions Script
# This script helps debug user permission issues

echo "🔍 Restaurant Web - Cognito Permissions Debug"
echo "============================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="/opt/restaurant-web"

echo -e "${BLUE}=== COGNITO CONFIGURATION CHECK ===${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

# Check Docker containers
echo -e "\n${YELLOW}1. Docker Container Status:${NC}"
docker-compose -f "$PROJECT_DIR/docker-compose.ec2.yml" ps

# Check backend logs for authentication errors
echo -e "\n${YELLOW}2. Recent Authentication Logs (last 50 lines):${NC}"
docker-compose -f "$PROJECT_DIR/docker-compose.ec2.yml" logs --tail=50 web | grep -i "auth\|cognito\|permission\|error\|401\|403" || echo "No authentication logs found"

# Test detailed JWT token debugging
echo -e "\n${YELLOW}3. JWT Token Debug Test:${NC}"
docker-compose -f "$PROJECT_DIR/docker-compose.ec2.yml" exec -T web python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_ec2')
django.setup()

from django.conf import settings

print('=== Django Cognito Settings ===')
print('USE_COGNITO_AUTH:', getattr(settings, 'USE_COGNITO_AUTH', 'NOT_SET'))
print('COGNITO_USER_POOL_ID:', getattr(settings, 'COGNITO_USER_POOL_ID', 'NOT_SET'))
print('COGNITO_APP_CLIENT_ID:', getattr(settings, 'COGNITO_APP_CLIENT_ID', 'NOT_SET'))
print('AWS_REGION:', getattr(settings, 'AWS_REGION', 'NOT_SET'))

print('\\n=== Authentication Middleware Check ===')
middleware = getattr(settings, 'MIDDLEWARE', [])
for mw in middleware:
    if 'cognito' in mw.lower() or 'auth' in mw.lower():
        print('- Found:', mw)

print('\\n=== Permission Classes Available ===')
try:
    from backend.cognito_permissions import (
        CognitoAdminOnlyPermission,
        CognitoCookOnlyPermission, 
        CognitoOrderStatusPermission,
        CognitoWaiterAndAdminPermission,
        CognitoReadOnlyForNonAdmins
    )
    print('✅ All permission classes imported successfully')
    
    # Test a dummy request simulation
    print('\\n=== Dummy Permission Test ===')
    from django.http import HttpRequest
    from backend.cognito_auth import CognitoUser
    
    # Create a test admin user
    test_user = CognitoUser('test-user', ['administradores'])
    print('Test admin user groups:', test_user.groups)
    print('Test user is_admin():', test_user.is_admin())
    print('Test user is_waiter():', test_user.is_waiter())
    print('Test user is_cook():', test_user.is_cook())
    
except Exception as e:
    print('❌ Error importing permissions:', str(e))
    import traceback
    traceback.print_exc()
" 2>/dev/null || echo "Could not run Django debug"

# Check environment variables in containers
echo -e "\n${YELLOW}4. Container Environment Variables:${NC}"
docker-compose -f "$PROJECT_DIR/docker-compose.ec2.yml" exec -T web env | grep -E "COGNITO|AWS_REGION|USE_COGNITO" | sort

# Test API endpoints manually
echo -e "\n${YELLOW}5. API Endpoint Tests:${NC}"

# Test without authentication (expect 401/403)
echo -e "${BLUE}Testing /api/v1/units/ without auth:${NC}"
API_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" http://localhost:8000/api/v1/units/ 2>/dev/null || echo "HTTPSTATUS:000")
HTTP_STATUS=$(echo $API_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
BODY=$(echo $API_RESPONSE | sed -e 's/HTTPSTATUS:.*//g')
echo "Status: $HTTP_STATUS"
echo "Response: $BODY"

# Test zones endpoint
echo -e "\n${BLUE}Testing /api/v1/zones/ without auth:${NC}"
API_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" http://localhost:8000/api/v1/zones/ 2>/dev/null || echo "HTTPSTATUS:000")
HTTP_STATUS=$(echo $API_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
BODY=$(echo $API_RESPONSE | sed -e 's/HTTPSTATUS:.*//g')
echo "Status: $HTTP_STATUS"
echo "Response: $BODY"

# Check if there are any Django errors
echo -e "\n${YELLOW}6. Django System Check:${NC}"
docker-compose -f "$PROJECT_DIR/docker-compose.ec2.yml" exec -T web python manage.py check 2>/dev/null || echo "Could not run Django check"

# Check Cognito JWT verification
echo -e "\n${YELLOW}7. JWT Verification Test:${NC}"
docker-compose -f "$PROJECT_DIR/docker-compose.ec2.yml" exec -T web python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_ec2')
django.setup()

try:
    from backend.cognito_auth import CognitoJWTAuthentication
    auth = CognitoJWTAuthentication()
    print('✅ CognitoJWTAuthentication class loaded successfully')
    print('User Pool ID:', auth.user_pool_id)
    print('App Client ID:', auth.app_client_id)
    print('Region:', auth.region)
    
    # Test if we can get JWK keys
    try:
        keys = auth.get_jwk_keys()
        print('✅ JWK keys retrieved:', len(keys), 'keys found')
    except Exception as e:
        print('❌ JWK keys error:', str(e))
        
except Exception as e:
    print('❌ Error loading JWT authentication:', str(e))
    import traceback
    traceback.print_exc()
" 2>/dev/null || echo "Could not test JWT verification"

echo -e "\n${GREEN}=== DEBUG COMPLETE ===${NC}"
echo -e "${YELLOW}Common Issues and Solutions:${NC}"
echo -e "1. ${BLUE}JWT Token Missing 'aud' claim${NC}: Check token validation in cognito_auth.py"
echo -e "2. ${BLUE}User not in correct group${NC}: Verify AWS Cognito user group membership"
echo -e "3. ${BLUE}Permission class mismatch${NC}: Check view permission_classes configuration"
echo -e "4. ${BLUE}Middleware order${NC}: Ensure CognitoJWTMiddleware is before permission checks"
echo -e ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "1. Check your user's group membership in AWS Cognito console"
echo -e "2. Test with a JWT token that includes 'cognito:groups' claim"
echo -e "3. Verify the frontend is sending the Authorization header correctly"