#!/bin/bash
set -e

# 🚀 OPTIMIZED DEPLOYMENT SCRIPT - Restaurant Web Application
# Version 2.0 - Enhanced with automatic migration handling

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

show_usage() {
    echo "Usage: $0 [OPTION]"
    echo "Options:"
    echo "  --dev          Start development environment"
    echo "  --prod         Deploy to production (EC2)"
    echo "  --build        Build frontend only"
    echo "  --sync         Sync dev database to prod (backup first)"
    echo "  --check        Check deployment health"
    echo "  --migrate      Run migrations with automatic fixes"
    echo "  --help         Show this help"
}

# Helper function for colored output
log() {
    local level=$1
    shift
    case $level in
        ERROR) echo -e "${RED}❌ $@${NC}" ;;
        SUCCESS) echo -e "${GREEN}✅ $@${NC}" ;;
        WARNING) echo -e "${YELLOW}⚠️  $@${NC}" ;;
        INFO) echo -e "${BLUE}ℹ️  $@${NC}" ;;
        *) echo "$@" ;;
    esac
}

# Check prerequisites
check_prerequisites() {
    log INFO "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log ERROR "Docker is not installed"
        exit 1
    fi
    
    # Check Node/npm for frontend
    if ! command -v npm &> /dev/null; then
        log ERROR "npm is not installed"
        exit 1
    fi
    
    # Check if frontend dependencies are installed
    if [ ! -d "frontend/node_modules" ]; then
        log WARNING "Frontend dependencies not installed. Installing..."
        cd frontend && npm install --cache=/tmp/npm-cache && cd ..
    fi
    
    log SUCCESS "Prerequisites check passed"
}

# Smart migration handler
handle_migrations() {
    local container_name="${1:-restaurant-backend}"
    log INFO "Handling database migrations..."
    
    # Wait for container to be ready
    local max_attempts=30
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if docker exec $container_name python -c "import django; print('Django ready')" &>/dev/null; then
            break
        fi
        ((attempt++))
        sleep 1
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log ERROR "Container not ready after 30 seconds"
        return 1
    fi
    
    # Use migration helper if available
    if [ -f "scripts/migration-helper.sh" ]; then
        bash scripts/migration-helper.sh $container_name
    else
        # Fallback to basic migration with error handling
        docker exec $container_name python /app/backend/manage.py migrate || {
            log WARNING "Migration failed, applying fixes..."
            docker exec $container_name python /app/backend/manage.py migrate config 0013 --fake 2>/dev/null || true
            docker exec $container_name python /app/backend/manage.py migrate operation 0021 --fake 2>/dev/null || true
            docker exec $container_name python /app/backend/manage.py migrate
        }
    fi
}

# Development Environment with better error handling
start_dev() {
    log INFO "Starting Development Environment..."
    
    check_prerequisites
    
    # Kill any existing process on port 5173
    if lsof -ti :5173 &>/dev/null; then
        log WARNING "Port 5173 is in use, killing existing process..."
        lsof -ti :5173 | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
    
    # Start backend with development configuration
    log INFO "Starting backend container with development settings..."
    # Stop any existing container first
    docker-compose down
    # Start with development overrides
    docker-compose run -d --name restaurant-backend -p 8000:8000 \
      -e DEBUG=True \
      -e ALLOWED_HOSTS='*' \
      -e DATABASE_NAME=restaurant_dev.sqlite3 \
      -e DJANGO_SETTINGS_MODULE=backend.settings \
      -e USE_COGNITO_AUTH=False \
      --rm app
    
    # Handle migrations
    handle_migrations
    
    # Start frontend in background
    log INFO "Starting frontend development server..."
    echo ""
    echo "🌐 Frontend: http://localhost:5173"
    echo "🔧 Backend: http://localhost:8000/api/v1/"
    echo "📊 API Docs: http://localhost:8000/api/v1/docs/"
    echo ""
    
    cd frontend && npm run dev
}

# Production Deployment with enhanced checks
deploy_prod() {
    log INFO "PRODUCTION DEPLOYMENT STARTING..."
    
    check_prerequisites
    
    # Check for uncommitted changes
    if [ -n "$(git status --porcelain)" ]; then
        log WARNING "You have uncommitted changes. Continue? (y/N)"
        read -r response
        if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            log ERROR "Deployment cancelled"
            exit 1
        fi
    fi
    
    # Build frontend
    log INFO "Building frontend for production..."
    cd frontend && npm run build && cd ..
    
    # Backup database before deployment
    if [ -f "data/restaurant_prod.sqlite3" ]; then
        log INFO "Backing up production database..."
        cp data/restaurant_prod.sqlite3 "data/backup_$(date +%Y%m%d_%H%M%S).sqlite3"
    fi
    
    # Deploy containers
    log INFO "Deploying containers..."
    docker-compose down
    docker-compose up -d app nginx
    
    # Apply migrations
    handle_migrations
    
    # Health check
    health_check
    
    log SUCCESS "DEPLOYMENT COMPLETE!"
    echo "🌐 https://www.xn--elfogndedonsoto-zrb.com/"
}

# Health check function
health_check() {
    log INFO "Running health checks..."
    
    # Check containers
    echo ""
    docker ps --format "table {{.Names}}\t{{.Status}}" | grep restaurant || true
    
    # Check backend health
    if docker exec restaurant-backend curl -s http://localhost:8000/api/v1/ &>/dev/null; then
        log SUCCESS "Backend is healthy"
    else
        log ERROR "Backend health check failed"
    fi
    
    # Check nginx (production only)
    if docker ps | grep -q restaurant-nginx; then
        if docker exec restaurant-nginx nginx -t &>/dev/null; then
            log SUCCESS "Nginx configuration is valid"
        else
            log ERROR "Nginx configuration test failed"
        fi
    fi
}

# Sync development to production
sync_dev_to_prod() {
    log WARNING "This will copy dev database to production. Are you sure? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        log ERROR "Sync cancelled"
        exit 1
    fi
    
    # Backup current production
    if [ -f "data/restaurant_prod.sqlite3" ]; then
        log INFO "Backing up current production database..."
        cp data/restaurant_prod.sqlite3 "data/backup_prod_$(date +%Y%m%d_%H%M%S).sqlite3"
    fi
    
    # Copy dev to prod
    log INFO "Copying dev database to production..."
    cp data/restaurant_dev.sqlite3 data/restaurant_prod.sqlite3
    
    log SUCCESS "Database sync complete"
}

# Build frontend only
build_frontend() {
    log INFO "Building frontend..."
    check_prerequisites
    cd frontend && npm run build
    log SUCCESS "Frontend built successfully"
}

# Main logic with better error handling
main() {
    case "${1:-}" in
        --dev)
            start_dev
            ;;
        --prod)
            deploy_prod
            ;;
        --build)
            build_frontend
            ;;
        --sync)
            sync_dev_to_prod
            ;;
        --check)
            health_check
            ;;
        --migrate)
            handle_migrations
            ;;
        --help)
            show_usage
            ;;
        "")
            start_dev  # Default to development
            ;;
        *)
            log ERROR "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"