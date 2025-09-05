#!/bin/bash
# 🏗️ TOTAL REBUILD DEPLOYMENT SCRIPT
# Expert Software Architect - Production Database Rebuild
# Purpose: Complete cleanup, dev-to-prod data sync, and total rebuild for 100% success

set -euo pipefail

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔧 CONFIGURATION & SETUP
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ECR_REGISTRY="${1:-}"
ECR_REPOSITORY="${2:-}"
REBUILD_ID="$(date +%Y%m%d_%H%M%S)_total_rebuild"
BACKUP_DIR="data/backups/total-rebuild/${REBUILD_ID}"

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
        "REBUILD") color=$CYAN ;;
    esac
    
    echo -e "${color}[${level}]${NC} ${timestamp} - $*" | tee -a "total_rebuild_${REBUILD_ID}.log"
}

log_info() { log "INFO" "$@"; }
log_success() { log "SUCCESS" "$@"; }
log_warning() { log "WARNING" "$@"; }
log_error() { log "ERROR" "$@"; }
log_critical() { log "CRITICAL" "$@"; }
log_rebuild() { log "REBUILD" "$@"; }

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🧹 PHASE 1: TOTAL SYSTEM CLEANUP
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

total_system_cleanup() {
    log_rebuild "🧹 PHASE 1: Starting total system cleanup..."
    
    # Stop all containers to prevent data corruption
    log_info "🛑 Stopping all application containers..."
    docker-compose -f docker/docker-compose.prod.yml --profile production down --volumes --remove-orphans || true
    
    # Remove all application containers and images to force rebuild
    log_info "🗑️ Removing all application containers and images..."
    docker container prune -f || true
    docker image prune -f || true
    
    # Remove ALL persistent volumes and cached data
    log_warning "💥 REMOVING ALL PERSISTENT VOLUMES AND CACHES..."
    docker volume prune -f || true
    
    # Clean Docker system completely
    log_info "🧽 Deep cleaning Docker system..."
    docker system prune -f --all || true
    
    # Remove old backup files (keep last 5)
    log_info "🗄️ Cleaning old backups (keeping last 5)..."
    find data/backups -name "*.sqlite3" -type f | sort | head -n -5 | xargs rm -f 2>/dev/null || true
    
    # Clean Python cache and temporary files
    log_info "🐍 Cleaning Python cache and temporary files..."
    find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find . -name "*.pyc" -delete 2>/dev/null || true
    find . -name "*.pyo" -delete 2>/dev/null || true
    find . -type f -name "*.log" -mtime +7 -delete 2>/dev/null || true
    
    # Clean Node.js cache
    log_info "📦 Cleaning Node.js cache..."
    rm -rf frontend/node_modules/.cache 2>/dev/null || true
    rm -rf frontend/dist 2>/dev/null || true
    
    log_success "✅ Total system cleanup completed"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 💾 PHASE 2: COMPLETE DATABASE REBUILD WITH DEV DATA SYNC
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

rebuild_database_with_dev_sync() {
    log_rebuild "💾 PHASE 2: Starting complete database rebuild with dev data sync..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup current production database if it exists
    if [[ -f "data/restaurant.prod.sqlite3" ]]; then
        log_info "📦 Backing up current production database..."
        cp "data/restaurant.prod.sqlite3" "$BACKUP_DIR/prod_before_rebuild.sqlite3"
        log_success "✅ Production database backed up"
    fi
    
    # Backup dev database for sync
    if [[ -f "data/restaurant_dev.sqlite3" ]]; then
        log_info "📦 Backing up dev database for sync..."
        cp "data/restaurant_dev.sqlite3" "$BACKUP_DIR/dev_source.sqlite3"
        log_success "✅ Dev database backed up for sync"
    else
        log_critical "❌ Dev database not found! Cannot sync data."
        return 1
    fi
    
    # COMPLETE DATABASE REBUILD STRATEGY
    log_warning "💥 REMOVING current production database for complete rebuild..."
    rm -f data/restaurant.prod.sqlite3
    
    # Copy dev database as starting point for production
    log_info "📋 Copying dev database as production base..."
    cp "data/restaurant_dev.sqlite3" "data/restaurant.prod.sqlite3"
    
    # Verify database integrity
    log_info "🔍 Verifying database integrity..."
    if sqlite3 "data/restaurant.prod.sqlite3" "PRAGMA integrity_check;" | grep -q "ok"; then
        log_success "✅ Database integrity verified"
    else
        log_critical "❌ Database integrity check failed"
        return 1
    fi
    
    log_success "✅ Database rebuilt with dev data sync completed"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🏗️ PHASE 3: COMPLETE APPLICATION REBUILD
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

complete_application_rebuild() {
    log_rebuild "🏗️ PHASE 3: Starting complete application rebuild..."
    
    # ECR Authentication
    log_info "🔐 Authenticating with ECR for fresh image pull..."
    if ! aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin "$ECR_REGISTRY"; then
        log_critical "ECR authentication failed"
        return 1
    fi
    
    # Pull latest production image (force fresh pull)
    log_info "📦 Pulling latest production image (forced fresh pull)..."
    docker pull --no-cache "$ECR_REGISTRY/$ECR_REPOSITORY:latest"
    
    # Rebuild all containers from scratch with no cache
    log_info "🏗️ Rebuilding all containers from scratch..."
    docker-compose -f docker/docker-compose.prod.yml --profile production build --no-cache --pull
    
    log_success "✅ Complete application rebuild finished"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔄 PHASE 4: FRESH MIGRATIONS AND DATA INTEGRITY
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

apply_fresh_migrations() {
    log_rebuild "🔄 PHASE 4: Applying fresh migrations and ensuring data integrity..."
    
    # Apply all migrations with fresh state
    log_info "🔄 Applying all migrations from clean state..."
    if ! docker-compose -f docker/docker-compose.prod.yml run --rm app python manage.py migrate --verbosity=2; then
        log_critical "❌ Migrations failed"
        return 1
    fi
    
    # Verify migration state
    log_info "📊 Verifying final migration state..."
    docker-compose -f docker/docker-compose.prod.yml run --rm app python manage.py showmigrations
    
    # Create superuser if needed
    log_info "👤 Ensuring superuser exists..."
    docker-compose -f docker/docker-compose.prod.yml run --rm app python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(is_superuser=True).exists():
    User.objects.create_superuser('admin', 'admin@restaurant.com', 'admin123')
    print('✅ Superuser created')
else:
    print('✅ Superuser already exists')
"
    
    log_success "✅ Fresh migrations and data integrity completed"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 PHASE 5: PRODUCTION DEPLOYMENT WITH HEALTH VALIDATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

deploy_and_validate() {
    log_rebuild "🚀 PHASE 5: Starting production deployment with health validation..."
    
    # Start all production services
    log_info "🚀 Starting production services..."
    if ! docker-compose -f docker/docker-compose.prod.yml --profile production up -d; then
        log_critical "❌ Failed to start production services"
        return 1
    fi
    
    # Wait for services to stabilize
    log_info "⏳ Waiting for services to stabilize..."
    sleep 30
    
    # Comprehensive health check
    log_info "🏥 Running comprehensive health validation..."
    local failed_checks=0
    
    # Check container health
    local unhealthy=$(docker ps --filter "name=restaurant-web" --filter "health=unhealthy" -q)
    if [[ -n "$unhealthy" ]]; then
        log_error "❌ Unhealthy containers detected"
        ((failed_checks++))
    fi
    
    # Check critical endpoints
    local endpoints=(
        "http://localhost/api/v1/dashboard-operativo/report/?date=$(date +%Y-%m-%d)"
        "http://localhost/api/v1/dashboard-financiero/report/?date=$(date +%Y-%m-%d)&period=month"
        "http://localhost/api/v1/orders/kitchen_board/"
    )
    
    for endpoint in "${endpoints[@]}"; do
        if ! curl -f -s -m 10 "$endpoint" > /dev/null; then
            log_error "❌ Health check failed: $endpoint"
            ((failed_checks++))
        else
            log_success "✅ Health check passed: $endpoint"
        fi
    done
    
    if [[ $failed_checks -gt 0 ]]; then
        log_critical "❌ $failed_checks health checks failed"
        return 1
    fi
    
    log_success "✅ All health checks passed - deployment successful!"
    return 0
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎯 MAIN TOTAL REBUILD ORCHESTRATOR
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

main() {
    log_rebuild "🏗️ TOTAL REBUILD DEPLOYMENT SYSTEM INITIALIZED"
    log_info "Rebuild ID: $REBUILD_ID"
    log_info "ECR: $ECR_REGISTRY/$ECR_REPOSITORY"
    
    # Parameter validation
    if [[ -z "$ECR_REGISTRY" || -z "$ECR_REPOSITORY" ]]; then
        log_critical "Missing required parameters: ECR_REGISTRY and ECR_REPOSITORY"
        exit 1
    fi
    
    # Execute all phases
    if total_system_cleanup && \
       rebuild_database_with_dev_sync && \
       complete_application_rebuild && \
       apply_fresh_migrations && \
       deploy_and_validate; then
        
        log_rebuild "🎉 TOTAL REBUILD SUCCESSFUL: $REBUILD_ID"
        
        # Final summary
        log_info "📊 Total Rebuild Summary:"
        log_info "  - Rebuild ID: $REBUILD_ID"
        log_info "  - Status: SUCCESS"
        log_info "  - Database: Rebuilt with dev data sync"
        log_info "  - Application: Complete rebuild from scratch"
        log_info "  - Cache: All caches cleared"
        log_info "  - Backup: $BACKUP_DIR"
        log_info "  - Log: total_rebuild_${REBUILD_ID}.log"
        
        return 0
    else
        log_critical "💥 TOTAL REBUILD FAILED: $REBUILD_ID"
        
        # Show rollback information
        log_error "🔄 Rollback information:"
        log_error "  - Prod backup: $BACKUP_DIR/prod_before_rebuild.sqlite3"
        log_error "  - Dev backup: $BACKUP_DIR/dev_source.sqlite3"
        
        return 1
    fi
}

# Signal handlers for graceful shutdown
trap 'log_warning "Total rebuild interrupted by signal"; exit 130' INT TERM

# Execute main rebuild orchestrator
main "$@"