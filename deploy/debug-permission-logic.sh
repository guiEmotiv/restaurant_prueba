#!/bin/bash

# Debug Permission Logic Script
# This script tests the exact permission logic that's failing

echo "🔍 Restaurant Web - Permission Logic Debug"
echo "=========================================="

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

echo -e "${BLUE}=== PERMISSION LOGIC DEEP DIVE ===${NC}"

echo -e "\n${YELLOW}Testing the exact scenario that's failing:${NC}"
docker-compose -f "$PROJECT_DIR/docker-compose.ec2.yml" exec -T web python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_ec2')
django.setup()

from django.http import HttpRequest
from backend.cognito_auth import CognitoUser
from backend.cognito_permissions import CognitoAdminOnlyPermission

print('=== RECREATING THE EXACT FAILING SCENARIO ===\\n')

# Create the exact user that's being created by the token
user = CognitoUser('admin', '', ['administradores'])
print('✅ Created CognitoUser with exact same parameters as token:')
print(f'  - username: {user.username}')
print(f'  - email: {user.email}')
print(f'  - groups: {user.groups}')
print(f'  - is_admin(): {user.is_admin()}')
print(f'  - is_authenticated: {user.is_authenticated}')
print(f'  - hasattr is_authenticated: {hasattr(user, \"is_authenticated\")}')

# Create the exact permission class being used
permission = CognitoAdminOnlyPermission()
print('\\n✅ Created CognitoAdminOnlyPermission instance')

# Create mock request exactly like Django REST Framework does
request = HttpRequest()
request.user = user
request.method = 'GET'

print('\\n=== TESTING PERMISSION LOGIC ===')
print('Testing CognitoAdminOnlyPermission.has_permission()...')

# Test the exact permission check
try:
    result = permission.has_permission(request, None)
    print(f'✅ Permission check completed: {result}')
    
    if result:
        print('✅ Permission GRANTED - User should have access')
    else:
        print('❌ Permission DENIED - This is why you get 403!')
        
    # Let's debug step by step what the permission class is checking
    print('\\n=== DEBUGGING PERMISSION CLASS LOGIC ===')
    
    # Check each condition in CognitoAdminOnlyPermission
    print('Checking conditions in CognitoAdminOnlyPermission:')
    
    print(f'1. request.user exists: {request.user is not None}')
    print(f'2. hasattr(request.user, \"is_authenticated\"): {hasattr(request.user, \"is_authenticated\")}')
    print(f'3. request.user.is_authenticated: {getattr(request.user, \"is_authenticated\", \"NOT_FOUND\")}')
    print(f'4. hasattr(request.user, \"is_admin\"): {hasattr(request.user, \"is_admin\")}')
    print(f'5. request.user.is_admin(): {getattr(request.user, \"is_admin\", lambda: \"NOT_FOUND\")()}')
    
    print('\\n=== STEP BY STEP PERMISSION CHECK ===')
    step1 = request.user is not None
    print(f'Step 1 - User exists: {step1}')
    
    if step1:
        step2 = hasattr(request.user, 'is_authenticated')
        print(f'Step 2 - Has is_authenticated attr: {step2}')
        
        if step2:
            step3 = request.user.is_authenticated
            print(f'Step 3 - Is authenticated: {step3}')
            
            if step3:
                step4 = hasattr(request.user, 'is_admin')
                print(f'Step 4 - Has is_admin attr: {step4}')
                
                if step4:
                    step5 = request.user.is_admin()
                    print(f'Step 5 - Is admin: {step5}')
                    
                    final_result = step1 and step2 and step3 and step4 and step5
                    print(f'\\nFINAL RESULT: {final_result}')
                    
                    if final_result != result:
                        print('⚠️  MISMATCH: Manual calculation differs from permission result!')
                    else:
                        print('✅ Manual calculation matches permission result')
                else:
                    print('❌ FAILED at step 4: User does not have is_admin method')
            else:
                print('❌ FAILED at step 3: User is not authenticated')
        else:
            print('❌ FAILED at step 2: User does not have is_authenticated attribute')
    else:
        print('❌ FAILED at step 1: User does not exist')
        
except Exception as e:
    print(f'❌ Permission check FAILED with error: {e}')
    import traceback
    traceback.print_exc()

print('\\n=== TESTING OTHER USER TYPES ===')

# Test with waiter user
waiter_user = CognitoUser('waiter', '', ['meseros'])
request.user = waiter_user
waiter_result = permission.has_permission(request, None)
print(f'Waiter user permission: {waiter_result} (should be False)')

# Test with cook user  
cook_user = CognitoUser('cook', '', ['cocineros'])
request.user = cook_user
cook_result = permission.has_permission(request, None)
print(f'Cook user permission: {cook_result} (should be False)')

print('\\n=== TESTING DIFFERENT PERMISSION CLASSES ===')

from backend.cognito_permissions import (
    CognitoCookOnlyPermission,
    CognitoOrderStatusPermission,  
    CognitoWaiterAndAdminPermission,
    CognitoReadOnlyForNonAdmins
)

request.user = user  # Back to admin user

permissions_to_test = [
    ('CognitoCookOnlyPermission', CognitoCookOnlyPermission()),
    ('CognitoOrderStatusPermission', CognitoOrderStatusPermission()),
    ('CognitoWaiterAndAdminPermission', CognitoWaiterAndAdminPermission()),
    ('CognitoReadOnlyForNonAdmins', CognitoReadOnlyForNonAdmins())
]

for perm_name, perm_instance in permissions_to_test:
    try:
        perm_result = perm_instance.has_permission(request, None)
        print(f'{perm_name}: {perm_result}')
    except Exception as e:
        print(f'{perm_name}: ERROR - {e}')
" 2>/dev/null || echo "Could not run permission logic test"

echo -e "\n${GREEN}=== PERMISSION LOGIC DEBUG COMPLETE ===${NC}"
echo -e "${YELLOW}Based on the results above:${NC}"
echo -e "- If all steps pass but result is False: Problem in permission class logic"
echo -e "- If a step fails: That's the exact problem"
echo -e "- If there's an exception: Permission class has a bug"