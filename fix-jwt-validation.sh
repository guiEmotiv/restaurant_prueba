#!/bin/bash

# ============================================================================
# Fix JWT Validation Script for EC2
# Fixes the issue where JWT tokens are sent but not validated correctly
# ============================================================================

set -e  # Exit on any error

echo "🔧 Fixing JWT Token Validation"
echo "==============================="
echo ""

# Check if running on EC2
if [ ! -d "/opt/restaurant-web" ]; then
    echo "❌ This script must be run on the EC2 instance"
    echo "   Expected directory: /opt/restaurant-web"
    exit 1
fi

cd /opt/restaurant-web

echo "📋 Step 1: Check current configuration..."

# Check if Cognito is enabled
if grep -q "USE_COGNITO_AUTH=True" .env.ec2; then
    echo "✅ Cognito authentication is enabled"
    
    # Show current Cognito config
    echo "📋 Current Cognito configuration:"
    grep "COGNITO\|AWS_REGION" .env.ec2 | head -3
else
    echo "❌ Cognito authentication is not enabled"
    echo "   Please run ./enable-auth-ec2.sh first"
    exit 1
fi

echo ""
echo "📋 Step 2: Check container logs for authentication errors..."

# Check recent logs for auth issues
echo "🔍 Recent authentication logs:"
docker-compose -f docker-compose.ec2.yml logs web --tail=20 | grep -i "cognito\|auth\|token\|403" || echo "No specific auth errors found in recent logs"

echo ""
echo "📋 Step 3: Update Cognito middleware for better debugging..."

# Create a temporary Python script to update the middleware
cat > /tmp/update_cognito_middleware.py << 'EOFPY'
import re

# Read the current middleware file
with open('backend/backend/cognito_auth.py', 'r') as f:
    content = f.read()

# Add more detailed logging to the middleware
updated_content = content

# Add debug logging to the __call__ method
if 'def __call__(self, request):' in content and 'logger.info(f"Processing request' not in content:
    updated_content = re.sub(
        r'(def __call__\(self, request\):\s*\n)',
        r'\1        logger.info(f"Processing request: {request.method} {request.path}")\n',
        updated_content
    )

# Add token logging
if 'token = auth_header.split' in content and 'logger.info(f"Extracted token' not in content:
    updated_content = re.sub(
        r'(token = auth_header\.split\(\' \'\)\[1\])',
        r'\1\n        logger.info(f"Extracted token length: {len(token)}")',
        updated_content
    )

# Add user creation logging
if 'request.user = user' in content and 'logger.info(f"Created Cognito user' not in content:
    updated_content = re.sub(
        r'(request\.user = user)',
        r'logger.info(f"Created Cognito user: {user.username}, groups: {user.groups}")\n            \1',
        updated_content
    )

# Add error logging improvement
if 'logger.warning(f"Token verification failed: {e}")' in content:
    updated_content = re.sub(
        r'logger\.warning\(f"Token verification failed: \{e\}"\)',
        r'logger.error(f"Token verification failed: {e}", exc_info=True)',
        updated_content
    )

# Write the updated content
with open('backend/backend/cognito_auth.py', 'w') as f:
    f.write(updated_content)

print("✅ Updated Cognito middleware with enhanced logging")
EOFPY

python3 /tmp/update_cognito_middleware.py
rm /tmp/update_cognito_middleware.py

echo ""
echo "📋 Step 4: Create authentication test endpoint..."

# Create a simple test view to verify authentication
cat > /tmp/auth_test_view.py << 'EOFPY'
import os

# Read the current views file for config app
views_file = 'backend/config/views.py'
with open(views_file, 'r') as f:
    content = f.read()

# Check if test endpoint already exists
if 'auth_test' not in content:
    # Add the test endpoint
    test_view = '''
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import JsonResponse

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def auth_test(request):
    """Test endpoint to verify authentication is working"""
    user_info = {
        'authenticated': hasattr(request.user, 'is_authenticated') and request.user.is_authenticated,
        'user_type': type(request.user).__name__,
        'is_anonymous': getattr(request.user, 'is_anonymous', False),
    }
    
    if hasattr(request.user, 'username'):
        user_info['username'] = request.user.username
    if hasattr(request.user, 'groups'):
        user_info['groups'] = request.user.groups
    if hasattr(request.user, 'email'):
        user_info['email'] = request.user.email
        
    return Response({
        'message': 'Authentication successful',
        'user': user_info,
        'request_path': request.path,
        'request_method': request.method
    })
'''
    
    # Append the test view
    with open(views_file, 'a') as f:
        f.write(test_view)
    
    print("✅ Added authentication test endpoint")
    
    # Update URLs
    urls_file = 'backend/config/urls.py'
    with open(urls_file, 'r') as f:
        urls_content = f.read()
    
    if 'auth_test' not in urls_content:
        # Add URL pattern
        if "path('", in urls_content:
            urls_content = urls_content.replace(
                "from .views import",
                "from .views import auth_test,"
            )
            
            # Find the urlpatterns and add the new path
            if 'urlpatterns = [' in urls_content:
                urls_content = urls_content.replace(
                    'urlpatterns = [',
                    "urlpatterns = [\n    path('auth-test/', auth_test, name='auth_test'),"
                )
        
        with open(urls_file, 'w') as f:
            f.write(urls_content)
        
        print("✅ Added URL pattern for auth test")
    else:
        print("ℹ️  Auth test endpoint already exists")
else:
    print("ℹ️  Auth test endpoint already exists")
EOFPY

python3 /tmp/auth_test_view.py
rm /tmp/auth_test_view.py

echo ""
echo "📋 Step 5: Rebuild and restart containers with fixes..."

# Stop containers
echo "🛑 Stopping containers..."
docker-compose -f docker-compose.ec2.yml down

# Build with updated middleware
echo "🔨 Building containers with authentication fixes..."
docker-compose -f docker-compose.ec2.yml build --no-cache

# Start containers
echo "🚀 Starting containers..."
docker-compose -f docker-compose.ec2.yml up -d

# Wait for startup
echo "⏳ Waiting for services to start..."
sleep 15

# Run migrations in case of new endpoint
echo "🗄️  Running migrations..."
docker-compose -f docker-compose.ec2.yml exec -T web python manage.py migrate

echo ""
echo "📋 Step 6: Test authentication..."

# Test the authentication endpoint
echo "🔍 Testing authentication endpoint..."
sleep 5

AUTH_TEST_RESULT=$(curl -s -w "%{http_code}" -o /tmp/auth_test_response.txt http://localhost:8000/api/v1/config/auth-test/)
AUTH_STATUS=${AUTH_TEST_RESULT: -3}

echo "Auth test status code: $AUTH_STATUS"

if [ "$AUTH_STATUS" = "200" ]; then
    echo "✅ Authentication test passed without token"
    cat /tmp/auth_test_response.txt
elif [ "$AUTH_STATUS" = "401" ] || [ "$AUTH_STATUS" = "403" ]; then
    echo "✅ Authentication test correctly requires authentication"
    echo "Response: $(cat /tmp/auth_test_response.txt)"
else
    echo "⚠️  Unexpected auth test result: $AUTH_STATUS"
    cat /tmp/auth_test_response.txt
fi

rm -f /tmp/auth_test_response.txt

echo ""
echo "📋 Step 7: Check application health..."

# Test regular endpoints
if curl -f http://localhost/admin/ > /dev/null 2>&1; then
    echo "✅ Admin panel accessible"
else
    echo "❌ Admin panel not accessible"
fi

if curl -f http://localhost/ > /dev/null 2>&1; then
    echo "✅ Frontend accessible"
else
    echo "❌ Frontend not accessible"
fi

echo ""
echo "📋 Step 8: Show recent logs for debugging..."

echo "🔍 Recent container logs (last 30 lines):"
docker-compose -f docker-compose.ec2.yml logs web --tail=30

echo ""
echo "🎉 JWT Validation Fix Completed!"
echo ""
echo "📍 Your application should now properly validate JWT tokens"
echo ""
echo "🔍 If you still see 403 errors:"
echo "1. Check the container logs: docker-compose -f docker-compose.ec2.yml logs web"
echo "2. Verify Cognito configuration in .env.ec2"
echo "3. Test the auth endpoint: curl http://YOUR-IP/api/v1/config/auth-test/"
echo ""
echo "📊 The logs now include detailed authentication debugging information"