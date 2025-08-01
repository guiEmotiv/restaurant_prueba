#!/bin/bash

# Toggle Authentication Script
# Enables or disables AWS Cognito authentication

echo "🔐 Toggle Authentication Settings"
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="/opt/restaurant-web"
FRONTEND_DIR="$PROJECT_DIR/frontend"

cd "$PROJECT_DIR"

# Check current auth status
check_auth_status() {
    if [ -f "$FRONTEND_DIR/.env.production" ]; then
        if grep -q "VITE_AWS_COGNITO_USER_POOL_ID=us-west-2_" "$FRONTEND_DIR/.env.production"; then
            echo "ENABLED"
        else
            echo "DISABLED"
        fi
    else
        echo "UNKNOWN"
    fi
}

current_status=$(check_auth_status)
echo -e "${BLUE}Current authentication status: $current_status${NC}"

echo -e "\n${BLUE}🎯 What would you like to do?${NC}"
echo "1) Enable AWS Cognito authentication"
echo "2) Disable authentication (bypass for testing)"
echo "3) Check current status"
echo ""
read -p "Choose option (1-3): " -n 1 -r choice
echo ""

case $choice in
    1)
        echo -e "\n${YELLOW}🔐 Enabling AWS Cognito authentication...${NC}"
        
        # Create production env with Cognito enabled
        cat > "$FRONTEND_DIR/.env.production" << EOF
# Frontend Production Environment Variables
# These are baked into the build at compile time

# API Configuration
VITE_API_URL=http://localhost:8000/api/v1

# AWS Cognito Configuration - ENABLED
VITE_AWS_REGION=us-west-2
VITE_AWS_COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI
VITE_AWS_COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0
EOF
        
        echo -e "${GREEN}✅ AWS Cognito authentication ENABLED${NC}"
        echo -e "${YELLOW}💡 You need to rebuild the frontend for changes to take effect${NC}"
        echo -e "${BLUE}Run: sudo ./deploy/deploy-optimized.sh${NC}"
        ;;
        
    2)
        echo -e "\n${YELLOW}🔓 Disabling authentication (bypass mode)...${NC}"
        
        # Create production env with Cognito disabled
        cat > "$FRONTEND_DIR/.env.production" << EOF
# Frontend Production Environment Variables
# These are baked into the build at compile time

# API Configuration
VITE_API_URL=http://localhost:8000/api/v1

# AWS Cognito Configuration - DISABLED FOR TESTING
# VITE_AWS_REGION=us-west-2
# VITE_AWS_COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI
# VITE_AWS_COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0
EOF
        
        echo -e "${GREEN}✅ Authentication DISABLED (bypass mode)${NC}"
        echo -e "${YELLOW}⚠️ This is for testing only - anyone can access the application${NC}"
        echo -e "${YELLOW}💡 You need to rebuild the frontend for changes to take effect${NC}"
        echo -e "${BLUE}Run: sudo ./deploy/deploy-optimized.sh${NC}"
        ;;
        
    3)
        echo -e "\n${BLUE}📊 Current authentication status: $current_status${NC}"
        
        if [ -f "$FRONTEND_DIR/.env.production" ]; then
            echo -e "\n${BLUE}Configuration details:${NC}"
            grep -E "(VITE_AWS_|#.*VITE_AWS_)" "$FRONTEND_DIR/.env.production" | sed 's/^/  /'
        fi
        ;;
        
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

echo -e "\n${GREEN}🎉 Authentication settings updated!${NC}"