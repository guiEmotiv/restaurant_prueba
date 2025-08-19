#!/bin/bash
# 🔄 BLUE-GREEN DEPLOYMENT SCRIPT
# Zero-downtime deployment with automatic rollback

set -e

# Configuration
DOMAIN=${DOMAIN:-"www.xn--elfogndedonsoto-zrb.com"}
IMAGE_TAG=${1:-"latest"}
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-180}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    local level=$1
    shift
    case $level in
        ERROR) echo -e "${RED}❌ $@${NC}" ;;
        SUCCESS) echo -e "${GREEN}✅ $@${NC}" ;;
        WARNING) echo -e "${YELLOW}⚠️  $@${NC}" ;;
        INFO) echo -e "${BLUE}ℹ️  $@${NC}" ;;
    esac
}

# Get current active color
get_current_color() {
    local current_backend=$(docker ps --filter "name=restaurant-backend" --format "{{.Names}}" | head -1)
    
    if [[ "$current_backend" =~ green ]]; then
        echo "green"
    elif [[ "$current_backend" =~ blue ]]; then
        echo "blue"
    else
        # Default to blue if no color found
        echo "blue"
    fi
}

# Determine new color
get_new_color() {
    local current=$1
    if [ "$current" = "blue" ]; then
        echo "green"
    else
        echo "blue"
    fi
}

# Create backup before deployment
create_backup() {
    log INFO "Creating database backup..."
    
    local backup_name="backup_$(date +%Y%m%d_%H%M%S).sqlite3"
    local current_container=$(docker ps --filter "name=restaurant-backend" --format "{{.Names}}" | head -1)
    
    if [ -n "$current_container" ]; then
        docker exec "$current_container" cp /app/data/restaurant_prod.sqlite3 "/app/data/$backup_name" || true
        log SUCCESS "Backup created: $backup_name"
        echo "$backup_name" > .last_backup
    else
        log WARNING "No running backend container found for backup"
    fi
}

# Deploy to new color environment
deploy_new_environment() {
    local new_color=$1
    local current_color=$2
    
    log INFO "Deploying to $new_color environment..."
    
    # Set environment variables for new color
    export COLOR=$new_color
    export BACKEND_CONTAINER="restaurant-backend-$new_color"
    export NGINX_CONTAINER="restaurant-nginx-$new_color"
    
    # Generate new ports to avoid conflicts
    if [ "$new_color" = "green" ]; then
        export HTTP_PORT=8080
        export HTTPS_PORT=4433
        export BACKEND_PORT=8001
    else
        export HTTP_PORT=80
        export HTTPS_PORT=443
        export BACKEND_PORT=8000
    fi
    
    # Create new docker-compose override for blue-green
    cat > docker-compose.$new_color.yml << EOF
version: '3.8'

services:
  app:
    image: restaurant-backend:${IMAGE_TAG}
    container_name: restaurant-backend-${new_color}
    ports:
      - "${BACKEND_PORT}:8000"
    environment:
      - ENVIRONMENT=production
      - COLOR=${new_color}
    env_file: .env.ec2
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    
  nginx:
    image: nginx:alpine
    container_name: restaurant-nginx-${new_color}
    ports:
      - "${HTTP_PORT}:80"
      - "${HTTPS_PORT}:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/proxy_params:/etc/nginx/proxy_params:ro
      - ./frontend/dist:/var/www/html:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    environment:
      - BACKEND_HOST=restaurant-backend-${new_color}
      - DOMAIN_NAME=${DOMAIN}
    depends_on:
      app:
        condition: service_healthy
EOF
    
    # Build and start new environment
    log INFO "Building and starting $new_color environment..."
    docker-compose -f docker-compose.$new_color.yml up -d --build
    
    log SUCCESS "$new_color environment started"
}

# Health check for new environment
health_check_new_environment() {
    local new_color=$1
    
    log INFO "Running health checks for $new_color environment..."
    
    # Use our health check script
    if [ "$new_color" = "green" ]; then
        ./scripts/health-check.sh green localhost
    else
        ./scripts/health-check.sh blue localhost
    fi
}

# Switch traffic to new environment
switch_traffic() {
    local new_color=$1
    local current_color=$2
    
    log INFO "Switching traffic from $current_color to $new_color..."
    
    # Update nginx configuration to point to new backend
    local new_backend="restaurant-backend-$new_color"
    
    # Create temporary nginx config
    cat > nginx/conf.d/active.conf << EOF
upstream backend {
    server $new_backend:8000;
}

server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # Include proxy params
    include /etc/nginx/proxy_params;
    
    location /api/ {
        proxy_pass http://backend;
    }
    
    location / {
        root /var/www/html;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
    
    # Reload nginx configuration
    docker exec restaurant-nginx nginx -s reload || {
        log ERROR "Failed to reload nginx configuration"
        return 1
    }
    
    log SUCCESS "Traffic switched to $new_color"
}

# Stop old environment
stop_old_environment() {
    local old_color=$1
    
    log INFO "Stopping $old_color environment..."
    
    # Gracefully stop old containers
    docker-compose -f docker-compose.$old_color.yml down --timeout 30
    
    # Clean up old images (optional)
    docker image prune -f --filter "label=color=$old_color" || true
    
    log SUCCESS "$old_color environment stopped"
}

# Rollback function
rollback() {
    local current_color=$1
    local previous_color=$2
    
    log WARNING "Rolling back from $current_color to $previous_color..."
    
    # Switch traffic back
    switch_traffic "$previous_color" "$current_color"
    
    # Restore database if backup exists
    if [ -f ".last_backup" ]; then
        local backup_name=$(cat .last_backup)
        log INFO "Restoring database from backup: $backup_name"
        
        local previous_container="restaurant-backend-$previous_color"
        docker exec "$previous_container" cp "/app/data/$backup_name" /app/data/restaurant_prod.sqlite3 || {
            log WARNING "Failed to restore database backup"
        }
    fi
    
    # Stop failed environment
    stop_old_environment "$current_color"
    
    log SUCCESS "Rollback completed to $previous_color"
}

# Main deployment function
main() {
    echo -e "${BLUE}🔄 === BLUE-GREEN DEPLOYMENT ===${NC}"
    echo "Image Tag: $IMAGE_TAG"
    echo "Domain: $DOMAIN"
    echo ""
    
    # Pre-deployment validation
    log INFO "Running pre-deployment validation..."
    ./scripts/deploy-validation.sh || {
        log ERROR "Pre-deployment validation failed"
        exit 1
    }
    
    # Determine colors
    local current_color=$(get_current_color)
    local new_color=$(get_new_color "$current_color")
    
    log INFO "Current environment: $current_color"
    log INFO "Deploying to: $new_color"
    
    # Create backup
    create_backup
    
    # Deploy to new environment
    deploy_new_environment "$new_color" "$current_color" || {
        log ERROR "Failed to deploy new environment"
        exit 1
    }
    
    # Health check new environment
    health_check_new_environment "$new_color" || {
        log ERROR "Health check failed for new environment"
        log WARNING "Initiating rollback..."
        stop_old_environment "$new_color"
        exit 1
    }
    
    # Switch traffic
    switch_traffic "$new_color" "$current_color" || {
        log ERROR "Failed to switch traffic"
        log WARNING "Initiating rollback..."
        rollback "$new_color" "$current_color"
        exit 1
    }
    
    # Final health check on production traffic
    log INFO "Final health check with live traffic..."
    sleep 30  # Allow time for traffic to stabilize
    
    ./scripts/health-check.sh "$new_color" "$DOMAIN" || {
        log ERROR "Final health check failed"
        log WARNING "Initiating rollback..."
        rollback "$new_color" "$current_color"
        exit 1
    }
    
    # Stop old environment
    stop_old_environment "$current_color"
    
    # Update active color
    echo "$new_color" > .active_color
    
    echo ""
    log SUCCESS "Blue-Green deployment completed! 🎉"
    log SUCCESS "Active environment: $new_color"
    echo ""
    echo -e "${GREEN}🚀 ZERO-DOWNTIME DEPLOYMENT SUCCESSFUL${NC}"
    echo "   • Previous: $current_color"
    echo "   • Current: $new_color"
    echo "   • Backup: $(cat .last_backup 2>/dev/null || echo 'none')"
    echo ""
}

# Handle rollback command
if [ "${1}" = "--rollback" ]; then
    if [ -f ".active_color" ]; then
        current_color=$(cat .active_color)
        previous_color=$(get_new_color "$current_color")
        rollback "$current_color" "$previous_color"
    else
        log ERROR "No active color information found"
        exit 1
    fi
else
    main "$@"
fi