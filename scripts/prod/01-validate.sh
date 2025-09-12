#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🛡️ PHASE 1: ENVIRONMENT VALIDATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

# Configuration - Use exported variables from main script
SSH_KEY="${SSH_KEY:-./ubuntu_fds_key.pem}"
PROD_SERVER="${PROD_SERVER:-ubuntu@44.248.47.186}"

validate_environment() {
    log_info "🛡️ PHASE 1: Environment Validation"
    
    # Check required files
    [[ -f "$SSH_KEY" ]] || log_error "SSH key not found: $SSH_KEY"
    [[ -f "./frontend/package.json" ]] || log_error "Frontend package.json not found"
    [[ -f "./backend/manage.py" ]] || log_error "Backend manage.py not found"
    [[ -f "./docker-compose.production.yml" ]] || log_error "docker-compose.production.yml not found"
    [[ -f "./Dockerfile.production" ]] || log_error "Dockerfile.production not found"
    
    # Set SSH permissions
    chmod 600 "$SSH_KEY"
    
    # Test SSH connection
    log_info "Testing SSH connection..."
    ssh -i "$SSH_KEY" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$PROD_SERVER" 'echo "SSH OK"' >/dev/null
    
    # Check git status
    if ! git status >/dev/null 2>&1; then
        log_error "Not in a git repository"
    fi
    
    local uncommitted=$(git status --porcelain | wc -l)
    if [[ $uncommitted -gt 0 ]]; then
        log_warning "⚠️ You have $uncommitted uncommitted changes"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
    fi
    
    log_success "Environment validation completed"
}

# Execute validation if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    validate_environment
fi