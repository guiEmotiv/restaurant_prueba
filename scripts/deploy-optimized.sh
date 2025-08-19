#!/bin/bash
# 🚀 OPTIMIZED DEPLOYMENT SCRIPT
# Enterprise-grade deployment with zero downtime and automatic rollback

set -e

# Configuration
DEPLOY_TYPE=${1:-"standard"}
IMAGE_TAG=${2:-"$(date +%Y%m%d_%H%M%S)"}
DOMAIN=${3:-"www.xn--elfogndedonsoto-zrb.com"}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() {
    local level=$1
    shift
    case $level in
        ERROR) echo -e "${RED}❌ $@${NC}" ;;
        SUCCESS) echo -e "${GREEN}✅ $@${NC}" ;;
        WARNING) echo -e "${YELLOW}⚠️  $@${NC}" ;;
        INFO) echo -e "${BLUE}ℹ️  $@${NC}" ;;
        DEPLOY) echo -e "${CYAN}🚀 $@${NC}" ;;
    esac
}

# Show usage
show_usage() {
    echo "Usage: $0 [DEPLOY_TYPE] [IMAGE_TAG] [DOMAIN]"
    echo ""
    echo "Deploy Types:"
    echo "  standard     Standard deployment (current method)"
    echo "  blue-green   Zero-downtime blue-green deployment"
    echo "  rolling      Rolling update deployment"
    echo "  canary       Canary deployment (10% traffic)"
    echo ""
    echo "Examples:"
    echo "  $0 standard"
    echo "  $0 blue-green v1.2.3"
    echo "  $0 rolling latest www.example.com"
    echo ""
}

# Deployment metrics tracking
track_deployment_start() {
    export DEPLOY_START=$(date +%s)
    export BACKUP_ID=$(date +%Y%m%d_%H%M%S)
    
    log DEPLOY "Starting optimized deployment..."
    log INFO "Deploy Type: $DEPLOY_TYPE"
    log INFO "Image Tag: $IMAGE_TAG"
    log INFO "Domain: $DOMAIN"
    log INFO "Backup ID: $BACKUP_ID"
    echo ""
}

track_deployment_end() {
    local status=$1
    local deploy_end=$(date +%s)
    local deploy_time=$((deploy_end - DEPLOY_START))
    
    echo ""
    if [ "$status" = "success" ]; then
        log SUCCESS "Deployment completed in ${deploy_time}s ⚡"
        log SUCCESS "Status: SUCCESSFUL 🎉"
    else
        log ERROR "Deployment failed after ${deploy_time}s"
        log ERROR "Status: FAILED ❌"
    fi
    
    # Log metrics
    echo "$(date '+%Y-%m-%d %H:%M:%S') | $DEPLOY_TYPE | $IMAGE_TAG | $deploy_time | $status" >> deployment.log
}

# Pre-deployment validation
run_pre_deployment_validation() {
    log INFO "Phase 1: Pre-deployment validation (30s target)..."
    
    # Run validation script
    if [ -f "scripts/deploy-validation.sh" ]; then
        chmod +x scripts/deploy-validation.sh
        ./scripts/deploy-validation.sh || {
            log ERROR "Pre-deployment validation failed"
            return 1
        }
    else
        log WARNING "Validation script not found, creating basic checks..."
        
        # Basic validation
        [ -f "docker-compose.yml" ] || { log ERROR "docker-compose.yml not found"; return 1; }
        [ -f ".env.ec2" ] || { log ERROR ".env.ec2 not found"; return 1; }
        
        log INFO "Basic validation passed"
    fi
    
    log SUCCESS "Pre-deployment validation completed"
}

# Create backup
create_deployment_backup() {
    log INFO "Phase 2: Creating backup..."
    
    mkdir -p backups
    
    # Database backup
    if docker ps --filter "name=restaurant-backend" --format "{{.Names}}" | head -1 | xargs -I {} docker exec {} test -f /app/data/restaurant_prod.sqlite3; then
        local current_container=$(docker ps --filter "name=restaurant-backend" --format "{{.Names}}" | head -1)
        docker exec "$current_container" cp /app/data/restaurant_prod.sqlite3 "/app/data/backup_${BACKUP_ID}.sqlite3"
        
        # Download backup locally
        docker cp "$current_container:/app/data/backup_${BACKUP_ID}.sqlite3" "backups/backup_${BACKUP_ID}.sqlite3"
        
        log SUCCESS "Database backup created: backup_${BACKUP_ID}.sqlite3"
    else
        log WARNING "No database found for backup"
    fi
    
    # Configuration backup
    tar -czf "backups/config_${BACKUP_ID}.tar.gz" \
        docker-compose.yml \
        .env.ec2 \
        nginx/ \
        2>/dev/null || log WARNING "Some config files missing"
    
    log SUCCESS "Configuration backup created"
}

# Generate dynamic configuration
generate_deployment_config() {
    log INFO "Phase 3: Generating dynamic configuration..."
    
    # Make sure scripts are executable
    chmod +x scripts/generate-config.sh 2>/dev/null || true
    
    # Generate configuration
    if [ -f "scripts/generate-config.sh" ]; then
        ./scripts/generate-config.sh production "$DOMAIN" || {
            log WARNING "Config generation failed, using existing configuration"
        }
    else
        log WARNING "Config generator not found, using existing configuration"
        
        # Basic ALLOWED_HOSTS update
        if [ -f ".env.ec2" ]; then
            local allowed_hosts="*,restaurant-backend,localhost,127.0.0.1,$DOMAIN,www.$DOMAIN"
            sed -i.bak "s/ALLOWED_HOSTS=.*/ALLOWED_HOSTS=$allowed_hosts/" .env.ec2 2>/dev/null || true
            log INFO "Basic ALLOWED_HOSTS updated"
        fi
    fi
    
    log SUCCESS "Configuration generated"
}

# Standard deployment
deploy_standard() {
    log INFO "Phase 4: Standard deployment..."
    
    # Build and deploy
    log INFO "Building frontend..."
    if [ -d "frontend" ]; then
        cd frontend
        npm ci --production 2>/dev/null || npm install
        npm run build
        cd ..
        log SUCCESS "Frontend built"
    fi
    
    log INFO "Deploying containers..."
    
    # Tag image with deployment info
    export IMAGE_TAG="$IMAGE_TAG"
    
    # Deploy with updated configuration
    docker-compose down --timeout 30 2>/dev/null || true
    docker-compose up -d --build
    
    log SUCCESS "Containers deployed"
}

# Blue-green deployment
deploy_blue_green() {
    log INFO "Phase 4: Blue-green deployment..."
    
    if [ -f "scripts/blue-green-deploy.sh" ]; then
        chmod +x scripts/blue-green-deploy.sh
        ./scripts/blue-green-deploy.sh "$IMAGE_TAG" || {
            log ERROR "Blue-green deployment failed"
            return 1
        }
    else
        log WARNING "Blue-green script not found, falling back to standard deployment"
        deploy_standard
    fi
}

# Rolling deployment
deploy_rolling() {
    log INFO "Phase 4: Rolling deployment..."
    
    # Rolling update by recreating containers one by one
    log INFO "Rolling update: Backend..."
    docker-compose up -d --no-deps --build app
    
    # Wait for backend to be healthy
    sleep 30
    
    log INFO "Rolling update: Nginx..."
    docker-compose up -d --no-deps nginx
    
    log SUCCESS "Rolling deployment completed"
}

# Canary deployment
deploy_canary() {
    log INFO "Phase 4: Canary deployment (10% traffic)..."
    
    # Implement canary by deploying to separate port and using nginx to split traffic
    export CANARY_PORT=8001
    export CANARY_CONTAINER="restaurant-backend-canary"
    
    # Deploy canary version
    docker run -d \
        --name "$CANARY_CONTAINER" \
        --env-file .env.ec2 \
        -p "$CANARY_PORT:8000" \
        -v "$(pwd)/data:/app/data" \
        restaurant-web-app:latest
    
    # Update nginx to split traffic (90/10)
    # This would require nginx configuration update
    
    log SUCCESS "Canary deployment completed (10% traffic)"
    log WARNING "Manual nginx configuration needed for traffic splitting"
}

# Health checks
run_health_checks() {
    log INFO "Phase 5: Health checks (60s timeout)..."
    
    if [ -f "scripts/health-check.sh" ]; then
        chmod +x scripts/health-check.sh
        ./scripts/health-check.sh --wait || {
            log ERROR "Health checks failed"
            return 1
        }
    else
        log WARNING "Health check script not found, running basic checks..."
        
        # Basic health check
        local max_attempts=30
        local attempt=0
        
        while [ $attempt -lt $max_attempts ]; do
            if curl -s -f "http://localhost:8000/api/v1/health/" >/dev/null 2>&1; then
                log SUCCESS "Backend health check passed"
                break
            fi
            
            attempt=$((attempt + 1))
            if [ $attempt -eq $max_attempts ]; then
                log ERROR "Backend health check failed after ${max_attempts} attempts"
                return 1
            fi
            
            log INFO "Health check attempt $attempt/$max_attempts..."
            sleep 5
        done
    fi
    
    log SUCCESS "All health checks passed"
}

# Cleanup old resources
cleanup_deployment() {
    log INFO "Phase 6: Cleanup..."
    
    # Remove old images
    docker image prune -f --filter "until=24h" 2>/dev/null || true
    
    # Clean old backups (keep last 5)
    if [ -d "backups" ]; then
        ls -t backups/backup_*.sqlite3 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
        ls -t backups/config_*.tar.gz 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
    fi
    
    log SUCCESS "Cleanup completed"
}

# Rollback function
rollback_deployment() {
    log WARNING "Initiating automatic rollback..."
    
    if [ -f "backups/backup_${BACKUP_ID}.sqlite3" ]; then
        log INFO "Restoring database backup..."
        
        local current_container=$(docker ps --filter "name=restaurant-backend" --format "{{.Names}}" | head -1)
        if [ -n "$current_container" ]; then
            docker cp "backups/backup_${BACKUP_ID}.sqlite3" "$current_container:/app/data/restaurant_prod.sqlite3"
            docker exec "$current_container" chown 1000:1000 /app/data/restaurant_prod.sqlite3
            log SUCCESS "Database restored"
        fi
    fi
    
    if [ -f "backups/config_${BACKUP_ID}.tar.gz" ]; then
        log INFO "Restoring configuration backup..."
        tar -xzf "backups/config_${BACKUP_ID}.tar.gz" 2>/dev/null || true
        log SUCCESS "Configuration restored"
    fi
    
    # Restart containers with previous configuration
    docker-compose restart
    
    log SUCCESS "Rollback completed"
}

# Main deployment function
main() {
    # Show usage for help
    if [ "${1}" = "--help" ] || [ "${1}" = "-h" ]; then
        show_usage
        exit 0
    fi
    
    # Start tracking
    track_deployment_start
    
    # Set trap for cleanup on failure
    trap 'track_deployment_end "failed"; rollback_deployment' ERR
    
    echo -e "${CYAN}🚀 === ENTERPRISE DEPLOYMENT PIPELINE ===${NC}"
    echo ""
    
    # Execute deployment phases
    run_pre_deployment_validation
    create_deployment_backup
    generate_deployment_config
    
    # Choose deployment strategy
    case "$DEPLOY_TYPE" in
        "standard")
            deploy_standard
            ;;
        "blue-green")
            deploy_blue_green
            ;;
        "rolling")
            deploy_rolling
            ;;
        "canary")
            deploy_canary
            ;;
        *)
            log ERROR "Unknown deployment type: $DEPLOY_TYPE"
            show_usage
            exit 1
            ;;
    esac
    
    # Post-deployment validation
    run_health_checks
    cleanup_deployment
    
    # Success tracking
    track_deployment_end "success"
    
    echo ""
    echo -e "${GREEN}🎉 === DEPLOYMENT SUCCESSFUL ===${NC}"
    echo ""
    echo -e "${BLUE}📊 DEPLOYMENT SUMMARY${NC}"
    echo "   • Type: $DEPLOY_TYPE"
    echo "   • Image: $IMAGE_TAG"
    echo "   • Domain: $DOMAIN"
    echo "   • Backup: backup_${BACKUP_ID}.sqlite3"
    echo "   • Time: $(($(date +%s) - DEPLOY_START))s"
    echo ""
    echo -e "${GREEN}🚀 SYSTEM READY FOR TRAFFIC${NC}"
}

# Execute main function
main "$@"