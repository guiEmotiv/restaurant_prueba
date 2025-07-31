#!/bin/bash

# EC2 Cleanup Script - Free up disk space and optimize system
# Run this script to clean up unnecessary files and prepare for deployment

echo "🧹 Starting EC2 cleanup process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to show disk space
show_disk_usage() {
    echo -e "\n${BLUE}💾 Current disk usage:${NC}"
    df -h / | grep -E "/$"
    echo -e "\n${BLUE}📊 Top 10 largest directories in /opt/restaurant-web:${NC}"
    du -sh /opt/restaurant-web/* 2>/dev/null | sort -hr | head -10
}

# Initial disk usage
echo -e "${YELLOW}📊 Initial disk usage:${NC}"
show_disk_usage

# Clean up Docker
echo -e "\n${YELLOW}🐳 Cleaning Docker...${NC}"
docker system prune -af --volumes 2>/dev/null || echo "Docker cleanup skipped"

# Clean up npm cache
echo -e "\n${YELLOW}📦 Cleaning npm cache...${NC}"
npm cache clean --force 2>/dev/null || echo "npm cache cleanup skipped"
rm -rf /home/ubuntu/.npm/_logs/* 2>/dev/null
rm -rf /home/ubuntu/.npm/_cacache/* 2>/dev/null

# Clean up node_modules in frontend
echo -e "\n${YELLOW}🗂️ Cleaning frontend node_modules...${NC}"
cd /opt/restaurant-web/frontend
rm -rf node_modules package-lock.json .vite dist 2>/dev/null

# Clean up Python cache and logs
echo -e "\n${YELLOW}🐍 Cleaning Python cache...${NC}"
find /opt/restaurant-web -name "*.pyc" -delete 2>/dev/null
find /opt/restaurant-web -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null
rm -rf /opt/restaurant-web/backend/staticfiles/* 2>/dev/null

# Clean up system cache
echo -e "\n${YELLOW}🧹 Cleaning system cache...${NC}"
sudo apt-get clean 2>/dev/null
sudo rm -rf /var/cache/apt/archives/* 2>/dev/null
sudo rm -rf /tmp/* 2>/dev/null
sudo rm -rf /var/tmp/* 2>/dev/null

# Remove old log files
echo -e "\n${YELLOW}📝 Cleaning old logs...${NC}"
sudo find /var/log -name "*.log.1" -delete 2>/dev/null
sudo find /var/log -name "*.log.*.gz" -delete 2>/dev/null

# Clean up Git
echo -e "\n${YELLOW}🔧 Cleaning Git...${NC}"
cd /opt/restaurant-web
git gc --aggressive --prune=now 2>/dev/null || echo "Git cleanup skipped"

# Fix permissions
echo -e "\n${YELLOW}🔐 Fixing permissions...${NC}"
sudo chown -R ubuntu:ubuntu /opt/restaurant-web

# Final disk usage
echo -e "\n${GREEN}✅ Cleanup completed!${NC}"
show_disk_usage

echo -e "\n${GREEN}🚀 System ready for deployment!${NC}"