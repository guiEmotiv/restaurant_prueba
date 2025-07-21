#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# Database Backup Script for Restaurant Management System
# Supports both PostgreSQL (RDS) and SQLite backups with retention
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
CONTAINER_NAME="restaurant_web_prod"
BACKUP_DIR="/opt/backups"
RETENTION_DAYS=30
LOG_FILE="/var/log/backup.log"

# Functions
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}" | tee -a "$LOG_FILE"
}

check_requirements() {
    log "Checking backup requirements..."
    
    # Check if Docker is running
    if ! docker ps >/dev/null 2>&1; then
        error "Docker is not running or not accessible"
    fi
    
    # Load environment variables if .env exists
    if [[ -f .env ]]; then
        set -a
        source .env
        set +a
    fi
    
    # Create backup directory
    sudo mkdir -p "$BACKUP_DIR"
    sudo chown $(whoami):$(whoami) "$BACKUP_DIR" 2>/dev/null || true
    
    log "✓ Requirements checked"
}

get_database_type() {
    local db_type="unknown"
    
    if [[ -n "${RDS_DB_NAME:-}" ]] && [[ -n "${RDS_HOSTNAME:-}" ]]; then
        db_type="postgresql"
        info "Detected PostgreSQL database"
    else
        # Check if container has SQLite database
        if docker exec "$CONTAINER_NAME" test -f /app/db.sqlite3 2>/dev/null; then
            db_type="sqlite"
            info "Detected SQLite database"
        else
            warning "Could not determine database type"
        fi
    fi
    
    echo "$db_type"
}

backup_postgresql() {
    log "Creating PostgreSQL backup..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/postgresql_backup_${timestamp}.sql"
    local json_backup_file="$BACKUP_DIR/django_data_${timestamp}.json"
    
    # PostgreSQL dump using pg_dump
    info "Creating PostgreSQL dump..."
    docker exec "$CONTAINER_NAME" pg_dump \
        --host="${RDS_HOSTNAME}" \
        --username="${RDS_USERNAME}" \
        --dbname="${RDS_DB_NAME}" \
        --port="${RDS_PORT:-5432}" \
        --no-password \
        --verbose \
        --clean \
        --create \
        --if-exists \
        > "$backup_file" 2>/dev/null || {
        warning "pg_dump not available in container, using Django dumpdata instead"
        rm -f "$backup_file"
    }
    
    # Django dumpdata as fallback or additional backup
    info "Creating Django data dump..."
    docker exec "$CONTAINER_NAME" python manage.py dumpdata \
        --indent 2 \
        --natural-foreign \
        --natural-primary \
        > "$json_backup_file"
    
    # Compress backups
    if [[ -f "$backup_file" ]]; then
        gzip "$backup_file"
        log "✓ PostgreSQL backup completed: ${backup_file}.gz"
    fi
    
    gzip "$json_backup_file"
    log "✓ Django data backup completed: ${json_backup_file}.gz"
}

backup_sqlite() {
    log "Creating SQLite backup..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local sqlite_backup_file="$BACKUP_DIR/sqlite_backup_${timestamp}.db"
    local json_backup_file="$BACKUP_DIR/django_data_${timestamp}.json"
    
    # SQLite database file backup
    info "Copying SQLite database file..."
    docker exec "$CONTAINER_NAME" sqlite3 /app/db.sqlite3 ".backup /tmp/backup.db"
    docker cp "$CONTAINER_NAME:/tmp/backup.db" "$sqlite_backup_file"
    docker exec "$CONTAINER_NAME" rm -f /tmp/backup.db
    
    # Django dumpdata backup
    info "Creating Django data dump..."
    docker exec "$CONTAINER_NAME" python manage.py dumpdata \
        --indent 2 \
        --natural-foreign \
        --natural-primary \
        > "$json_backup_file"
    
    # Compress backups
    gzip "$sqlite_backup_file"
    gzip "$json_backup_file"
    
    log "✓ SQLite backup completed: ${sqlite_backup_file}.gz"
    log "✓ Django data backup completed: ${json_backup_file}.gz"
}

backup_static_files() {
    log "Backing up static files..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local static_backup_file="$BACKUP_DIR/staticfiles_${timestamp}.tar.gz"
    
    # Check if staticfiles exist in container
    if docker exec "$CONTAINER_NAME" test -d /app/staticfiles 2>/dev/null; then
        docker exec "$CONTAINER_NAME" tar -czf /tmp/staticfiles.tar.gz -C /app staticfiles
        docker cp "$CONTAINER_NAME:/tmp/staticfiles.tar.gz" "$static_backup_file"
        docker exec "$CONTAINER_NAME" rm -f /tmp/staticfiles.tar.gz
        log "✓ Static files backup completed: $static_backup_file"
    else
        warning "No static files directory found in container"
    fi
}

upload_to_s3() {
    if [[ -n "${AWS_S3_BACKUP_BUCKET:-}" ]] && command -v aws &> /dev/null; then
        log "Uploading backups to S3..."
        
        # Configure AWS CLI
        export AWS_ACCESS_KEY_ID
        export AWS_SECRET_ACCESS_KEY
        export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
        
        # Upload recent backups (last 24 hours)
        find "$BACKUP_DIR" -name "*.gz" -mtime -1 -exec aws s3 cp {} "s3://$AWS_S3_BACKUP_BUCKET/backups/" \;
        find "$BACKUP_DIR" -name "*.tar.gz" -mtime -1 -exec aws s3 cp {} "s3://$AWS_S3_BACKUP_BUCKET/backups/" \;
        
        log "✓ Backups uploaded to S3"
    else
        info "S3 backup not configured (AWS_S3_BACKUP_BUCKET not set or AWS CLI not available)"
    fi
}

cleanup_old_backups() {
    log "Cleaning up old backups..."
    
    # Remove local backups older than retention period
    find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    
    # Clean up S3 backups if configured
    if [[ -n "${AWS_S3_BACKUP_BUCKET:-}" ]] && command -v aws &> /dev/null; then
        info "Cleaning up old S3 backups..."
        aws s3 ls "s3://$AWS_S3_BACKUP_BUCKET/backups/" --recursive | \
        awk '$1 < "'$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d)'" {print $4}' | \
        xargs -I {} aws s3 rm "s3://$AWS_S3_BACKUP_BUCKET/{}" 2>/dev/null || true
    fi
    
    log "✓ Old backups cleaned up (older than $RETENTION_DAYS days)"
}

verify_backup() {
    log "Verifying backup integrity..."
    
    local latest_backup=$(find "$BACKUP_DIR" -name "*$(date +%Y%m%d)*.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
    
    if [[ -n "$latest_backup" ]] && [[ -f "$latest_backup" ]]; then
        # Test if the backup file is a valid gzip file
        if gzip -t "$latest_backup" 2>/dev/null; then
            local backup_size=$(stat -c%s "$latest_backup")
            if [[ $backup_size -gt 1024 ]]; then
                log "✓ Backup verification passed: $latest_backup ($backup_size bytes)"
            else
                warning "Backup file seems too small: $backup_size bytes"
            fi
        else
            error "Backup file is corrupted: $latest_backup"
        fi
    else
        warning "No recent backup file found for verification"
    fi
}

show_backup_status() {
    log "=== Backup Status ==="
    
    info "Backup directory: $BACKUP_DIR"
    info "Retention period: $RETENTION_DAYS days"
    
    if [[ -d "$BACKUP_DIR" ]]; then
        info "Available backups:"
        ls -lah "$BACKUP_DIR"/*.gz 2>/dev/null | tail -10 || echo "No backup files found"
        
        info "Disk usage:"
        du -sh "$BACKUP_DIR" 2>/dev/null || echo "Backup directory not accessible"
        
        info "Backup count by type:"
        echo "PostgreSQL: $(ls "$BACKUP_DIR"/postgresql_backup_*.gz 2>/dev/null | wc -l)"
        echo "SQLite: $(ls "$BACKUP_DIR"/sqlite_backup_*.gz 2>/dev/null | wc -l)"
        echo "Django data: $(ls "$BACKUP_DIR"/django_data_*.gz 2>/dev/null | wc -l)"
        echo "Static files: $(ls "$BACKUP_DIR"/staticfiles_*.tar.gz 2>/dev/null | wc -l)"
    else
        warning "Backup directory not found"
    fi
}

restore_backup() {
    local backup_file="$1"
    
    if [[ ! -f "$backup_file" ]]; then
        error "Backup file not found: $backup_file"
    fi
    
    log "Restoring from backup: $backup_file"
    
    # Determine backup type and restore accordingly
    if [[ "$backup_file" =~ postgresql_backup_ ]]; then
        warning "PostgreSQL restore requires manual intervention"
        info "To restore PostgreSQL backup:"
        info "1. Stop the application: docker-compose -f docker-compose.prod.yml down"
        info "2. Restore database: zcat $backup_file | psql -h \$RDS_HOSTNAME -U \$RDS_USERNAME \$RDS_DB_NAME"
        info "3. Restart application: docker-compose -f docker-compose.prod.yml up -d"
    elif [[ "$backup_file" =~ sqlite_backup_ ]]; then
        warning "This will replace the current SQLite database. Continue? (y/N)"
        read -r confirm
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            docker-compose -f docker-compose.prod.yml down
            zcat "$backup_file" | docker run -i --rm -v "$(pwd):/workspace" -w /workspace alpine:latest sh -c "cat > db.sqlite3"
            docker-compose -f docker-compose.prod.yml up -d
            log "✓ SQLite database restored"
        else
            info "Restore cancelled"
        fi
    elif [[ "$backup_file" =~ django_data_ ]]; then
        warning "This will load data into the current database. Continue? (y/N)"
        read -r confirm
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            zcat "$backup_file" | docker exec -i "$CONTAINER_NAME" python manage.py loaddata --format=json -
            log "✓ Django data restored"
        else
            info "Restore cancelled"
        fi
    else
        error "Unknown backup file type: $backup_file"
    fi
}

# Main backup process
main() {
    log "Starting database backup..."
    
    check_requirements
    
    # Check if container is running
    if ! docker ps --format "{{.Names}}" | grep -q "$CONTAINER_NAME"; then
        error "Container '$CONTAINER_NAME' is not running"
    fi
    
    local db_type=$(get_database_type)
    
    case "$db_type" in
        "postgresql")
            backup_postgresql
            ;;
        "sqlite")
            backup_sqlite
            ;;
        *)
            error "Unsupported or unknown database type: $db_type"
            ;;
    esac
    
    backup_static_files
    upload_to_s3
    verify_backup
    cleanup_old_backups
    show_backup_status
    
    log "🗄️ Backup completed successfully!"
}

# Handle script arguments
case "${1:-backup}" in
    "backup")
        main
        ;;
    "status")
        show_backup_status
        ;;
    "restore")
        if [[ -z "${2:-}" ]]; then
            error "Please specify backup file to restore from"
        fi
        restore_backup "$2"
        ;;
    "cleanup")
        cleanup_old_backups
        ;;
    "list")
        info "Available backups in $BACKUP_DIR:"
        ls -lah "$BACKUP_DIR"/*.gz 2>/dev/null || echo "No backup files found"
        ;;
    *)
        echo "Usage: $0 [backup|status|restore <file>|cleanup|list]"
        echo ""
        echo "Commands:"
        echo "  backup          - Create database backup (default)"
        echo "  status          - Show backup status and statistics"
        echo "  restore <file>  - Restore from backup file"
        echo "  cleanup         - Remove old backups"
        echo "  list            - List available backups"
        exit 1
        ;;
esac