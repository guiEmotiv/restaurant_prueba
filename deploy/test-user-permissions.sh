#!/bin/bash

# Test User Permissions Script
# This script helps test specific user permission scenarios

echo "🧪 Restaurant Web - User Permissions Test"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="/opt/restaurant-web"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

echo -e "${BLUE}=== USER PERMISSION SCENARIOS TEST ===${NC}"

# Test different user scenarios
echo -e "\n${YELLOW}Testing Different User Permission Scenarios:${NC}"
docker-compose -f "$PROJECT_DIR/docker-compose.ec2.yml" exec -T web python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_ec2')
django.setup()

from backend.cognito_auth import CognitoUser
from backend.cognito_permissions import (
    CognitoAdminOnlyPermission,
    CognitoCookOnlyPermission, 
    CognitoOrderStatusPermission,
    CognitoWaiterAndAdminPermission,
    CognitoReadOnlyForNonAdmins
)
from django.http import HttpRequest

print('=== TESTING USER PERMISSION SCENARIOS ===\\n')

# Create test users
admin_user = CognitoUser('admin-test', 'admin@test.com', ['administradores'])
waiter_user = CognitoUser('waiter-test', 'waiter@test.com', ['meseros'])
cook_user = CognitoUser('cook-test', 'cook@test.com', ['cocineros'])
multi_user = CognitoUser('multi-test', 'multi@test.com', ['administradores', 'meseros'])

users = [
    ('ADMIN', admin_user),
    ('WAITER', waiter_user), 
    ('COOK', cook_user),
    ('MULTI-ROLE', multi_user)
]

permissions = [
    ('CognitoAdminOnlyPermission', CognitoAdminOnlyPermission()),
    ('CognitoCookOnlyPermission', CognitoCookOnlyPermission()),
    ('CognitoOrderStatusPermission', CognitoOrderStatusPermission()),
    ('CognitoWaiterAndAdminPermission', CognitoWaiterAndAdminPermission()),
    ('CognitoReadOnlyForNonAdmins', CognitoReadOnlyForNonAdmins())
]

# Test each user against each permission
print('| User Role    | Permission Class                | GET | POST | Result |')
print('|-------------|--------------------------------|-----|------|--------|')

for user_type, user in users:
    for perm_name, permission in permissions:
        # Create mock requests
        get_request = HttpRequest()
        get_request.method = 'GET'
        get_request.user = user
        
        post_request = HttpRequest()
        post_request.method = 'POST'
        post_request.user = user
        
        # Test permissions
        get_allowed = permission.has_permission(get_request, None)
        post_allowed = permission.has_permission(post_request, None)
        
        # Determine result
        if get_allowed and post_allowed:
            result = '✅ FULL'
        elif get_allowed and not post_allowed:
            result = '📖 READ'
        elif not get_allowed and not post_allowed:
            result = '❌ NONE'
        else:
            result = '🤔 PARTIAL'
            
        print(f'| {user_type:<11} | {perm_name:<30} | {\"✅\" if get_allowed else \"❌\":>3} | {\"✅\" if post_allowed else \"❌\":>4} | {result:<6} |')

print('\\n=== USER DETAILS ===')
for user_type, user in users:
    print(f'\\n{user_type} USER:')
    print(f'  - Username: {user.username}')
    print(f'  - Groups: {user.groups}')
    print(f'  - is_admin(): {user.is_admin()}')
    print(f'  - is_waiter(): {user.is_waiter()}')
    print(f'  - is_cook(): {user.is_cook()}')
    print(f'  - is_authenticated: {user.is_authenticated}')
    print(f'  - is_active: {user.is_active}')
    print(f'  - is_staff: {user.is_staff}')
    print(f'  - is_superuser: {user.is_superuser}')

print('\\n=== EXPECTED BEHAVIOR ===')
print('✅ FULL = Full access (GET + POST/PUT/DELETE)')
print('📖 READ = Read-only access (GET only)')  
print('❌ NONE = No access')
print('🤔 PARTIAL = Unexpected behavior')

print('\\n=== RECOMMENDATIONS ===')
print('1. Admin users should have FULL access to Admin-only permissions')
print('2. Waiters should have FULL access to WaiterAndAdmin permissions')
print('3. Cooks should have FULL access to Cook and OrderStatus permissions')
print('4. All users should have READ access to ReadOnlyForNonAdmins permissions')
print('5. Only Admins should have FULL access to ReadOnlyForNonAdmins permissions')

print('\\n=== YOUR USER TROUBLESHOOTING ===')
print('If you are getting \"No tiene permiso\" errors:')
print('1. Check that your user is in the \"administradores\" group in AWS Cognito')
print('2. Verify your JWT token contains cognito:groups claim with [\"administradores\"]')
print('3. Check browser DevTools > Application > Local Storage for auth tokens')
print('4. Try logging out and logging back in to refresh the token')
" 2>/dev/null || echo "Could not run permission test"

echo -e "\n${GREEN}=== PERMISSION TEST COMPLETE ===${NC}"
echo -e "${YELLOW}If your user should be an admin but shows as having no permissions:${NC}"
echo -e "1. ${BLUE}Check AWS Cognito Console > User Pool > Users > [Your User] > Groups${NC}"
echo -e "2. ${BLUE}Ensure user is in 'administradores' group${NC}"
echo -e "3. ${BLUE}If not in group, add user to 'administradores' group${NC}"
echo -e "4. ${BLUE}Log out and log back in to get fresh token${NC}"