#!/bin/bash
# 🧹 EC2 Disk Space Cleanup Script for Restaurant Management System

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Show current disk usage
print_status "📊 Current disk usage:"
df -h

echo ""
print_status "🔍 Analyzing disk usage by directory:"
du -sh /* 2>/dev/null | sort -hr | head -20

# Clean package manager cache
print_status "🧹 Cleaning package manager cache..."
sudo apt-get clean
sudo apt-get autoremove -y
print_success "Package cache cleaned"

# Clean Docker system
print_status "🐳 Cleaning Docker resources..."

# Stop all containers
docker-compose -f docker-compose.ec2.yml down 2>/dev/null || true

# Remove unused Docker resources
docker system prune -a -f --volumes
print_success "Docker cleaned"

# Clean old logs
print_status "📜 Cleaning old logs..."
sudo journalctl --vacuum-time=2d
sudo find /var/log -type f -name "*.log" -mtime +7 -delete 2>/dev/null || true
print_success "Logs cleaned"

# Clean npm cache
print_status "📦 Cleaning npm cache..."
npm cache clean --force 2>/dev/null || true
print_success "NPM cache cleaned"

# Remove old Docker images except the latest
print_status "🖼️ Removing old Docker images..."
docker images | grep -v REPOSITORY | awk '{print $3}' | tail -n +2 | xargs -r docker rmi -f 2>/dev/null || true

# Show new disk usage
echo ""
print_status "📊 New disk usage:"
df -h

# Calculate freed space
print_success "🎉 Cleanup complete!"
echo ""
echo "Next steps:"
echo "1. Run: ./deploy/deploy-ec2.sh"
echo "2. If still having issues, consider:"
echo "   - Increasing EC2 instance storage"
echo "   - Using docker volumes for persistent data"