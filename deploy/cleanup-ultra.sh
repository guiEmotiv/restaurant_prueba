#!/bin/bash

# Ultra-Aggressive Cleanup for 7GB EC2
# Frees maximum space possible

echo "🧹 Ultra-Aggressive EC2 Cleanup"
echo "==============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Show initial space
initial_space=$(df / | tail -1 | awk '{print int($4/1024/1024)}')
echo -e "${BLUE}💾 Initial space: ${initial_space}GB${NC}"

echo -e "\n${YELLOW}🛑 Stopping all services...${NC}"
docker-compose -f docker-compose.ec2.yml down 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true
systemctl stop apache2 2>/dev/null || true

echo -e "\n${YELLOW}🐳 Nuclear Docker cleanup...${NC}"
# Remove everything Docker-related
docker system prune -a --volumes -f 2>/dev/null || true
docker builder prune -a -f 2>/dev/null || true
docker volume prune -f 2>/dev/null || true
docker network prune -f 2>/dev/null || true

# Remove Docker images forcefully
docker rmi $(docker images -q) -f 2>/dev/null || true

echo -e "\n${YELLOW}📦 Remove unnecessary packages...${NC}"
# Remove packages we don't need
apt remove --purge -y \
    snapd \
    certbot \
    python3-certbot-nginx \
    cloud-init \
    landscape-common \
    update-notifier-common \
    command-not-found \
    ubuntu-advantage-tools \
    unattended-upgrades \
    whoopsie \
    popularity-contest \
    apport \
    python3-apport \
    2>/dev/null || true

# Autoremove aggressively
apt autoremove --purge -y
apt autoclean

echo -e "\n${YELLOW}🗑️ Clean package caches...${NC}"
# Clean all package caches
rm -rf /var/cache/apt/archives/*
rm -rf /var/lib/apt/lists/*
apt clean

echo -e "\n${YELLOW}📝 Clean logs aggressively...${NC}"
# Clean system logs
journalctl --vacuum-time=1h 2>/dev/null || true
journalctl --vacuum-size=10M 2>/dev/null || true

# Remove log files
find /var/log -type f -name "*.log" -delete 2>/dev/null || true
find /var/log -type f -name "*.gz" -delete 2>/dev/null || true
find /var/log -type f -name "*.old" -delete 2>/dev/null || true
find /var/log -type f -name "*.1" -delete 2>/dev/null || true

# Clean specific log directories
rm -rf /var/log/journal/* 2>/dev/null || true
rm -rf /var/log/apt/* 2>/dev/null || true

echo -e "\n${YELLOW}🗂️ Clean temporary files...${NC}"
# Clean temp directories
rm -rf /tmp/* 2>/dev/null || true
rm -rf /var/tmp/* 2>/dev/null || true
rm -rf /root/.cache/* 2>/dev/null || true
rm -rf /home/*/.cache/* 2>/dev/null || true

echo -e "\n${YELLOW}📚 Remove documentation...${NC}"
# Remove docs and man pages
rm -rf /usr/share/doc/* 2>/dev/null || true
rm -rf /usr/share/man/* 2>/dev/null || true
rm -rf /usr/share/info/* 2>/dev/null || true
rm -rf /usr/share/locale/* 2>/dev/null || true

echo -e "\n${YELLOW}🐍 Clean Python caches...${NC}"
# Clean Python caches everywhere
find / -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find / -name "*.pyc" -delete 2>/dev/null || true
find / -name "*.pyo" -delete 2>/dev/null || true

echo -e "\n${YELLOW}📦 Clean Node.js files...${NC}"
# Clean Node.js
rm -rf /opt/restaurant-web/frontend/node_modules 2>/dev/null || true
rm -rf /opt/restaurant-web/frontend/package-lock.json 2>/dev/null || true
rm -rf /root/.npm 2>/dev/null || true
rm -rf /home/*/.npm 2>/dev/null || true

echo -e "\n${YELLOW}🔧 Clean build artifacts...${NC}"
# Clean build artifacts
rm -rf /opt/restaurant-web/backend/venv 2>/dev/null || true
rm -rf /opt/restaurant-web/frontend/dist 2>/dev/null || true

echo -e "\n${YELLOW}💾 Clean kernel modules...${NC}"
# Remove old kernels (keep current)
current_kernel=$(uname -r)
dpkg --list | grep linux-image | grep -v "$current_kernel" | awk '{print $2}' | xargs apt remove --purge -y 2>/dev/null || true

echo -e "\n${YELLOW}🔧 Final optimizations...${NC}"
# Clean package database
apt clean
apt autoclean
dpkg --clear-avail

# Compact Git repository
cd /opt/restaurant-web 2>/dev/null && git gc --aggressive --prune=now 2>/dev/null || true

# Sync filesystem
sync

# Calculate space freed
final_space=$(df / | tail -1 | awk '{print int($4/1024/1024)}')
freed_space=$((final_space - initial_space))

echo -e "\n${GREEN}🎉 Ultra cleanup completed!${NC}"
echo -e "${BLUE}📊 Initial space: ${initial_space}GB${NC}"
echo -e "${BLUE}📊 Final space: ${final_space}GB${NC}"
echo -e "${GREEN}📊 Space freed: ${freed_space}GB${NC}"

if [ $final_space -gt 2 ]; then
    echo -e "${GREEN}✅ Plenty of space for deployment!${NC}"
else
    echo -e "${YELLOW}⚠️ Still tight on space, but should work${NC}"
fi

echo -e "\n${BLUE}💡 Ready for: sudo ./deploy/setup-minimal-domain.sh${NC}"