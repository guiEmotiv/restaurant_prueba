#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# EC2 + SQLite + Docker Production Deployment Script
# Simple, reliable deployment for Restaurant Management System
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Configuration
APP_NAME="Restaurant Management System"
CONTAINER_NAME="restaurant_web_ec2"
COMPOSE_FILE="docker-compose.ec2.yml"
DATA_DIR="/opt/restaurant-app"
LOG_FILE="$DATA_DIR/logs/deployment.log"

# Create required directories
sudo mkdir -p "$DATA_DIR"/{data,logs,staticfiles,media,backups}
sudo chown -R $(whoami):$(whoami) "$DATA_DIR" 2>/dev/null || true

# Functions
log() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${GREEN}[$timestamp] $message${NC}" | tee -a "$LOG_FILE"
}

error() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${RED}[$timestamp] ERROR: $message${NC}" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${YELLOW}[$timestamp] WARNING: $message${NC}" | tee -a "$LOG_FILE"
}

info() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${BLUE}[$timestamp] INFO: $message${NC}" | tee -a "$LOG_FILE"
}

header() {
    echo -e "${PURPLE}"
    echo "═══════════════════════════════════════════════════════════════════"
    echo "  $1"
    echo "═══════════════════════════════════════════════════════════════════"
    echo -e "${NC}"
}

check_requirements() {
    header "Checking System Requirements"
    
    # Check if running on Linux (EC2)
    if [[ "$OSTYPE" != "linux-gnu"* ]]; then
        warning "This script is optimized for Linux/EC2. Continuing anyway..."
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    docker --version | tee -a "$LOG_FILE"
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
    fi
    docker-compose --version | tee -a "$LOG_FILE"
    
    # Check Docker permissions
    if ! docker ps &> /dev/null; then
        error "Cannot access Docker. Please add your user to docker group: sudo usermod -aG docker $USER"
    fi
    
    # Check .env file
    if [[ ! -f .env ]]; then
        if [[ -f .env.ec2 ]]; then
            warning ".env not found but .env.ec2 exists. Copying .env.ec2 to .env"
            cp .env.ec2 .env
        else
            error "Environment file .env not found. Please create it from .env.ec2"
        fi
    fi
    
    # Check required environment variables
    source .env
    if [[ -z "${DJANGO_SECRET_KEY:-}" ]] || [[ "$DJANGO_SECRET_KEY" == "CHANGE_ME_TO_A_SECURE_SECRET_KEY" ]]; then
        error "DJANGO_SECRET_KEY is not set or using default value. Please update .env file."
    fi
    
    if [[ -z "${EC2_PUBLIC_IP:-}" ]] || [[ "$EC2_PUBLIC_IP" == "127.0.0.1" ]]; then
        warning "EC2_PUBLIC_IP is not set or using default. Application will only be accessible locally."
    fi
    
    log "✓ All requirements met"
}

backup_data() {
    header "Creating Backup"
    
    local backup_file="$DATA_DIR/backups/backup_$(date +%Y%m%d_%H%M%S).tar.gz"
    
    if [[ -f "$DATA_DIR/data/db.sqlite3" ]]; then
        info "Creating database backup..."
        tar -czf "$backup_file" -C "$DATA_DIR" data/db.sqlite3 2>/dev/null || true
        log "✓ Backup created: $backup_file"
    else
        info "No existing database found, skipping backup"
    fi
}

deploy_application() {
    header "Deploying Application"
    
    # Pull latest code if git is available
    if command -v git &> /dev/null && [[ -d .git ]]; then
        info "Pulling latest code..."
        git pull origin main || warning "Git pull failed, continuing with current code"
    fi
    
    # Stop existing containers
    info "Stopping existing containers..."
    docker-compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
    
    # Clean up unused Docker resources
    info "Cleaning up Docker resources..."
    docker system prune -f --volumes 2>/dev/null || true
    
    # Build new images
    log "Building application images..."
    docker-compose -f "$COMPOSE_FILE" build --no-cache web
    
    # Start services
    log "Starting services..."
    docker-compose -f "$COMPOSE_FILE" up -d web
    
    log "✓ Application deployed successfully"
}

wait_for_health() {
    header "Waiting for Application Health"
    
    local max_attempts=30
    local attempt=1
    
    info "Waiting for container to start..."
    sleep 10
    
    while [[ $attempt -le $max_attempts ]]; do
        if docker ps --filter "name=$CONTAINER_NAME" --filter "status=running" --format "{{.Names}}" | grep -q "$CONTAINER_NAME"; then
            # Check if health check passes
            if docker exec "$CONTAINER_NAME" python manage.py check --deploy 2>/dev/null; then
                log "✓ Application is healthy and ready"
                return 0
            fi
        fi
        
        info "Health check attempt $attempt/$max_attempts..."
        sleep 10
        ((attempt++))
    done
    
    error "Application failed to become healthy after $((max_attempts * 10)) seconds"
}

setup_superuser() {
    header "Setting up Admin User"
    
    # Check if superuser environment variables are set
    source .env
    if [[ -n "${DJANGO_SUPERUSER_USERNAME:-}" ]] && [[ -n "${DJANGO_SUPERUSER_PASSWORD:-}" ]] && [[ -n "${DJANGO_SUPERUSER_EMAIL:-}" ]]; then
        info "Superuser environment variables detected, automatic setup completed during container start"
        log "✓ Admin user: $DJANGO_SUPERUSER_USERNAME"
    else
        warning "No superuser environment variables found."
        echo ""
        echo "To create an admin user manually, run:"
        echo "docker exec -it $CONTAINER_NAME python manage.py createsuperuser"
        echo ""
    fi
}

show_deployment_info() {
    header "Deployment Information"
    
    source .env
    local public_ip="${EC2_PUBLIC_IP:-localhost}"
    local domain="${DOMAIN_NAME:-$public_ip}"
    
    info "Application Status:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep "$CONTAINER_NAME" || echo "Container not found"
    
    echo ""
    info "Access URLs:"
    echo "  📱 Application:     http://$domain:8000/"
    echo "  🔧 Admin Panel:     http://$domain:8000/admin/"
    echo "  📖 API Docs:        http://$domain:8000/api/docs/"
    echo "  ❤️  Health Check:   http://$domain:8000/admin/"
    
    echo ""
    info "File Locations:"
    echo "  💾 Database:        $DATA_DIR/data/db.sqlite3"
    echo "  📋 Logs:            $DATA_DIR/logs/"
    echo "  📦 Static Files:    $DATA_DIR/staticfiles/"
    echo "  📁 Media Files:     $DATA_DIR/media/"
    echo "  💾 Backups:         $DATA_DIR/backups/"
    
    echo ""
    info "Useful Commands:"
    echo "  🔍 View logs:       docker logs -f $CONTAINER_NAME"
    echo "  🛠️  Django shell:   docker exec -it $CONTAINER_NAME python manage.py shell"
    echo "  👤 Create user:     docker exec -it $CONTAINER_NAME python manage.py createsuperuser"
    echo "  🔄 Restart app:     $0 restart"
    echo "  📊 Show status:     $0 status"
}

cleanup_old_backups() {
    info "Cleaning up old backups (keeping last 7 days)..."
    find "$DATA_DIR/backups" -name "backup_*.tar.gz" -mtime +7 -delete 2>/dev/null || true
    log "✓ Backup cleanup completed"
}

# Command functions
cmd_deploy() {
    header "Starting $APP_NAME Deployment"
    log "Deployment started by: $(whoami)"
    log "Server: $(hostname)"
    log "Date: $(date)"
    
    check_requirements
    backup_data
    deploy_application
    wait_for_health
    setup_superuser
    cleanup_old_backups
    show_deployment_info
    
    log "🚀 Deployment completed successfully!"
}

cmd_status() {
    header "Application Status"
    show_deployment_info
    
    echo ""
    info "Recent logs (last 20 lines):"
    docker logs --tail 20 "$CONTAINER_NAME" 2>/dev/null || echo "No logs available"
}

cmd_logs() {
    header "Application Logs"
    if docker ps --format "{{.Names}}" | grep -q "$CONTAINER_NAME"; then
        docker logs -f "$CONTAINER_NAME"
    else
        error "Container $CONTAINER_NAME is not running"
    fi
}

cmd_restart() {
    header "Restarting Application"
    docker-compose -f "$COMPOSE_FILE" restart web
    wait_for_health
    log "✓ Application restarted successfully"
}

cmd_stop() {
    header "Stopping Application"
    docker-compose -f "$COMPOSE_FILE" down
    log "✓ Application stopped"
}

cmd_backup() {
    header "Creating Manual Backup"
    backup_data
}

cmd_shell() {
    header "Opening Django Shell"
    if docker ps --format "{{.Names}}" | grep -q "$CONTAINER_NAME"; then
        docker exec -it "$CONTAINER_NAME" python manage.py shell
    else
        error "Container $CONTAINER_NAME is not running"
    fi
}

# Main command handler
case "${1:-deploy}" in
    "deploy"|"")
        cmd_deploy
        ;;
    "status")
        cmd_status
        ;;
    "logs")
        cmd_logs
        ;;
    "restart")
        cmd_restart
        ;;
    "stop")
        cmd_stop
        ;;
    "backup")
        cmd_backup
        ;;
    "shell")
        cmd_shell
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [COMMAND]"
        echo ""
        echo "Commands:"
        echo "  deploy   - Deploy application (default)"
        echo "  status   - Show application status"
        echo "  logs     - Show application logs (follow mode)"
        echo "  restart  - Restart application"
        echo "  stop     - Stop application"
        echo "  backup   - Create manual backup"
        echo "  shell    - Open Django shell"
        echo "  help     - Show this help message"
        ;;
    *)
        error "Unknown command: $1. Use '$0 help' for usage information."
        ;;
esac