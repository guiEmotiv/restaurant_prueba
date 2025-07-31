#!/bin/bash

# ============================================================================
# Debug JWT Tokens Script
# Helps diagnose JWT token validation issues
# ============================================================================

set -e  # Exit on any error

echo "🔍 JWT Token Debugging"
echo "====================="
echo ""

# Check if running on EC2
if [ ! -d "/opt/restaurant-web" ]; then
    echo "❌ This script must be run on the EC2 instance"
    echo "   Expected directory: /opt/restaurant-web"
    exit 1
fi

cd /opt/restaurant-web

echo "📋 Step 1: Check Cognito configuration..."

if [ -f ".env.ec2" ]; then
    echo "✅ Backend configuration (.env.ec2):"
    echo "  USE_COGNITO_AUTH: $(grep USE_COGNITO_AUTH .env.ec2 | cut -d'=' -f2)"
    echo "  AWS_REGION: $(grep AWS_REGION .env.ec2 | cut -d'=' -f2)"
    echo "  USER_POOL_ID: $(grep COGNITO_USER_POOL_ID .env.ec2 | cut -d'=' -f2 | head -c 20)..."
    echo "  APP_CLIENT_ID: $(grep COGNITO_APP_CLIENT_ID .env.ec2 | cut -d'=' -f2 | head -c 15)..."
else
    echo "❌ .env.ec2 not found"
fi

if [ -f "frontend/.env.production" ]; then
    echo "✅ Frontend configuration (.env.production):"
    echo "  AWS_REGION: $(grep VITE_AWS_REGION frontend/.env.production | cut -d'=' -f2)"
    echo "  USER_POOL_ID: $(grep VITE_AWS_COGNITO_USER_POOL_ID frontend/.env.production | cut -d'=' -f2 | head -c 20)..."
    echo "  APP_CLIENT_ID: $(grep VITE_AWS_COGNITO_APP_CLIENT_ID frontend/.env.production | cut -d'=' -f2 | head -c 15)..."
else
    echo "❌ frontend/.env.production not found"
fi

echo ""
echo "📋 Step 2: Check AWS Cognito connectivity..."

# Test if we can reach AWS Cognito
USER_POOL_ID=$(grep COGNITO_USER_POOL_ID .env.ec2 | cut -d'=' -f2)
AWS_REGION=$(grep AWS_REGION .env.ec2 | cut -d'=' -f2)

if [ "$USER_POOL_ID" != "us-east-1_XXXXXXXXX" ] && [ "$AWS_REGION" = "us-east-1" ]; then
    echo "🔍 Testing Cognito JWKS endpoint connectivity..."
    JWKS_URL="https://cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json"
    
    if curl -s --connect-timeout 10 "$JWKS_URL" > /tmp/jwks_test.json; then
        if grep -q "keys" /tmp/jwks_test.json; then
            echo "✅ JWKS endpoint accessible and contains keys"
            echo "   Keys found: $(cat /tmp/jwks_test.json | grep -o '"kid"' | wc -l)"
        else
            echo "❌ JWKS endpoint returned invalid response"
            echo "   Response: $(head -c 200 /tmp/jwks_test.json)"
        fi
        rm -f /tmp/jwks_test.json
    else
        echo "❌ Cannot connect to JWKS endpoint: $JWKS_URL"
    fi
else
    echo "⚠️  Skipping JWKS test - using placeholder values"
fi

echo ""
echo "📋 Step 3: Check container status and logs..."

# Check if containers are running
echo "🐳 Container status:"
docker-compose -f docker-compose.ec2.yml ps

echo ""
echo "🔍 Recent authentication-related logs:"
docker-compose -f docker-compose.ec2.yml logs web --tail=50 | grep -i "auth\|cognito\|token\|403\|401\|jwt" | tail -20 || echo "No recent auth logs found"

echo ""
echo "📋 Step 4: Test API endpoints directly..."

echo "🔍 Testing backend API health:"

# Test admin endpoint (should work)
ADMIN_STATUS=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:8000/admin/)
echo "  Admin endpoint: HTTP $ADMIN_STATUS"

# Test API endpoint that requires auth
API_STATUS=$(curl -s -w "%{http_code}" -o /tmp/api_test.txt http://localhost:8000/api/v1/units/)
echo "  Units API endpoint: HTTP $API_STATUS"

if [ "$API_STATUS" = "403" ]; then
    echo "    Response: $(cat /tmp/api_test.txt)"
elif [ "$API_STATUS" = "200" ]; then
    echo "    ✅ API endpoint accessible (auth might be disabled)"
fi

rm -f /tmp/api_test.txt

echo ""
echo "📋 Step 5: Verify middleware configuration..."

# Check if middleware is properly loaded
echo "🔍 Checking Django middleware configuration:"
docker-compose -f docker-compose.ec2.yml exec -T web python -c "
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_ec2')
import django
django.setup()
from django.conf import settings

print('Middleware configuration:')
for i, middleware in enumerate(settings.MIDDLEWARE):
    marker = '✅' if 'cognito' in middleware.lower() else '  '
    print(f'{marker} {i+1}. {middleware}')

print(f'\\nUSE_COGNITO_AUTH: {getattr(settings, \"USE_COGNITO_AUTH\", \"Not set\")}')
print(f'COGNITO_USER_POOL_ID: {getattr(settings, \"COGNITO_USER_POOL_ID\", \"Not set\")}')
print(f'COGNITO_APP_CLIENT_ID: {getattr(settings, \"COGNITO_APP_CLIENT_ID\", \"Not set\")[:15]}...')
"

echo ""
echo "📋 Step 6: Test Cognito middleware directly..."

# Create a test script to verify token handling
cat > /tmp/test_cognito_middleware.py << 'EOFPY'
import os
import sys
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_ec2')

import django
django.setup()

try:
    from backend.cognito_auth import CognitoAuthenticationMiddleware
    print("✅ Cognito middleware can be imported")
    
    # Test middleware initialization
    def dummy_response(request):
        return "OK"
    
    middleware = CognitoAuthenticationMiddleware(dummy_response)
    print("✅ Cognito middleware can be initialized")
    
    # Test JWKS endpoint access
    try:
        from django.conf import settings
        user_pool_id = settings.COGNITO_USER_POOL_ID
        region = settings.AWS_REGION
        
        if user_pool_id and region and not user_pool_id.endswith('XXXXXXXXX'):
            public_key = middleware.get_public_key('test-kid')
            print(f"❌ get_public_key test failed as expected (test-kid not found)")
        else:
            print("⚠️  Cannot test JWKS - using placeholder configuration")
            
    except Exception as e:
        if "not found for kid" in str(e):
            print("✅ JWKS endpoint accessible (test key not found as expected)")
        else:
            print(f"❌ JWKS endpoint error: {e}")
            
except ImportError as e:
    print(f"❌ Cannot import Cognito middleware: {e}")
except Exception as e:
    print(f"❌ Cognito middleware error: {e}")
EOFPY

echo "🔍 Testing Cognito middleware:"
docker-compose -f docker-compose.ec2.yml exec -T web python /tmp/test_cognito_middleware.py

echo ""
echo "📋 Debugging Summary"
echo "===================="

echo "🔍 If you're still seeing 403 errors, the issue might be:"
echo ""
echo "1. 🔑 JWT Token Format:"
echo "   - Frontend sends: 'Bearer <token>'"
echo "   - Backend expects: 'Bearer <token>'"
echo "   - Check browser dev tools for actual token format"
echo ""
echo "2. 🌐 CORS Issues:"
echo "   - Verify CORS_ALLOWED_ORIGINS includes your domain"
echo "   - Check if preflight requests are failing"
echo ""
echo "3. ⚙️  Middleware Order:"
echo "   - CognitoAuthenticationMiddleware should be after CORS"
echo "   - Check middleware configuration above"
echo ""
echo "4. 🔐 Cognito Configuration:"
echo "   - Verify User Pool ID and App Client ID are correct"
echo "   - Check if users exist and are in correct groups"
echo ""
echo "5. 🕒 Token Expiration:"
echo "   - JWT tokens expire after 1 hour by default"
echo "   - Try refreshing the page and logging in again"
echo ""
echo "🛠️  To fix the issue, run:"
echo "   ./fix-jwt-validation.sh"
echo ""
echo "📊 To see detailed logs:"
echo "   docker-compose -f docker-compose.ec2.yml logs web -f"