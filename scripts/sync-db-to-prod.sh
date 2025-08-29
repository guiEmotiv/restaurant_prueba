#!/bin/bash
# Database Sync Script: Local to Production
# Purpose: Safely sync local SQLite database to EC2 production
# Author: Expert Software Architect

set -euo pipefail

# Configuration
LOCAL_DB="data/restaurant.local.sqlite3"
PROD_DB="restaurant.prod.sqlite3"
PROD_DB_PATH="data/${PROD_DB}"
EC2_HOST="${EC2_HOST:-ec2-44-248-47-186.us-west-2.compute.amazonaws.com}"
EC2_USER="${EC2_USER:-ubuntu}"
SSH_KEY="${SSH_KEY:-ubuntu_fds_key.pem}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Header
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}🔄 DATABASE SYNC: LOCAL → PRODUCTION${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Validate prerequisites
validate_prerequisites() {
    log_info "🔍 Validating prerequisites..."
    
    # Check local database exists
    if [[ ! -f "$LOCAL_DB" ]]; then
        log_error "Local database not found: $LOCAL_DB"
        exit 1
    fi
    
    # Check SSH key exists
    if [[ ! -f "$SSH_KEY" ]]; then
        log_error "SSH key not found: $SSH_KEY"
        exit 1
    fi
    
    # Test SSH connection
    if ! ssh -i "$SSH_KEY" -o ConnectTimeout=5 -o StrictHostKeyChecking=yes "$EC2_USER@$EC2_HOST" "echo 'SSH connection successful'" &>/dev/null; then
        log_error "Cannot connect to EC2 instance"
        exit 1
    fi
    
    log_success "Prerequisites validated"
}

# Show database information
show_db_info() {
    log_info "📊 Database Information:"
    
    # Local DB info
    local local_size=$(du -h "$LOCAL_DB" | cut -f1)
    local local_tables=$(sqlite3 "$LOCAL_DB" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "0")
    
    echo -e "  ${BLUE}Local Database:${NC}"
    echo -e "    • Path: $LOCAL_DB"
    echo -e "    • Size: $local_size"
    echo -e "    • Tables: $local_tables"
    
    # Get production DB info
    local prod_info=$(ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "
        if [[ -f '/opt/restaurant-web/$PROD_DB_PATH' ]]; then
            size=\$(du -h '/opt/restaurant-web/$PROD_DB_PATH' | cut -f1)
            tables=\$(sqlite3 '/opt/restaurant-web/$PROD_DB_PATH' 'SELECT COUNT(*) FROM sqlite_master WHERE type=\"table\";' 2>/dev/null || echo '0')
            echo \"\$size|\$tables\"
        else
            echo 'Not found|0'
        fi
    ")
    
    IFS='|' read -r prod_size prod_tables <<< "$prod_info"
    
    echo -e "\n  ${BLUE}Production Database:${NC}"
    echo -e "    • Host: $EC2_HOST"
    echo -e "    • Path: /opt/restaurant-web/$PROD_DB_PATH"
    echo -e "    • Size: $prod_size"
    echo -e "    • Tables: $prod_tables"
}

# Confirm action
confirm_sync() {
    echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}⚠️  WARNING: This will REPLACE the production database!${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    read -p "Are you sure you want to sync local database to production? (yes/NO): " confirm
    
    if [[ "$confirm" != "yes" ]]; then
        log_warning "Sync cancelled by user"
        exit 0
    fi
}

# Create production backup
create_prod_backup() {
    log_info "💾 Creating production database backup..."
    
    ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" << EOF
        set -e
        cd /opt/restaurant-web
        
        # Create backup directory if not exists
        mkdir -p data/backups/prod
        
        # Check if production DB exists
        if [[ -f "$PROD_DB_PATH" ]]; then
            # Create backup
            cp "$PROD_DB_PATH" "data/backups/prod/backup_before_sync_${TIMESTAMP}.sqlite3"
            echo "Backup created: backup_before_sync_${TIMESTAMP}.sqlite3"
            
            # Keep only last 10 backups
            cd data/backups/prod
            ls -t backup_*.sqlite3 2>/dev/null | tail -n +11 | xargs -r rm
        else
            echo "No production database to backup"
        fi
EOF
    
    log_success "Backup completed"
}

# Upload local database
upload_database() {
    log_info "📤 Uploading local database to production..."
    
    # Create temp copy with production name
    local temp_db="/tmp/${PROD_DB}_${TIMESTAMP}"
    cp "$LOCAL_DB" "$temp_db"
    
    # Upload to EC2
    if scp -i "$SSH_KEY" "$temp_db" "$EC2_USER@$EC2_HOST:/tmp/${PROD_DB}_upload"; then
        log_success "Database uploaded successfully"
    else
        log_error "Failed to upload database"
        rm -f "$temp_db"
        exit 1
    fi
    
    # Clean up temp file
    rm -f "$temp_db"
}

# Deploy new database
deploy_database() {
    log_info "🚀 Deploying new database..."
    
    ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" << EOF
        set -e
        cd /opt/restaurant-web
        
        # Stop services
        echo "Stopping services..."
        docker-compose -f docker/docker-compose.prod.yml --profile production down || true
        
        # Deploy new database
        echo "Deploying new database..."
        mkdir -p data
        mv "/tmp/${PROD_DB}_upload" "$PROD_DB_PATH"
        
        # Set permissions
        chmod 644 "$PROD_DB_PATH"
        
        # Verify database
        if sqlite3 "$PROD_DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" &>/dev/null; then
            echo "Database verified successfully"
        else
            echo "ERROR: Database verification failed"
            exit 1
        fi
        
        # Restart services
        echo "Restarting services..."
        docker-compose -f docker/docker-compose.prod.yml --profile production up -d
        
        # Wait for services
        sleep 10
EOF
    
    log_success "Database deployed successfully"
}

# Validate deployment
validate_deployment() {
    log_info "🏥 Validating deployment..."
    
    local validation_passed=true
    
    # Check container health
    log_info "Checking container health..."
    local container_status=$(ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "docker ps --filter 'name=restaurant-web-app' --format '{{.Status}}'")
    
    if [[ "$container_status" == *"healthy"* ]] || [[ "$container_status" == *"Up"* ]]; then
        log_success "Container is healthy"
    else
        log_error "Container is not healthy: $container_status"
        validation_passed=false
    fi
    
    # Test APIs
    log_info "Testing APIs..."
    local api_endpoints=(
        "http://$EC2_HOST/api/v1/dashboard-operativo/report/?date=$(date +%Y-%m-%d)"
        "http://$EC2_HOST/api/v1/dashboard-financiero/report/?date=$(date +%Y-%m-%d)&period=month"
        "http://$EC2_HOST/api/v1/orders/kitchen_board/"
    )
    
    for endpoint in "${api_endpoints[@]}"; do
        local http_code=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint" 2>/dev/null || echo "000")
        if [[ "$http_code" == "200" ]]; then
            log_success "API endpoint working: ${endpoint##*/}"
        else
            log_error "API endpoint failed (HTTP $http_code): ${endpoint##*/}"
            validation_passed=false
        fi
    done
    
    if [[ "$validation_passed" == true ]]; then
        log_success "All validations passed!"
    else
        log_error "Some validations failed"
        return 1
    fi
}

# Rollback on failure
rollback() {
    log_error "🔄 Initiating rollback..."
    
    ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" << EOF
        set -e
        cd /opt/restaurant-web
        
        # Stop services
        docker-compose -f docker/docker-compose.prod.yml --profile production down || true
        
        # Find latest backup
        latest_backup=\$(ls -t data/backups/prod/backup_before_sync_*.sqlite3 2>/dev/null | head -1)
        
        if [[ -n "\$latest_backup" ]]; then
            echo "Restoring from: \$latest_backup"
            cp "\$latest_backup" "$PROD_DB_PATH"
            
            # Restart services
            docker-compose -f docker/docker-compose.prod.yml --profile production up -d
            
            echo "Rollback completed"
        else
            echo "ERROR: No backup found for rollback"
            exit 1
        fi
EOF
}

# Main execution
main() {
    validate_prerequisites
    show_db_info
    confirm_sync
    
    # Create backup before proceeding
    create_prod_backup
    
    # Upload and deploy
    if upload_database; then
        if deploy_database; then
            if validate_deployment; then
                echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                echo -e "${GREEN}✅ DATABASE SYNC COMPLETED SUCCESSFULLY!${NC}"
                echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                echo -e "\n📊 Summary:"
                echo -e "  • Source: $LOCAL_DB"
                echo -e "  • Destination: $EC2_HOST:$PROD_DB_PATH"
                echo -e "  • Backup: backup_before_sync_${TIMESTAMP}.sqlite3"
                echo -e "  • Status: ${GREEN}SUCCESS${NC}"
            else
                log_error "Validation failed, rolling back..."
                rollback
                exit 1
            fi
        else
            log_error "Deployment failed"
            exit 1
        fi
    else
        log_error "Upload failed"
        exit 1
    fi
}

# Handle script arguments
case "${1:-}" in
    "--force"|"-f")
        log_warning "Force mode enabled - skipping confirmation"
        confirm="yes"
        ;;
    "--help"|"-h")
        echo "Usage: $0 [--force|-f] [--help|-h]"
        echo ""
        echo "Sync local SQLite database to EC2 production"
        echo ""
        echo "Options:"
        echo "  --force, -f    Skip confirmation prompt"
        echo "  --help, -h     Show this help message"
        exit 0
        ;;
esac

# Execute main function
main