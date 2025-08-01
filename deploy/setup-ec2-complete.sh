#!/bin/bash

# Complete EC2 Setup Script
# Master script to set up the entire restaurant web application

echo "🚀 Complete EC2 Setup for Restaurant Web Application"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="/opt/restaurant-web"

echo -e "${BLUE}📍 Running from: $SCRIPT_DIR${NC}"
echo -e "${BLUE}📁 Project directory: $PROJECT_DIR${NC}"

# Function to run script with error handling
run_script() {
    local script_name="$1"
    local description="$2"
    
    echo -e "\n${YELLOW}🔧 $description${NC}"
    echo -e "${BLUE}Running: $script_name${NC}"
    
    if [ -f "$SCRIPT_DIR/$script_name" ]; then
        if bash "$SCRIPT_DIR/$script_name"; then
            echo -e "${GREEN}✅ $description completed${NC}"
        else
            echo -e "${RED}❌ $description failed${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ Script not found: $script_name${NC}"
        exit 1
    fi
}

# Function to show menu
show_menu() {
    echo -e "\n${BLUE}🎯 What would you like to do?${NC}"
    echo "1) Complete setup (recommended for first time)"
    echo "2) Quick cleanup and deploy"
    echo "3) Only cleanup disk space"
    echo "4) Only configure Cognito"
    echo "5) Only deploy application"
    echo "6) Setup Node.js version"
    echo "7) Setup environment (.env.ec2)"
    echo "8) Toggle authentication (enable/disable)"
    echo "9) Ultra cleanup (7GB optimization)"
    echo "10) Setup minimal domain (no SSL)"
    echo ""
    read -p "Choose option (1-10): " -n 2 -r choice
    echo ""
    return $choice
}

# Function for complete setup
complete_setup() {
    echo -e "\n${YELLOW}🔄 Starting complete setup...${NC}"
    
    run_script "cleanup-ec2.sh" "Cleaning up system"
    run_script "setup-node-version.sh" "Setting up Node.js version"
    run_script "configure-cognito.sh" "Configuring AWS Cognito"
    run_script "deploy-optimized.sh" "Deploying application"
    
    echo -e "\n${GREEN}🎉 Complete setup finished!${NC}"
}

# Function for quick deploy
quick_deploy() {
    echo -e "\n${YELLOW}⚡ Starting quick cleanup and deploy...${NC}"
    
    run_script "cleanup-ec2.sh" "Cleaning up system"
    
    # Check if .env.ec2 exists, create if missing
    if [ ! -f "/opt/restaurant-web/.env.ec2" ]; then
        echo -e "\n${YELLOW}🔧 Setting up environment configuration...${NC}"
        run_script "setup-env-ec2.sh" "Setting up EC2 environment"
    fi
    
    run_script "deploy-optimized.sh" "Deploying application"
    
    echo -e "\n${GREEN}🎉 Quick deploy finished!${NC}"
}

# Main function
main() {
    # Check if running as root or with sudo for some operations
    if [[ $EUID -eq 0 ]]; then
        echo -e "${YELLOW}⚠️ Running as root. Some operations will be performed as ubuntu user.${NC}"
    fi
    
    # Ensure we're in the right directory
    if [ ! -d "$PROJECT_DIR" ]; then
        echo -e "${RED}❌ Project directory not found: $PROJECT_DIR${NC}"
        exit 1
    fi
    
    cd "$PROJECT_DIR"
    
    # Show current status
    echo -e "\n${BLUE}📊 Current system status:${NC}"
    echo -e "Disk usage: $(df -h / | tail -1 | awk '{print $5}') used"
    echo -e "Node.js: $(node --version 2>/dev/null || echo 'not installed')"
    echo -e "Docker: $(docker --version 2>/dev/null | cut -d' ' -f3 | tr -d ',' || echo 'not installed')"
    
    # Show menu and handle choice
    show_menu
    choice=$?
    
    case $choice in
        1)
            complete_setup
            ;;
        2)
            quick_deploy
            ;;
        3)
            run_script "cleanup-ec2.sh" "Cleaning up disk space"
            ;;
        4)
            run_script "configure-cognito.sh" "Configuring AWS Cognito"
            ;;
        5)
            run_script "deploy-optimized.sh" "Deploying application"
            ;;
        6)
            run_script "setup-node-version.sh" "Setting up Node.js version"
            ;;
        7)
            run_script "setup-env-ec2.sh" "Setting up EC2 environment"
            ;;
        8)
            run_script "toggle-auth.sh" "Toggling authentication settings"
            ;;
        9)
            run_script "cleanup-ultra.sh" "Ultra cleanup for 7GB optimization"
            ;;
        10)
            run_script "setup-minimal-domain.sh" "Setting up minimal domain (no SSL)"
            ;;
        *)
            echo -e "${RED}Invalid option${NC}"
            exit 1
            ;;
    esac
    
    echo -e "\n${GREEN}🎊 All done! Your application should be running.${NC}"
    echo -e "${BLUE}🌐 Access at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo 'your-ec2-ip')${NC}"
}

# Run main function
main "$@"