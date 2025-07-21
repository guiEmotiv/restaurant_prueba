#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# Restaurant Web - Quick Production Deployment
# One-command setup for EC2 + SQLite + Docker
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

header() {
    echo -e "${BLUE}"
    echo "═══════════════════════════════════════════════════════════════════"
    echo "  🍽️  Restaurant Management System - Quick Start"
    echo "═══════════════════════════════════════════════════════════════════"
    echo -e "${NC}"
}

log() { echo -e "${GREEN}✓ $1${NC}"; }
info() { echo -e "${BLUE}ℹ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠ $1${NC}"; }

main() {
    header
    
    echo "This script will guide you through the deployment process:"
    echo ""
    echo "1. 🔍 Validate deployment configuration"
    echo "2. ⚙️  Help configure environment variables"
    echo "3. 🚀 Deploy the application"
    echo ""
    
    read -p "Continue with deployment? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 0
    fi
    
    # Step 1: Validate
    info "Step 1: Validating deployment configuration..."
    ./deploy/validate-deployment.sh
    
    echo ""
    
    # Step 2: Configure environment
    info "Step 2: Configuring environment..."
    
    if [[ ! -f .env ]]; then
        cp .env.ec2 .env
        log "Created .env from template"
    fi
    
    # Generate Django secret key
    if command -v python3 &> /dev/null; then
        SECRET_KEY=$(python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')
        sed -i.bak "s/CHANGE_ME_TO_A_SECURE_SECRET_KEY/$SECRET_KEY/" .env
        log "Generated Django secret key"
    else
        warning "Python3 not found. Please manually set DJANGO_SECRET_KEY in .env"
    fi
    
    # Try to get EC2 IP
    if curl -s --connect-timeout 2 http://169.254.169.254/latest/meta-data/public-ipv4 &>/dev/null; then
        EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
        sed -i.bak "s/127.0.0.1/$EC2_IP/" .env
        log "Detected EC2 public IP: $EC2_IP"
    else
        warning "Not running on EC2 or cannot detect public IP"
        echo "Please manually set EC2_PUBLIC_IP in .env file"
    fi
    
    echo ""
    info "Environment configuration completed. Review .env file if needed."
    
    # Step 3: Deploy
    echo ""
    info "Step 3: Deploying application..."
    echo ""
    
    read -p "Deploy now? (Y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        echo "Deployment paused. Run './deploy/ec2-deploy.sh' when ready."
        exit 0
    fi
    
    ./deploy/ec2-deploy.sh deploy
    
    echo ""
    log "🎉 Quick deployment completed!"
    echo ""
    info "Next steps:"
    echo "  - Create admin user: ./deploy/ec2-deploy.sh shell"
    echo "  - Check status: ./deploy/ec2-deploy.sh status"
    echo "  - View logs: ./deploy/ec2-deploy.sh logs"
}

main "$@"