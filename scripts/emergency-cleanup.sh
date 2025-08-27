#!/bin/bash

# Emergency EC2 Cleanup Script
# This script aggressively cleans EC2 to free up disk space

echo "🚨 EMERGENCY CLEANUP STARTING"
echo "Current disk usage:"
df -h /

echo ""
echo "=== 🧹 Docker Cleanup ==="
# Stop all containers gracefully
echo "Stopping all containers..."
docker stop $(docker ps -aq) 2>/dev/null || echo "No containers to stop"

# Remove all stopped containers
echo "Removing all containers..."
docker container prune -f

# Remove all unused images (aggressive)
echo "Removing all unused images..."
docker image prune -a -f

# Remove all unused volumes
echo "Removing unused volumes..."
docker volume prune -f

# Remove all unused networks
echo "Removing unused networks..."
docker network prune -f

# Complete system cleanup
echo "Docker system prune..."
docker system prune -a -f --volumes

echo ""
echo "=== 🗂️ Log Cleanup ==="
# Clean system logs (keep only 1 day)
echo "Cleaning system logs..."
sudo journalctl --vacuum-time=1d

# Clean old log files
echo "Removing old log files..."
sudo find /var/log -name "*.log" -type f -mtime +3 -delete 2>/dev/null || true
sudo find /var/log -name "*.gz" -type f -delete 2>/dev/null || true

echo ""
echo "=== 📦 Package Cleanup ==="
# Clean package cache
echo "Cleaning package cache..."
sudo apt-get clean
sudo apt-get autoclean
sudo apt-get autoremove -y

echo ""
echo "=== 🗑️ Temp Files Cleanup ==="
# Clean temp directories
echo "Cleaning temporary files..."
sudo rm -rf /tmp/* 2>/dev/null || true
sudo rm -rf /var/tmp/* 2>/dev/null || true
rm -rf ~/.cache/* 2>/dev/null || true

# Clean user temp files
find /home -name ".cache" -type d -exec rm -rf {} + 2>/dev/null || true

echo ""
echo "=== 📊 Final Disk Usage ==="
df -h /

echo ""
echo "=== 📋 Largest Files (for reference) ==="
echo "Top 10 largest files/directories:"
sudo du -ah / 2>/dev/null | sort -rh | head -10

echo ""
echo "✅ Emergency cleanup completed!"