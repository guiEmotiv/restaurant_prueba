#!/bin/bash

# Restaurant Web - Update and Deploy Script
# This script pulls latest changes from git and then runs the build-deploy script

echo "🔄 Restaurant Web - Update and Deploy"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/opt/restaurant-web"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

# Navigate to project directory
cd "$PROJECT_DIR" || {
    echo -e "${RED}❌ Project directory not found: $PROJECT_DIR${NC}"
    exit 1
}

# Show current commit
echo -e "${BLUE}📍 Current commit:${NC}"
git log --oneline -1

# Pull latest changes
echo -e "\n${YELLOW}📥 Pulling latest changes from repository...${NC}"
git pull origin main || {
    echo -e "${RED}❌ Failed to pull changes. Check your git configuration.${NC}"
    exit 1
}

# Show new commit
echo -e "\n${GREEN}✅ Updated to:${NC}"
git log --oneline -1

# Show what changed
echo -e "\n${BLUE}📝 Files changed:${NC}"
git diff --name-only HEAD@{1} HEAD

# Run build and deploy
echo -e "\n${YELLOW}🚀 Running build and deploy...${NC}"
./deploy/build-deploy.sh

echo -e "\n${GREEN}✨ Update and deployment complete!${NC}"