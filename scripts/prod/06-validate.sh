#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ✅ PHASE 6: DEPLOYMENT VALIDATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

# Configuration
readonly SSH_KEY="${SSH_KEY:-./ubuntu_fds_key.pem}"
readonly PROD_SERVER="${PROD_SERVER:-ubuntu@44.248.47.186}"
readonly DOMAIN="${DOMAIN:-www.xn--elfogndedonsoto-zrb.com}"

# Colors
readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly RED='\033[0;31m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

# Logging functions
log_info() { printf "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - %s\n" "$*"; }
log_success() { printf "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - %s\n" "$*"; }
log_warning() { printf "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - %s\n" "$*"; }
log_error() { printf "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - %s\n" "$*"; exit 1; }

validate_deployment() {
    log_info "✅ PHASE 6: Deployment Validation"
    
    # Wait for services to stabilize
    log_info "Waiting for services to stabilize..."
    sleep 30
    
    local failed=0
    
    # Test critical endpoints
    local endpoints=(
        "https://$DOMAIN/"
        "https://$DOMAIN/kitchen"
        "https://$DOMAIN/vite.svg"
        "https://$DOMAIN/api/v1/health/"
    )
    
    for endpoint in "${endpoints[@]}"; do
        local name=$(basename "$endpoint")
        [[ "$name" == "" ]] && name="homepage"
        
        log_info "Testing: $name"
        if timeout 15 curl -f -s -L "$endpoint" >/dev/null 2>&1; then
            log_success "✅ $name - OK"
        else
            log_warning "❌ $name - FAILED"
            ((failed++))
        fi
    done
    
    # Container health check  
    log_info "Checking container health..."
    local container_status=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_SERVER" \
        'cd /home/ubuntu/restaurant-web && /usr/bin/docker ps --format "{{.Names}}: {{.Status}}" | grep restaurant')
    
    if [[ -n "$container_status" ]]; then
        log_success "✅ Containers healthy:"
        echo "$container_status" | while read line; do log_info "  $line"; done
    else
        log_warning "❌ Container health check failed"
        ((failed++))
    fi
    
    # Final summary
    if [[ $failed -eq 0 ]]; then
        log_success "🎉 All validation checks passed!"
        return 0
    else
        log_warning "⚠️ $failed validation(s) failed"
        return 1
    fi
}

# Execute validation if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    validate_deployment
fi