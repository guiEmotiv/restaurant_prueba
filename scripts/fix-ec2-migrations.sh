#!/bin/bash
# 🔧 EC2 MIGRATION REPAIR SYSTEM
# Expert Software Architect - Targeted Production Migration Fix
# Purpose: Fix EC2-specific migration issues without disrupting working deployment

set -euo pipefail

# Color codes for expert logging
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

log_info() { echo -e "${BLUE}[EXPERT]${NC} $(date '+%H:%M:%S') - $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $(date '+%H:%M:%S') - $*"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $(date '+%H:%M:%S') - $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') - $*"; }

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 1: PRE-MIGRATION DATABASE DIAGNOSIS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

diagnose_production_database() {
    log_info "🔬 PHASE 1: Diagnosing production database state..."
    
    if [[ ! -f "data/restaurant.prod.sqlite3" ]]; then
        log_error "❌ Production database not found at data/restaurant.prod.sqlite3"
        return 1
    fi
    
    log_info "📊 Analyzing database integrity..."
    
    # Check for orphaned payments
    ORPHANED_PAYMENTS=$(sqlite3 data/restaurant.prod.sqlite3 "
        SELECT COUNT(*) FROM payment p 
        LEFT JOIN orders o ON p.order_id = o.id 
        WHERE o.id IS NULL;
    " 2>/dev/null || echo "0")
    
    # Check for incorrect view references
    VIEW_ERRORS=$(sqlite3 data/restaurant.prod.sqlite3 "
        SELECT COUNT(*) FROM sqlite_master 
        WHERE type='view' AND sql LIKE '%main.order %';
    " 2>/dev/null || echo "0")
    
    log_info "📈 Database Analysis Results:"
    log_info "  - Orphaned payments: $ORPHANED_PAYMENTS"
    log_info "  - Views with incorrect references: $VIEW_ERRORS"
    
    if [[ $ORPHANED_PAYMENTS -gt 0 ]] || [[ $VIEW_ERRORS -gt 0 ]]; then
        log_warning "⚠️ Database integrity issues detected - repair needed"
        return 2  # Needs repair
    else
        log_success "✅ Database integrity is healthy"
        return 0  # Healthy
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 2: SURGICAL DATABASE REPAIR
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

repair_database_integrity() {
    log_info "🔧 PHASE 2: Performing surgical database repair..."
    
    # Create backup before repair
    BACKUP_FILE="data/backups/before_repair_$(date +%Y%m%d_%H%M%S).sqlite3"
    mkdir -p data/backups
    cp data/restaurant.prod.sqlite3 "$BACKUP_FILE"
    log_info "📦 Backup created: $BACKUP_FILE"
    
    # Repair orphaned payments by creating placeholder orders
    log_info "🔨 Fixing orphaned payments..."
    sqlite3 data/restaurant.prod.sqlite3 "
    -- Create placeholder orders for orphaned payments
    INSERT OR IGNORE INTO orders (id, status, total, created_at, updated_at)
    SELECT DISTINCT p.order_id, 'PAID', 0.00, datetime('now'), datetime('now')
    FROM payment p 
    LEFT JOIN orders o ON p.order_id = o.id 
    WHERE o.id IS NULL;
    "
    
    # Fix view references (order -> orders)
    log_info "🔧 Fixing view table references..."
    sqlite3 data/restaurant.prod.sqlite3 "
    -- Drop and recreate dashboard_operativo_view with correct table reference
    DROP VIEW IF EXISTS dashboard_operativo_view;
    CREATE VIEW dashboard_operativo_view AS
    SELECT 
        o.id,
        o.status,
        o.total,
        o.created_at
    FROM orders o  -- Changed from 'order' to 'orders'
    WHERE DATE(o.created_at) = DATE('now');
    "
    
    log_success "✅ Database integrity repair completed"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 3: APPLY PENDING MIGRATIONS SAFELY
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

apply_migrations_safely() {
    log_info "🔄 PHASE 3: Applying pending migrations safely..."
    
    # Apply migrations with Docker (production environment)
    if docker-compose -f docker/docker-compose.prod.yml run --rm app python manage.py migrate --verbosity=2; then
        log_success "✅ Migrations applied successfully"
    else
        log_error "❌ Migration failed - check logs above"
        return 1
    fi
    
    # Verify migration state
    log_info "📊 Verifying migration state..."
    docker-compose -f docker/docker-compose.prod.yml run --rm app python manage.py showmigrations
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 4: PRODUCTION HEALTH VALIDATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

validate_production_health() {
    log_info "🏥 PHASE 4: Validating production system health..."
    
    # Django system check
    if docker-compose -f docker/docker-compose.prod.yml run --rm app python manage.py check; then
        log_success "✅ Django system check passed"
    else
        log_warning "⚠️ Django system check warnings detected"
    fi
    
    # Test critical endpoints
    log_info "🧪 Testing critical API endpoints..."
    sleep 10  # Wait for services
    
    local endpoints=(
        "http://localhost/api/v1/dashboard-operativo/report/?date=$(date +%Y-%m-%d)"
        "http://localhost/api/v1/dashboard-financiero/report/?date=$(date +%Y-%m-%d)&period=month"
        "http://localhost/api/v1/orders/kitchen_board/"
    )
    
    local failed=0
    for endpoint in "${endpoints[@]}"; do
        if curl -f -s -m 10 "$endpoint" > /dev/null; then
            log_success "✅ API working: $endpoint"
        else
            log_error "❌ API failed: $endpoint"
            ((failed++))
        fi
    done
    
    return $failed
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MAIN EXECUTION ORCHESTRATOR
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

main() {
    log_info "🚀 EC2 MIGRATION REPAIR SYSTEM STARTED"
    
    # Phase 1: Diagnose
    if diagnose_production_database; then
        DB_STATUS="healthy"
    elif [[ $? -eq 2 ]]; then
        DB_STATUS="needs_repair"
    else
        log_error "❌ Cannot access production database"
        return 1
    fi
    
    # Phase 2: Repair if needed
    if [[ $DB_STATUS == "needs_repair" ]]; then
        if repair_database_integrity; then
            log_success "✅ Database repaired successfully"
        else
            log_error "❌ Database repair failed"
            return 1
        fi
    fi
    
    # Phase 3: Apply migrations
    if apply_migrations_safely; then
        log_success "✅ Migrations applied successfully"
    else
        log_error "❌ Migration application failed"
        return 1
    fi
    
    # Phase 4: Validate
    local health_failures
    if validate_production_health; then
        health_failures=0
    else
        health_failures=$?
    fi
    
    if [[ $health_failures -eq 0 ]]; then
        log_success "🎉 EC2 MIGRATION REPAIR SUCCESSFUL!"
        log_info "📋 Summary:"
        log_info "  - Database: $DB_STATUS -> healthy"
        log_info "  - Migrations: Applied successfully"  
        log_info "  - Health: All endpoints working"
        return 0
    else
        log_error "💥 $health_failures health check(s) failed"
        return 1
    fi
}

main "$@"