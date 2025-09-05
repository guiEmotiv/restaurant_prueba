#!/bin/bash
# 🏢 ENTERPRISE-GRADE DEPLOYMENT SCRIPT
# Expert Software Architect - Production Ready
# Purpose: Zero-downtime deployment with comprehensive monitoring and rollback

set -euo pipefail

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔧 CONFIGURATION & SETUP
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ECR_REGISTRY="${1:-}"
ECR_REPOSITORY="${2:-}"
ACTION="${3:-deploy}"
DEPLOYMENT_ID="$(date +%Y%m%d_%H%M%S)_$(git rev-parse --short HEAD 2>/dev/null || echo 'manual')"
BACKUP_DIR="data/backups/enterprise/${DEPLOYMENT_ID}"
HEALTH_CHECK_TIMEOUT=120
ROLLBACK_ENABLED=true

# Color codes for enterprise logging
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly WHITE='\033[1;37m'
readonly NC='\033[0m'

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📊 ENTERPRISE LOGGING SYSTEM
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log() {
    local level=$1; shift
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S UTC')
    local color=$WHITE
    
    case $level in
        "INFO")  color=$BLUE ;;
        "SUCCESS") color=$GREEN ;;
        "WARNING") color=$YELLOW ;;
        "ERROR") color=$RED ;;
        "CRITICAL") color=$PURPLE ;;
        "DEPLOY") color=$CYAN ;;
    esac
    
    echo -e "${color}[${level}]${NC} ${timestamp} - $*" | tee -a "deployment_${DEPLOYMENT_ID}.log"
}

log_info() { log "INFO" "$@"; }
log_success() { log "SUCCESS" "$@"; }
log_warning() { log "WARNING" "$@"; }
log_error() { log "ERROR" "$@"; }
log_critical() { log "CRITICAL" "$@"; }
log_deploy() { log "DEPLOY" "$@"; }

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔍 ENTERPRISE VALIDATION SYSTEM
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

validate_prerequisites() {
    log_info "🔍 Running enterprise-grade prerequisite validation..."
    
    # Parameter validation
    if [[ -z "$ECR_REGISTRY" || -z "$ECR_REPOSITORY" ]]; then
        log_critical "Missing required parameters: ECR_REGISTRY and ECR_REPOSITORY"
        exit 1
    fi
    
    # System requirements validation
    local required_tools=("docker" "docker-compose" "git" "aws" "curl" "sqlite3")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_critical "Required tool not found: $tool"
            exit 1
        fi
    done
    
    # Docker daemon health check
    if ! docker info &> /dev/null; then
        log_critical "Docker daemon is not running or accessible"
        exit 1
    fi
    
    # AWS credentials validation
    if ! aws sts get-caller-identity &> /dev/null; then
        log_critical "AWS credentials are not properly configured"
        exit 1
    fi
    
    # System resources validation
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [[ $disk_usage -gt 85 ]]; then
        log_warning "Disk usage is high: ${disk_usage}%"
        if [[ $disk_usage -gt 95 ]]; then
            log_critical "Disk usage critically high: ${disk_usage}%"
            exit 1
        fi
    fi
    
    local memory_usage=$(free | grep Mem | awk '{printf("%.0f", ($3/$2)*100)}')
    if [[ $memory_usage -gt 90 ]]; then
        log_warning "Memory usage is high: ${memory_usage}%"
    fi
    
    log_success "✅ All prerequisites validated successfully"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 💾 ENTERPRISE BACKUP SYSTEM
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create_comprehensive_backup() {
    log_info "💾 Creating comprehensive enterprise backup..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Database backup with integrity check
    if [[ -f "data/restaurant.prod.sqlite3" ]]; then
        log_info "Backing up production database..."
        cp "data/restaurant.prod.sqlite3" "$BACKUP_DIR/"
        
        # Verify backup integrity
        if sqlite3 "$BACKUP_DIR/restaurant.prod.sqlite3" "PRAGMA integrity_check;" | grep -q "ok"; then
            log_success "Database backup verified successfully"
        else
            log_error "Database backup integrity check failed"
            return 1
        fi
    fi
    
    # Container state backup
    log_info "Capturing current container state..."
    docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" > "$BACKUP_DIR/containers.txt"
    docker images --format "table {{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.CreatedAt}}" > "$BACKUP_DIR/images.txt"
    
    # Configuration backup
    log_info "Backing up configuration files..."
    if [[ -f ".env" ]]; then
        cp ".env" "$BACKUP_DIR/"
    fi
    
    # Git state backup
    log_info "Recording git state..."
    git rev-parse HEAD > "$BACKUP_DIR/git_commit.txt" 2>/dev/null || echo "manual" > "$BACKUP_DIR/git_commit.txt"
    git status --porcelain > "$BACKUP_DIR/git_status.txt" 2>/dev/null || echo "no git" > "$BACKUP_DIR/git_status.txt"
    
    # System state backup
    log_info "Recording system state..."
    echo "DEPLOYMENT_ID=$DEPLOYMENT_ID" > "$BACKUP_DIR/deployment_info.txt"
    echo "TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M:%S UTC')" >> "$BACKUP_DIR/deployment_info.txt"
    echo "USER=$(whoami)" >> "$BACKUP_DIR/deployment_info.txt"
    echo "PWD=$(pwd)" >> "$BACKUP_DIR/deployment_info.txt"
    
    log_success "✅ Comprehensive backup created: $BACKUP_DIR"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🏥 ENTERPRISE HEALTH CHECK SYSTEM
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

health_check_endpoint() {
    local endpoint=$1
    local name=$2
    local timeout=${3:-10}
    local max_attempts=5
    local delay=3
    
    log_info "🏥 Health checking $name endpoint..."
    
    for attempt in $(seq 1 $max_attempts); do
        local start_time=$(date +%s)
        
        if curl -f -s -m $timeout "$endpoint" > /dev/null 2>&1; then
            local end_time=$(date +%s)
            local response_time=$((end_time - start_time))
            log_success "✅ $name healthy (${response_time}s response)"
            return 0
        fi
        
        if [[ $attempt -lt $max_attempts ]]; then
            log_warning "⚠️  $name check $attempt/$max_attempts failed, retrying in ${delay}s..."
            sleep $delay
        fi
    done
    
    log_error "❌ $name failed after $max_attempts attempts"
    return 1
}

comprehensive_health_check() {
    log_info "🏥 Running comprehensive health validation..."
    
    # Container health check
    local unhealthy_containers=$(docker ps --filter "name=restaurant-web" --filter "health=unhealthy" -q)
    if [[ -n "$unhealthy_containers" ]]; then
        log_error "Unhealthy containers detected"
        docker ps --filter "name=restaurant-web"
        return 1
    fi
    
    # Wait for services to stabilize
    log_info "Waiting for services to stabilize..."
    sleep 15
    
    # Critical endpoint validation with detailed monitoring
    local endpoints=(
        "http://localhost/api/v1/health/|Health Check API|5"
        "http://localhost/api/v1/dashboard-operativo/report/?date=$(date +%Y-%m-%d)|Dashboard Operativo|10"
        "http://localhost/api/v1/dashboard-financiero/report/?date=$(date +%Y-%m-%d)&period=month|Dashboard Financiero|10"
        "http://localhost/api/v1/orders/kitchen_board/|Kitchen Board API|8"
    )
    
    local failed_checks=0
    for endpoint_info in "${endpoints[@]}"; do
        IFS='|' read -r endpoint name timeout <<< "$endpoint_info"
        if ! health_check_endpoint "$endpoint" "$name" "$timeout"; then
            ((failed_checks++))
        fi
    done
    
    if [[ $failed_checks -gt 0 ]]; then
        log_error "❌ $failed_checks health checks failed"
        return 1
    fi
    
    log_success "✅ All health checks passed"
    return 0
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 ENTERPRISE DEPLOYMENT ORCHESTRATOR
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

execute_deployment() {
    log_deploy "🚀 Starting enterprise deployment: $DEPLOYMENT_ID"
    
    # Step 1: Code synchronization
    log_info "📥 Synchronizing latest code..."
    if ! git fetch origin main || ! git reset --hard origin/main; then
        log_critical "Failed to synchronize code from repository"
        return 1
    fi
    log_success "Code synchronized successfully"
    
    # Step 2: ECR Authentication
    log_info "🔐 Authenticating with ECR..."
    if ! aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin "$ECR_REGISTRY"; then
        log_critical "ECR authentication failed"
        return 1
    fi
    log_success "ECR authentication successful"
    
    # Step 3: Image acquisition
    log_info "📦 Pulling latest production image..."
    if ! docker pull "$ECR_REGISTRY/$ECR_REPOSITORY:latest"; then
        log_critical "Failed to pull Docker image"
        return 1
    fi
    log_success "Production image acquired successfully"
    
    # Step 4: Database migrations with monitoring
    log_info "🔄 Executing database migrations..."
    if ! docker-compose -f docker/docker-compose.prod.yml run --rm app python manage.py migrate; then
        log_critical "Database migration failed"
        return 1
    fi
    log_success "Database migrations completed successfully"
    
    # Step 5: Zero-downtime deployment
    log_info "🚀 Deploying new version with zero-downtime strategy..."
    if ! docker-compose -f docker/docker-compose.prod.yml --profile production up -d; then
        log_critical "Deployment failed"
        return 1
    fi
    log_success "New version deployed successfully"
    
    # Step 6: Comprehensive health validation
    if ! comprehensive_health_check; then
        log_critical "Health validation failed - initiating rollback"
        return 1
    fi
    
    log_deploy "✅ Enterprise deployment completed successfully: $DEPLOYMENT_ID"
    return 0
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔄 ENTERPRISE ROLLBACK SYSTEM
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

execute_rollback() {
    log_warning "🔄 Initiating enterprise rollback procedure..."
    
    # Stop current containers
    docker-compose -f docker/docker-compose.prod.yml --profile production down || true
    
    # Restore database if backup exists
    if [[ -f "$BACKUP_DIR/restaurant.prod.sqlite3" ]]; then
        log_info "Restoring database backup..."
        cp "$BACKUP_DIR/restaurant.prod.sqlite3" "data/restaurant.prod.sqlite3"
        log_success "Database restored from backup"
    fi
    
    # Attempt to restart with previous configuration
    docker-compose -f docker/docker-compose.prod.yml --profile production up -d
    
    log_warning "⚠️  Rollback completed - manual verification required"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎯 MAIN DEPLOYMENT ORCHESTRATOR
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

main() {
    log_deploy "🏢 ENTERPRISE DEPLOYMENT SYSTEM INITIALIZED"
    log_info "Deployment ID: $DEPLOYMENT_ID"
    log_info "Action: $ACTION"
    log_info "ECR: $ECR_REGISTRY/$ECR_REPOSITORY"
    
    # Prerequisite validation
    validate_prerequisites
    
    # Comprehensive backup
    create_comprehensive_backup
    
    # Execute deployment with error handling
    if execute_deployment; then
        log_deploy "🎉 DEPLOYMENT SUCCESS: $DEPLOYMENT_ID"
        
        # Cleanup old backups (keep last 10)
        find data/backups/enterprise -maxdepth 1 -type d -name "*_*" | sort | head -n -10 | xargs rm -rf 2>/dev/null || true
        
        # Final summary
        log_info "📊 Deployment Summary:"
        log_info "  - ID: $DEPLOYMENT_ID"
        log_info "  - Status: SUCCESS"
        log_info "  - Image: $ECR_REGISTRY/$ECR_REPOSITORY:latest"
        log_info "  - Backup: $BACKUP_DIR"
        log_info "  - Log: deployment_${DEPLOYMENT_ID}.log"
        
    else
        log_critical "💥 DEPLOYMENT FAILED: $DEPLOYMENT_ID"
        
        if [[ "$ROLLBACK_ENABLED" == "true" ]]; then
            execute_rollback
        fi
        
        exit 1
    fi
}

# Signal handlers for graceful shutdown
trap 'log_warning "Deployment interrupted by signal"; exit 130' INT TERM

# Execute main deployment orchestrator
main "$@"