#!/bin/bash

# Restaurant Web - Node.js Installation Script
# Use this if Node.js is not installed on your system

echo "🚀 Node.js Installation"
echo "======================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

echo -e "${BLUE}📝 This script will:${NC}"
echo -e "  ✅ Install Node.js 20.x LTS"
echo -e "  ✅ Install NPM"
echo -e "  ✅ Verify installation"
echo ""

# Check if Node.js is already installed
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${YELLOW}⚠️ Node.js is already installed: $NODE_VERSION${NC}"
    read -p "Do you want to reinstall? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Skipping installation${NC}"
        exit 0
    fi
fi

echo -e "${BLUE}📦 Installing Node.js...${NC}"

# Update package list
echo -e "${BLUE}Updating package list...${NC}"
apt update

# Install curl if not present
if ! command -v curl &> /dev/null; then
    echo -e "${BLUE}Installing curl...${NC}"
    apt install -y curl
fi

# Add NodeSource repository
echo -e "${BLUE}Adding NodeSource repository...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

# Install Node.js
echo -e "${BLUE}Installing Node.js and NPM...${NC}"
apt install -y nodejs

# Verify installation
echo -e "${BLUE}🧪 Verifying installation...${NC}"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js installed: $NODE_VERSION${NC}"
else
    echo -e "${RED}❌ Node.js installation failed${NC}"
    exit 1
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✅ NPM installed: $NPM_VERSION${NC}"
else
    echo -e "${RED}❌ NPM installation failed${NC}"
    exit 1
fi

# Test npm
echo -e "${BLUE}Testing NPM...${NC}"
if npm --version > /dev/null 2>&1; then
    echo -e "${GREEN}✅ NPM is working${NC}"
else
    echo -e "${RED}❌ NPM is not working properly${NC}"
    exit 1
fi

echo -e "\n${GREEN}🎉 NODE.JS INSTALLATION COMPLETED!${NC}"
echo -e "${BLUE}📋 Installed versions:${NC}"
echo -e "  Node.js: $(node --version)"
echo -e "  NPM: $(npm --version)"
echo ""
echo -e "${YELLOW}✅ Now you can run:${NC}"
echo -e "  sudo ./deploy/frontend-only.sh"
echo -e "  sudo ./deploy/backend-only.sh"
echo -e "  sudo ./deploy/build-deploy.sh"