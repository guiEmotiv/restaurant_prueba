#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# Production Deployment Script for Restaurant Management System
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
LOG_FILE="/var/log/deployment.log"

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
    log "Checking deployment requirements..."
    
    # Check if running as root or with sudo
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root. Use a regular user with docker permissions."
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
    fi
    
    # Check .env file
    if [[ ! -f .env ]]; then
        error "Environment file .env not found. Please create it from .env.example"
    fi
    
    # Check critical environment variables
    local required_vars=("DJANGO_SECRET_KEY")
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" .env; then
            error "Required environment variable $var not found in .env file"
        fi
    done
    
    # Check optional AWS variables
    if grep -q "^AWS_ACCESS_KEY_ID=" .env && grep -q "^AWS_SECRET_ACCESS_KEY=" .env; then
        if ! grep -q "^AWS_S3_BUCKET_NAME=" .env; then
            warning "AWS credentials found but AWS_S3_BUCKET_NAME not set"
        fi
    else
        info "AWS credentials not configured - using local static files"
    fi
    
    log "✓ All requirements met"
}

backup_database() {
    log "Creating database backup..."
    
    # Create backup directory
    sudo mkdir -p "$BACKUP_DIR"
    
    # Check if container is running
    if docker ps --format "table {{.Names}}" | grep -q "$CONTAINER_NAME"; then
        # Backup from running container
        docker exec "$CONTAINER_NAME" python manage.py dumpdata --indent 2 > "$BACKUP_DIR/db_backup_$(date +%Y%m%d_%H%M%S).json"
        log "✓ Database backup completed"
    else
        warning "Container not running, skipping database backup"
    fi
}

build_and_deploy() {
    log "Building and deploying application..."
    
    # Pull latest changes
    log "Pulling latest code from repository..."
    git pull origin main || warning "Git pull failed, continuing with local code"
    
    # Stop existing container
    log "Stopping existing containers..."
    docker-compose -f docker-compose.prod.yml down --remove-orphans || true
    
    # Clean up unused Docker resources
    log "Cleaning up Docker resources..."
    docker system prune -f --volumes || true
    
    # Build new image
    log "Building production image..."
    docker-compose -f docker-compose.prod.yml build --no-cache web
    
    # Start services
    log "Starting production services..."
    docker-compose -f docker-compose.prod.yml up -d
    
    log "✓ Application deployed successfully"
}

run_migrations() {
    log "Running database migrations..."
    
    # Wait for container to be healthy
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if docker ps --filter "name=$CONTAINER_NAME" --filter "health=healthy" --format "{{.Names}}" | grep -q "$CONTAINER_NAME"; then
            break
        fi
        info "Waiting for container to be healthy... ($attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done
    
    if [[ $attempt -gt $max_attempts ]]; then
        error "Container failed to become healthy after $((max_attempts * 10)) seconds"
    fi
    
    # Run migrations
    docker exec "$CONTAINER_NAME" python manage.py migrate --noinput
    
    # Collect static files
    docker exec "$CONTAINER_NAME" python manage.py collectstatic --noinput --clear
    
    log "✓ Migrations and static files completed"
}

health_check() {
    log "Performing health check..."
    
    # Check container status
    if ! docker ps --format "table {{.Names}}\t{{.Status}}" | grep "$CONTAINER_NAME" | grep -q "Up"; then
        error "Container is not running"
    fi
    
    # Check application health
    local max_attempts=10
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if docker exec "$CONTAINER_NAME" python manage.py check --deploy; then
            log "✓ Application health check passed"
            break
        fi
        warning "Health check attempt $attempt failed, retrying..."
        sleep 5
        ((attempt++))
    done
    
    if [[ $attempt -gt $max_attempts ]]; then
        error "Application health check failed after $max_attempts attempts"
    fi
}

cleanup_old_images() {
    log "Cleaning up old Docker images..."
    
    # Remove old images
    docker image prune -f --filter "until=24h" || true
    
    log "✓ Cleanup completed"
}

show_status() {
    log "=== Deployment Status ==="
    info "Container Status:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep "$CONTAINER_NAME" || echo "Container not found"
    
    info "Application Logs (last 20 lines):"
    docker logs --tail 20 "$CONTAINER_NAME" 2>/dev/null || echo "No logs available"
    
    info "Health Check:"
    docker exec "$CONTAINER_NAME" python manage.py check --deploy 2>/dev/null && echo "✓ Healthy" || echo "✗ Unhealthy"
}

# Main deployment process
main() {
    log "Starting production deployment..."
    
    check_requirements
    backup_database
    build_and_deploy
    run_migrations
    health_check
    cleanup_old_images
    show_status
    
    log "🚀 Deployment completed successfully!"
    info "Your application is now running at: http://$(curl -s ifconfig.me):8000"
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "status")
        show_status
        ;;
    "backup")
        backup_database
        ;;
    "health")
        health_check
        ;;
    "logs")
        docker logs -f "$CONTAINER_NAME"
        ;;
    "restart")
        log "Restarting application..."
        docker-compose -f docker-compose.prod.yml restart
        health_check
        log "✓ Application restarted"
        ;;
    *)
        echo "Usage: $0 [deploy|status|backup|health|logs|restart]"
        echo ""
        echo "Commands:"
        echo "  deploy  - Full deployment (default)"
        echo "  status  - Show application status"
        echo "  backup  - Create database backup only"
        echo "  health  - Run health check only"
        echo "  logs    - Show application logs"
        echo "  restart - Restart application"
        exit 1
        ;;
esac