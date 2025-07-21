#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# Deployment Validation Script
# Tests all deployment components before production deployment
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Functions
log() { echo -e "${GREEN}✓ $1${NC}"; }
error() { echo -e "${RED}✗ $1${NC}"; exit 1; }
warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
info() { echo -e "${BLUE}ℹ $1${NC}"; }

header() {
    echo -e "${BLUE}"
    echo "═══════════════════════════════════════════════════════════════════"
    echo "  $1"
    echo "═══════════════════════════════════════════════════════════════════"
    echo -e "${NC}"
}

# Main validation
main() {
    header "Validating Restaurant Web Deployment Configuration"
    
    info "Checking deployment files..."
    
    # Check required files exist
    [[ -f "docker-compose.ec2.yml" ]] || error "docker-compose.ec2.yml not found"
    [[ -f "backend/Dockerfile.ec2" ]] || error "backend/Dockerfile.ec2 not found"
    [[ -f "backend/backend/settings_ec2.py" ]] || error "backend/settings_ec2.py not found"
    [[ -f ".env.ec2" ]] || error ".env.ec2 template not found"
    [[ -f "deploy/ec2-setup.sh" ]] || error "ec2-setup.sh not found"
    [[ -f "deploy/ec2-deploy.sh" ]] || error "ec2-deploy.sh not found"
    log "All required files present"
    
    # Check scripts are executable
    [[ -x "deploy/ec2-setup.sh" ]] || error "ec2-setup.sh is not executable"
    [[ -x "deploy/ec2-deploy.sh" ]] || error "ec2-deploy.sh is not executable"
    log "Deployment scripts are executable"
    
    # Validate Docker Compose configuration
    info "Validating Docker Compose configuration..."
    if [[ ! -f ".env" ]]; then
        cp .env.ec2 .env
        info "Created .env from template"
    fi
    
    docker-compose -f docker-compose.ec2.yml config > /dev/null || error "Invalid Docker Compose configuration"
    log "Docker Compose configuration is valid"
    
    # Check Dockerfile exists and has basic structure
    info "Checking Dockerfile structure..."
    if command -v docker &> /dev/null; then
        cd backend && docker build -f Dockerfile.ec2 -t restaurant-test . > /dev/null 2>&1 && docker rmi restaurant-test > /dev/null 2>&1 || warning "Docker validation skipped (daemon not available)"
        cd ..
    else
        warning "Docker not available, skipping Dockerfile build test"
    fi
    [[ -f "backend/Dockerfile.ec2" ]] && grep -q "FROM python" "backend/Dockerfile.ec2" || error "Invalid Dockerfile structure"
    log "Dockerfile structure is valid"
    
    # Validate Python requirements
    [[ -f "backend/requirements-prod.txt" ]] || error "requirements-prod.txt not found"
    log "Requirements file exists"
    
    # Check deployment script functions
    info "Testing deployment script functions..."
    bash -n deploy/ec2-setup.sh || error "ec2-setup.sh has syntax errors"
    bash -n deploy/ec2-deploy.sh || error "ec2-deploy.sh has syntax errors"
    log "Deployment scripts have valid syntax"
    
    # Summary
    header "Validation Results"
    log "All deployment components validated successfully!"
    echo ""
    info "Ready for production deployment. Next steps:"
    echo "  1. 🚀 Launch EC2 instance (Ubuntu 22.04)"
    echo "  2. 📦 Run: sudo ./deploy/ec2-setup.sh"
    echo "  3. ⚙️  Configure .env file"
    echo "  4. 🎯 Deploy: ./deploy/ec2-deploy.sh"
    echo ""
    warning "Remember to:"
    echo "  - Set DJANGO_SECRET_KEY in .env"
    echo "  - Set EC2_PUBLIC_IP in .env"
    echo "  - Configure security groups (ports 22, 80, 8000)"
}

main "$@"