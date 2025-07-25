#!/bin/bash

# ============================================================================
# EC2 Deployment Script - Restaurant Management System
# Works both from local machine and from within EC2
# ============================================================================

set -e  # Exit on any error

# Configuration
DEPLOY_USER="ubuntu"
APP_NAME="restaurant-web"
APP_DIR="/opt/$APP_NAME"

# Detect if running on EC2 vs local machine
RUNNING_ON_EC2=false
if [ -d "/opt/restaurant-web" ] && [ -f "/opt/restaurant-web/.env.ec2" ]; then
    RUNNING_ON_EC2=true
    cd /opt/restaurant-web
    
    # Load .env.ec2 variables when running on EC2
    set -a  # Export all variables
    source .env.ec2
    set +a  # Stop exporting
    
    # Set EC2_HOST from .env.ec2 file
    if [ -n "$EC2_PUBLIC_IP" ]; then
        EC2_HOST="$EC2_PUBLIC_IP"
        echo "🔧 Running on EC2 - loaded configuration from .env.ec2"
        echo "📍 Using EC2_PUBLIC_IP: $EC2_PUBLIC_IP"
    fi
fi

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

# Check if EC2_HOST is provided or can be determined
check_ec2_host() {
    if [ "$RUNNING_ON_EC2" = true ]; then
        if [ -z "$EC2_HOST" ]; then
            log_warning "EC2_PUBLIC_IP not found in .env.ec2, using localhost"
            EC2_HOST="localhost"
        fi
        return 0
    fi
    
    if [ -z "$EC2_HOST" ]; then
        log_error "EC2_HOST environment variable is required when running from local machine"
        echo "Usage when running from local machine:"
        echo "  EC2_HOST=your-ec2-ip.amazonaws.com $0 [command]"
        echo ""
        echo "Usage when running on EC2 (automatically detects configuration):"
        echo "  sudo $0 [command]"
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
    if [ "$RUNNING_ON_EC2" = true ]; then
        deploy_on_ec2
    else
        deploy_from_local
    fi
}

# Deploy when running on EC2
deploy_on_ec2() {
    log_info "Deploying locally on EC2..."
    
    # Step 1: Verify .env.ec2 configuration
    log_info "Verifying .env.ec2 configuration..."
    if [ -f .env.ec2 ]; then
        log_success "Using .env.ec2 configuration:"
        grep -E '^[A-Z_]+=.*' .env.ec2 | sed 's/=.*/=***/' | head -5
    else
        log_error ".env.ec2 file missing!"
        exit 1
    fi
    
    # Step 2: Build frontend if needed
    log_info "Checking frontend..."
    if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
        if [ ! -d "frontend/dist" ] || [ "frontend/package.json" -nt "frontend/dist" ]; then
            log_info "Building frontend..."
            cd frontend
            npm ci
            npm run build
            cd ..
        else
            log_info "Frontend already built and up to date"
        fi
    else
        log_warning "Frontend directory or package.json not found"
    fi
    
    # Step 3: Deploy containers
    log_info "Deploying Docker containers..."
    
    log_info "Stopping existing containers..."
    docker-compose -f docker-compose.ec2.yml down || true
    
    log_info "Building Docker images..."
    docker-compose -f docker-compose.ec2.yml build --no-cache
    
    log_info "Starting containers..."
    docker-compose -f docker-compose.ec2.yml up -d
    
    log_info "Waiting for services to start..."
    sleep 15
    
    log_info "Running database migrations..."
    docker-compose -f docker-compose.ec2.yml exec -T web python manage.py migrate
    
    log_info "Collecting static files..."
    docker-compose -f docker-compose.ec2.yml exec -T web python manage.py collectstatic --noinput
    
    # Step 4: Health checks
    log_info "Checking application health..."
    sleep 5
    if curl -f http://localhost:8000/api/v1/categories/ > /dev/null 2>&1; then
        log_success "Backend API is responding"
    else
        log_error "Backend API is not responding"
        docker-compose -f docker-compose.ec2.yml logs web
    fi
    
    if curl -f http://localhost/ > /dev/null 2>&1; then
        log_success "Frontend is responding"
    else
        log_error "Frontend is not responding"
        docker-compose -f docker-compose.ec2.yml logs nginx
    fi
    
    log_success "Deployment completed! Application is running at:"
    log_success "  Local: http://localhost/"
    if [ -n "$EC2_PUBLIC_IP" ]; then
        log_success "  Public: http://$EC2_PUBLIC_IP/"
    fi
}

# Deploy from local machine
deploy_from_local() {
    log_info "Starting deployment from local machine to $EC2_HOST..."
    
    # Step 1: Check if .env.ec2 exists on remote
    log_info "Checking .env.ec2 configuration on EC2..."
    ssh $DEPLOY_USER@$EC2_HOST << 'ENDSSH'
        if [ ! -f /opt/restaurant-web/.env.ec2 ]; then
            echo "❌ ERROR: .env.ec2 file not found in /opt/restaurant-web/"
            echo "Please create your .env.ec2 file with the required environment variables"
            echo "Example variables needed:"
            echo "  DJANGO_SECRET_KEY=your-secret-key"
            echo "  DEBUG=0"
            echo "  EC2_PUBLIC_IP=your-ec2-ip"
            exit 1
        else
            echo "✅ .env.ec2 configuration found"
        fi
ENDSSH
    
    if [ $? -ne 0 ]; then
        log_error "Deployment aborted. Please configure .env.ec2 file on EC2 first."
        exit 1
    fi
    
    # Step 2: Build frontend locally
    log_info "Building frontend locally..."
    if [ -d "frontend" ]; then
        cd frontend
        if [ -f package.json ]; then
            log_info "Installing frontend dependencies..."
            npm ci
            log_info "Building frontend for production..."
            npm run build
            cd ..
        else
            log_error "No package.json found in frontend directory"
            exit 1
        fi
    else
        log_error "Frontend directory not found"
        exit 1
    fi
    
    # Step 3: Upload application files (excluding .env.ec2 to preserve it)
    log_info "Uploading application files..."
    rsync -avz --delete \
        --exclude='.git' \
        --exclude='node_modules' \
        --exclude='backend/db.sqlite3' \
        --exclude='backend/__pycache__' \
        --exclude='data/' \
        --exclude='.env.ec2' \
        ./ $DEPLOY_USER@$EC2_HOST:$APP_DIR/
    
    # Step 4: Deploy via SSH
    log_info "Deploying on EC2..."
    ssh $DEPLOY_USER@$EC2_HOST << 'ENDSSH'
        set -e
        cd /opt/restaurant-web
        
        echo "📋 Verifying .env.ec2 configuration..."
        if [ -f .env.ec2 ]; then
            echo "✅ Using .env.ec2 configuration:"
            grep -E '^[A-Z_]+=.*' .env.ec2 | sed 's/=.*/=***/' | head -5
        else
            echo "❌ .env.ec2 file missing!"
            exit 1
        fi
        
        echo "🐳 Stopping existing containers..."
        docker-compose -f docker-compose.ec2.yml down || true
        
        echo "🔨 Building Docker images..."
        docker-compose -f docker-compose.ec2.yml build --no-cache
        
        echo "🚀 Starting containers..."
        docker-compose -f docker-compose.ec2.yml up -d
        
        echo "⏳ Waiting for services to start..."
        sleep 15
        
        echo "🗄️ Running database migrations..."
        docker-compose -f docker-compose.ec2.yml exec -T web python manage.py migrate
        
        echo "📊 Collecting static files..."
        docker-compose -f docker-compose.ec2.yml exec -T web python manage.py collectstatic --noinput
        
        echo "🔍 Checking application health..."
        sleep 5
        if curl -f http://localhost:8000/api/v1/categories/ > /dev/null 2>&1; then
            echo "✅ Backend API is responding"
        else
            echo "❌ Backend API is not responding"
            docker-compose -f docker-compose.ec2.yml logs web
        fi
        
        if curl -f http://localhost/ > /dev/null 2>&1; then
            echo "✅ Frontend is responding"
        else
            echo "❌ Frontend is not responding"
            docker-compose -f docker-compose.ec2.yml logs nginx
        fi
        
        echo "✅ Deployment completed successfully!"
ENDSSH
    
    log_success "Deployment completed! Application is running at http://$EC2_HOST"
    log_info "You can also check status with: EC2_HOST=$EC2_HOST $0 status"
}

# Check application status
status() {
    if [ "$RUNNING_ON_EC2" = true ]; then
        status_on_ec2
    else
        status_from_local
    fi
}

# Check status when running on EC2
status_on_ec2() {
    log_info "Checking application status locally on EC2..."
    
    echo "🐳 Docker containers status:"
    docker-compose -f docker-compose.ec2.yml ps
    
    echo ""
    echo "💾 Disk usage:"
    df -h /opt/restaurant-web
    
    echo ""
    echo "🔍 Application health check:"
    curl -s -o /dev/null -w "Backend API: %{http_code}\n" http://localhost:8000/api/v1/categories/ || echo "Backend API: FAILED"
    curl -s -o /dev/null -w "Frontend: %{http_code}\n" http://localhost/ || echo "Frontend: FAILED"
    
    if [ -n "$EC2_PUBLIC_IP" ]; then
        echo ""
        echo "🌐 External access check (using $EC2_PUBLIC_IP):"
        curl -s -o /dev/null -w "Public API: %{http_code}\n" http://$EC2_PUBLIC_IP/api/v1/categories/ || echo "Public API: FAILED"
        curl -s -o /dev/null -w "Public Frontend: %{http_code}\n" http://$EC2_PUBLIC_IP/ || echo "Public Frontend: FAILED"
    fi
    
    echo ""
    echo "📋 Configuration status:"
    if [ -f .env.ec2 ]; then
        log_success ".env.ec2 file exists"
        echo "Key variables:"
        grep -E '^[A-Z_]+=.*' .env.ec2 | sed 's/=.*/=***/' | head -5
    else
        log_error ".env.ec2 file missing"
    fi
}

# Check status from local machine
status_from_local() {
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
        
        echo ""
        echo "📋 Configuration status:"
        if [ -f .env.ec2 ]; then
            echo "✅ .env.ec2 file exists"
            echo "Key variables:"
            grep -E '^[A-Z_]+=.*' .env.ec2 | sed 's/=.*/=***/' | head -5
        else
            echo "❌ .env.ec2 file missing"
        fi
ENDSSH
}

# View application logs
logs() {
    if [ "$RUNNING_ON_EC2" = true ]; then
        log_info "Viewing application logs locally..."
        echo "📋 Recent container logs:"
        docker-compose -f docker-compose.ec2.yml logs --tail=50
    else
        log_info "Viewing application logs on $EC2_HOST..."
        ssh $DEPLOY_USER@$EC2_HOST << 'ENDSSH'
            cd /opt/restaurant-web
            echo "📋 Recent container logs:"
            docker-compose -f docker-compose.ec2.yml logs --tail=50
ENDSSH
    fi
}

# Restart application
restart() {
    if [ "$RUNNING_ON_EC2" = true ]; then
        log_info "Restarting application locally..."
        echo "🔄 Restarting containers..."
        docker-compose -f docker-compose.ec2.yml restart
        
        echo "⏳ Waiting for services to restart..."
        sleep 10
        
        echo "🔍 Checking health after restart..."
        curl -s -o /dev/null -w "Backend API: %{http_code}\n" http://localhost:8000/api/v1/categories/ || echo "Backend API: FAILED"
        curl -s -o /dev/null -w "Frontend: %{http_code}\n" http://localhost/ || echo "Frontend: FAILED"
        
        log_success "Application restarted!"
    else
        log_info "Restarting application on $EC2_HOST..."
        ssh $DEPLOY_USER@$EC2_HOST << 'ENDSSH'
            cd /opt/restaurant-web
            echo "🔄 Restarting containers..."
            docker-compose -f docker-compose.ec2.yml restart
            
            echo "⏳ Waiting for services to restart..."
            sleep 10
            
            echo "🔍 Checking health after restart..."
            curl -s -o /dev/null -w "Backend API: %{http_code}\n" http://localhost:8000/api/v1/categories/ || echo "Backend API: FAILED"
            curl -s -o /dev/null -w "Frontend: %{http_code}\n" http://localhost/ || echo "Frontend: FAILED"
            
            echo "✅ Application restarted!"
ENDSSH
        log_success "Application restarted successfully!"
    fi
}

# Stop application
stop() {
    if [ "$RUNNING_ON_EC2" = true ]; then
        stop_on_ec2
    else
        stop_from_local
    fi
}

# Stop when running on EC2
stop_on_ec2() {
    log_info "Stopping application locally on EC2..."
    echo "🛑 Stopping containers..."
    docker-compose -f docker-compose.ec2.yml down
    log_success "Application stopped!"
}

# Stop from local machine
stop_from_local() {
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
    if [ "$RUNNING_ON_EC2" = true ]; then
        backup_on_ec2
    else
        backup_from_local
    fi
}

# Backup when running on EC2
backup_on_ec2() {
    log_info "Creating database backup locally on EC2..."
    
    BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S).sqlite3"
    
    echo "📦 Creating database backup..."
    
    # Create backup directory if it doesn't exist
    mkdir -p data/backups
    
    # Copy database file
    if docker-compose -f docker-compose.ec2.yml ps | grep -q web; then
        docker-compose -f docker-compose.ec2.yml exec -T web cp /app/data/restaurant.sqlite3 /app/data/backups/$BACKUP_NAME || \
        docker-compose -f docker-compose.ec2.yml exec -T web cp /app/db.sqlite3 /app/data/backups/$BACKUP_NAME
    else
        log_error "Web container not running"
        exit 1
    fi
    
    log_success "Backup created: data/backups/$BACKUP_NAME"
    
    # List recent backups
    echo "📋 Recent backups:"
    ls -la data/backups/ | tail -5
}

# Backup from local machine
backup_from_local() {
    log_info "Creating database backup on $EC2_HOST..."
    
    BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S).sqlite3"
    
    ssh $DEPLOY_USER@$EC2_HOST << ENDSSH
        cd /opt/restaurant-web
        echo "📦 Creating database backup..."
        
        # Create backup directory if it doesn't exist
        mkdir -p data/backups
        
        # Copy database file
        if docker-compose -f docker-compose.ec2.yml ps | grep -q web; then
            docker-compose -f docker-compose.ec2.yml exec -T web cp /app/data/restaurant.sqlite3 /app/data/backups/$BACKUP_NAME || \
            docker-compose -f docker-compose.ec2.yml exec -T web cp /app/db.sqlite3 /app/data/backups/$BACKUP_NAME
        else
            echo "❌ Web container not running"
            exit 1
        fi
        
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