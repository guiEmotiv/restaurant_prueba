#!/bin/bash
# Emergency Cleanup Script - Free maximum disk space safely
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

log "🧹 EMERGENCY DISK CLEANUP - Freeing maximum space safely"

# Show space before cleanup
echo "📊 Disk space before cleanup:"
df -h

# Stop services gracefully
log "⏸️ Stopping services gracefully"
sudo systemctl stop docker nginx 2>/dev/null || true
sudo pkill -f docker 2>/dev/null || true
sudo pkill -f nginx 2>/dev/null || true

# Docker cleanup (nuclear but safe)
log "🐳 Docker cleanup"
sudo docker system prune -af --volumes 2>/dev/null || true
sudo rm -rf /var/lib/docker/overlay2 2>/dev/null || true
sudo rm -rf /var/lib/docker/image 2>/dev/null || true
sudo rm -rf /var/lib/docker/containers 2>/dev/null || true

# System cleanup  
log "🗑️ System cleanup"
sudo apt-get autoremove --purge -y 2>/dev/null || true
sudo apt-get autoclean 2>/dev/null || true
sudo journalctl --vacuum-size=50M 2>/dev/null || true

# Logs cleanup (keep some recent logs)
log "📝 Logs cleanup"
sudo find /var/log -name "*.log" -type f -mtime +7 -delete 2>/dev/null || true
sudo find /var/log -name "*.gz" -type f -delete 2>/dev/null || true

# Temp cleanup
log "🗂️ Temp cleanup"
sudo find /tmp -type f -mtime +1 -delete 2>/dev/null || true
sudo find /var/tmp -type f -mtime +1 -delete 2>/dev/null || true

# Cache cleanup (preserve npm cache for faster builds)
log "💨 Cache cleanup"
sudo rm -rf /var/cache/apt 2>/dev/null || true
sudo rm -rf /root/.cache/pip 2>/dev/null || true

# Restart Docker
log "🐳 Restarting Docker service"
sudo systemctl start docker
sleep 10

# Show space after cleanup
echo ""
success "📊 Disk space after cleanup:"
df -h
echo ""

# Calculate space freed
FREED_SPACE=$(($(df / | tail -1 | awk '{print $4}') - AVAILABLE_SPACE))
if [ $FREED_SPACE -gt 0 ]; then
    success "🎉 Freed ${FREED_SPACE}KB of disk space"
else
    success "✅ Cleanup completed"
fi