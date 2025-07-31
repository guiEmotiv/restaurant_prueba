#!/bin/bash

# Node.js Version Setup for EC2
# Installs the correct Node.js version for the project

echo "🔧 Setting up Node.js version..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check current Node version
current_node=$(node --version 2>/dev/null || echo "none")
echo -e "${BLUE}📍 Current Node.js version: $current_node${NC}"

# Required Node version (compatible with Vite 7.x)
REQUIRED_NODE="20"

# Function to install Node.js via NodeSource
install_node() {
    echo -e "\n${YELLOW}📦 Installing Node.js $REQUIRED_NODE...${NC}"
    
    # Remove existing Node if installed via apt
    sudo apt-get remove -y nodejs npm 2>/dev/null || true
    
    # Install Node.js 20.x via NodeSource
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # Verify installation
    local new_version=$(node --version)
    echo -e "${GREEN}✅ Node.js installed: $new_version${NC}"
    echo -e "${GREEN}✅ npm version: $(npm --version)${NC}"
}

# Check if we need to update Node.js
if [[ $current_node == v18* ]] || [[ $current_node == "none" ]]; then
    echo -e "${YELLOW}⚠️ Node.js needs to be updated (current: $current_node, required: v20+)${NC}"
    install_node
elif [[ $current_node == v20* ]] || [[ $current_node == v22* ]]; then
    echo -e "${GREEN}✅ Node.js version is compatible: $current_node${NC}"
else
    echo -e "${YELLOW}⚠️ Unexpected Node.js version: $current_node${NC}"
    read -p "Do you want to install Node.js 20? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        install_node
    fi
fi

# Set npm configuration for better performance
echo -e "\n${YELLOW}⚙️ Configuring npm...${NC}"
npm config set fund false
npm config set audit false
npm config set progress false

echo -e "\n${GREEN}🎉 Node.js setup completed!${NC}"