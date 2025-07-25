#!/bin/bash

# ============================================================================
# Local EC2 Commands - Run directly on EC2 instance
# For use when you're already SSH'd into the EC2 instance
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if running on EC2
check_environment() {
    if [ ! -d "/opt/restaurant-web" ]; then
        log_error "Not running on EC2 or /opt/restaurant-web not found"
        exit 1
    fi
    cd /opt/restaurant-web
}

# Build and start containers
start() {
    log_info "Starting restaurant application..."
    
    if [ ! -f .env.ec2 ]; then
        log_error ".env.ec2 file not found. Please create it first."
        exit 1
    fi
    
    log_info "Using .env.ec2 configuration:"
    grep -E '^[A-Z_]+=.*' .env.ec2 | sed 's/=.*/=***/' | head -5
    
    log_info "Building and starting containers..."
    docker-compose -f docker-compose.ec2.yml down || true
    docker-compose -f docker-compose.ec2.yml build --no-cache
    docker-compose -f docker-compose.ec2.yml up -d
    
    log_info "Waiting for services to start..."
    sleep 10
    
    log_info "Running database migrations..."
    docker-compose -f docker-compose.ec2.yml exec -T web python manage.py migrate
    
    log_info "Collecting static files..."
    docker-compose -f docker-compose.ec2.yml exec -T web python manage.py collectstatic --noinput
    
    log_success "Application started successfully!"
}

# Check application status
status() {
    log_info "Checking application status..."
    
    echo "🐳 Docker containers status:"
    docker-compose -f docker-compose.ec2.yml ps
    
    echo ""
    echo "💾 Disk usage:"
    df -h /opt/restaurant-web
    
    echo ""
    echo "🔍 Application health check:"
    curl -s -o /dev/null -w "Backend API: %{http_code}\n" http://localhost:8000/api/v1/categories/ || echo "Backend API: FAILED"
    curl -s -o /dev/null -w "Frontend: %{http_code}\n" http://localhost/ || echo "Frontend: FAILED"
}

# View application logs
logs() {
    log_info "Viewing application logs..."
    echo "📋 Recent container logs:"
    docker-compose -f docker-compose.ec2.yml logs --tail=50
}

# Restart application
restart() {
    log_info "Restarting application..."
    docker-compose -f docker-compose.ec2.yml restart
    
    log_info "Waiting for services to restart..."
    sleep 5
    
    log_success "Application restarted!"
}

# Stop application
stop() {
    log_info "Stopping application..."
    docker-compose -f docker-compose.ec2.yml down
    log_success "Application stopped!"
}

# Create database backup
backup() {
    log_info "Creating database backup..."
    
    BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S).sqlite3"
    
    # Create backup directory if it doesn't exist
    mkdir -p data/backups
    
    # Copy database file
    docker-compose -f docker-compose.ec2.yml exec -T web cp /app/db.sqlite3 /app/data/backups/$BACKUP_NAME 2>/dev/null || \
    docker-compose -f docker-compose.ec2.yml exec -T web cp /app/data/restaurant.sqlite3 /app/data/backups/$BACKUP_NAME
    
    log_success "Backup created: data/backups/$BACKUP_NAME"
    
    # List recent backups
    echo "📋 Recent backups:"
    ls -la data/backups/ | tail -5
}

# Show usage
usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Available commands:"
    echo "  start     - Build and start the application"
    echo "  status    - Check application status"
    echo "  logs      - View application logs"
    echo "  restart   - Restart the application"
    echo "  stop      - Stop the application"
    echo "  backup    - Create database backup"
    echo ""
    echo "This script should be run directly on the EC2 instance."
}

# Main script logic
main() {
    check_environment
    
    case "${1:-start}" in
        start)
            start
            ;;
        status)
            status
            ;;
        logs)
            logs
            ;;
        restart)
            restart
            ;;
        stop)
            stop
            ;;
        backup)
            backup
            ;;
        *)
            usage
            ;;
    esac
}

# Run main function with all arguments
main "$@"