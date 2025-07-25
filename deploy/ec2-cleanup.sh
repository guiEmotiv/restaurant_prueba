#!/bin/bash

# ============================================================================
# EC2 Cleanup and Optimization Script
# Frees up space and prepares EC2 for deployment
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

# Check disk space
check_disk_space() {
    log_info "Checking disk space..."
    df -h /
    echo ""
    
    # Get available space and convert to MB for better precision
    AVAILABLE_KB=$(df / | tail -1 | awk '{print $4}')
    AVAILABLE_MB=$((AVAILABLE_KB / 1024))
    AVAILABLE_GB=$((AVAILABLE_MB / 1024))
    
    log_info "Available space: ${AVAILABLE_MB}MB (${AVAILABLE_GB}GB)"
    
    if [ "$AVAILABLE_MB" -lt 1024 ]; then  # Less than 1GB
        log_warning "Low disk space detected (${AVAILABLE_MB}MB available). Running cleanup..."
        return 1
    else
        log_success "Sufficient disk space available (${AVAILABLE_MB}MB)"
        return 0
    fi
}

# Clean system packages
clean_system() {
    log_info "Cleaning system packages..."
    
    sudo apt-get clean
    sudo apt-get autoremove -y
    sudo apt-get autoclean
    
    # Clean logs older than 7 days
    sudo journalctl --vacuum-time=7d
    
    # Clean temporary files
    sudo rm -rf /tmp/*
    sudo rm -rf /var/tmp/*
    
    log_success "System cleaned"
}

# Clean Docker
clean_docker() {
    log_info "Cleaning Docker..."
    
    # Stop all containers
    docker stop $(docker ps -aq) 2>/dev/null || true
    
    # Remove all containers
    docker rm $(docker ps -aq) 2>/dev/null || true
    
    # Remove all images
    docker rmi $(docker images -q) 2>/dev/null || true
    
    # Clean docker system
    docker system prune -af
    
    # Clean volumes
    docker volume prune -f
    
    log_success "Docker cleaned"
}

# Update Node.js to version 18
update_nodejs() {
    log_info "Checking Node.js version..."
    
    CURRENT_NODE=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo "0")
    
    if [ "$CURRENT_NODE" -lt "18" ]; then
        log_warning "Node.js version $CURRENT_NODE detected. Updating to Node.js 18..."
        
        # Remove old Node.js
        sudo apt-get remove -y nodejs npm 2>/dev/null || true
        
        # Install Node.js 18 LTS
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
        
        # Verify installation
        log_info "New Node.js version: $(node --version)"
        log_info "New npm version: $(npm --version)"
        
        log_success "Node.js updated successfully"
    else
        log_success "Node.js version $(node --version) is adequate"
    fi
}

# Ensure all required system dependencies
install_dependencies() {
    log_info "Installing required system dependencies..."
    
    # Update package lists
    sudo apt-get update
    
    # Install essential packages
    sudo apt-get install -y \
        curl \
        wget \
        git \
        build-essential \
        python3 \
        python3-pip \
        docker.io \
        docker-compose \
        bc \
        net-tools
    
    # Ensure Docker is running
    sudo systemctl enable docker
    sudo systemctl start docker
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    
    log_success "System dependencies installed"
}

# Clean npm cache
clean_npm() {
    log_info "Cleaning npm cache..."
    
    npm cache clean --force 2>/dev/null || true
    rm -rf ~/.npm 2>/dev/null || true
    
    log_success "npm cache cleaned"
}

# Clean application files
clean_app() {
    log_info "Cleaning application files..."
    
    if [ -d "/opt/restaurant-web" ]; then
        cd /opt/restaurant-web
        
        # Remove node_modules
        rm -rf frontend/node_modules
        rm -rf backend/node_modules
        
        # Remove build artifacts
        rm -rf frontend/dist
        rm -rf frontend/build
        
        # Remove Python cache
        find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
        find . -name "*.pyc" -delete 2>/dev/null || true
        
        # Keep database and .env.ec2 but remove logs
        rm -rf data/logs/* 2>/dev/null || true
        
        log_success "Application files cleaned"
    else
        log_warning "/opt/restaurant-web not found"
    fi
}

# Setup swap if needed (for low memory)
setup_swap() {
    log_info "Checking swap..."
    
    SWAP_SIZE=$(free -m | grep Swap | awk '{print $2}')
    
    if [ "$SWAP_SIZE" -eq "0" ]; then
        log_warning "No swap detected. Creating 1GB swap file..."
        
        # Create swap file
        sudo fallocate -l 1G /swapfile
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile
        sudo swapon /swapfile
        
        # Make permanent
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
        
        log_success "Swap created and activated"
    else
        log_success "Swap already available: ${SWAP_SIZE}MB"
    fi
}

# Show system status
show_status() {
    log_info "System status after cleanup:"
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
}

# Main cleanup process
main() {
    log_info "Starting EC2 cleanup and optimization..."
    echo ""
    
    # Check if running as root or with sudo
    if [ "$EUID" -ne 0 ]; then
        log_error "Please run with sudo: sudo $0"
        exit 1
    fi
    
    # Always check disk space first
    check_disk_space
    NEED_CLEANUP=$?
    
    if [ $NEED_CLEANUP -eq 1 ] || [ "${1:-}" = "force" ]; then
        log_info "Performing full cleanup and setup..."
        
        log_info "Step 1/7: Installing dependencies..."
        install_dependencies
        
        log_info "Step 2/7: Cleaning system..."
        clean_system
        
        log_info "Step 3/7: Cleaning Docker..."
        clean_docker
        
        log_info "Step 4/7: Cleaning application files..."
        clean_app
        
        log_info "Step 5/7: Cleaning npm cache..."
        clean_npm
        
        log_info "Step 6/7: Setting up swap..."
        setup_swap
        
        log_info "Step 7/7: Updating Node.js..."
        update_nodejs
        
        log_success "Cleanup and setup completed!"
    else
        log_info "System looks healthy. Use '$0 force' to force cleanup."
        install_dependencies  # Always ensure dependencies
        update_nodejs  # Always check Node.js version
    fi
    
    echo ""
    show_status
    
    echo ""
    log_success "EC2 is ready for deployment!"
    log_info "Run: sudo ./deploy/ec2-deploy.sh deploy"
}

# Show usage
if [ "${1:-}" = "help" ] || [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    echo "Usage: sudo $0 [force]"
    echo ""
    echo "This script cleans up EC2 to free space and prepare for deployment."
    echo ""
    echo "Options:"
    echo "  force    - Force cleanup even if disk space seems adequate"
    echo "  help     - Show this help message"
    echo ""
    echo "The script will:"
    echo "  - Clean system packages and logs"
    echo "  - Remove Docker containers and images"
    echo "  - Clean application build files"
    echo "  - Update Node.js to version 18"
    echo "  - Setup swap if needed"
    echo "  - Show system status"
    exit 0
fi

# Run main function
main "$@"