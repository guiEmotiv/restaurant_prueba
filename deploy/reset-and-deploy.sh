#!/bin/bash

# Reset and Deploy Script
# Nuclear reset + complete deployment in one command

echo "💥 Restaurant Web - Reset and Deploy"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="/opt/restaurant-web"

echo -e "${YELLOW}⚠️ This will completely reset and redeploy the application${NC}"
echo -e "${YELLOW}⚠️ All data will be lost and recreated from scratch${NC}"
echo -e "\n${BLUE}Are you sure you want to continue? (y/N)${NC}"
read -r -n 1 confirm
echo ""

if [[ ! $confirm =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Operation cancelled${NC}"
    exit 0
fi

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

echo -e "\n${YELLOW}🔥 Starting nuclear reset...${NC}"

# ==============================================================================
# PHASE 1: NUCLEAR RESET
# ==============================================================================
echo -e "\n${YELLOW}💥 PHASE 1: Nuclear Reset${NC}"

# Stop everything
systemctl stop nginx 2>/dev/null || true
cd "$PROJECT_DIR" 2>/dev/null || true
docker-compose -f docker-compose.ec2.yml down --remove-orphans 2>/dev/null || true

# Remove all Docker content
docker system prune -a --volumes -f 2>/dev/null || true
docker builder prune -a -f 2>/dev/null || true
docker volume prune -f 2>/dev/null || true
docker network prune -f 2>/dev/null || true
docker rmi $(docker images -aq) -f 2>/dev/null || true

# Remove application data but keep git
if [ -d "$PROJECT_DIR" ]; then
    find "$PROJECT_DIR" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} + 2>/dev/null || true
fi

# Remove nginx configs
rm -f /etc/nginx/sites-enabled/* 2>/dev/null || true
rm -f /etc/nginx/sites-available/xn--* 2>/dev/null || true

echo -e "${GREEN}✅ Nuclear reset completed${NC}"

# ==============================================================================
# PHASE 2: PULL LATEST CODE
# ==============================================================================
echo -e "\n${YELLOW}📥 PHASE 2: Pull Latest Code${NC}"

cd "$PROJECT_DIR"
git reset --hard HEAD 2>/dev/null || true
git clean -fdx 2>/dev/null || true
git pull origin main 2>/dev/null || true

echo -e "${GREEN}✅ Latest code pulled${NC}"

# ==============================================================================
# PHASE 3: EXECUTE MASTER DEPLOYMENT
# ==============================================================================
echo -e "\n${YELLOW}🚀 PHASE 3: Execute Master Deployment${NC}"

if [ -f "$PROJECT_DIR/deploy/master-deploy.sh" ]; then
    echo -e "${BLUE}Executing master deployment script...${NC}"
    bash "$PROJECT_DIR/deploy/master-deploy.sh"
    deployment_exit_code=$?
    
    if [ $deployment_exit_code -eq 0 ]; then
        echo -e "\n${GREEN}🎉 Master deployment completed successfully!${NC}"
    else
        echo -e "\n${RED}❌ Master deployment failed with exit code: $deployment_exit_code${NC}"
        exit $deployment_exit_code
    fi
else
    echo -e "${RED}❌ Master deployment script not found${NC}"
    exit 1
fi

# ==============================================================================
# PHASE 4: VERIFICATION
# ==============================================================================
echo -e "\n${YELLOW}🔍 PHASE 4: Post-Deployment Verification${NC}"

if [ -f "$PROJECT_DIR/deploy/verify-deployment.sh" ]; then
    echo -e "${BLUE}Running deployment verification...${NC}"
    bash "$PROJECT_DIR/deploy/verify-deployment.sh"
else
    echo -e "${YELLOW}⚠️ Verification script not found, skipping...${NC}"
fi

# ==============================================================================
# COMPLETION
# ==============================================================================
echo -e "\n${GREEN}🎊 RESET AND DEPLOYMENT COMPLETED!${NC}"
echo -e "${BLUE}═════════════════════════════════════${NC}"
echo -e "${BLUE}🌐 Your application is ready at:${NC}"
echo -e "   ${GREEN}http://xn--elfogndedonsoto-zrb.com${NC}"
echo -e ""
echo -e "${BLUE}🔐 Authentication:${NC}"
echo -e "   ${GREEN}AWS Cognito ENABLED${NC}"
echo -e ""
echo -e "${YELLOW}💡 Next steps:${NC}"
echo -e "1. Create Cognito users in AWS Console"
echo -e "2. Assign users to groups: administradores, meseros"
echo -e "3. Login with your Cognito credentials"
echo -e "4. No test data created - add your own data"
echo -e ""
echo -e "${GREEN}✨ Fresh deployment completed successfully!${NC}"