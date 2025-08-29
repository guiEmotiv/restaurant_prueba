#!/bin/bash
# Database Sync Script: Production to Local
# Purpose: Download production database to local environment
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
echo -e "${CYAN}🔄 DATABASE SYNC: PRODUCTION → LOCAL${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Validate prerequisites
validate_prerequisites() {
    log_info "🔍 Validating prerequisites..."
    
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
    
    # Check if production database exists
    if ! ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "[[ -f '/opt/restaurant-web/$PROD_DB_PATH' ]]"; then
        log_error "Production database not found"
        exit 1
    fi
    
    log_success "Prerequisites validated"
}

# Show database information
show_db_info() {
    log_info "📊 Database Information:"
    
    # Get production DB info
    local prod_info=$(ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "
        cd /opt/restaurant-web
        size=\$(du -h '$PROD_DB_PATH' | cut -f1)
        tables=\$(sqlite3 '$PROD_DB_PATH' 'SELECT COUNT(*) FROM sqlite_master WHERE type=\"table\";' 2>/dev/null || echo '0')
        modified=\$(stat -c %Y '$PROD_DB_PATH')
        echo \"\$size|\$tables|\$modified\"
    ")
    
    IFS='|' read -r prod_size prod_tables prod_modified <<< "$prod_info"
    prod_date=$(date -d "@$prod_modified" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "Unknown")
    
    echo -e "  ${BLUE}Production Database:${NC}"
    echo -e "    • Host: $EC2_HOST"
    echo -e "    • Path: /opt/restaurant-web/$PROD_DB_PATH"
    echo -e "    • Size: $prod_size"
    echo -e "    • Tables: $prod_tables"
    echo -e "    • Modified: $prod_date"
    
    # Local DB info if exists
    if [[ -f "$LOCAL_DB" ]]; then
        local local_size=$(du -h "$LOCAL_DB" | cut -f1)
        local local_tables=$(sqlite3 "$LOCAL_DB" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "0")
        local local_date=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$LOCAL_DB" 2>/dev/null || stat -c "%y" "$LOCAL_DB" 2>/dev/null | cut -d' ' -f1,2 || echo "Unknown")
        
        echo -e "\n  ${BLUE}Local Database (current):${NC}"
        echo -e "    • Path: $LOCAL_DB"
        echo -e "    • Size: $local_size"
        echo -e "    • Tables: $local_tables"
        echo -e "    • Modified: $local_date"
    else
        echo -e "\n  ${YELLOW}Local Database: Not found (will be created)${NC}"
    fi
}

# Confirm action
confirm_sync() {
    echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}⚠️  WARNING: This will REPLACE your local database!${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    read -p "Are you sure you want to sync production database to local? (yes/NO): " confirm
    
    if [[ "$confirm" != "yes" ]]; then
        log_warning "Sync cancelled by user"
        exit 0
    fi
}

# Create local backup
create_local_backup() {
    if [[ -f "$LOCAL_DB" ]]; then
        log_info "💾 Creating local database backup..."
        
        # Create backup directory
        mkdir -p data/backups/local
        
        # Create backup
        local backup_file="data/backups/local/backup_before_prod_sync_${TIMESTAMP}.sqlite3"
        cp "$LOCAL_DB" "$backup_file"
        
        log_success "Local backup created: $backup_file"
        
        # Keep only last 5 local backups
        cd data/backups/local
        ls -t backup_*.sqlite3 2>/dev/null | tail -n +6 | xargs -r rm || true
        cd - > /dev/null
    else
        log_info "No local database to backup"
    fi
}

# Download production database
download_database() {
    log_info "📥 Downloading production database..."
    
    # Create data directory if not exists
    mkdir -p data
    
    # Download with progress
    if scp -i "$SSH_KEY" "$EC2_USER@$EC2_HOST:/opt/restaurant-web/$PROD_DB_PATH" "${LOCAL_DB}.tmp"; then
        log_success "Database downloaded successfully"
    else
        log_error "Failed to download database"
        exit 1
    fi
    
    # Verify downloaded database
    if sqlite3 "${LOCAL_DB}.tmp" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" &>/dev/null; then
        # Replace local database
        mv "${LOCAL_DB}.tmp" "$LOCAL_DB"
        log_success "Database verified and installed"
    else
        log_error "Downloaded database is corrupted"
        rm -f "${LOCAL_DB}.tmp"
        exit 1
    fi
}

# Run migrations if needed
run_migrations() {
    log_info "🔄 Checking for pending migrations..."
    
    cd backend
    if python manage.py showmigrations | grep -q "\[ \]"; then
        log_warning "Pending migrations detected"
        read -p "Run migrations now? (yes/NO): " run_migrate
        
        if [[ "$run_migrate" == "yes" ]]; then
            python manage.py migrate
            log_success "Migrations completed"
        else
            log_warning "Skipping migrations - database may not work correctly"
        fi
    else
        log_success "No pending migrations"
    fi
    cd - > /dev/null
}

# Main execution
main() {
    validate_prerequisites
    show_db_info
    confirm_sync
    
    # Create backup before proceeding
    create_local_backup
    
    # Download and install
    if download_database; then
        echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}✅ DATABASE SYNC COMPLETED SUCCESSFULLY!${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "\n📊 Summary:"
        echo -e "  • Source: $EC2_HOST:$PROD_DB_PATH"
        echo -e "  • Destination: $LOCAL_DB"
        echo -e "  • Status: ${GREEN}SUCCESS${NC}"
        
        # Offer to run migrations
        echo ""
        run_migrations
    else
        log_error "Sync failed"
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
        echo "Sync production SQLite database to local environment"
        echo ""
        echo "Options:"
        echo "  --force, -f    Skip confirmation prompt"
        echo "  --help, -h     Show this help message"
        exit 0
        ;;
esac

# Execute main function
main