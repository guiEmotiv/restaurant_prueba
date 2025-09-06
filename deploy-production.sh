#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 PROFESSIONAL PRODUCTION DEPLOYMENT SCRIPT
# Full-Stack Restaurant Web Application - Dev to Production Pipeline
# Author: DevOps Expert | Version: 1.0 | Date: 2025-09-06
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail
IFS=$'\n\t'

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔧 CONFIGURATION & CONSTANTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$SCRIPT_DIR"
readonly DEPLOY_ID="$(date +%Y%m%d_%H%M%S)"
readonly LOG_FILE="./deployment_${DEPLOY_ID}.log"

# Production server configuration
readonly PROD_SERVER="ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com"
readonly SSH_KEY="./ubuntu_fds_key.pem"
readonly REMOTE_DIR="/home/ubuntu/restaurant-web"
readonly DOMAIN="www.xn--elfogndedonsoto-zrb.com"

# Performance thresholds
readonly MAX_MEMORY_USAGE=85
readonly MAX_DISK_USAGE=90
readonly HEALTH_CHECK_TIMEOUT=60
readonly DEPLOYMENT_TIMEOUT=600

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📝 LOGGING SYSTEM
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
        CRITICAL) color=$PURPLE ;;
        DEPLOY)   color=$CYAN ;;
    esac
    
    printf "${color}[%s]${NC} %s - %s\n" "$level" "$timestamp" "$*" | tee -a "$LOG_FILE"
}

log_info()     { log INFO "$@"; }
log_success()  { log SUCCESS "$@"; }
log_warning()  { log WARNING "$@"; }
log_error()    { log ERROR "$@"; exit 1; }
log_critical() { log CRITICAL "$@"; }
log_deploy()   { log DEPLOY "$@"; }

# Progress indicator
show_progress() {
    local task="$1"
    local duration=${2:-3}
    
    printf "${CYAN}⏳ %s${NC}" "$task"
    for i in $(seq 1 $duration); do
        printf "."
        sleep 1
    done
    printf " ${GREEN}✅${NC}\n"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🛡️ PHASE 1: ENVIRONMENT VALIDATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

validate_local_environment() {
    log_deploy "🛡️  PHASE 1: Environment Validation"
    
    # Check required files
    [[ -f "$SSH_KEY" ]] || log_error "SSH key not found: $SSH_KEY"
    [[ -f "./frontend/package.json" ]] || log_error "Frontend package.json not found"
    [[ -f "./backend/manage.py" ]] || log_error "Backend Django project not found"
    [[ -f "./docker-compose.prod.yml" ]] || log_error "Production docker-compose not found"
    [[ -f "./Dockerfile.prod" ]] || log_error "Production Dockerfile not found"
    
    # Set SSH key permissions
    chmod 600 "$SSH_KEY"
    
    # Check SSH connectivity
    log_info "Testing SSH connectivity..."
    if ! ssh -i "$SSH_KEY" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$PROD_SERVER" 'echo "SSH connection successful"' >/dev/null 2>&1; then
        log_error "Cannot connect to production server"
    fi
    
    # Validate environment variables
    [[ -f ".env" ]] && log_info "Environment file found" || log_warning "No .env file found"
    
    log_success "Local environment validation completed"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🏗️ PHASE 2: BUILD OPTIMIZATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

build_frontend() {
    log_deploy "🏗️  PHASE 2: Production Build Process"
    
    log_info "Building optimized frontend..."
    cd frontend
    
    # Clean previous builds
    rm -rf dist/ node_modules/.cache/ 2>/dev/null || true
    
    # Verify dependencies
    if [[ ! -d "node_modules" ]] || [[ package.json -nt node_modules ]]; then
        log_info "Installing/updating dependencies..."
        npm ci --production=false
    fi
    
    # Production build with optimizations
    log_info "Creating optimized production build..."
    NODE_ENV=production \
    VITE_DISABLE_COGNITO=false \
    VITE_AWS_COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI \
    VITE_AWS_COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0 \
    VITE_API_BASE_URL=https://${DOMAIN}/api/v1 \
    npm run build
    
    # Verify build success
    [[ -d "dist" ]] || log_error "Frontend build failed - dist directory not created"
    [[ -f "dist/index.html" ]] || log_error "Frontend build failed - index.html not found"
    
    # Build size analysis
    local build_size=$(du -sh dist/ | cut -f1)
    log_info "Frontend build size: $build_size"
    
    cd ..
    log_success "Frontend build completed successfully"
}

create_deployment_package() {
    log_info "Creating deployment package..."
    
    # Create temporary deployment directory
    local deploy_tmp="./tmp_deploy_${DEPLOY_ID}"
    mkdir -p "$deploy_tmp"
    
    # Package frontend build
    tar -czf "$deploy_tmp/frontend-dist.tar.gz" -C frontend dist/
    
    # Package backend files
    tar -czf "$deploy_tmp/backend.tar.gz" \
        --exclude='**/__pycache__' \
        --exclude='**/*.pyc' \
        --exclude='**/migrations/__pycache__' \
        --exclude='*.sqlite3' \
        backend/
    
    # Package configuration files
    cp docker-compose.prod.yml Dockerfile.prod "$deploy_tmp/"
    [[ -f ".env" ]] && cp .env "$deploy_tmp/"
    
    # Create deployment info
    cat > "$deploy_tmp/deployment_info.json" << EOF
{
  "deploy_id": "$DEPLOY_ID",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "git_branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
  "build_env": "production",
  "domain": "$DOMAIN"
}
EOF
    
    echo "$deploy_tmp"
    log_success "Deployment package created: $deploy_tmp"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 PHASE 3: SERVER PREPARATION & CLEANUP
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

prepare_production_server() {
    log_deploy "🚀 PHASE 3: Production Server Preparation"
    
    log_info "Connecting to production server..."
    
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_SERVER" << 'REMOTE_SCRIPT'
        set -euo pipefail
        export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
        
        echo "🔍 Server diagnostics:"
        echo "  Hostname: $(hostname)"
        echo "  Uptime: $(uptime -p)"
        echo "  Load: $(uptime | awk -F'load average:' '{print $2}')"
        
        # Memory and disk analysis
        memory_usage=$(free | awk '/^Mem:/ {printf "%.0f", $3/$2 * 100}')
        disk_usage=$(df / | awk 'NR==2 {print int($3/$2 * 100)}')
        
        echo "  Memory usage: ${memory_usage}%"
        echo "  Disk usage: ${disk_usage}%"
        
        # Critical resource check
        if [[ $memory_usage -gt 90 ]] || [[ $disk_usage -gt 95 ]]; then
            echo "❌ Critical resource usage detected!"
            exit 1
        fi
        
        # Aggressive cleanup if needed
        if [[ $memory_usage -gt 80 ]] || [[ $disk_usage -gt 85 ]]; then
            echo "🧹 Performing aggressive cleanup..."
            
            # Stop current containers
            sudo docker-compose -f /home/ubuntu/restaurant-web/docker-compose.prod.yml down 2>/dev/null || true
            
            # Docker system cleanup
            sudo docker system prune -af --volumes 2>/dev/null || true
            sudo docker volume prune -f 2>/dev/null || true
            sudo docker network prune -f 2>/dev/null || true
            
            # System cleanup
            sudo apt-get autoremove -y 2>/dev/null || true
            sudo apt-get autoclean 2>/dev/null || true
            sudo journalctl --vacuum-size=50M 2>/dev/null || true
            
            # Clean logs and temp files
            sudo find /var/log -type f -name "*.log" -mtime +3 -delete 2>/dev/null || true
            sudo find /tmp -type f -mtime +1 -delete 2>/dev/null || true
            sudo rm -rf /var/tmp/docker-* /tmp/docker-* 2>/dev/null || true
            
            # Update resource usage
            memory_usage=$(free | awk '/^Mem:/ {printf "%.0f", $3/$2 * 100}')
            disk_usage=$(df / | awk 'NR==2 {print int($3/$2 * 100)}')
            echo "  Post-cleanup Memory: ${memory_usage}%"
            echo "  Post-cleanup Disk: ${disk_usage}%"
        fi
        
        # Ensure project directory
        mkdir -p /home/ubuntu/restaurant-web
        cd /home/ubuntu/restaurant-web
        
        # Create backup of current database if exists
        if [[ -f data/restaurant.prod.sqlite3 ]]; then
            echo "📦 Creating database backup..."
            mkdir -p data/backups
            cp data/restaurant.prod.sqlite3 "data/backups/backup_$(date +%Y%m%d_%H%M%S).sqlite3"
            # Keep only last 5 backups
            ls -t data/backups/backup_*.sqlite3 | tail -n +6 | xargs -r rm -f
        fi
        
        echo "✅ Server preparation completed"
REMOTE_SCRIPT
    
    log_success "Production server prepared successfully"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📦 PHASE 4: DEPLOYMENT TRANSFER
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

deploy_to_server() {
    local deploy_package="$1"
    log_deploy "📦 PHASE 4: Deployment Transfer"
    
    log_info "Uploading deployment package..."
    scp -i "$SSH_KEY" -o StrictHostKeyChecking=no -r "$deploy_package"/* "$PROD_SERVER:$REMOTE_DIR/"
    
    log_info "Extracting and configuring on server..."
    
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_SERVER" << REMOTE_SCRIPT
        set -euo pipefail
        export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
        cd $REMOTE_DIR
        
        # Extract frontend
        echo "📱 Deploying frontend..."
        rm -rf frontend-dist/
        mkdir -p frontend-dist/
        tar -xzf frontend-dist.tar.gz -C frontend-dist/ --strip-components=1
        
        # Extract backend
        echo "🔧 Deploying backend..."
        rm -rf backend/
        tar -xzf backend.tar.gz
        
        # Set proper permissions
        sudo mkdir -p data
        sudo chown -R ubuntu:ubuntu data/
        chmod 755 data/
        
        # Ensure database directory structure
        mkdir -p data/backups data/logs
        
        echo "✅ Deployment files extracted successfully"
REMOTE_SCRIPT
    
    log_success "Deployment transfer completed"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🗄️ PHASE 5: DATABASE MIGRATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

run_migrations() {
    log_deploy "🗄️  PHASE 5: Database Migration"
    
    log_info "Running Django migrations..."
    
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_SERVER" << 'REMOTE_SCRIPT'
        set -euo pipefail
        export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
        cd /home/ubuntu/restaurant-web
        
        # Build the new image with migrations
        echo "🐳 Building production Docker image..."
        sudo docker build -f Dockerfile.prod -t restaurant-app:latest .
        
        # Run migrations in a temporary container
        echo "🗄️  Running database migrations..."
        sudo docker run --rm \
            -v "$(pwd)/data:/app/data" \
            -v "$(pwd)/.env:/app/.env" \
            --entrypoint="" \
            restaurant-app:latest \
            python manage.py migrate --no-input
        
        # Collect static files
        echo "📁 Collecting static files..."
        sudo docker run --rm \
            -v "$(pwd)/data:/app/data" \
            -v "$(pwd)/.env:/app/.env" \
            --entrypoint="" \
            restaurant-app:latest \
            python manage.py collectstatic --no-input --clear
        
        echo "✅ Database migration completed"
REMOTE_SCRIPT
    
    log_success "Database migrations completed successfully"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚢 PHASE 6: CONTAINER ORCHESTRATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

deploy_containers() {
    log_deploy "🚢 PHASE 6: Container Orchestration"
    
    log_info "Starting production containers..."
    
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_SERVER" << 'REMOTE_SCRIPT'
        set -euo pipefail
        export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
        cd /home/ubuntu/restaurant-web
        
        # Stop existing containers gracefully
        echo "🛑 Stopping existing containers..."
        sudo docker-compose -f docker-compose.prod.yml down --timeout 30 2>/dev/null || true
        
        # Remove orphaned containers
        sudo docker ps -aq --filter "name=restaurant" | xargs -r sudo docker rm -f 2>/dev/null || true
        
        # Start new containers
        echo "🚀 Starting production containers..."
        export DOCKER_IMAGE=restaurant-app:latest
        sudo docker-compose -f docker-compose.prod.yml up -d
        
        # Wait for services to start
        echo "⏳ Waiting for services to initialize..."
        sleep 20
        
        # Verify containers are running
        if ! sudo docker ps | grep -q "restaurant"; then
            echo "❌ Failed to start containers"
            sudo docker-compose -f docker-compose.prod.yml logs
            exit 1
        fi
        
        echo "✅ Containers started successfully"
REMOTE_SCRIPT
    
    log_success "Container orchestration completed"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔒 PHASE 7: SSL & NGINX CONFIGURATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

configure_nginx() {
    log_deploy "🔒 PHASE 7: SSL & Nginx Configuration"
    
    log_info "Configuring Nginx with SSL..."
    
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_SERVER" << REMOTE_SCRIPT
        set -euo pipefail
        export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
        cd /home/ubuntu/restaurant-web
        
        # Check SSL certificates
        ssl_available=false
        if [[ -d "/etc/letsencrypt/live/$DOMAIN" ]]; then
            cert_file="/etc/letsencrypt/live/$DOMAIN/cert.pem"
            if [[ -f "\$cert_file" ]]; then
                days_left=\$(( (\$(date -d "\$(openssl x509 -enddate -noout -in "\$cert_file" | cut -d= -f2)" +%s) - \$(date +%s)) / 86400 ))
                if [[ \$days_left -gt 7 ]]; then
                    ssl_available=true
                    echo "🔒 SSL certificate valid for \$days_left days"
                else
                    echo "⚠️  SSL certificate expires in \$days_left days"
                fi
            fi
        fi
        
        # Create Nginx configuration
        mkdir -p docker/nginx/conf.d/
        
        if [[ "\$ssl_available" == "true" ]]; then
            echo "🔐 Configuring Nginx with SSL/HTTPS..."
            cat > docker/nginx/conf.d/default.conf << 'EOF'
# HTTPS Production Configuration
server_tokens off;
limit_req_zone \$binary_remote_addr zone=api:10m rate=60r/m;
limit_req_zone \$binary_remote_addr zone=general:10m rate=200r/m;

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN xn--elfogndedonsoto-zrb.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files \$uri =404;
    }
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN xn--elfogndedonsoto-zrb.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    client_max_body_size 10M;
    
    # API endpoints
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://app:8000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_read_timeout 300s;
    }
    
    # Admin interface
    location /admin/ {
        proxy_pass http://app:8000/admin/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Static files
    location /static/ {
        proxy_pass http://app:8000/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Frontend
    location / {
        limit_req zone=general burst=50 nodelay;
        proxy_pass http://app:8000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF
        else
            echo "🔓 Configuring Nginx with HTTP (SSL not available)..."
            cat > docker/nginx/conf.d/default.conf << 'EOF'
# HTTP Configuration (SSL not available)
server_tokens off;
limit_req_zone \$binary_remote_addr zone=api:10m rate=60r/m;
limit_req_zone \$binary_remote_addr zone=general:10m rate=200r/m;

server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN xn--elfogndedonsoto-zrb.com _;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    client_max_body_size 10M;
    
    # API endpoints
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://app:8000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Frontend
    location / {
        limit_req zone=general burst=50 nodelay;
        proxy_pass http://app:8000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
        fi
        
        # Restart nginx with new configuration
        echo "🔄 Reloading Nginx configuration..."
        sudo docker-compose -f docker-compose.prod.yml restart nginx
        sleep 10
        
        echo "✅ Nginx configuration completed"
REMOTE_SCRIPT
    
    log_success "SSL & Nginx configuration completed"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ✅ PHASE 8: COMPREHENSIVE VALIDATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

validate_deployment() {
    log_deploy "✅ PHASE 8: Comprehensive Validation"
    
    local failed=0
    local total=0
    
    log_info "Running comprehensive health checks..."
    
    # Test critical endpoints
    local endpoints=(
        "https://$DOMAIN/"
        "https://$DOMAIN/api/v1/health/"
        "https://$DOMAIN/api/v1/config/units/"
        "https://$DOMAIN/api/v1/dashboard-operativo/report/?date=$(date +%Y-%m-%d)"
        "https://$DOMAIN/admin/"
    )
    
    for endpoint in "${endpoints[@]}"; do
        ((total++))
        local endpoint_name=$(echo "$endpoint" | sed 's/.*\/\([^/?]*\).*/\1/')
        [[ -z "$endpoint_name" ]] && endpoint_name="homepage"
        
        log_info "Testing endpoint: $endpoint_name"
        
        if timeout 30 curl -f -s -L "$endpoint" >/dev/null 2>&1; then
            log_success "✅ $endpoint_name - OK"
        else
            log_warning "❌ $endpoint_name - FAILED"
            ((failed++))
            
            # Try HTTP fallback for the main endpoints
            if [[ "$endpoint" == *"https://"* ]]; then
                local http_endpoint="${endpoint/https:/http:}"
                if timeout 30 curl -f -s -L "$http_endpoint" >/dev/null 2>&1; then
                    log_warning "⚠️  $endpoint_name - HTTP fallback working"
                    ((failed--))
                fi
            fi
        fi
    done
    
    # Container health check
    log_info "Validating container status..."
    
    local container_status=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_SERVER" \
        'export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" && \
         cd /home/ubuntu/restaurant-web && \
         sudo docker ps --filter "name=restaurant" --format "{{.Names}}: {{.Status}}"')
    
    if [[ -n "$container_status" ]]; then
        log_success "Container status:"
        echo "$container_status" | while read -r line; do
            log_info "  $line"
        done
    else
        log_warning "❌ No containers running"
        ((failed++))
    fi
    
    # SSL certificate check
    log_info "Checking SSL certificate..."
    if timeout 10 openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" </dev/null >/dev/null 2>&1; then
        local cert_info=$(echo | openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
        if [[ -n "$cert_info" ]]; then
            log_success "✅ SSL certificate valid"
            log_info "$cert_info"
        fi
    else
        log_warning "⚠️  SSL certificate check failed (may be using HTTP)"
    fi
    
    # Performance check
    log_info "Performance validation..."
    local response_time=$(curl -o /dev/null -s -w "%{time_total}" -L "https://$DOMAIN/" 2>/dev/null || echo "timeout")
    
    if [[ "$response_time" != "timeout" ]]; then
        log_info "Homepage response time: ${response_time}s"
        if (( $(echo "$response_time < 3.0" | bc -l) )); then
            log_success "✅ Performance acceptable"
        else
            log_warning "⚠️  Slow response time: ${response_time}s"
        fi
    fi
    
    # Final validation summary
    local success=$((total - failed))
    log_deploy "Validation Summary:"
    log_info "  Total checks: $total"
    log_info "  Successful: $success"
    log_info "  Failed: $failed"
    
    if [[ $failed -eq 0 ]]; then
        log_success "🎉 All validations passed!"
        return 0
    elif [[ $failed -lt $((total / 2)) ]]; then
        log_warning "⚠️  Deployment partially successful ($failed failures)"
        return 1
    else
        log_error "❌ Deployment validation failed ($failed failures)"
        return 2
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🧹 CLEANUP & FINALIZATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cleanup() {
    local deploy_package="$1"
    log_info "Cleaning up temporary files..."
    
    if [[ -d "$deploy_package" ]]; then
        rm -rf "$deploy_package"
        log_info "Removed deployment package: $deploy_package"
    fi
    
    # Clean up remote temporary files
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_SERVER" \
        "cd /home/ubuntu/restaurant-web && rm -f *.tar.gz deployment_info.json" 2>/dev/null || true
}

generate_deployment_report() {
    local status="$1"
    local end_time=$(date '+%Y-%m-%d %H:%M:%S')
    local duration=$(($(date +%s) - $(date -d "$(head -1 "$LOG_FILE" | awk '{print $2, $3}')" +%s) 2>/dev/null || echo 0))
    
    cat << EOF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 DEPLOYMENT REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 SUMMARY
  Status: $status
  Deploy ID: $DEPLOY_ID
  Completed: $end_time
  Duration: ${duration}s

🌐 ENDPOINTS
  Production: https://$DOMAIN/
  API: https://$DOMAIN/api/v1/
  Admin: https://$DOMAIN/admin/

📋 DEPLOYMENT LOG
  Full log: $LOG_FILE

🔧 POST-DEPLOYMENT
  • Monitor application logs: ssh -i $SSH_KEY $PROD_SERVER "sudo docker logs restaurant-app -f"
  • Check resource usage: ssh -i $SSH_KEY $PROD_SERVER "free -h && df -h"
  • View container status: ssh -i $SSH_KEY $PROD_SERVER "sudo docker ps"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎯 MAIN EXECUTION FLOW
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

main() {
    local start_time=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Banner
    cat << 'EOF'
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 PROFESSIONAL PRODUCTION DEPLOYMENT SYSTEM
   Full-Stack Restaurant Web Application Pipeline
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
    
    log_deploy "Deployment started: $start_time"
    log_deploy "Deploy ID: $DEPLOY_ID"
    log_deploy "Target: $DOMAIN"
    
    # Set up cleanup trap
    local deploy_package=""
    trap 'cleanup "$deploy_package"' EXIT
    
    # Execute deployment pipeline
    validate_local_environment
    build_frontend
    deploy_package=$(create_deployment_package)
    prepare_production_server
    deploy_to_server "$deploy_package"
    run_migrations
    deploy_containers
    configure_nginx
    
    # Wait for services to stabilize
    log_info "Waiting for services to stabilize..."
    show_progress "Service stabilization" 30
    
    # Validation
    if validate_deployment; then
        log_success "🎉 DEPLOYMENT SUCCESSFUL!"
        generate_deployment_report "SUCCESS"
        exit 0
    else
        log_critical "⚠️  DEPLOYMENT COMPLETED WITH WARNINGS"
        generate_deployment_report "PARTIAL_SUCCESS" 
        exit 1
    fi
}

# Execute main function with all arguments
main "$@"