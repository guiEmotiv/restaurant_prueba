#!/bin/bash

# Debug Frontend Token Script
# This script helps debug what token the frontend is sending

echo "🔍 Restaurant Web - Frontend Token Debug"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

DOMAIN="xn--elfogndedonsoto-zrb.com"
PROJECT_DIR="/opt/restaurant-web"

echo -e "${BLUE}=== FRONTEND TOKEN ANALYSIS ===${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

echo -e "\n${YELLOW}1. Current Frontend Build Check:${NC}"
if [ -f "$PROJECT_DIR/frontend/dist/index.html" ]; then
    echo -e "✅ Frontend build exists"
    echo -e "Build size: $(du -sh $PROJECT_DIR/frontend/dist | cut -f1)"
else
    echo -e "❌ Frontend build not found"
fi

echo -e "\n${YELLOW}2. Frontend Environment Variables:${NC}"
if [ -f "$PROJECT_DIR/frontend/.env.production" ]; then
    echo -e "✅ Frontend .env.production found:"
    cat "$PROJECT_DIR/frontend/.env.production"
else
    echo -e "❌ Frontend .env.production not found"
fi

echo -e "\n${YELLOW}3. Test API Request Simulation:${NC}"
echo -e "${BLUE}Testing what happens when we call API from frontend domain...${NC}"

# Simulate a request from the frontend with a test token
echo -e "\n${BLUE}Simulating request with access token (what frontend should send):${NC}"
ACCESS_TOKEN="eyJraWQiOiJITUJ2N0xhQ3VGanVFM21Wekduek5JbmJiZjFZQ2ZIXC9yZUFBRnRZd0ttQT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxODYxZDM2MC05MGQxLTcwM2MtZjIxYi05NzY0NmVlMjA1OTIiLCJjb2duaXRvOmdyb3VwcyI6WyJhZG1pbmlzdHJhZG9yZXMiXSwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLnVzLXdlc3QtMi5hbWF6b25hd3MuY29tXC91cy13ZXN0LTJfYmRDd0Y2MFpJIiwiY2xpZW50X2lkIjoiNGk5aHJkN3NyZ2JxYnR1bjA5cDQzbmNmbjAiLCJvcmlnaW5fanRpIjoiNDUwMDRkYTktN2RjMS00NTZlLWJhMmUtZWIzMTEyYzE0MTkxIiwiZXZlbnRfaWQiOiJiOGZkZmZhNi0zYTQ5LTRhOTQtYjg2Ni1iYjEzNmZkOTQ0MzYiLCJ0b2tlbl91c2UiOiJhY2Nlc3MiLCJzY29wZSI6ImF3cy5jb2duaXRvLnNpZ25pbi51c2VyLmFkbWluIiwiYXV0aF90aW1lIjoxNzU0MDI2NDk1LCJleHAiOjE3NTQwMzAwOTUsImlhdCI6MTc1NDAyNjQ5NSwianRpIjoiMjY0MTgwNTEtZWI2Yy00YjU0LWI2MjctODZmNjhlMzkwMjNjIiwidXNlcm5hbWUiOiJhZG1pbiJ9.Z00F7EUZiNlKVyZi6Owkd9j6CAk5LPzG9yEV8pbQbFKePGNVx6CJDHiImu-yxtPMd2UPY5FtYmg1GbZ0ho1LxG-CAXp5Tur14EyBW-ZgFEPG6BcX3IJAHsOJrW5jln908rLh_HYf3j_z1bHQJ6dgVL1b3iYacN8sL6D9UmR80V5iQg9Aq5VZHl_gqKBa_CJJlMHrrbjdE-OGqKplgo_ySV9vJKJ2qs58Z-mOk5n3PH437iqxIKKb8xs8cCLstLqUDi8KoZBN3v4EofkDOG1rv1yWI5cTqnrecqhlx5I57O1VkrjU3ROAudR6aQuuRWTGPKjiazX_Kw1gisOxvIRPzg"

echo -e "Testing /api/v1/units/ with ACCESS TOKEN:"
API_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    http://localhost:8000/api/v1/units/ 2>/dev/null || echo "HTTPSTATUS:000")

HTTP_STATUS=$(echo $API_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
BODY=$(echo $API_RESPONSE | sed -e 's/HTTPSTATUS:.*//g')

echo -e "Status: ${HTTP_STATUS}"
if [ ${#BODY} -gt 200 ]; then
    echo -e "Response: ${BODY:0:200}... (truncated)"
else
    echo -e "Response: $BODY"
fi

echo -e "\n${BLUE}Testing /api/v1/zones/ with ACCESS TOKEN:${NC}"
API_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    http://localhost:8000/api/v1/zones/ 2>/dev/null || echo "HTTPSTATUS:000")

HTTP_STATUS=$(echo $API_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
BODY=$(echo $API_RESPONSE | sed -e 's/HTTPSTATUS:.*//g')

echo -e "Status: ${HTTP_STATUS}"
if [ ${#BODY} -gt 200 ]; then
    echo -e "Response: ${BODY:0:200}... (truncated)"
else
    echo -e "Response: $BODY"
fi

echo -e "\n${YELLOW}4. Decode Token Information:${NC}"
docker-compose -f "$PROJECT_DIR/docker-compose.ec2.yml" exec -T web python -c "
import os
import django
import jwt
import json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_ec2')
django.setup()

access_token = 'eyJraWQiOiJITUJ2N0xhQ3VGanVFM21Wekduek5JbmJiZjFZQ2ZIXC9yZUFBRnRZd0ttQT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxODYxZDM2MC05MGQxLTcwM2MtZjIxYi05NzY0NmVlMjA1OTIiLCJjb2duaXRvOmdyb3VwcyI6WyJhZG1pbmlzdHJhZG9yZXMiXSwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLnVzLXdlc3QtMi5hbWF6b25hd3MuY29tXC91cy13ZXN0LTJfYmRDd0Y2MFpJIiwiY2xpZW50X2lkIjoiNGk5aHJkN3NyZ2JxYnR1bjA5cDQzbmNmbjAiLCJvcmlnaW5fanRpIjoiNDUwMDRkYTktN2RjMS00NTZlLWJhMmUtZWIzMTEyYzE0MTkxIiwiZXZlbnRfaWQiOiJiOGZkZmZhNi0zYTQ5LTRhOTQtYjg2Ni1iYjEzNmZkOTQ0MzYiLCJ0b2tlbl91c2UiOiJhY2Nlc3MiLCJzY29wZSI6ImF3cy5jb2duaXRvLnNpZ25pbi51c2VyLmFkbWluIiwiYXV0aF90aW1lIjoxNzU0MDI2NDk1LCJleHAiOjE3NTQwMzAwOTUsImlhdCI6MTc1NDAyNjQ5NSwianRpIjoiMjY0MTgwNTEtZWI2Yy00YjU0LWI2MjctODZmNjhlMzkwMjNjIiwidXNlcm5hbWUiOiJhZG1pbiJ9'

print('=== ACCESS TOKEN ANALYSIS ===')
try:
    # Decode without verification to see payload
    payload = jwt.decode(access_token, options={'verify_signature': False})
    print('✅ Token decoded successfully')
    print('Username:', payload.get('username', 'N/A'))
    print('Groups:', payload.get('cognito:groups', []))
    print('Token Use:', payload.get('token_use', 'N/A'))
    print('Client ID:', payload.get('client_id', 'N/A'))
    print('Issuer:', payload.get('iss', 'N/A'))
    
    # Check expiry
    import time
    exp = payload.get('exp', 0)
    current_time = int(time.time())
    if exp > current_time:
        print('✅ Token is VALID (not expired)')
        print(f'Expires in: {exp - current_time} seconds')
    else:
        print('❌ Token is EXPIRED')
        print(f'Expired {current_time - exp} seconds ago')
        
except Exception as e:
    print('❌ Error decoding token:', str(e))

print('\\n=== BACKEND TOKEN VERIFICATION TEST ===')
try:
    from backend.cognito_auth import CognitoAuthenticationMiddleware
    middleware = CognitoAuthenticationMiddleware(None)
    
    # Try to verify the real token
    user = middleware.verify_cognito_token(access_token)
    print('✅ Token verification SUCCESS')
    print('Verified user:', user.username)
    print('Verified groups:', user.groups)
    print('Is admin:', user.is_admin())
    
except Exception as e:
    print('❌ Token verification FAILED:', str(e))
" 2>/dev/null || echo "Could not analyze token"

echo -e "\n${YELLOW}5. Backend Logs During Token Verification:${NC}"
echo -e "${BLUE}Recent backend logs (last 30 lines):${NC}"
docker-compose -f "$PROJECT_DIR/docker-compose.ec2.yml" logs --tail=30 web | grep -E "Token|auth|Cognito|permission|admin|401|403" || echo "No relevant logs found"

echo -e "\n${GREEN}=== TOKEN DEBUG COMPLETE ===${NC}"
echo -e "${YELLOW}ANALYSIS:${NC}"
echo -e "✅ Your token contains the correct group: ['administradores']"
echo -e "✅ Your token is an ACCESS TOKEN (correct for API calls)"
echo -e "✅ Your token has the correct client_id and issuer"
echo -e ""
echo -e "${YELLOW}IF the test above shows 200 OK:${NC}"
echo -e "  → The backend correctly recognizes your admin token"
echo -e "  → Problem is in frontend not sending the token correctly"
echo -e ""
echo -e "${YELLOW}IF the test above shows 403 Forbidden:${NC}"
echo -e "  → The backend receives the token but permission logic has an issue"
echo -e ""
echo -e "${YELLOW}IF the test above shows 401 Unauthorized:${NC}"
echo -e "  → The backend is not processing the token correctly"
echo -e ""
echo -e "${BLUE}Next step: Check frontend token sending logic${NC}"