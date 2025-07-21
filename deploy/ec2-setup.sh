#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# EC2 Server Setup Script for Restaurant Management System
# Prepares Ubuntu server with Docker and required dependencies
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Configuration
APP_DIR="/opt/restaurant-app"
LOG_FILE="/var/log/ec2-setup.log"

# Functions
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}" | tee -a "$LOG_FILE"
}

header() {
    echo -e "${PURPLE}"
    echo "═══════════════════════════════════════════════════════════════════"
    echo "  $1"
    echo "═══════════════════════════════════════════════════════════════════"
    echo -e "${NC}"
}

check_os() {
    header "Checking Operating System"
    
    if [[ ! -f /etc/os-release ]]; then
        error "Cannot determine operating system"
    fi
    
    source /etc/os-release
    log "OS: $PRETTY_NAME"
    
    if [[ "$ID" != "ubuntu" ]]; then
        warning "This script is optimized for Ubuntu. Your OS: $ID"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # Check if we're on EC2
    if curl -s --connect-timeout 2 http://169.254.169.254/latest/meta-data/instance-id &>/dev/null; then
        local instance_id=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
        local region=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)
        log "✓ Running on EC2 instance: $instance_id (region: $region)"
    else
        warning "Not running on EC2, continuing anyway..."
    fi
}

check_privileges() {
    header "Checking Privileges"
    
    if [[ $EUID -eq 0 ]]; then
        warning "Running as root. This is not recommended for security."
        warning "Consider creating a non-root user for the application."
    fi
    
    # Check sudo access
    if ! sudo -n true 2>/dev/null; then
        info "This script requires sudo access for system installation."
        sudo -v || error "Cannot obtain sudo privileges"
    fi
    
    log "✓ Privileges checked"
}

update_system() {
    header "Updating System Packages"
    
    info "Updating package lists..."
    sudo apt-get update -y
    
    info "Upgrading system packages..."
    sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
    
    info "Installing essential packages..."
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
        curl \
        wget \
        git \
        unzip \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        htop \
        vim \
        ufw \
        fail2ban
    
    log "✓ System updated successfully"
}

install_docker() {
    header "Installing Docker"
    
    # Remove old versions if they exist
    sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Add Docker's official GPG key
    info "Adding Docker repository..."
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Update package index
    sudo apt-get update -y
    
    # Install Docker Engine
    info "Installing Docker Engine..."
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io
    
    # Start and enable Docker
    sudo systemctl start docker
    sudo systemctl enable docker
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    
    log "✓ Docker installed successfully"
    docker --version
}

install_docker_compose() {
    header "Installing Docker Compose"
    
    # Get latest version
    local compose_version=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    
    info "Installing Docker Compose $compose_version..."
    sudo curl -L "https://github.com/docker/compose/releases/download/$compose_version/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    
    sudo chmod +x /usr/local/bin/docker-compose
    
    # Create symlink for easy access
    sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    
    log "✓ Docker Compose installed successfully"
    docker-compose --version
}

setup_firewall() {
    header "Configuring Firewall"
    
    # Reset UFW to default
    sudo ufw --force reset
    
    # Default policies
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    
    # Allow SSH (important!)
    sudo ufw allow 22/tcp
    
    # Allow HTTP and HTTPS
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    
    # Allow application port
    sudo ufw allow 8000/tcp
    
    # Enable firewall
    sudo ufw --force enable
    
    log "✓ Firewall configured"
    sudo ufw status
}

setup_fail2ban() {
    header "Configuring Fail2Ban"
    
    # Create jail.local configuration
    sudo tee /etc/fail2ban/jail.local > /dev/null << EOF
[DEFAULT]
bantime = 1800
findtime = 600
maxretry = 5
destemail = root@localhost
sendername = Fail2BanAlerts
mta = sendmail

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
EOF
    
    # Start and enable fail2ban
    sudo systemctl restart fail2ban
    sudo systemctl enable fail2ban
    
    log "✓ Fail2Ban configured"
}

create_app_structure() {
    header "Creating Application Structure"
    
    # Create application directory
    sudo mkdir -p "$APP_DIR"/{data,logs,staticfiles,media,backups}
    
    # Set proper ownership
    sudo chown -R $USER:$USER "$APP_DIR"
    
    # Set proper permissions
    chmod 755 "$APP_DIR"
    chmod 755 "$APP_DIR"/{data,logs,staticfiles,media,backups}
    
    log "✓ Application structure created at $APP_DIR"
    ls -la "$APP_DIR"
}

setup_swap() {
    header "Setting up Swap File"
    
    # Check if swap already exists
    if [[ $(swapon --show | wc -l) -gt 0 ]]; then
        info "Swap already configured, skipping..."
        return 0
    fi
    
    # Create 2GB swap file for t3.micro instances
    info "Creating 2GB swap file..."
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    
    # Make swap permanent
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    
    # Optimize swap usage
    echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
    echo 'vm.vfs_cache_pressure=50' | sudo tee -a /etc/sysctl.conf
    
    log "✓ Swap configured"
    free -h
}

optimize_system() {
    header "Optimizing System for Production"
    
    # Increase file descriptor limits
    sudo tee -a /etc/security/limits.conf > /dev/null << EOF
# Increased limits for restaurant app
* soft nofile 65536
* hard nofile 65536
root soft nofile 65536
root hard nofile 65536
EOF
    
    # Optimize kernel parameters
    sudo tee -a /etc/sysctl.conf > /dev/null << EOF

# Restaurant app optimizations
net.core.somaxconn = 1024
net.ipv4.tcp_max_syn_backlog = 2048
vm.overcommit_memory = 1
EOF
    
    # Apply sysctl changes
    sudo sysctl -p
    
    log "✓ System optimized for production"
}

setup_log_rotation() {
    header "Setting up Log Rotation"
    
    # Create logrotate configuration for application logs
    sudo tee /etc/logrotate.d/restaurant-app > /dev/null << EOF
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    notifempty
    copytruncate
    create 644 $USER $USER
}
EOF
    
    log "✓ Log rotation configured"
}

show_summary() {
    header "Setup Summary"
    
    echo ""
    info "System Information:"
    echo "  🖥️  Server: $(hostname)"
    echo "  💻 OS: $(lsb_release -d | cut -f2)"
    echo "  🐳 Docker: $(docker --version | cut -d' ' -f3 | tr -d ',')"
    echo "  📦 Compose: $(docker-compose --version | cut -d' ' -f3 | tr -d ',')"
    
    echo ""
    info "Application Setup:"
    echo "  📁 App Directory: $APP_DIR"
    echo "  👤 Owner: $USER"
    echo "  🔥 Firewall: $(sudo ufw status | grep -q "Status: active" && echo "Active" || echo "Inactive")"
    echo "  🔒 Fail2Ban: $(systemctl is-active fail2ban)"
    echo "  💾 Swap: $(free -h | grep Swap | awk '{print $2}')"
    
    echo ""
    info "Next Steps:"
    echo "  1. 🔄 Logout and login again to apply Docker group membership"
    echo "  2. 📥 Clone your application code to $APP_DIR"
    echo "  3. ⚙️  Create and configure .env file"
    echo "  4. 🚀 Run deployment: ./deploy/ec2-deploy.sh"
    
    echo ""
    warning "Important Security Notes:"
    echo "  • Change default passwords immediately"
    echo "  • Configure proper domain names and SSL certificates"
    echo "  • Review and restrict firewall rules for production"
    echo "  • Set up regular automated backups"
    echo "  • Monitor logs and system resources"
    
    echo ""
    log "✅ EC2 server setup completed successfully!"
    log "🔄 Please logout and login again to complete Docker setup"
}

# Main setup process
main() {
    header "EC2 Server Setup for Restaurant Management System"
    log "Setup started by: $(whoami) on $(hostname)"
    
    check_os
    check_privileges
    update_system
    install_docker
    install_docker_compose
    setup_firewall
    setup_fail2ban
    setup_swap
    create_app_structure
    optimize_system
    setup_log_rotation
    show_summary
}

# Run main function
main "$@"