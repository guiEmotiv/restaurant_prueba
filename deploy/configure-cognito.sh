#!/bin/bash

# AWS Cognito Configuration Script
# Safely configures Cognito credentials without exposing sensitive data

echo "🔐 Configuring AWS Cognito..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="/opt/restaurant-web"
BACKEND_ENV="$PROJECT_DIR/backend/.env"
FRONTEND_ENV="$PROJECT_DIR/frontend/.env"

# Function to update or add environment variable
update_env_var() {
    local file="$1"
    local key="$2"
    local value="$3"
    
    if grep -q "^$key=" "$file" 2>/dev/null; then
        # Update existing variable
        sed -i "s/^$key=.*/$key=$value/" "$file"
        echo -e "${BLUE}  ↻ Updated $key in $(basename $file)${NC}"
    else
        # Add new variable
        echo "$key=$value" >> "$file"
        echo -e "${GREEN}  + Added $key to $(basename $file)${NC}"
    fi
}

# Function to configure Cognito interactively
configure_interactive() {
    echo -e "\n${YELLOW}📝 Enter your AWS Cognito configuration:${NC}"
    
    # Get AWS Region
    read -p "AWS Region (e.g., us-west-2): " aws_region
    aws_region=${aws_region:-us-west-2}
    
    # Get User Pool ID
    read -p "Cognito User Pool ID (e.g., us-west-2_xxxxxxxxx): " user_pool_id
    
    # Get App Client ID
    read -p "Cognito App Client ID: " app_client_id
    
    # Validate inputs
    if [[ -z "$user_pool_id" || -z "$app_client_id" ]]; then
        echo -e "${RED}❌ User Pool ID and App Client ID are required!${NC}"
        exit 1
    fi
    
    # Validate format
    if [[ ! "$user_pool_id" =~ ^[a-z0-9-]+_[A-Za-z0-9]+$ ]]; then
        echo -e "${YELLOW}⚠️ User Pool ID format looks incorrect${NC}"
    fi
    
    echo -e "\n${BLUE}📋 Configuration summary:${NC}"
    echo -e "  Region: $aws_region"
    echo -e "  User Pool: ${user_pool_id:0:15}..."
    echo -e "  App Client: ${app_client_id:0:10}..."
    
    read -p "Continue with this configuration? (Y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        echo -e "${YELLOW}Configuration cancelled${NC}"
        exit 0
    fi
    
    # Update backend configuration
    echo -e "\n${YELLOW}📄 Updating backend configuration...${NC}"
    update_env_var "$BACKEND_ENV" "AWS_REGION" "$aws_region"
    update_env_var "$BACKEND_ENV" "COGNITO_USER_POOL_ID" "$user_pool_id"
    update_env_var "$BACKEND_ENV" "COGNITO_APP_CLIENT_ID" "$app_client_id"
    
    # Update frontend configuration
    echo -e "\n${YELLOW}📄 Updating frontend configuration...${NC}"
    update_env_var "$FRONTEND_ENV" "VITE_AWS_REGION" "$aws_region"
    update_env_var "$FRONTEND_ENV" "VITE_AWS_COGNITO_USER_POOL_ID" "$user_pool_id"
    update_env_var "$FRONTEND_ENV" "VITE_AWS_COGNITO_APP_CLIENT_ID" "$app_client_id"
    
    echo -e "\n${GREEN}✅ Cognito configuration updated successfully!${NC}"
    echo -e "${BLUE}💡 Next steps:${NC}"
    echo -e "  1. Create groups 'administradores' and 'meseros' in AWS Cognito Console"
    echo -e "  2. Create users and assign them to groups"
    echo -e "  3. Run: ./deploy/deploy-optimized.sh"
}

# Function to disable Cognito (for testing)
disable_cognito() {
    echo -e "\n${YELLOW}🔒 Disabling Cognito authentication...${NC}"
    
    update_env_var "$BACKEND_ENV" "AWS_REGION" "us-west-2"
    update_env_var "$BACKEND_ENV" "COGNITO_USER_POOL_ID" ""
    update_env_var "$BACKEND_ENV" "COGNITO_APP_CLIENT_ID" ""
    
    update_env_var "$FRONTEND_ENV" "VITE_AWS_REGION" "us-west-2"
    update_env_var "$FRONTEND_ENV" "VITE_AWS_COGNITO_USER_POOL_ID" ""
    update_env_var "$FRONTEND_ENV" "VITE_AWS_COGNITO_APP_CLIENT_ID" ""
    
    echo -e "${GREEN}✅ Cognito authentication disabled${NC}"
    echo -e "${BLUE}💡 The application will run without authentication${NC}"
}

# Main function
main() {
    cd "$PROJECT_DIR" || exit 1
    
    # Ensure .env files exist
    touch "$BACKEND_ENV" "$FRONTEND_ENV"
    
    echo -e "${BLUE}🔐 AWS Cognito Configuration${NC}"
    echo -e "1) Configure Cognito credentials"
    echo -e "2) Disable Cognito (no authentication)"
    echo ""
    read -p "Choose option (1-2): " -n 1 -r choice
    echo ""
    
    case $choice in
        1)
            configure_interactive
            ;;
        2)
            disable_cognito
            ;;
        *)
            echo -e "${RED}Invalid option${NC}"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"