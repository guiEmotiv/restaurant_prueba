#!/bin/bash

# ============================================================================
# Debug Cook User - Verificar configuración del usuario cocinero
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Debug Cook User Configuration${NC}"
echo "=============================================="

# Load environment variables
if [ -f "/opt/restaurant-web/.env.ec2" ]; then
    set -a
    source /opt/restaurant-web/.env.ec2
    set +a
    echo -e "${GREEN}✅ Loaded .env.ec2 configuration${NC}"
else
    echo -e "${RED}❌ .env.ec2 not found${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}📋 Environment Configuration:${NC}"
echo "AWS_REGION: $VITE_AWS_REGION"
echo "USER_POOL_ID: $VITE_AWS_COGNITO_USER_POOL_ID"
echo "APP_CLIENT_ID: $VITE_AWS_COGNITO_APP_CLIENT_ID"

echo ""
echo -e "${BLUE}🔍 Checking Cognito Groups...${NC}"

# Get all groups in the user pool
echo "Available groups in user pool:"
aws cognito-idp list-groups \
    --user-pool-id "$VITE_AWS_COGNITO_USER_POOL_ID" \
    --region "$VITE_AWS_REGION" \
    --query 'Groups[].{GroupName:GroupName,Description:Description}' \
    --output table

echo ""
echo -e "${BLUE}👨‍🍳 Checking Cook Users...${NC}"

# List all users and their groups
echo "Users and their groups:"
aws cognito-idp list-users \
    --user-pool-id "$VITE_AWS_COGNITO_USER_POOL_ID" \
    --region "$VITE_AWS_REGION" \
    --query 'Users[?Enabled==`true`].{Username:Username,Email:Attributes[?Name==`email`].Value|[0],Status:UserStatus}' \
    --output table

echo ""
echo -e "${BLUE}🔍 Checking specific group memberships...${NC}"

# Check users in cocineros group
echo "Users in 'cocineros' group:"
aws cognito-idp list-users-in-group \
    --user-pool-id "$VITE_AWS_COGNITO_USER_POOL_ID" \
    --group-name "cocineros" \
    --region "$VITE_AWS_REGION" \
    --query 'Users[].{Username:Username,Email:Attributes[?Name==`email`].Value|[0]}' \
    --output table 2>/dev/null || echo "No users found in 'cocineros' group or group doesn't exist"

echo ""
echo "Users in 'administradores' group:"
aws cognito-idp list-users-in-group \
    --user-pool-id "$VITE_AWS_COGNITO_USER_POOL_ID" \
    --group-name "administradores" \
    --region "$VITE_AWS_REGION" \
    --query 'Users[].{Username:Username,Email:Attributes[?Name==`email`].Value|[0]}' \
    --output table 2>/dev/null || echo "No users found in 'administradores' group"

echo ""
echo "Users in 'meseros' group:"
aws cognito-idp list-users-in-group \
    --user-pool-id "$VITE_AWS_COGNITO_USER_POOL_ID" \
    --group-name "meseros" \
    --region "$VITE_AWS_REGION" \
    --query 'Users[].{Username:Username,Email:Attributes[?Name==`email`].Value|[0]}' \
    --output table 2>/dev/null || echo "No users found in 'meseros' group"

echo ""
echo -e "${BLUE}💡 Frontend Debug Instructions:${NC}"
echo "1. Login with the cook user"
echo "2. Open browser console (F12)"
echo "3. Look for these debug messages:"
echo "   - '🔍 User groups from token:'"
echo "   - '✅ User is cook' or other role messages"
echo "   - Check sessionStorage: sessionStorage.getItem('auth-debug-logs')"

echo ""
echo -e "${BLUE}🔧 If cook user shows as admin, possible causes:${NC}"
echo "1. User is not in 'cocineros' group in Cognito"
echo "2. JWT token doesn't contain 'cognito:groups' claim"
echo "3. Token is cached and needs refresh (logout/login)"
echo "4. Group name mismatch (check exact spelling)"

echo ""
echo -e "${GREEN}✅ Debug complete. Check the results above.${NC}"