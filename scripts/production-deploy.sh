#!/bin/bash
# Enterprise-Grade Production Deployment Script
# Author: Expert Software Architect
# Purpose: Bulletproof deployment with automatic rollback and comprehensive validation

set -euo pipefail

# Configuration
ECR_REGISTRY="${1:-}"
ECR_REPOSITORY="${2:-}"
ACTION="${3:-deploy}"
DEPLOYMENT_ID=$(date +%Y%m%d_%H%M%S)
HEALTH_CHECK_RETRIES=5
HEALTH_CHECK_DELAY=3

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
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

# Validation functions
validate_prerequisites() {
    log_info "🔍 Validating prerequisites..."
    
    # Check required parameters
    if [[ -z "$ECR_REGISTRY" || -z "$ECR_REPOSITORY" ]]; then
        log_error "Missing required parameters: ECR_REGISTRY and ECR_REPOSITORY"
        exit 1
    fi
    
    # Check required tools
    local required_tools=("docker" "docker-compose" "git" "aws")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool not found: $tool"
            exit 1
        fi
    done
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    # Check disk space
    local available_space=$(df / | tail -1 | awk '{print $4}')
    if [[ $available_space -lt 1048576 ]]; then  # Less than 1GB
        log_warning "Low disk space: ${available_space}KB available"
        
        # Run aggressive cleanup
        log_info "🧹 Running aggressive cleanup..."
        ./scripts/auto-cleanup.sh || true
        
        # Docker cleanup
        docker system prune -af --volumes || true
        
        # Re-check space
        available_space=$(df / | tail -1 | awk '{print $4}')
        if [[ $available_space -lt 512000 ]]; then  # Less than 500MB
            log_error "Insufficient disk space after cleanup: ${available_space}KB"
            exit 1
        fi
    fi
    
    log_success "Prerequisites validated successfully"
}

# Backup current state for rollback
create_deployment_backup() {
    log_info "💾 Creating deployment backup..."
    
    # Save current container IDs
    docker ps -q --filter "name=restaurant-web" > "/tmp/deployment_${DEPLOYMENT_ID}_containers.txt"
    
    # Backup database if exists
    if [[ -f "data/restaurant.prod.sqlite3" ]]; then
        local backup_dir="data/backups/prod"
        mkdir -p "$backup_dir"
        cp "data/restaurant.prod.sqlite3" "$backup_dir/backup_${DEPLOYMENT_ID}.sqlite3"
        log_success "Database backup created: backup_${DEPLOYMENT_ID}.sqlite3"
    fi
    
    # Save current image tags
    docker images --format "{{.Repository}}:{{.Tag}}" | grep "$ECR_REGISTRY/$ECR_REPOSITORY" | head -1 > "/tmp/deployment_${DEPLOYMENT_ID}_image.txt"
}

# Health check with retry logic
health_check_with_retry() {
    local endpoint="$1"
    local description="$2"
    
    log_info "🏥 Health checking $description..."
    
    for attempt in $(seq 1 $HEALTH_CHECK_RETRIES); do
        local response=$(curl -s -w "\n%{http_code}" "$endpoint" 2>/dev/null || echo "000")
        local http_code=$(echo "$response" | tail -n 1)
        
        if [[ "$http_code" == "200" ]]; then
            log_success "$description is healthy (HTTP 200)"
            return 0
        fi
        
        if [[ $attempt -lt $HEALTH_CHECK_RETRIES ]]; then
            log_warning "Attempt $attempt failed (HTTP $http_code), retrying in ${HEALTH_CHECK_DELAY}s..."
            sleep $HEALTH_CHECK_DELAY
        fi
    done
    
    log_error "$description failed after $HEALTH_CHECK_RETRIES attempts"
    return 1
}

# Comprehensive health validation
validate_deployment_health() {
    log_info "🏥 Validating deployment health..."
    
    # Wait for containers to be ready
    log_info "Waiting for containers to stabilize..."
    sleep 10
    
    # Check container health
    local unhealthy=$(docker ps --filter "name=restaurant-web" --filter "health=unhealthy" -q)
    if [[ -n "$unhealthy" ]]; then
        log_error "Unhealthy containers detected"
        docker ps --filter "name=restaurant-web"
        return 1
    fi
    
    # Check all critical endpoints
    local endpoints=(
        "http://localhost/api/v1/dashboard-operativo/report/?date=2025-08-29|Dashboard Operativo API"
        "http://localhost/api/v1/dashboard-financiero/report/?date=2025-08-29&period=month|Dashboard Financiero API"
        "http://localhost/api/v1/orders/kitchen_board/|Kitchen Board API"
    )
    
    for endpoint_info in "${endpoints[@]}"; do
        IFS='|' read -r endpoint description <<< "$endpoint_info"
        if ! health_check_with_retry "$endpoint" "$description"; then
            return 1
        fi
    done
    
    log_success "All health checks passed"
    return 0
}

# Rollback deployment
rollback_deployment() {
    log_error "🔄 Initiating rollback..."
    
    # Stop current containers
    docker-compose -f docker/docker-compose.prod.yml --profile production down || true
    
    # Restore previous image if available
    if [[ -f "/tmp/deployment_${DEPLOYMENT_ID}_image.txt" ]]; then
        local previous_image=$(cat "/tmp/deployment_${DEPLOYMENT_ID}_image.txt")
        if [[ -n "$previous_image" ]]; then
            log_info "Restoring previous image: $previous_image"
            # Update docker-compose to use previous image
            export DOCKER_IMAGE="$previous_image"
        fi
    fi
    
    # Restore database if backup exists
    if [[ -f "data/backups/prod/backup_${DEPLOYMENT_ID}.sqlite3" ]]; then
        log_info "Restoring database backup..."
        cp "data/backups/prod/backup_${DEPLOYMENT_ID}.sqlite3" "data/restaurant.prod.sqlite3"
    fi
    
    # Start previous version
    docker-compose -f docker/docker-compose.prod.yml --profile production up -d
    
    log_warning "Rollback completed - manual intervention may be required"
}

# Main deployment process
main() {
    log_info "🚀 Starting enterprise-grade deployment (ID: $DEPLOYMENT_ID)"
    
    # Step 1: Validate prerequisites
    validate_prerequisites
    
    # Step 2: Create backup
    create_deployment_backup
    
    # Step 3: Sync latest code
    log_info "📥 Syncing latest code..."
    if ! git fetch origin main && git reset --hard origin/main; then
        log_error "Failed to sync code"
        exit 1
    fi
    log_success "Code synced to latest version"
    
    # Step 4: Login to ECR
    log_info "🔐 Authenticating with ECR..."
    if ! aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin "$ECR_REGISTRY"; then
        log_error "ECR authentication failed"
        exit 1
    fi
    
    # Step 5: Pull latest image
    log_info "📦 Pulling latest Docker image..."
    if ! docker pull "$ECR_REGISTRY/$ECR_REPOSITORY:latest"; then
        log_error "Failed to pull Docker image"
        exit 1
    fi
    
    # Step 6: Run database migrations
    log_info "🔄 Running database migrations..."
    if ! docker-compose -f docker/docker-compose.prod.yml run --rm app python manage.py migrate; then
        log_error "Migration failed"
        rollback_deployment
        exit 1
    fi
    log_success "Database migrations completed successfully"
    
    # Step 7: Deploy new version
    log_info "🚀 Deploying new version..."
    if ! docker-compose -f docker/docker-compose.prod.yml --profile production up -d; then
        log_error "Deployment failed"
        rollback_deployment
        exit 1
    fi
    
    # Step 8: Validate deployment
    if ! validate_deployment_health; then
        log_error "Health validation failed"
        rollback_deployment
        exit 1
    fi
    
    # Step 9: Cleanup old resources
    log_info "🧹 Cleaning up old resources..."
    docker image prune -f || true
    find data/backups/prod -name "*.sqlite3" -mtime +7 -delete || true
    
    # Step 10: Final validation
    log_success "✅ Deployment completed successfully!"
    log_info "📊 Deployment Summary:"
    echo "  - Deployment ID: $DEPLOYMENT_ID"
    echo "  - Status: SUCCESS"
    echo "  - Image: $ECR_REGISTRY/$ECR_REPOSITORY:latest"
    echo "  - Health: All systems operational"
    
    # Cleanup temporary files
    rm -f "/tmp/deployment_${DEPLOYMENT_ID}_"* || true
}

# Execute main function
main "$@"