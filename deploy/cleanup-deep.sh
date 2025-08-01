#!/bin/bash

# Deep Cleanup Script for EC2 - Maximum Space Recovery
# Removes all unnecessary packages and files for minimal Ubuntu setup

echo "🧹 Deep Ubuntu Cleanup - Maximum Space Recovery"
echo "==============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to show space before and after
show_space() {
    local label="$1"
    local available=$(df / | tail -1 | awk '{print int($4/1024/1024)}')
    echo -e "${BLUE}$label: ${available}GB available${NC}"
}

show_space "Initial space"

echo -e "\n${YELLOW}🛑 Stopping services...${NC}"
docker-compose -f docker-compose.ec2.yml down 2>/dev/null || true

echo -e "\n${YELLOW}🐳 Aggressive Docker cleanup...${NC}"
# Remove all containers, images, networks, volumes
docker system prune -a --volumes -f 2>/dev/null || true
docker builder prune -a -f 2>/dev/null || true

echo -e "\n${YELLOW}📦 Removing unnecessary packages...${NC}"
# Remove build tools that were previously installed
sudo apt remove -y --purge \
    build-essential \
    gcc g++ \
    cpp \
    libc6-dev \
    linux-headers-* \
    snapd \
    unattended-upgrades \
    ubuntu-advantage-tools \
    cloud-init \
    landscape-common \
    update-notifier-common \
    command-not-found \
    python3-pip \
    python3-setuptools \
    python3-wheel \
    2>/dev/null || true

echo -e "\n${YELLOW}🧼 Autoremove and autoclean...${NC}"
sudo apt autoremove -y --purge
sudo apt autoclean

echo -e "\n${YELLOW}📄 Cleaning package caches...${NC}"
sudo rm -rf /var/cache/apt/archives/*
sudo rm -rf /var/lib/apt/lists/*
sudo apt clean

echo -e "\n${YELLOW}📝 Cleaning logs...${NC}"
# Clean system logs but keep recent ones
sudo journalctl --vacuum-time=1d
sudo find /var/log -type f -name "*.log" -mtime +1 -delete 2>/dev/null || true
sudo find /var/log -type f -name "*.gz" -delete 2>/dev/null || true

echo -e "\n${YELLOW}🗑️ Cleaning temporary files...${NC}"
sudo rm -rf /tmp/*
sudo rm -rf /var/tmp/*
sudo rm -rf /root/.cache/*
sudo rm -rf /home/*/.cache/* 2>/dev/null || true

echo -e "\n${YELLOW}📚 Cleaning documentation and man pages...${NC}"
sudo rm -rf /usr/share/doc/*
sudo rm -rf /usr/share/man/*
sudo rm -rf /usr/share/info/*
sudo rm -rf /usr/share/locale/*

echo -e "\n${YELLOW}🐍 Cleaning Python caches...${NC}"
find /opt/restaurant-web -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find /opt/restaurant-web -name "*.pyc" -delete 2>/dev/null || true
rm -rf /opt/restaurant-web/backend/venv 2>/dev/null || true

echo -e "\n${YELLOW}📦 Cleaning Node.js if present...${NC}"
rm -rf /opt/restaurant-web/frontend/node_modules 2>/dev/null || true
rm -rf /opt/restaurant-web/frontend/package-lock.json 2>/dev/null || true
rm -rf /home/*/.npm 2>/dev/null || true
rm -rf /root/.npm 2>/dev/null || true

echo -e "\n${YELLOW}🔧 Cleaning Git...${NC}"
cd /opt/restaurant-web 2>/dev/null || true
git gc --aggressive --prune=now 2>/dev/null || true
git clean -fdx 2>/dev/null || true

echo -e "\n${YELLOW}💾 Final system cleanup...${NC}"
sudo updatedb 2>/dev/null || true
sync

show_space "Final space"

echo -e "\n${GREEN}✅ Deep cleanup completed!${NC}"
echo -e "${BLUE}💡 You can now run: sudo ./deploy/deploy-optimized.sh${NC}"