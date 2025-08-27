#!/bin/bash

# EC2 Environment Cleanup Script
# This script cleans up the deployment environment on EC2
# Removes duplicate configs, old files, and prepares for fresh deployment

echo "🧹 Starting comprehensive EC2 environment cleanup..."

# Navigate to deployment directory
cd /opt/restaurant-web || exit 1

echo "📊 Current directory contents:"
ls -la

echo ""
echo "🔍 Checking current docker containers..."
docker ps -a

echo ""
echo "🛑 Stopping and removing ALL containers..."
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true

echo ""
echo "🗑️ Removing ALL docker images..."
docker rmi $(docker images -q) -f 2>/dev/null || true

echo ""
echo "🧹 Complete docker system cleanup..."
docker system prune -a -f --volumes || true

echo ""
echo "📁 Cleaning up deployment directory..."

# Remove old docker-compose files
echo "Removing old docker-compose files..."
rm -f docker-compose.yml docker-compose.*.yml

# Remove old nginx configurations (keep only necessary ones)
echo "Cleaning nginx configurations..."
if [ -d "nginx" ]; then
    # Keep only default.conf and remove conflicting configs
    cd nginx/conf.d
    ls -la
    echo "Keeping only default.conf, removing conflicting configs..."
    rm -f dev.conf simple.conf ssl.conf cloudflare.conf
    ls -la
    cd ../..
fi

# Remove old environment files
echo "Cleaning environment files..."
rm -f .env.* || true

# Remove temporary and log files
echo "Cleaning temporary files..."
rm -rf logs/* || true
rm -rf /tmp/docker-* || true

# Clean old backups (keep only last 3)
echo "Cleaning old backups (keeping only last 3)..."
if [ -d "backups" ]; then
    cd backups
    ls -t backup-* 2>/dev/null | tail -n +4 | xargs -r rm -rf
    echo "Remaining backups:"
    ls -la
    cd ..
fi

# Remove any leftover frontend-dist directories
echo "Removing old frontend-dist directories..."
rm -rf frontend-dist || true

echo ""
echo "🔧 System cleanup..."
# Clean system logs
sudo journalctl --vacuum-time=1d || true

# Clean apt cache
sudo apt-get clean || true
sudo apt-get autoremove -y || true

echo ""
echo "💾 Final disk usage:"
df -h /

echo ""
echo "📊 Final directory structure:"
find . -maxdepth 2 -type f -name "*.yml" -o -name "*.conf" -o -name "*.env*" | sort

echo ""
echo "✅ EC2 environment cleanup completed!"
echo "Environment is now clean and ready for fresh deployment"