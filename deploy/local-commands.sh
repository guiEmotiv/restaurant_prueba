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

# Check if running on EC2 and load environment
check_environment() {
    if [ ! -d "/opt/restaurant-web" ]; then
        log_error "Not running on EC2 or /opt/restaurant-web not found"
        exit 1
    fi
    cd /opt/restaurant-web
    
    # Load .env.ec2 variables
    if [ -f .env.ec2 ]; then
        set -a  # Export all variables
        source .env.ec2
        set +a  # Stop exporting
        log_info "Loaded configuration from .env.ec2"
    else
        log_warning ".env.ec2 not found - some commands may not work properly"
    fi
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

# Show configuration info
info() {
    log_info "Restaurant application configuration:"
    
    echo ""
    echo "🔧 Environment Configuration:"
    if [ -f .env.ec2 ]; then
        echo "  DEBUG: ${DEBUG:-Not set}"
        echo "  ALLOWED_HOSTS: ${ALLOWED_HOSTS:-Not set}"
        echo "  EC2_PUBLIC_IP: ${EC2_PUBLIC_IP:-Not set}"
        echo "  DOMAIN_NAME: ${DOMAIN_NAME:-Not set}"
        echo "  TIME_ZONE: ${TIME_ZONE:-Not set}"
        echo "  LANGUAGE_CODE: ${LANGUAGE_CODE:-Not set}"
    else
        echo "  ❌ .env.ec2 file not found"
    fi
    
    echo ""
    echo "📂 File System:"
    echo "  Application directory: $(pwd)"
    echo "  Database file: $(ls -la data/restaurant.sqlite3 2>/dev/null || echo 'Not found')"
    echo "  Log directory: $(ls -ld data/logs 2>/dev/null || echo 'Not found')"
    echo "  Backup directory: $(ls -ld data/backups 2>/dev/null || echo 'Not found')"
    
    echo ""
    echo "🐳 Docker Status:"
    docker-compose -f docker-compose.ec2.yml ps
}

# Show access URLs
urls() {
    log_info "Application access URLs:"
    
    echo ""
    if [ -n "$EC2_PUBLIC_IP" ]; then
        echo "🌐 Using IP from .env.ec2: $EC2_PUBLIC_IP"
        echo ""
        echo "Frontend URLs:"
        echo "  http://$EC2_PUBLIC_IP/"
        if [ -n "$DOMAIN_NAME" ] && [ "$DOMAIN_NAME" != "your-domain.com" ]; then
            echo "  http://$DOMAIN_NAME/"
        fi
        
        echo ""
        echo "Backend API URLs:"
        echo "  http://$EC2_PUBLIC_IP/api/v1/"
        echo "  http://$EC2_PUBLIC_IP/api/v1/categories/"
        echo "  http://$EC2_PUBLIC_IP/api/v1/docs/"
        if [ -n "$DOMAIN_NAME" ] && [ "$DOMAIN_NAME" != "your-domain.com" ]; then
            echo "  http://$DOMAIN_NAME/api/v1/"
        fi
        
        echo ""
        echo "Admin URLs:"
        echo "  http://$EC2_PUBLIC_IP/api/v1/admin/"
        if [ -n "$DOMAIN_NAME" ] && [ "$DOMAIN_NAME" != "your-domain.com" ]; then
            echo "  http://$DOMAIN_NAME/api/v1/admin/"
        fi
    else
        log_warning "EC2_PUBLIC_IP not found in .env.ec2"
        echo "Please configure EC2_PUBLIC_IP in your .env.ec2 file"
    fi
}

# Test connectivity
test() {
    log_info "Testing application connectivity..."
    
    if [ -z "$EC2_PUBLIC_IP" ]; then
        log_error "EC2_PUBLIC_IP not found in .env.ec2"
        return 1
    fi
    
    echo ""
    echo "🔍 Testing local connectivity:"
    
    # Test local Docker containers
    echo -n "  Docker containers: "
    if docker-compose -f docker-compose.ec2.yml ps | grep -q "Up"; then
        echo -e "${GREEN}✅ Running${NC}"
    else
        echo -e "${RED}❌ Not running${NC}"
    fi
    
    # Test local backend
    echo -n "  Backend (localhost:8000): "
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/categories/ | grep -q "200"; then
        echo -e "${GREEN}✅ OK${NC}"
    else
        echo -e "${RED}❌ Failed${NC}"
    fi
    
    # Test local frontend
    echo -n "  Frontend (localhost:80): "
    if curl -s -o /dev/null -w "%{http_code}" http://localhost/ | grep -q "200"; then
        echo -e "${GREEN}✅ OK${NC}"
    else
        echo -e "${RED}❌ Failed${NC}"
    fi
    
    echo ""
    echo "🌐 Testing external connectivity (using $EC2_PUBLIC_IP):"
    
    # Test external backend
    echo -n "  Backend API: "
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://$EC2_PUBLIC_IP/api/v1/categories/ 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ OK (HTTP $HTTP_CODE)${NC}"
    else
        echo -e "${RED}❌ Failed (HTTP $HTTP_CODE)${NC}"
    fi
    
    # Test external frontend
    echo -n "  Frontend: "
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://$EC2_PUBLIC_IP/ 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ OK (HTTP $HTTP_CODE)${NC}"
    else
        echo -e "${RED}❌ Failed (HTTP $HTTP_CODE)${NC}"
    fi
    
    if [ -n "$DOMAIN_NAME" ] && [ "$DOMAIN_NAME" != "your-domain.com" ]; then
        echo ""
        echo "🏷️  Testing domain connectivity (using $DOMAIN_NAME):"
        
        echo -n "  Domain frontend: "
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN_NAME/ 2>/dev/null || echo "000")
        if [ "$HTTP_CODE" = "200" ]; then
            echo -e "${GREEN}✅ OK (HTTP $HTTP_CODE)${NC}"
        else
            echo -e "${RED}❌ Failed (HTTP $HTTP_CODE)${NC}"
        fi
    fi
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
    echo "Configuration commands (using .env.ec2):"
    echo "  info      - Show current configuration and system info"
    echo "  urls      - Show application access URLs (using EC2_PUBLIC_IP)"
    echo "  test      - Test connectivity to application endpoints"
    echo ""
    echo "This script should be run directly on the EC2 instance."
    echo "It will load configuration from .env.ec2 in the current directory."
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
        info)
            info
            ;;
        urls)
            urls
            ;;
        test)
            test
            ;;
        *)
            usage
            ;;
    esac
}

# Run main function with all arguments
main "$@"