#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 DEVOPS PRODUCTION DEPLOYMENT SYSTEM 
# Expert DevOps Engineer - Enterprise-Grade Deployment Pipeline
# Version: 2.0 - Unified, Secure, Optimized
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔧 CONFIGURATION & ENVIRONMENT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ECR_REGISTRY="${1:-}"
ECR_REPOSITORY="${2:-}"
ACTION="${3:-deploy}"
DEPLOY_ID="$(date +%Y%m%d_%H%M%S)"
MEMORY_THRESHOLD=90  # Alert if memory usage exceeds 90%
DISK_THRESHOLD=85    # Alert if disk usage exceeds 85%

# Professional logging with colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

# Log file for audit trail
LOG_FILE="/opt/restaurant-web/logs/devops_deploy_${DEPLOY_ID}.log"
mkdir -p /opt/restaurant-web/logs

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📊 PROFESSIONAL LOGGING SYSTEM
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log() {
    local level=$1; shift
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local color=$NC
    
    case $level in
        INFO) color=$BLUE ;;
        SUCCESS) color=$GREEN ;;
        WARNING) color=$YELLOW ;;
        ERROR) color=$RED ;;
        DEVOPS) color=$CYAN ;;
        SECURITY) color=$PURPLE ;;
    esac
    
    echo -e "${color}[${level}]${NC} ${timestamp} - $*" | tee -a "$LOG_FILE"
}

log_info() { log INFO "$@"; }
log_success() { log SUCCESS "$@"; }
log_warning() { log WARNING "$@"; }
log_error() { log ERROR "$@"; }
log_devops() { log DEVOPS "$@"; }
log_security() { log SECURITY "$@"; }

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🧹 PHASE 1: SYSTEM CLEANUP & OPTIMIZATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cleanup_system() {
    log_devops "🧹 PHASE 1: System cleanup and optimization"
    
    # Memory usage check
    MEMORY_USAGE=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
    log_info "Current memory usage: ${MEMORY_USAGE}%"
    
    if [ "$MEMORY_USAGE" -gt "$MEMORY_THRESHOLD" ]; then
        log_warning "High memory usage detected! Initiating cleanup..."
        
        # Clean Docker resources
        log_info "Cleaning Docker system..."
        docker system prune -af --volumes 2>/dev/null || true
        docker volume prune -f 2>/dev/null || true
        
        # Clean package manager cache
        log_info "Cleaning package cache..."
        apt-get clean 2>/dev/null || true
        apt-get autoremove -y 2>/dev/null || true
        
        # Clean logs older than 7 days
        log_info "Cleaning old logs..."
        find /var/log -type f -name "*.log" -mtime +7 -delete 2>/dev/null || true
        find /opt/restaurant-web/logs -type f -name "*.log" -mtime +30 -delete 2>/dev/null || true
        
        # Clear systemd journal
        journalctl --vacuum-time=7d 2>/dev/null || true
    fi
    
    # Disk usage check
    DISK_USAGE=$(df / | tail -1 | awk '{print int($3/$2 * 100)}')
    log_info "Current disk usage: ${DISK_USAGE}%"
    
    if [ "$DISK_USAGE" -gt "$DISK_THRESHOLD" ]; then
        log_warning "High disk usage detected! Cleaning up..."
        
        # Remove old Docker images
        docker image prune -af --filter "until=168h" 2>/dev/null || true
        
        # Clean temp files
        rm -rf /tmp/* /var/tmp/* 2>/dev/null || true
        
        # Remove old backups (keep last 10)
        cd /opt/restaurant-web/data/backups && ls -t *.sqlite3 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true
    fi
    
    # Final memory report
    MEMORY_AFTER=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
    log_success "Memory usage after cleanup: ${MEMORY_AFTER}%"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔐 PHASE 2: SECURITY VALIDATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

validate_security() {
    log_security "🔐 PHASE 2: Security validation"
    
    # Check SSL certificates
    if [ -d "/etc/letsencrypt/live/www.xn--elfogndedonsoto-zrb.com" ]; then
        CERT_EXPIRY=$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/www.xn--elfogndedonsoto-zrb.com/cert.pem | cut -d= -f2)
        DAYS_LEFT=$(( ($(date -d "$CERT_EXPIRY" +%s) - $(date +%s)) / 86400 ))
        
        if [ "$DAYS_LEFT" -lt 30 ]; then
            log_warning "SSL certificate expires in ${DAYS_LEFT} days! Consider renewal."
        else
            log_success "SSL certificate valid for ${DAYS_LEFT} more days"
        fi
    else
        log_warning "SSL certificates not found - will use HTTP only"
    fi
    
    # Verify AWS Cognito environment variables
    if [ -f "/opt/restaurant-web/.env" ]; then
        if grep -q "COGNITO_USER_POOL_ID" /opt/restaurant-web/.env; then
            log_success "AWS Cognito configuration found"
        else
            log_warning "AWS Cognito not configured in .env"
        fi
    fi
    
    # Check firewall status
    if command -v ufw > /dev/null 2>&1; then
        UFW_STATUS=$(ufw status | grep -c "Status: active" || echo "0")
        if [ "$UFW_STATUS" -eq 1 ]; then
            log_success "Firewall is active"
        else
            log_warning "Firewall is not active!"
        fi
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔄 PHASE 3: DATABASE MIGRATION FIX
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

fix_database_migrations() {
    log_devops "🔄 PHASE 3: Database migration fixes"
    
    # Backup current database
    BACKUP_FILE="/opt/restaurant-web/data/backups/pre_deploy_${DEPLOY_ID}.sqlite3"
    mkdir -p /opt/restaurant-web/data/backups
    
    if [ -f "/opt/restaurant-web/data/restaurant.prod.sqlite3" ]; then
        cp /opt/restaurant-web/data/restaurant.prod.sqlite3 "$BACKUP_FILE"
        log_success "Database backed up to: $BACKUP_FILE"
    fi
    
    # Execute migration fix script if exists
    if [ -f "/opt/restaurant-web/scripts/fix-ec2-migrations.sh" ]; then
        log_info "Executing EC2 migration fixes..."
        bash /opt/restaurant-web/scripts/fix-ec2-migrations.sh || {
            log_warning "Migration fix had issues, continuing..."
        }
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🐳 PHASE 4: DOCKER DEPLOYMENT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

deploy_application() {
    log_devops "🐳 PHASE 4: Docker deployment"
    
    # Login to ECR
    log_info "Authenticating with ECR..."
    aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin "$ECR_REGISTRY"
    
    # Pull latest image
    log_info "Pulling latest production image..."
    docker pull "$ECR_REGISTRY/$ECR_REPOSITORY:latest"
    
    # Stop current containers gracefully
    log_info "Stopping current containers..."
    docker-compose -f docker/docker-compose.prod.yml --profile production down --remove-orphans || true
    
    # Start new containers
    log_info "Starting production containers..."
    docker-compose -f docker/docker-compose.prod.yml --profile production up -d
    
    # Wait for services to be healthy
    log_info "Waiting for services to stabilize..."
    sleep 20
    
    # Check container health
    UNHEALTHY=$(docker ps --filter "name=restaurant-web" --filter "health=unhealthy" -q)
    if [ -z "$UNHEALTHY" ]; then
        log_success "All containers are healthy"
    else
        log_error "Unhealthy containers detected!"
        docker ps --filter "name=restaurant-web"
        return 1
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🌐 PHASE 5: SSL/HTTPS CONFIGURATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

configure_ssl() {
    log_security "🌐 PHASE 5: SSL/HTTPS configuration"
    
    # Create Nginx SSL configuration if certificates exist
    if [ -d "/etc/letsencrypt/live/www.xn--elfogndedonsoto-zrb.com" ]; then
        log_info "Configuring Nginx for SSL..."
        
        mkdir -p /opt/restaurant-web/nginx/conf.d
        cat > /opt/restaurant-web/nginx/conf.d/default.conf << 'EOF'
# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name xn--elfogndedonsoto-zrb.com www.xn--elfogndedonsoto-zrb.com;
    
    # Allow Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.xn--elfogndedonsoto-zrb.com xn--elfogndedonsoto-zrb.com;
    
    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/www.xn--elfogndedonsoto-zrb.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.xn--elfogndedonsoto-zrb.com/privkey.pem;
    
    # SSL configuration
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    
    # Modern configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Proxy to Django app
    location / {
        proxy_pass http://app:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts for long-running requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # API specific configuration
    location /api/ {
        proxy_pass http://app:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers for API
        add_header Access-Control-Allow-Origin "$http_origin" always;
        add_header Access-Control-Allow-Credentials "true" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization" always;
    }
    
    # Static files
    location /static/ {
        alias /opt/restaurant-web/static/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # Media files
    location /media/ {
        alias /opt/restaurant-web/media/;
        expires 7d;
        add_header Cache-Control "public";
    }
}
EOF
        log_success "SSL configuration created"
        
        # Restart Nginx to apply changes
        docker-compose -f docker/docker-compose.prod.yml restart nginx
    else
        log_info "Creating HTTP-only Nginx configuration..."
        
        mkdir -p /opt/restaurant-web/nginx/conf.d
        cat > /opt/restaurant-web/nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name _;
    
    location / {
        proxy_pass http://app:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
        log_success "HTTP configuration created"
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ✅ PHASE 6: HEALTH VALIDATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

validate_deployment() {
    log_devops "✅ PHASE 6: Health validation"
    
    local failed=0
    
    # Test endpoints
    local endpoints=(
        "http://localhost/api/v1/dashboard-operativo/report/?date=$(date +%Y-%m-%d)"
        "http://localhost/api/v1/dashboard-financiero/report/?date=$(date +%Y-%m-%d)&period=month"
        "http://localhost/api/v1/orders/kitchen_board/"
    )
    
    for endpoint in "${endpoints[@]}"; do
        if curl -f -s -m 10 "$endpoint" > /dev/null 2>&1; then
            log_success "✅ Endpoint working: ${endpoint##*/}"
        else
            log_error "❌ Endpoint failed: ${endpoint##*/}"
            ((failed++))
        fi
    done
    
    # Check HTTPS if SSL is configured
    if [ -d "/etc/letsencrypt/live/www.xn--elfogndedonsoto-zrb.com" ]; then
        if curl -f -s -m 10 "https://www.xn--elfogndedonsoto-zrb.com" > /dev/null 2>&1; then
            log_success "✅ HTTPS is working"
        else
            log_warning "⚠️ HTTPS check failed"
        fi
    fi
    
    return $failed
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔄 ROLLBACK CAPABILITY
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

rollback_deployment() {
    log_warning "🔄 Initiating rollback..."
    
    # Find previous image
    PREVIOUS_IMAGE=$(docker images "$ECR_REGISTRY/$ECR_REPOSITORY" --format "{{.Tag}}" | grep -v latest | head -1)
    
    if [ -n "$PREVIOUS_IMAGE" ]; then
        log_info "Rolling back to image: $PREVIOUS_IMAGE"
        docker tag "$ECR_REGISTRY/$ECR_REPOSITORY:$PREVIOUS_IMAGE" "$ECR_REGISTRY/$ECR_REPOSITORY:latest"
        deploy_application
    else
        log_error "No previous image found for rollback"
        return 1
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎯 MAIN ORCHESTRATOR
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

main() {
    log_devops "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_devops "🚀 DEVOPS DEPLOYMENT PIPELINE v2.0"
    log_devops "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_info "Deploy ID: $DEPLOY_ID"
    log_info "Action: $ACTION"
    log_info "ECR: $ECR_REGISTRY/$ECR_REPOSITORY"
    
    # Validate parameters
    if [[ -z "$ECR_REGISTRY" || -z "$ECR_REPOSITORY" ]]; then
        log_error "Missing ECR parameters!"
        exit 1
    fi
    
    case "$ACTION" in
        deploy)
            # Full deployment pipeline
            cleanup_system
            validate_security
            fix_database_migrations
            deploy_application
            configure_ssl
            
            if validate_deployment; then
                log_devops "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                log_success "🎉 DEPLOYMENT SUCCESSFUL!"
                log_devops "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                log_info "📊 Deployment Summary:"
                log_info "  - Deploy ID: $DEPLOY_ID"
                log_info "  - Status: SUCCESS"
                log_info "  - Memory usage: $(free | grep Mem | awk '{print int($3/$2 * 100)}')%"
                log_info "  - Disk usage: $(df / | tail -1 | awk '{print int($3/$2 * 100)}')%"
                log_info "  - SSL: $([ -d '/etc/letsencrypt/live/www.xn--elfogndedonsoto-zrb.com' ] && echo 'Enabled' || echo 'Disabled')"
                log_info "  - Log: $LOG_FILE"
                return 0
            else
                log_error "Deployment validation failed!"
                rollback_deployment
                return 1
            fi
            ;;
            
        rollback)
            rollback_deployment
            ;;
            
        status)
            validate_security
            validate_deployment
            ;;
            
        cleanup)
            cleanup_system
            ;;
            
        *)
            log_error "Unknown action: $ACTION"
            exit 1
            ;;
    esac
}

# Signal handlers
trap 'log_warning "Deployment interrupted!"; exit 130' INT TERM

# Execute main
main "$@"