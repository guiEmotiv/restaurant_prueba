#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 PHASE 3: SERVER PREPARATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

# Configuration
readonly SSH_KEY="${SSH_KEY:-./ubuntu_fds_key.pem}"
readonly PROD_SERVER="${PROD_SERVER:-ubuntu@44.248.47.186}"

# Colors
readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly RED='\033[0;31m'
readonly NC='\033[0m'

# Logging functions
log_info() { printf "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - %s\n" "$*"; }
log_success() { printf "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - %s\n" "$*"; }
log_error() { printf "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - %s\n" "$*"; exit 1; }

prepare_server() {
    log_info "🚀 PHASE 3: Server Preparation"
    
    log_info "Connecting to production server..."
    
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_SERVER" << 'REMOTE_SCRIPT'
        set -euo pipefail
        
        echo "🔍 Server diagnostics:"
        memory_before=$(free | awk '/^Mem:/ {printf "%.0f", $3/$2 * 100}')
        disk_before=$(df / | awk 'NR==2 {print int($3/$2 * 100)}')
        echo "  Memory: ${memory_before}% | Disk: ${disk_before}%"
        
        # MANDATORY cleanup before deployment
        echo "🧹 Performing mandatory cleanup..."
        
        # Stop containers
        cd /home/ubuntu/restaurant-web 2>/dev/null || true
        /usr/bin/docker compose -f docker-compose.production.yml down 2>/dev/null || true
        
        # Docker cleanup  
        /usr/bin/docker system prune -af --volumes 2>/dev/null || true
        /usr/bin/docker builder prune -af 2>/dev/null || true
        
        # System cleanup
        /usr/bin/sudo apt-get autoremove -y 2>/dev/null || true
        /usr/bin/sudo apt-get autoclean 2>/dev/null || true
        
        # Clean logs (no backups)
        /usr/bin/sudo find /var/log -type f -name "*.log" -mtime +2 -delete 2>/dev/null || true
        /usr/bin/sudo find /tmp -type f -mtime +1 -delete 2>/dev/null || true
        
        # Check final usage
        memory_after=$(free | awk '/^Mem:/ {printf "%.0f", $3/$2 * 100}')
        disk_after=$(df / | awk 'NR==2 {print int($3/$2 * 100)}')
        echo "✅ After cleanup - Memory: ${memory_after}% | Disk: ${disk_after}%"
        
        if [[ $disk_after -gt 90 ]]; then
            echo "❌ Still insufficient disk space: ${disk_after}%"
            exit 1
        fi
        
        # Ensure project directory
        mkdir -p /home/ubuntu/restaurant-web
        echo "✅ Server prepared successfully"
REMOTE_SCRIPT
    
    log_success "Server preparation completed"
}

# Execute preparation if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    prepare_server
fi