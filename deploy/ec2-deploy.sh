#!/bin/bash

# ============================================================================
# EC2 Deployment Script - Restaurant Management System
# Simple deployment without authentication
# ============================================================================

set -e  # Exit on any error

# Configuration
DEPLOY_USER="ubuntu"
APP_NAME="restaurant-web"
APP_DIR="/opt/$APP_NAME"
DOCKER_COMPOSE_FILE="docker-compose.ec2.yml"

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

# Check if EC2_HOST is provided
check_ec2_host() {
    if [ -z "$EC2_HOST" ]; then
        log_error "EC2_HOST environment variable is required"
        echo "Usage: EC2_HOST=your-ec2-ip.amazonaws.com $0 [command]"
        echo ""
        echo "Available commands:"
        echo "  deploy    - Deploy the application"
        echo "  status    - Check application status"
        echo "  logs      - View application logs"
        echo "  restart   - Restart the application"
        echo "  stop      - Stop the application"
        echo "  backup    - Create database backup"
        echo ""
        exit 1
    fi
}

# Deploy application
deploy() {
    log_info "Starting deployment to $EC2_HOST..."
    
    # Step 1: Upload files
    log_info "Uploading application files..."
    rsync -avz --delete \
        --exclude='.git' \
        --exclude='node_modules' \
        --exclude='backend/db.sqlite3' \
        --exclude='backend/__pycache__' \
        --exclude='frontend/dist' \
        --exclude='data/' \
        ./ $DEPLOY_USER@$EC2_HOST:$APP_DIR/
    
    # Step 2: Deploy via SSH
    ssh $DEPLOY_USER@$EC2_HOST << 'ENDSSH'
        set -e
        cd /opt/restaurant-web
        
        echo "🐳 Building and starting containers..."
        docker-compose -f docker-compose.ec2.yml down || true
        docker-compose -f docker-compose.ec2.yml build --no-cache
        docker-compose -f docker-compose.ec2.yml up -d
        
        echo "⏳ Waiting for services to start..."
        sleep 10
        
        echo "🗄️ Running database migrations..."
        docker-compose -f docker-compose.ec2.yml exec -T web python manage.py migrate
        
        echo "📊 Collecting static files..."
        docker-compose -f docker-compose.ec2.yml exec -T web python manage.py collectstatic --noinput
        
        echo "✅ Deployment completed successfully!"
ENDSSH
    
    log_success "Deployment completed! Application is running at http://$EC2_HOST"
}

# Check application status
status() {
    log_info "Checking application status on $EC2_HOST..."
    
    ssh $DEPLOY_USER@$EC2_HOST << 'ENDSSH'
        cd /opt/restaurant-web
        echo "🐳 Docker containers status:"
        docker-compose -f docker-compose.ec2.yml ps
        
        echo ""
        echo "💾 Disk usage:"
        df -h /opt/restaurant-web
        
        echo ""
        echo "🔍 Application health check:"
        curl -s -o /dev/null -w "Backend API: %{http_code}\n" http://localhost:8000/api/v1/categories/ || echo "Backend API: FAILED"
        curl -s -o /dev/null -w "Frontend: %{http_code}\n" http://localhost/ || echo "Frontend: FAILED"
ENDSSH
}

# View application logs
logs() {
    log_info "Viewing application logs on $EC2_HOST..."
    
    ssh $DEPLOY_USER@$EC2_HOST << 'ENDSSH'
        cd /opt/restaurant-web
        echo "📋 Recent container logs:"
        docker-compose -f docker-compose.ec2.yml logs --tail=50
ENDSSH
}

# Restart application
restart() {
    log_info "Restarting application on $EC2_HOST..."
    
    ssh $DEPLOY_USER@$EC2_HOST << 'ENDSSH'
        cd /opt/restaurant-web
        echo "🔄 Restarting containers..."
        docker-compose -f docker-compose.ec2.yml restart
        
        echo "⏳ Waiting for services to restart..."
        sleep 5
        
        echo "✅ Application restarted!"
ENDSSH
    
    log_success "Application restarted successfully!"
}

# Stop application
stop() {
    log_info "Stopping application on $EC2_HOST..."
    
    ssh $DEPLOY_USER@$EC2_HOST << 'ENDSSH'
        cd /opt/restaurant-web
        echo "🛑 Stopping containers..."
        docker-compose -f docker-compose.ec2.yml down
        
        echo "✅ Application stopped!"
ENDSSH
    
    log_success "Application stopped successfully!"
}

# Create database backup
backup() {
    log_info "Creating database backup on $EC2_HOST..."
    
    BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S).sqlite3"
    
    ssh $DEPLOY_USER@$EC2_HOST << ENDSSH
        cd /opt/restaurant-web
        echo "📦 Creating database backup..."
        
        # Create backup directory if it doesn't exist
        mkdir -p data/backups
        
        # Copy database file
        docker-compose -f docker-compose.ec2.yml exec -T web cp /app/db.sqlite3 /app/data/backups/$BACKUP_NAME
        
        echo "✅ Backup created: data/backups/$BACKUP_NAME"
        
        # List recent backups
        echo "📋 Recent backups:"
        ls -la data/backups/ | tail -5
ENDSSH
    
    log_success "Database backup created: $BACKUP_NAME"
}

# Main script logic
main() {
    check_ec2_host
    
    case "${1:-deploy}" in
        deploy)
            deploy
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
            log_error "Unknown command: $1"
            check_ec2_host  # This will show usage
            ;;
    esac
}

# Run main function with all arguments
main "$@"