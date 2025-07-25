#!/bin/bash

# ============================================================================
# EC2 Simple Cleanup Script - Always executes all cleanup steps
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run with sudo: sudo $0"
    exit 1
fi

echo "🧹 Starting EC2 cleanup and optimization..."
echo ""

# Show initial disk space
log_info "Initial disk space:"
df -h /
echo ""

# Step 1: Clean system packages
log_info "Step 1/7: Cleaning system packages..."
apt-get clean
apt-get autoremove -y
apt-get autoclean
journalctl --vacuum-time=7d
rm -rf /tmp/*
rm -rf /var/tmp/*
log_success "System packages cleaned"
echo ""

# Step 2: Clean Docker
log_info "Step 2/7: Cleaning Docker..."
if command -v docker >/dev/null 2>&1; then
    docker stop $(docker ps -aq) 2>/dev/null || true
    docker rm $(docker ps -aq) 2>/dev/null || true
    docker rmi $(docker images -q) 2>/dev/null || true
    docker system prune -af 2>/dev/null || true
    docker volume prune -f 2>/dev/null || true
    log_success "Docker cleaned"
else
    log_warning "Docker not found"
fi
echo ""

# Step 3: Clean application files
log_info "Step 3/7: Cleaning application files..."
if [ -d "/opt/restaurant-web" ]; then
    cd /opt/restaurant-web
    rm -rf frontend/node_modules 2>/dev/null || true
    rm -rf frontend/dist 2>/dev/null || true
    find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
    find . -name "*.pyc" -delete 2>/dev/null || true
    rm -rf data/logs/* 2>/dev/null || true
    log_success "Application files cleaned"
else
    log_warning "/opt/restaurant-web not found"
fi
echo ""

# Step 4: Clean npm cache
log_info "Step 4/7: Cleaning npm cache..."
npm cache clean --force 2>/dev/null || true
rm -rf ~/.npm 2>/dev/null || true
log_success "npm cache cleaned"
echo ""

# Step 5: Setup swap
log_info "Step 5/7: Setting up swap..."
SWAP_SIZE=$(free -m | grep Swap | awk '{print $2}')
if [ "$SWAP_SIZE" -eq "0" ]; then
    log_info "Creating 1GB swap file..."
    fallocate -l 1G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    log_success "Swap created"
else
    log_success "Swap already available: ${SWAP_SIZE}MB"
fi
echo ""

# Step 6: Install dependencies
log_info "Step 6/7: Installing dependencies..."
apt-get update -qq
apt-get install -y curl wget git build-essential python3 python3-pip
if ! command -v docker >/dev/null 2>&1; then
    apt-get install -y docker.io docker-compose
fi
apt-get install -y bc net-tools
systemctl enable docker >/dev/null 2>&1 || true
systemctl start docker >/dev/null 2>&1 || true
usermod -aG docker ubuntu >/dev/null 2>&1 || true
log_success "Dependencies installed"
echo ""

# Step 7: Update Node.js
log_info "Step 7/7: Updating Node.js..."
CURRENT_NODE=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo "0")
if [ "$CURRENT_NODE" -lt "18" ]; then
    log_info "Installing Node.js 18..."
    apt-get remove -y nodejs npm 2>/dev/null || true
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
    log_success "Node.js installed: $(node --version)"
else
    log_success "Node.js $(node --version) is adequate"
fi
echo ""

log_success "✅ ALL CLEANUP STEPS COMPLETED!"
echo ""

# Show final status
log_info "📊 Final system status:"
echo ""
echo "💾 Disk space:"
df -h /
echo ""
echo "🧠 Memory:"
free -m
echo ""
echo "🐳 Docker:"
docker system df 2>/dev/null || echo "Docker not available"
echo ""
echo "📦 Node.js:"
echo "  Version: $(node --version 2>/dev/null || echo 'Not installed')"
echo "  npm: $(npm --version 2>/dev/null || echo 'Not installed')"
echo ""

log_success "🚀 EC2 is ready for deployment!"
log_info "Next step: sudo ./deploy/ec2-deploy.sh deploy"