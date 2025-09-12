#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🏗️ PHASE 2: BUILD FRONTEND
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

# Configuration
readonly DOMAIN="${DOMAIN:-www.xn--elfogndedonsoto-zrb.com}"

# Colors
readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly RED='\033[0;31m'
readonly NC='\033[0m'

# Logging functions
log_info() { printf "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - %s\n" "$*"; }
log_success() { printf "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - %s\n" "$*"; }
log_error() { printf "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - %s\n" "$*"; exit 1; }

build_frontend() {
    log_info "🏗️ PHASE 2: Frontend Build"
    
    cd frontend
    
    # Clean previous build
    rm -rf dist/ node_modules/.cache/ 2>/dev/null || true
    
    # Install dependencies if needed
    if [[ ! -d "node_modules" ]] || [[ package.json -nt node_modules ]]; then
        log_info "Installing dependencies..."
        npm ci --production=false
    fi
    
    # Build with correct Cognito settings
    log_info "Building frontend with AWS Cognito enabled..."
    NODE_ENV=production \
    VITE_AWS_COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI \
    VITE_AWS_COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0 \
    VITE_API_BASE_URL=https://${DOMAIN}/api/v1 \
    npm run build
    
    # Verify build
    [[ -d "dist" ]] || log_error "Frontend build failed - no dist directory"
    [[ -f "dist/index.html" ]] || log_error "Frontend build failed - no index.html"
    
    local build_size=$(du -sh dist/ | cut -f1)
    log_info "Frontend build size: $build_size"
    
    cd ..
    log_success "Frontend build completed"
}

# Execute build if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    build_frontend
fi