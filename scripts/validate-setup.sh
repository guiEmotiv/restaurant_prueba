#!/bin/bash

# Restaurant Management System - Setup Validation
# Validates development and production environment configuration

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[VALIDATE]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warning() { echo -e "${YELLOW}[!]${NC} $1"; }

ERRORS=0

check_file() {
    local file="$1"
    local description="$2"
    
    if [[ -f "$file" ]]; then
        success "$description: $file"
    else
        error "$description missing: $file"
        ((ERRORS++))
    fi
}

check_executable() {
    local file="$1"
    local description="$2"
    
    if [[ -x "$file" ]]; then
        success "$description executable: $file"
    else
        error "$description not executable: $file"
        ((ERRORS++))
    fi
}

log "Validating Restaurant Management System Setup..."

# Core architecture files
log "Checking core architecture files..."
check_file "./docker-compose.yml" "Development compose"
check_file "./docker-compose.production.yml" "Production compose"
check_file "./Dockerfile.dev" "Development Dockerfile"
check_file "./Dockerfile.prod" "Production Dockerfile"
check_file "./.github/workflows/deploy-production.yml" "GitHub Actions workflow"

# Backend configuration
log "Checking backend configuration..."
check_file "./backend/backend/settings.py" "Django settings"
check_file "./backend/manage.py" "Django manage.py"
check_file "./backend/requirements.txt" "Backend requirements"

# Frontend configuration
log "Checking frontend configuration..."
check_file "./frontend/package.json" "Frontend package.json"
check_file "./frontend/vite.config.js" "Vite configuration"

# Development scripts
log "Checking development scripts..."
check_executable "./dev.sh" "Main development script"
check_executable "./scripts/clean-operational-data.sh" "Operational data cleaner"
check_file "./scripts/production-deploy.sh" "Production deployment"

# Docker files
log "Checking Docker configurations..."
check_file "./docker/nginx/conf.d/default.conf" "Nginx configuration"
check_file "./docker/postgres/postgresql.conf" "PostgreSQL configuration"

# Environment templates
log "Checking environment templates..."
check_file "./.env.ec2.template" "Environment template"

# Validate PostgreSQL-only setup
log "Validating PostgreSQL-only configuration..."
if grep -q "sqlite" "./backend/backend/settings.py" 2>/dev/null; then
    warning "SQLite references found in settings - should be PostgreSQL only"
else
    success "No SQLite references in settings"
fi

# Check for required directories
log "Checking required directories..."
[[ -d "./logs" ]] || mkdir -p ./logs && success "Logs directory"
[[ -d "./media" ]] || mkdir -p ./media && success "Media directory"
[[ -d "./backups" ]] || mkdir -p ./backups && success "Backups directory"

# Validate development environment
log "Testing development environment startup (dry-run)..."
if docker-compose config >/dev/null 2>&1; then
    success "Development compose configuration valid"
else
    error "Development compose configuration invalid"
    ((ERRORS++))
fi

# Validate production environment
log "Testing production environment (dry-run)..."
if docker-compose -f docker-compose.production.yml config >/dev/null 2>&1; then
    success "Production compose configuration valid"
else
    error "Production compose configuration invalid"
    ((ERRORS++))
fi

# Architecture summary
log "Architecture Summary:"
echo "  Development:"
echo "    - Docker Compose with PostgreSQL 15"
echo "    - Django backend with hot-reload"
echo "    - Optional frontend container"
echo "    - Native frontend development (npm run dev)"
echo ""
echo "  Production:"
echo "    - ECR image deployment to EC2 Ubuntu"
echo "    - PostgreSQL with health checks"
echo "    - Nginx reverse proxy with SSL"
echo "    - GitHub Actions CI/CD"

if [[ $ERRORS -eq 0 ]]; then
    success "✨ All validations passed! Architecture is ready for development and production."
    log "Quick start:"
    echo "  ./dev.sh up        # Start development"
    echo "  ./dev.sh migrate   # Run migrations"
    echo "  ./dev.sh logs      # View logs"
    echo "  git push origin main  # Deploy to production"
else
    error "❌ Found $ERRORS issues. Please fix before proceeding."
    exit 1
fi