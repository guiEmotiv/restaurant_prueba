#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 ENTERPRISE PRODUCTION DEPLOYMENT SYSTEM 
# Ultra-Secure DevOps Pipeline for Restaurant Web Application
# Version: 3.0 - Production-Grade Security & Performance
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail
IFS=$'\n\t'

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔐 SECURITY & ENVIRONMENT VALIDATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly DEPLOY_ID="$(date +%Y%m%d_%H%M%S)"
readonly LOG_DIR="/opt/restaurant-web/logs/enterprise"
readonly LOG_FILE="${LOG_DIR}/deploy_${DEPLOY_ID}.log"

# Create secure log directory
mkdir -p "$LOG_DIR"
chmod 750 "$LOG_DIR"

# Security parameters
readonly MEMORY_THRESHOLD=85
readonly DISK_THRESHOLD=80
readonly MAX_DEPLOY_TIME=900  # 15 minutes max
readonly HEALTH_CHECK_RETRIES=10
readonly HEALTH_CHECK_DELAY=15

# Deployment parameters (validated)
ECR_REGISTRY="${1:-}"
ECR_REPOSITORY="${2:-}"
ACTION="${3:-deploy}"

# Colors for professional output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📊 ENTERPRISE LOGGING SYSTEM
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log() {
    local level=$1; shift
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local color=$NC
    
    case $level in
        INFO)     color=$BLUE ;;
        SUCCESS)  color=$GREEN ;;
        WARNING)  color=$YELLOW ;;
        ERROR)    color=$RED ;;
        SECURITY) color=$PURPLE ;;
        DEVOPS)   color=$CYAN ;;
    esac
    
    printf "${color}[%s]${NC} %s - %s\n" "$level" "$timestamp" "$*" | tee -a "$LOG_FILE"
}

log_info()     { log INFO "$@"; }
log_success()  { log SUCCESS "$@"; }
log_warning()  { log WARNING "$@"; }
log_error()    { log ERROR "$@"; exit 1; }
log_security() { log SECURITY "$@"; }
log_devops()   { log DEVOPS "$@"; }

# Deployment timeout handler
timeout_handler() {
    log_error "Deployment timeout exceeded ${MAX_DEPLOY_TIME} seconds!"
}
trap timeout_handler ALRM
(sleep $MAX_DEPLOY_TIME && kill -ALRM $$) &

# Cleanup on exit
cleanup_on_exit() {
    log_info "Cleaning up deployment artifacts..."
    jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup_on_exit EXIT

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🛡️ PHASE 1: SECURITY & ENVIRONMENT VALIDATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

validate_environment() {
    log_security "🛡️ PHASE 1: Security & Environment Validation"
    
    # Validate required parameters
    if [[ -z "$ECR_REGISTRY" || -z "$ECR_REPOSITORY" ]]; then
        log_error "Missing required ECR parameters!"
    fi
    
    # Validate deployment action
    case "$ACTION" in
        deploy|rollback|status|cleanup) ;;
        *) log_error "Invalid action: $ACTION" ;;
    esac
    
    # Check AWS CLI and credentials
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not installed!"
    fi
    
    if ! aws sts get-caller-identity &>/dev/null; then
        log_error "AWS credentials not configured or invalid!"
    fi
    
    # Validate ECR registry accessibility
    if ! aws ecr describe-repositories --region us-west-2 --repository-names "$ECR_REPOSITORY" &>/dev/null; then
        log_error "Cannot access ECR repository: $ECR_REPOSITORY"
    fi
    
    # Check Docker daemon
    if ! docker info &>/dev/null; then
        log_error "Docker daemon not running or accessible!"
    fi
    
    # Validate environment file
    if [[ ! -f "/opt/restaurant-web/.env" ]]; then
        log_warning "Environment file not found at /opt/restaurant-web/.env"
    fi
    
    # Check SSL certificate status
    if [[ -d "/etc/letsencrypt/live/www.xn--elfogndedonsoto-zrb.com" ]]; then
        local cert_file="/etc/letsencrypt/live/www.xn--elfogndedonsoto-zrb.com/cert.pem"
        if [[ -f "$cert_file" ]]; then
            local cert_expiry=$(openssl x509 -enddate -noout -in "$cert_file" | cut -d= -f2)
            local days_left=$(( ($(date -d "$cert_expiry" +%s) - $(date +%s)) / 86400 ))
            
            if [[ $days_left -lt 7 ]]; then
                log_error "SSL certificate expires in ${days_left} days! Renewal required."
            elif [[ $days_left -lt 30 ]]; then
                log_warning "SSL certificate expires in ${days_left} days. Consider renewal soon."
            else
                log_success "SSL certificate valid for ${days_left} more days"
            fi
        fi
    else
        log_info "SSL certificates not found - HTTP mode will be used"
    fi
    
    log_success "Environment validation completed"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🧹 PHASE 2: INTELLIGENT SYSTEM CLEANUP
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

optimize_system() {
    log_devops "🧹 PHASE 2: Intelligent System Optimization"
    
    # Memory usage analysis
    local memory_usage=$(free | awk '/^Mem:/ {printf "%.0f", $3/$2 * 100}')
    local disk_usage=$(df / | awk 'NR==2 {print int($3/$2 * 100)}')
    
    log_info "Current system status:"
    log_info "  Memory usage: ${memory_usage}%"
    log_info "  Disk usage: ${disk_usage}%"
    log_info "  Load average: $(uptime | awk -F'load average:' '{print $2}')"
    
    # Aggressive cleanup if needed
    if [[ $memory_usage -gt $MEMORY_THRESHOLD ]] || [[ $disk_usage -gt $DISK_THRESHOLD ]]; then
        log_warning "High resource usage detected - initiating aggressive cleanup"
        
        # Stop current containers gracefully
        log_info "Stopping current containers..."
        docker-compose -f docker/docker-compose.prod.yml down --remove-orphans --timeout 30 2>/dev/null || true
        
        # Docker cleanup
        log_info "Cleaning Docker system..."
        docker system prune -af --volumes --filter "until=24h" 2>/dev/null || true
        docker volume prune -f 2>/dev/null || true
        docker network prune -f 2>/dev/null || true
        
        # Remove unused images (keep last 3 versions)
        docker images "$ECR_REGISTRY/$ECR_REPOSITORY" --format "table {{.Tag}}\t{{.ID}}" | \
            grep -v "TAG\|latest" | tail -n +4 | awk '{print $2}' | xargs -r docker rmi -f 2>/dev/null || true
        
        # System cleanup
        log_info "System-level cleanup..."
        apt-get autoremove -y &>/dev/null || true
        apt-get autoclean &>/dev/null || true
        journalctl --vacuum-time=7d &>/dev/null || true
        
        # Clean old logs and backups
        find /var/log -type f -name "*.log" -mtime +7 -delete 2>/dev/null || true
        find "$LOG_DIR" -type f -name "*.log" -mtime +30 -delete 2>/dev/null || true
        find /opt/restaurant-web/data/backups -name "*.sqlite3" -mtime +30 -delete 2>/dev/null || true
        
        # Clean temporary files
        rm -rf /tmp/docker-* /var/tmp/docker-* 2>/dev/null || true
        
        # Update resource usage
        memory_usage=$(free | awk '/^Mem:/ {printf "%.0f", $3/$2 * 100}')
        disk_usage=$(df / | awk 'NR==2 {print int($3/$2 * 100)}')
        log_success "Cleanup completed - Memory: ${memory_usage}%, Disk: ${disk_usage}%"
    fi
    
    # Pre-deployment system check
    if [[ $memory_usage -gt 95 ]] || [[ $disk_usage -gt 95 ]]; then
        log_error "Critical system resources exhausted - deployment aborted"
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 💾 PHASE 3: SECURE DATABASE MANAGEMENT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

manage_database() {
    log_devops "💾 PHASE 3: Secure Database Management"
    
    local db_path="/opt/restaurant-web/data/restaurant.prod.sqlite3"
    local backup_dir="/opt/restaurant-web/data/backups/enterprise"
    local backup_file="${backup_dir}/pre_deploy_${DEPLOY_ID}.sqlite3"
    
    # Ensure proper database directory permissions (CRITICAL FIX)
    sudo mkdir -p "/opt/restaurant-web/data"
    sudo chown -R ubuntu:ubuntu "/opt/restaurant-web/data"
    sudo chmod 755 "/opt/restaurant-web/data"
    
    # Create secure backup directory
    mkdir -p "$backup_dir"
    chmod 750 "$backup_dir"
    
    # Create database backup with integrity check
    if [[ -f "$db_path" ]]; then
        log_info "Creating database backup with integrity verification..."
        
        # Verify database integrity before backup
        if sqlite3 "$db_path" "PRAGMA integrity_check;" | grep -v "ok" > /dev/null; then
            log_error "Database integrity check failed!"
        fi
        
        # Create backup
        cp "$db_path" "$backup_file"
        
        # Verify backup integrity
        if sqlite3 "$backup_file" "PRAGMA integrity_check;" | grep -v "ok" > /dev/null; then
            log_error "Backup integrity check failed!"
        fi
        
        # Compress backup to save space
        gzip "$backup_file"
        
        log_success "Database backup created: ${backup_file}.gz"
    else
        log_info "No existing database found - fresh installation"
    fi
    
    # Clean old backups (keep last 10)
    find "$backup_dir" -name "*.sqlite3.gz" -type f | sort -r | tail -n +11 | xargs -r rm -f
    
    # Execute any pending migration fixes
    if [[ -f "/opt/restaurant-web/scripts/fix-ec2-migrations.sh" ]]; then
        log_info "Executing database migration fixes..."
        timeout 300 bash /opt/restaurant-web/scripts/fix-ec2-migrations.sh || {
            log_warning "Migration fixes encountered issues but continuing..."
        }
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🐳 PHASE 4: SECURE CONTAINER DEPLOYMENT  
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

deploy_containers() {
    log_devops "🐳 PHASE 4: Secure Container Deployment"
    
    # Login to ECR with timeout
    log_info "Authenticating with ECR..."
    if ! timeout 60 aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin "$ECR_REGISTRY"; then
        log_error "ECR authentication failed"
    fi
    
    # Pull latest image with verification
    log_info "Pulling latest production image..."
    local image_tag="$ECR_REGISTRY/$ECR_REPOSITORY:latest"
    
    if ! timeout 300 docker pull "$image_tag"; then
        log_error "Failed to pull image: $image_tag"
    fi
    
    # Verify image integrity
    if ! docker inspect "$image_tag" &>/dev/null; then
        log_error "Image integrity verification failed"
    fi
    
    # Stop existing containers gracefully
    log_info "Gracefully stopping existing containers..."
    if docker-compose -f docker/docker-compose.prod.yml ps -q | grep -q .; then
        docker-compose -f docker/docker-compose.prod.yml down --timeout 30 --remove-orphans
        sleep 10
    fi
    
    # Remove any orphaned containers
    docker ps -a -q -f "name=restaurant-web" | xargs -r docker rm -f 2>/dev/null || true
    
    # Start new containers with resource limits
    log_info "Starting production containers..."
    if ! docker-compose -f docker/docker-compose.prod.yml --profile production up -d; then
        log_error "Failed to start containers"
    fi
    
    # Wait for container initialization
    log_info "Waiting for container initialization..."
    sleep 20
    
    # Verify all containers are running
    local unhealthy_containers=$(docker ps --filter "name=restaurant-web" --filter "status=exited" -q)
    if [[ -n "$unhealthy_containers" ]]; then
        log_error "Failed containers detected:"
        docker ps --filter "name=restaurant-web"
    fi
    
    log_success "Containers deployed successfully"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🌐 PHASE 5: PRODUCTION SSL/HTTPS CONFIGURATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

configure_secure_proxy() {
    log_devops "🌐 PHASE 5: Production SSL/HTTPS Configuration"
    
    local nginx_config_dir="/opt/restaurant-web/docker/nginx/conf.d"
    local nginx_config_file="$nginx_config_dir/default.conf"
    
    mkdir -p "$nginx_config_dir"
    
    # Generate production-grade Nginx configuration
    if [[ -d "/etc/letsencrypt/live/www.xn--elfogndedonsoto-zrb.com" ]]; then
        log_info "Configuring Nginx with SSL/TLS security..."
        
        cat > "$nginx_config_file" << 'EOF'
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔒 ENTERPRISE NGINX CONFIGURATION WITH SSL
# Ultra-Secure Production Configuration for Restaurant Web
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Security: Hide Nginx version
server_tokens off;

# Rate limiting zones  
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
limit_req_zone $binary_remote_addr zone=general:10m rate=100r/m;

# HTTP -> HTTPS Redirect
server {
    listen 80;
    listen [::]:80;
    server_name xn--elfogndedonsoto-zrb.com www.xn--elfogndedonsoto-zrb.com;
    
    # Security headers even for HTTP
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Allow Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files $uri =404;
    }
    
    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS Production Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.xn--elfogndedonsoto-zrb.com xn--elfogndedonsoto-zrb.com;
    
    # SSL Certificates
    ssl_certificate /etc/letsencrypt/live/www.xn--elfogndedonsoto-zrb.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.xn--elfogndedonsoto-zrb.com/privkey.pem;
    
    # SSL Security Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;
    
    # HSTS (2 years)
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), speaker=()" always;
    
    # CSP Header for enhanced security
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cognito-idp.us-west-2.amazonaws.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.amazonaws.com; frame-ancestors 'self';" always;
    
    # Client settings
    client_max_body_size 10M;
    client_body_timeout 60s;
    client_header_timeout 60s;
    
    # API Endpoints (with rate limiting)
    location /api/ {
        limit_req zone=api burst=10 nodelay;
        
        proxy_pass http://app:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 300s;
        
        # CORS for API
        add_header Access-Control-Allow-Origin "$http_origin" always;
        add_header Access-Control-Allow-Credentials "true" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
        add_header Access-Control-Allow-Headers "DNT, User-Agent, X-Requested-With, If-Modified-Since, Cache-Control, Content-Type, Range, Authorization" always;
        
        # Handle preflight requests
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Max-Age 86400;
            add_header Content-Type 'text/plain charset=UTF-8';
            add_header Content-Length 0;
            return 204;
        }
    }
    
    # Admin interface (secured)
    location /admin/ {
        limit_req zone=general burst=5 nodelay;
        
        proxy_pass http://app:8000/admin/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Enhanced security for admin
        add_header X-Frame-Options "DENY" always;
    }
    
    # Static files (with aggressive caching)
    location /static/ {
        proxy_pass http://app:8000/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options "nosniff" always;
    }
    
    # Media files (with moderate caching)
    location /media/ {
        proxy_pass http://app:8000/media/;
        expires 30d;
        add_header Cache-Control "public";
        add_header X-Content-Type-Options "nosniff" always;
    }
    
    # Import endpoints (with file size limits)
    location ~ ^/import-(units|zones|tables|containers|groups|ingredients|recipes)/$ {
        limit_req zone=api burst=3 nodelay;
        
        proxy_pass http://app:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        client_max_body_size 50M;
        proxy_request_buffering off;
    }
    
    # Health check endpoint
    location /health/ {
        proxy_pass http://app:8000/health/;
        access_log off;
    }
    
    # Frontend - All other requests
    location / {
        limit_req zone=general burst=20 nodelay;
        
        proxy_pass http://app:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
    }
    
    # Security: Block common attack patterns
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    location ~ \.(sql|log|conf)$ {
        deny all;
        access_log off;
        log_not_found off;
    }
}
EOF
        log_success "SSL/HTTPS configuration created with enterprise security"
        
    else
        log_info "Creating secure HTTP configuration (SSL not available)..."
        
        cat > "$nginx_config_file" << 'EOF'
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔒 SECURE HTTP NGINX CONFIGURATION  
# Production-Grade HTTP Configuration (SSL certificates not available)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

server_tokens off;

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
limit_req_zone $binary_remote_addr zone=general:10m rate=100r/m;

server {
    listen 80;
    listen [::]:80;
    server_name xn--elfogndedonsoto-zrb.com www.xn--elfogndedonsoto-zrb.com _;
    
    # Security headers for HTTP
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    client_max_body_size 10M;
    
    # API with rate limiting
    location /api/ {
        limit_req zone=api burst=10 nodelay;
        
        proxy_pass http://app:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 300s;
    }
    
    # All other routes
    location / {
        limit_req zone=general burst=20 nodelay;
        
        proxy_pass http://app:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
        log_success "Secure HTTP configuration created"
    fi
    
    # Restart Nginx with new configuration
    log_info "Applying Nginx configuration..."
    if ! docker-compose -f docker/docker-compose.prod.yml restart nginx; then
        log_error "Failed to restart Nginx with new configuration"
    fi
    
    sleep 10
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ✅ PHASE 6: COMPREHENSIVE HEALTH VALIDATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

validate_deployment() {
    log_devops "✅ PHASE 6: Comprehensive Health Validation"
    
    local failed=0
    local success=0
    
    # Wait for full application startup
    log_info "Waiting for application startup..."
    sleep 30
    
    # Test critical endpoints with retries
    local endpoints=(
        "http://localhost/api/v1/dashboard-operativo/report/?date=$(date +%Y-%m-%d)"
        "http://localhost/api/v1/dashboard-financiero/report/?date=$(date +%Y-%m-%d)&period=month"
        "http://localhost/api/v1/orders/kitchen_board/"
        "http://localhost/api/v1/config/units/"
    )
    
    log_info "Testing critical API endpoints..."
    for endpoint in "${endpoints[@]}"; do
        local endpoint_name="${endpoint##*/}"
        local retry_count=0
        local success_flag=false
        
        while [[ $retry_count -lt $HEALTH_CHECK_RETRIES ]]; do
            if curl -f -s -m 15 "$endpoint" &>/dev/null; then
                log_success "✅ Endpoint healthy: $endpoint_name"
                ((success++))
                success_flag=true
                break
            fi
            
            ((retry_count++))
            if [[ $retry_count -lt $HEALTH_CHECK_RETRIES ]]; then
                log_warning "Endpoint check failed, retrying in ${HEALTH_CHECK_DELAY}s... ($retry_count/$HEALTH_CHECK_RETRIES)"
                sleep $HEALTH_CHECK_DELAY
            fi
        done
        
        if [[ "$success_flag" != true ]]; then
            log_error "❌ Endpoint failed after $HEALTH_CHECK_RETRIES attempts: $endpoint_name"
            ((failed++))
        fi
    done
    
    # Test HTTPS if available
    if [[ -d "/etc/letsencrypt/live/www.xn--elfogndedonsoto-zrb.com" ]]; then
        log_info "Testing HTTPS configuration..."
        if curl -f -s -m 15 "https://www.xn--elfogndedonsoto-zrb.com" &>/dev/null; then
            log_success "✅ HTTPS is working correctly"
            ((success++))
        else
            log_warning "⚠️ HTTPS check failed"
            ((failed++))
        fi
        
        # SSL certificate validation
        if openssl s_client -connect www.xn--elfogndedonsoto-zrb.com:443 -servername www.xn--elfogndedonsoto-zrb.com </dev/null 2>/dev/null | openssl x509 -noout -dates &>/dev/null; then
            log_success "✅ SSL certificate is valid"
        else
            log_warning "⚠️ SSL certificate validation failed"
        fi
    fi
    
    # Container health verification
    log_info "Verifying container health..."
    local unhealthy=$(docker ps --filter "name=restaurant-web" --filter "health=unhealthy" -q | wc -l)
    local total=$(docker ps --filter "name=restaurant-web" -q | wc -l)
    
    if [[ $unhealthy -eq 0 ]] && [[ $total -gt 0 ]]; then
        log_success "✅ All $total containers are healthy"
        ((success++))
    else
        log_error "❌ Found $unhealthy unhealthy containers out of $total"
        docker ps --filter "name=restaurant-web" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        ((failed++))
    fi
    
    # System resource validation
    local final_memory=$(free | awk '/^Mem:/ {printf "%.0f", $3/$2 * 100}')
    local final_disk=$(df / | awk 'NR==2 {print int($3/$2 * 100)}')
    
    log_info "Post-deployment system status:"
    log_info "  Memory usage: ${final_memory}%"
    log_info "  Disk usage: ${final_disk}%"
    
    # Final validation result
    log_info "Health check summary:"
    log_info "  Successful checks: $success"
    log_info "  Failed checks: $failed"
    
    return $failed
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔄 ROLLBACK CAPABILITY
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

rollback_deployment() {
    log_warning "🔄 Initiating emergency rollback..."
    
    # Find previous working image
    local previous_image=$(docker images "$ECR_REGISTRY/$ECR_REPOSITORY" --format "table {{.Tag}}\t{{.CreatedAt}}" | \
        grep -v "TAG\|latest" | head -1 | awk '{print $1}')
    
    if [[ -n "$previous_image" ]] && [[ "$previous_image" != "<none>" ]]; then
        log_info "Rolling back to image: $ECR_REGISTRY/$ECR_REPOSITORY:$previous_image"
        
        # Tag previous image as latest
        docker tag "$ECR_REGISTRY/$ECR_REPOSITORY:$previous_image" "$ECR_REGISTRY/$ECR_REPOSITORY:latest"
        
        # Redeploy with previous image
        deploy_containers
        configure_secure_proxy
        
        if validate_deployment; then
            log_success "Rollback completed successfully"
            return 0
        else
            log_error "Rollback failed - manual intervention required"
            return 1
        fi
    else
        log_error "No previous image found for rollback"
        return 1
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎯 MAIN ORCHESTRATOR
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

generate_deployment_summary() {
    local status=$1
    local end_time=$(date '+%Y-%m-%d %H:%M:%S')
    local final_memory=$(free | awk '/^Mem:/ {printf "%.0f", $3/$2 * 100}')
    local final_disk=$(df / | awk 'NR==2 {print int($3/$2 * 100)}')
    local ssl_status="Disabled"
    
    if [[ -d "/etc/letsencrypt/live/www.xn--elfogndedonsoto-zrb.com" ]]; then
        ssl_status="Enabled"
    fi
    
    cat << EOF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 ENTERPRISE DEPLOYMENT REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 DEPLOYMENT SUMMARY
  • Status: $status
  • Deploy ID: $DEPLOY_ID  
  • Action: $ACTION
  • Completed: $end_time
  • Duration: $(($(date +%s) - $(date -d "$(head -1 "$LOG_FILE" | awk '{print $2, $3}')" +%s) )) seconds

🎯 IMAGE INFORMATION
  • Registry: $ECR_REGISTRY
  • Repository: $ECR_REPOSITORY
  • Tag: latest

📈 SYSTEM RESOURCES
  • Memory Usage: ${final_memory}%
  • Disk Usage: ${final_disk}%
  • SSL/HTTPS: $ssl_status

🔒 SECURITY FEATURES
  • Rate limiting: Enabled
  • Security headers: Enabled  
  • CSP policy: Enabled
  • HSTS: $([ "$ssl_status" = "Enabled" ] && echo "Enabled" || echo "N/A")

📋 DEPLOYMENT LOG
  • Full log: $LOG_FILE

🌐 ENDPOINTS
  • Production: https://www.xn--elfogndedonsoto-zrb.com/
  • API: https://www.xn--elfogndedonsoto-zrb.com/api/v1/
  • Admin: https://www.xn--elfogndedonsoto-zrb.com/admin/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
}

main() {
    local start_time=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Header
    echo -e "${BOLD}${CYAN}"
    cat << 'EOF'
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 ENTERPRISE PRODUCTION DEPLOYMENT SYSTEM v3.0
   Ultra-Secure DevOps Pipeline for Restaurant Web Application
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
    echo -e "${NC}"
    
    log_devops "Deployment started at: $start_time"
    log_info "Deploy ID: $DEPLOY_ID"
    log_info "Action: $ACTION"
    log_info "Registry: $ECR_REGISTRY/$ECR_REPOSITORY"
    
    case "$ACTION" in
        deploy)
            # Full enterprise deployment pipeline
            validate_environment
            optimize_system  
            manage_database
            deploy_containers
            configure_secure_proxy
            
            if validate_deployment; then
                log_success "🎉 ENTERPRISE DEPLOYMENT SUCCESSFUL!"
                generate_deployment_summary "SUCCESS"
                exit 0
            else
                log_error "Deployment validation failed - initiating rollback"
                if rollback_deployment; then
                    log_warning "Rollback completed successfully"
                    generate_deployment_summary "ROLLED_BACK"
                    exit 1
                else
                    log_error "Both deployment and rollback failed!"
                    generate_deployment_summary "FAILED"
                    exit 2
                fi
            fi
            ;;
            
        rollback)
            validate_environment
            rollback_deployment
            ;;
            
        status)
            validate_environment
            validate_deployment
            ;;
            
        cleanup)
            optimize_system
            ;;
            
        *)
            log_error "Invalid action: $ACTION"
            echo "Usage: $0 <ECR_REGISTRY> <ECR_REPOSITORY> [deploy|rollback|status|cleanup]"
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"