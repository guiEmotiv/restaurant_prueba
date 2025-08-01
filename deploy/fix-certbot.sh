#!/bin/bash

# Fix Certbot Installation Script
# Fixes OpenSSL compatibility issues with certbot

echo "🔧 Fixing Certbot Installation"
echo "=============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

echo -e "${YELLOW}🗑️ Removing broken certbot installation...${NC}"
# Remove old certbot
apt remove --purge certbot python3-certbot-nginx -y
apt autoremove -y

echo -e "${YELLOW}📦 Installing certbot via snap...${NC}"
# Install snapd if not present
if ! command -v snap >/dev/null 2>&1; then
    apt update
    apt install snapd -y
    systemctl enable snapd
    systemctl start snapd
    # Wait for snap to be ready
    sleep 5
fi

# Install certbot via snap (more stable)
snap install core; snap refresh core
snap install --classic certbot

# Create symlink for certbot command
ln -sf /snap/bin/certbot /usr/bin/certbot

echo -e "${YELLOW}🧪 Testing certbot installation...${NC}"
if /snap/bin/certbot --version >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Certbot installed successfully via snap${NC}"
    /snap/bin/certbot --version
else
    echo -e "${RED}❌ Certbot installation failed${NC}"
    exit 1
fi

echo -e "\n${GREEN}🎉 Certbot fix completed!${NC}"
echo -e "${BLUE}💡 You can now run SSL setup:${NC}"
echo -e "   sudo /snap/bin/certbot --nginx -d xn--elfogndedonsoto-zrb.com"
echo -e "   or"
echo -e "   sudo ./deploy/setup-punycode-domain.sh"