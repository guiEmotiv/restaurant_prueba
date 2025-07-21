#!/bin/bash

# EC2 Ubuntu Server Setup Script
# Restaurant Management System - Production Deployment

set -euo pipefail

echo "🚀 EC2 Ubuntu Setup - Restaurant Management System"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running on Ubuntu
if [[ ! -f /etc/os-release ]] || ! grep -q "Ubuntu" /etc/os-release; then
    print_error "This script is designed for Ubuntu systems"
    exit 1
fi

print_status "Detected Ubuntu system"

# Update system packages
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y
print_status "System packages updated"

# Install required dependencies
echo "🔧 Installing dependencies..."
sudo apt install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    software-properties-common \
    htop \
    unzip
print_status "Dependencies installed"

# Install Docker
echo "🐳 Installing Docker..."
if ! command -v docker &> /dev/null; then
    # Add Docker GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Update package index and install Docker
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    
    print_status "Docker installed successfully"
else
    print_warning "Docker already installed"
fi

# Install Docker Compose
echo "🐳 Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_VERSION="v2.24.0"
    sudo curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    print_status "Docker Compose installed successfully"
else
    print_warning "Docker Compose already installed"
fi

# Configure firewall (UFW)
echo "🔥 Configuring firewall..."
sudo ufw --force enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
print_status "Firewall configured"

# Create deployment directory
echo "📁 Creating deployment directory..."
mkdir -p ~/restaurant-web
print_status "Deployment directory created"

# Display system information
echo ""
echo "📊 System Information:"
echo "===================="
echo "OS: $(lsb_release -d | cut -f2)"
echo "Kernel: $(uname -r)"
echo "Docker: $(docker --version)"
echo "Docker Compose: $(docker-compose --version)"
echo "Memory: $(free -h | awk '/^Mem:/ {print $2}')"
echo "Disk: $(df -h / | awk 'NR==2 {print $2 " total, " $4 " available"}')"
echo ""

print_status "EC2 setup completed successfully!"
echo ""
echo "📋 Next Steps:"
echo "=============="
echo "1. Log out and log back in to apply Docker group changes"
echo "2. Clone your repository: git clone <your-repo-url> ~/restaurant-web"
echo "3. Navigate to project: cd ~/restaurant-web"
echo "4. Configure environment: cp .env.ec2 .env.ec2.local && nano .env.ec2.local"
echo "5. Run deployment: ./deploy/ec2-deploy.sh"
echo ""
print_warning "Please log out and log back in before proceeding!"