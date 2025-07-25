#!/bin/bash

# EC2 Deployment Script - Fixed Version
# Restaurant Management System - Production Deployment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_with_timestamp() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Functions
show_help() {
    echo "EC2 Deployment Script - Restaurant Management System"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  deploy    Deploy the application (default)"
    echo "  status    Check application status"
    echo "  logs      View application logs"
    echo "  restart   Restart the application"
    echo "  stop      Stop the application"
    echo "  backup    Create database backup"
    echo "  clean     Clean database and restart"
    echo "  help      Show this help message"
    echo ""
}

check_requirements() {
    print_info "Checking deployment requirements..."
    
    # Check if we're in the right directory
    if [ ! -f "docker-compose.ec2.yml" ]; then
        print_error "docker-compose.ec2.yml not found. Are you in the right directory?"
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running or not accessible"
        exit 1
    fi
    
    # Check if git is available
    if ! command -v git &> /dev/null; then
        print_error "Git is not installed"
        exit 1
    fi
    
    print_status "All requirements met"
}

get_ec2_public_ip() {
    # Try multiple methods to get EC2 public IP
    local public_ip=""
    
    # Method 1: EC2 metadata service
    if command -v curl &> /dev/null; then
        public_ip=$(curl -s --connect-timeout 3 --max-time 5 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "")
        if [[ "$public_ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            echo "$public_ip"
            return 0
        fi
    fi
    
    # Method 2: Environment variable
    if [ -n "${EC2_PUBLIC_IP:-}" ]; then
        echo "$EC2_PUBLIC_IP"
        return 0
    fi
    
    # Method 3: External service
    if command -v curl &> /dev/null; then
        public_ip=$(curl -s --connect-timeout 3 --max-time 5 http://checkip.amazonaws.com/ 2>/dev/null || echo "")
        if [[ "$public_ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            echo "$public_ip"
            return 0
        fi
    fi
    
    # Fallback
    echo "localhost"
}

validate_environment() {
    print_info "Validating environment configuration..."
    
    # Create data directory if it doesn't exist
    mkdir -p data
    
    # Set EC2_PUBLIC_IP environment variable
    export EC2_PUBLIC_IP=$(get_ec2_public_ip)
    print_info "Using IP: $EC2_PUBLIC_IP"
    
    print_status "Environment configuration validated"
}

check_migration_conflict() {
    print_info "Checking for migration conflicts..."
    
    if [ -f "data/db.sqlite3" ]; then
        # Check if database has migration issues
        if docker-compose -f docker-compose.ec2.yml run --rm web python manage.py showmigrations --verbosity=0 2>&1 | grep -q "InconsistentMigrationHistory\|admin.0001_initial is applied before"; then
            print_warning "Migration conflict detected in database"
            print_info "Backing up current database..."
            
            BACKUP_NAME="db_backup_before_clean_$(date +%Y%m%d_%H%M%S).sqlite3"
            cp "data/db.sqlite3" "data/$BACKUP_NAME"
            print_status "Database backed up as: data/$BACKUP_NAME"
            
            print_info "Removing conflicted database..."
            rm -f "data/db.sqlite3"
            print_status "Database removed - fresh migrations will be applied"
        fi
    fi
}

deploy_application() {
    log_with_timestamp "🚀 Starting application deployment..."
    
    check_requirements
    validate_environment
    
    print_info "Creating data directory..."
    mkdir -p data
    print_status "Created data directory"
    
    print_info "Stopping existing containers..."
    docker-compose -f docker-compose.ec2.yml down --remove-orphans || true
    print_status "Stopped existing containers"
    
    # Check for migration conflicts
    check_migration_conflict
    
    log_with_timestamp "🔨 Building application image..."
    docker-compose -f docker-compose.ec2.yml build --no-cache
    print_status "Application built successfully"
    
    log_with_timestamp "🚀 Starting containers..."
    docker-compose -f docker-compose.ec2.yml up -d
    print_status "Containers started"
    
    # Wait for application to be ready
    log_with_timestamp "⏳ Waiting for application to be ready..."
    local max_attempts=30
    local attempt=1
    local container_name="restaurant_web_ec2"
    
    while [ $attempt -le $max_attempts ]; do
        if docker ps --format "table {{.Names}}\\t{{.Status}}" | grep -q "$container_name.*Up.*healthy"; then
            print_status "Application is ready!"
            break
        elif docker ps --format "table {{.Names}}\\t{{.Status}}" | grep -q "$container_name.*Restarting"; then
            print_warning "Container is restarting, checking logs..."
            docker logs "$container_name" --tail 10
            sleep 3
        elif ! docker ps --format "table {{.Names}}" | grep -q "$container_name"; then
            print_error "Container failed to start"
            docker-compose -f docker-compose.ec2.yml logs --tail 50
            exit 1
        else
            sleep 2
        fi
        
        attempt=$((attempt + 1))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        print_error "Application failed to start within expected time"
        print_info "Recent logs:"
        docker-compose -f docker-compose.ec2.yml logs --tail 20
        exit 1
    fi
    
    print_status "Deployment completed successfully!"
    show_application_info
}

show_status() {
    print_info "Application Status"
    echo "=================="
    
    if docker-compose -f docker-compose.ec2.yml ps | grep -q "Up"; then
        print_status "Application is running"
        docker-compose -f docker-compose.ec2.yml ps
    else
        print_warning "Application is not running"
        print_info "Recent logs:"
        docker-compose -f docker-compose.ec2.yml logs --tail 10
    fi
}

show_logs() {
    print_info "Application Logs"
    echo "================"
    docker-compose -f docker-compose.ec2.yml logs -f
}

restart_application() {
    print_info "Restarting application..."
    docker-compose -f docker-compose.ec2.yml restart
    print_status "Application restarted"
}

stop_application() {
    print_info "Stopping application..."
    docker-compose -f docker-compose.ec2.yml down
    print_status "Application stopped"
}

backup_database() {
    print_info "Creating database backup..."
    
    if [ ! -f "data/db.sqlite3" ]; then
        print_error "Database file not found"
        exit 1
    fi
    
    BACKUP_NAME="db_backup_$(date +%Y%m%d_%H%M%S).sqlite3"
    cp "data/db.sqlite3" "data/$BACKUP_NAME"
    
    print_status "Database backup created: data/$BACKUP_NAME"
}

clean_and_restart() {
    print_info "Performing clean restart..."
    
    # Stop containers
    docker-compose -f docker-compose.ec2.yml down --remove-orphans
    
    # Backup and remove database
    if [ -f "data/db.sqlite3" ]; then
        BACKUP_NAME="db_backup_before_clean_$(date +%Y%m%d_%H%M%S).sqlite3"
        cp "data/db.sqlite3" "data/$BACKUP_NAME"
        print_info "Database backed up as: data/$BACKUP_NAME"
        rm -f "data/db.sqlite3"
    fi
    
    # Clean Docker
    docker system prune -f
    
    # Redeploy
    deploy_application
}

show_application_info() {
    local app_url="http://$(get_ec2_public_ip)"
    
    echo ""
    echo "🎉 Restaurant Management System"
    echo "==============================="
    echo "📱 Application: $app_url"
    echo "🔧 Admin Panel: $app_url/admin/"
    echo "📖 API Documentation: $app_url/api/v1/"
    echo ""
    echo "📋 Useful Commands:"
    echo "  Status:  ./deploy/ec2-deploy.sh status"
    echo "  Logs:    ./deploy/ec2-deploy.sh logs"
    echo "  Restart: ./deploy/ec2-deploy.sh restart"
    echo "  Backup:  ./deploy/ec2-deploy.sh backup"
    echo "  Clean:   ./deploy/ec2-deploy.sh clean"
    echo ""
}

# Main script logic
COMMAND=${1:-deploy}

case $COMMAND in
    deploy)
        deploy_application
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    restart)
        restart_application
        ;;
    stop)
        stop_application
        ;;
    backup)
        backup_database
        ;;
    clean)
        clean_and_restart
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "Unknown command: $COMMAND"
        show_help
        exit 1
        ;;
esac