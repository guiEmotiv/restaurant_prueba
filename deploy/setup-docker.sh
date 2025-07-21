#!/bin/bash

# Script to setup Docker on EC2 Amazon Linux 2

set -e

echo "🐳 Setting up Docker on EC2..."

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

# Check if running as root or with sudo
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root or with sudo"
   exit 1
fi

# Update system packages
print_status "Updating system packages..."
yum update -y

# Install Docker
print_status "Installing Docker..."
amazon-linux-extras install docker -y

# Start Docker service
print_status "Starting Docker service..."
systemctl start docker
systemctl enable docker

# Add ec2-user to docker group
print_status "Adding ec2-user to docker group..."
usermod -a -G docker ec2-user

# Install Docker Compose
print_status "Installing Docker Compose..."
DOCKER_COMPOSE_VERSION="v2.24.5"
curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create symbolic link for docker-compose
ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

# Verify installations
print_status "Verifying installations..."

# Check Docker
if docker --version; then
    print_status "Docker installed successfully"
else
    print_error "Docker installation failed"
    exit 1
fi

# Check Docker service
if systemctl is-active --quiet docker; then
    print_status "Docker service is running"
else
    print_error "Docker service is not running"
    exit 1
fi

# Check Docker Compose
if docker-compose --version; then
    print_status "Docker Compose installed successfully"
else
    print_error "Docker Compose installation failed"
    exit 1
fi

# Test Docker
print_status "Testing Docker..."
docker run --rm hello-world

print_status "Docker setup completed successfully!"
print_warning "You need to log out and log back in for group changes to take effect"
print_warning "Or run: newgrp docker"

echo ""
echo "Next steps:"
echo "1. Log out and log back in (or run: newgrp docker)"
echo "2. Create your .env file from .env.example"
echo "3. Run: docker-compose -f docker-compose.prod.yml up -d"