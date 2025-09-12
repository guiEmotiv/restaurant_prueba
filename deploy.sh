#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 RESTAURANT WEB - Simple & Effective Deployment
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

# Colors
readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly RED='\033[0;31m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

# Logging
log_info() { printf "${BLUE}[INFO]${NC} %s\n" "$*"; }
log_success() { printf "${GREEN}[SUCCESS]${NC} %s\n" "$*"; }
log_warn() { printf "${YELLOW}[WARNING]${NC} %s\n" "$*"; }
log_error() { printf "${RED}[ERROR]${NC} %s\n" "$*"; exit 1; }

# Configuration
ENVIRONMENT=${1:-production}
ENV_FILE=".env.$ENVIRONMENT"

log_info "🖥️  Running deployment directly on EC2 server"

# Validate environment file
[[ ! -f "$ENV_FILE" ]] && log_error "Environment file $ENV_FILE not found!"

# Load environment variables
set -o allexport
source "$ENV_FILE"
set +o allexport

# ─────────────────────────────────────────────────────────────────────
# STEP 1: Clean EC2 Memory and Disk
# ─────────────────────────────────────────────────────────────────────
clean_server_resources() {
    if [[ "$ENVIRONMENT" != "production" ]]; then
        log_info "Skipping server cleanup for $ENVIRONMENT environment"
        return 0
    fi
    
    log_info "🧹 Cleaning EC2 memory and disk resources..."
    
    echo '📊 Current Resource Usage BEFORE cleanup:'
    echo '=========================================='
    df -h / | grep -v Filesystem
    free -h | grep '^Mem'
    echo ''
    
    echo '🐳 Cleaning Docker resources...'
    # Stop containers gracefully
    docker stop $(docker ps -q) 2>/dev/null || echo 'No containers to stop'
    
    # Aggressive Docker cleanup
    docker system prune -a -f --volumes 2>/dev/null || true
    docker image prune -a -f 2>/dev/null || true
    docker volume prune -f 2>/dev/null || true
    docker builder prune -a -f 2>/dev/null || true
    
    echo '🗑️  Cleaning system resources...'
    # Clean APT cache
    apt-get clean 2>/dev/null || true
    apt-get autoremove -y 2>/dev/null || true
    apt-get autoclean 2>/dev/null || true
    
    # Clean system logs
    journalctl --vacuum-time=1d 2>/dev/null || true
    find /var/log -type f -name '*.log' -exec truncate -s 0 {} \; 2>/dev/null || true
    
    # Clean temp files
    find /tmp -type f -mtime +1 -delete 2>/dev/null || true
    find /var/tmp -type f -mtime +1 -delete 2>/dev/null || true
    
    # Clear memory cache
    sync && echo 3 > /proc/sys/vm/drop_caches
    
    echo ''
    echo '📊 Resource Usage AFTER cleanup:'
    echo '================================='
    df -h / | grep -v Filesystem
    free -h | grep '^Mem'
    echo ''
    
    log_success "✅ Server resources cleaned successfully"
}

# ─────────────────────────────────────────────────────────────────────
# STEP 2: Validate Dependencies and Libraries
# ─────────────────────────────────────────────────────────────────────
validate_dependencies() {
    if [[ "$ENVIRONMENT" != "production" ]]; then
        log_info "Validating local dependencies..."
        # Check Node.js locally
        [[ ! $(command -v node) ]] && log_error "Node.js not installed locally"
        [[ ! $(command -v npm) ]] && log_error "npm not installed locally"
        return 0
    fi
    
    log_info "🔍 Validating server dependencies and libraries..."
    
    echo '🔧 Checking system dependencies...'
    
    # Check essential tools
    command -v git >/dev/null || log_error "git not installed"
    command -v curl >/dev/null || log_error "curl not installed"
    command -v unzip >/dev/null || log_error "unzip not installed"
    
    # Check Docker
    command -v docker >/dev/null || log_error "Docker not installed"
    docker --version || log_error "Docker not accessible"
    docker compose version >/dev/null 2>&1 || log_error "Docker Compose not available"
    
    # Check Node.js and npm
    command -v node >/dev/null || log_error "Node.js not installed"
    command -v npm >/dev/null || log_error "npm not installed"
    
    # Check Python (for backend)
    command -v python3 >/dev/null || log_error "Python3 not installed"
    command -v pip3 >/dev/null || log_error "pip3 not installed"
    
    echo '✅ All dependencies are installed'
    echo ''
    echo '📋 Versions:'
    echo "   Git: $(git --version | cut -d' ' -f3)"
    echo "   Docker: $(docker --version | cut -d' ' -f3 | tr -d ',')"
    echo "   Node.js: $(node --version)"
    echo "   npm: $(npm --version)"
    echo "   Python: $(python3 --version | cut -d' ' -f2)"
    echo ''
    
    log_success "✅ All dependencies validated successfully"
}

# ─────────────────────────────────────────────────────────────────────
# STEP 3: Build Backend
# ─────────────────────────────────────────────────────────────────────
build_backend() {
    if [[ "$ENVIRONMENT" != "production" ]]; then
        log_info "Skipping backend build for $ENVIRONMENT environment"
        return 0
    fi
    
    log_info "🏗️  Building backend..."
    
    echo '📦 Installing Python dependencies...'
    cd backend
    
    # Create virtual environment if it doesn't exist
    if [[ ! -d venv ]]; then
        python3 -m venv venv
    fi
    
    # Activate virtual environment and install dependencies
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    
    echo '🔧 Running Django setup...'
    # Django management commands
    python manage.py collectstatic --noinput --clear
    python manage.py makemigrations
    python manage.py migrate
    
    # Create superuser if it doesn't exist
    python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@restaurant.com', 'admin123')
    print('Superuser created successfully')
else:
    print('Superuser already exists')
"
    
    echo '✅ Backend built successfully'
    cd ..
    
    log_success "✅ Backend built successfully"
}

# ─────────────────────────────────────────────────────────────────────
# STEP 4: Build Frontend
# ─────────────────────────────────────────────────────────────────────
build_frontend() {
    log_info "🏗️  Building frontend for $ENVIRONMENT..."
    
    cd frontend || log_error "Frontend directory not found"
    
    echo '📦 Installing Node.js dependencies...'
    npm ci --production=false
    
    echo '🏗️  Building frontend with production environment...'
    npm run build
    
    # Verify build
    [[ ! -d dist ]] && log_error "Frontend build failed - no dist directory"
    [[ ! -f dist/index.html ]] && log_error "Frontend build failed - no index.html"
    
    local build_size=$(du -sh dist/ | cut -f1)
    echo "✅ Frontend built successfully ($build_size)"
    
    cd ..
    
    log_success "✅ Frontend built successfully"
}

# ─────────────────────────────────────────────────────────────────────
# STEP 5: Configure HTTPS and SSL
# ─────────────────────────────────────────────────────────────────────
configure_https_ssl() {
    if [[ "$ENVIRONMENT" != "production" ]]; then
        log_info "Skipping HTTPS/SSL configuration for $ENVIRONMENT environment"
        return 0
    fi
    
    log_info "🔒 Configuring HTTPS and SSL certificates..."
    
    echo '🔍 Checking SSL certificate status...'
    
    # Check if Let's Encrypt certificates exist
    if [[ -d /etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com ]]; then
        echo "✅ Let's Encrypt certificates found"
        
        # Check certificate expiry
        cert_expiry=$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com/cert.pem | cut -d= -f2)
        echo "📅 Certificate expires: $cert_expiry"
        
        # Check if certificate is expiring soon (less than 30 days)
        if openssl x509 -checkend 2592000 -noout -in /etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com/cert.pem; then
            echo '✅ Certificate is valid for more than 30 days'
        else
            echo '⚠️  Certificate expires within 30 days, renewing...'
            certbot renew --quiet || echo 'Certificate renewal failed'
        fi
    else
        echo "⚠️  Let's Encrypt certificates not found"
        echo '🔧 Checking for self-signed certificates...'
        
        # Create self-signed certificate if none exists
        if [[ ! -f docker/nginx/ssl/selfsigned.crt ]]; then
            echo '🔧 Creating self-signed SSL certificate...'
            mkdir -p docker/nginx/ssl
            
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout docker/nginx/ssl/selfsigned.key \
                -out docker/nginx/ssl/selfsigned.crt \
                -subj "/C=PE/ST=Lima/L=Lima/O=Restaurant/OU=IT Department/CN=xn--elfogndedonsoto-zrb.com"
                
            echo '✅ Self-signed certificate created'
        else
            echo '✅ Self-signed certificate already exists'
        fi
    fi
    
    echo '🔧 Verifying nginx SSL configuration...'
    if [[ -f docker/nginx/conf.d/default.conf ]]; then
        if grep -q 'ssl_certificate' docker/nginx/conf.d/default.conf; then
            echo '✅ Nginx SSL configuration found'
        else
            echo '⚠️  Nginx SSL configuration missing'
        fi
    fi
    
    # Set correct permissions
    chmod 644 docker/nginx/ssl/*.crt 2>/dev/null || true
    chmod 600 docker/nginx/ssl/*.key 2>/dev/null || true
    
    echo '✅ HTTPS/SSL configuration completed'
    
    log_success "✅ HTTPS/SSL configured successfully"
}

# ─────────────────────────────────────────────────────────────────────
# STEP 6: Deploy to Server (Production only)
# ─────────────────────────────────────────────────────────────────────
deploy_to_server() {
    if [[ "$ENVIRONMENT" != "production" ]]; then
        log_info "Skipping server deployment for $ENVIRONMENT environment"
        return 0
    fi
    
    log_info "🚀 Deploying containers..."
    
    echo '📥 Pulling latest code from repository...'
    git pull origin main || log_error "Git pull failed"
    
    echo '🛑 Stopping existing containers...'
    docker compose -f docker-compose.production.yml down 2>/dev/null || true
    
    echo '🧹 Cleaning up Docker resources...'
    docker system prune -f || true
    
    echo '🚀 Starting containers with new environment...'
    docker compose -f docker-compose.production.yml up -d --build || log_error "Container startup failed"
    
    echo '⏳ Waiting for containers to start...'
    sleep 15
    
    echo '📋 Checking container status...'
    docker compose -f docker-compose.production.yml ps
    
    echo '🔍 Checking container logs...'
    docker compose -f docker-compose.production.yml logs --tail=10 restaurant-web-backend || true
    
    echo '🩺 Testing internal health check...'
    timeout 30 bash -c 'until curl -sf http://localhost:8000/api/v1/health/ > /dev/null; do sleep 2; done' && echo '✅ Backend is healthy' || echo '❌ Backend health check failed'
    
    log_success "✅ Containers deployed successfully"
}

# ─────────────────────────────────────────────────────────────────────
# STEP 3: Validate Deployment
# ─────────────────────────────────────────────────────────────────────
validate_deployment() {
    if [[ "$ENVIRONMENT" != "production" ]]; then
        log_success "Development build completed successfully!"
        return 0
    fi
    
    log_info "🔍 Validating deployment..."
    
    # Wait for services to stabilize
    log_info "⏳ Waiting for services to stabilize..."
    sleep 30
    
    # Test endpoints with retries
    local failed=0
    local max_attempts=3
    
    # Test frontend with retries
    log_info "Testing frontend accessibility..."
    local attempt=1
    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf --max-time 30 "https://www.xn--elfogndedonsoto-zrb.com/" > /dev/null; then
            log_success "✅ Frontend is accessible (attempt $attempt/$max_attempts)"
            break
        else
            if [[ $attempt -eq $max_attempts ]]; then
                log_warn "❌ Frontend check failed after $max_attempts attempts"
                ((failed++))
            else
                log_info "Frontend check failed, retrying in 10s... (attempt $attempt/$max_attempts)"
                sleep 10
            fi
        fi
        ((attempt++))
    done
    
    # Test API health endpoint
    log_info "Testing API health endpoint..."
    attempt=1
    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf --max-time 30 "https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/" > /dev/null; then
            log_success "✅ API health check passed (attempt $attempt/$max_attempts)"
            break
        else
            if [[ $attempt -eq $max_attempts ]]; then
                log_warn "❌ API health check failed after $max_attempts attempts"
                ((failed++))
            else
                log_info "API health check failed, retrying in 10s... (attempt $attempt/$max_attempts)"
                sleep 10
            fi
        fi
        ((attempt++))
    done
    
    # Test API auth debug endpoint
    log_info "Testing API auth configuration..."
    if curl -sf --max-time 30 "https://www.xn--elfogndedonsoto-zrb.com/api/v1/auth-debug/" > /dev/null; then
        log_success "✅ API auth endpoint is accessible"
    else
        log_warn "❌ API auth endpoint check failed"
        ((failed++))
    fi
    
    # Test static files
    log_info "Testing static files..."
    if curl -sf --max-time 30 "https://www.xn--elfogndedonsoto-zrb.com/vite.svg" > /dev/null; then
        log_success "✅ Static files are accessible"
    else
        log_warn "❌ Static files check failed"
        ((failed++))
    fi
    
    # Final validation report
    echo ""
    log_info "📊 Deployment Validation Summary:"
    echo "   • Total tests: 4"
    echo "   • Failed tests: $failed"
    echo "   • Success rate: $((4-failed))/4"
    
    if [[ $failed -eq 0 ]]; then
        log_success "🎉 Deployment completed successfully!"
        log_info "🌍 Your application is ready at: https://www.xn--elfogndedonsoto-zrb.com"
    else
        log_warn "⚠️  Deployment completed with $failed validation failures"
        log_warn "Check the server logs for more details"
        return 1
    fi
}

# ─────────────────────────────────────────────────────────────────────
# DEPLOYMENT STATUS CHECK
# ─────────────────────────────────────────────────────────────────────
show_deployment_status() {
    if [[ "$ENVIRONMENT" != "production" ]]; then
        return 0
    fi
    
    log_info "📊 Getting deployment status..."
    
    echo '📋 Container Status:'
    docker compose -f docker-compose.production.yml ps
    
    echo ''
    echo '📊 Resource Usage:'
    docker stats --no-stream --format 'table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}'
    
    echo ''
    echo '📝 Recent Backend Logs:'
    docker compose -f docker-compose.production.yml logs --tail=5 restaurant-web-backend
    
    echo ''
    echo '📝 Recent Nginx Logs:'
    docker compose -f docker-compose.production.yml logs --tail=5 restaurant-web-nginx
}

# ─────────────────────────────────────────────────────────────────────
# FINAL STEP: Complete Docker Validation
# ─────────────────────────────────────────────────────────────────────
final_docker_validation() {
    if [[ "$ENVIRONMENT" != "production" ]]; then
        log_success "Development build completed successfully!"
        return 0
    fi
    
    log_info "🐳 Running complete Docker validation..."
    
    echo '🔍 Docker Container Health Check:'
    echo '================================='
    docker compose -f docker-compose.production.yml ps
    
    echo ''
    echo '📊 Container Resource Usage:'
    echo '============================'
    docker stats --no-stream --format 'table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}'
    
    echo ''
    echo '🏥 Container Health Status:'
    echo '==========================='
    for container in $(docker compose -f docker-compose.production.yml ps --services); do
        health_status=$(docker inspect --format='{{.State.Health.Status}}' ${container}-prod 2>/dev/null || echo 'no-healthcheck')
        echo "   $container: $health_status"
    done
    
    echo ''
    echo '📝 Recent Container Logs (Last 5 lines each):'
    echo '=============================================='
    echo '--- Backend Logs ---'
    docker compose -f docker-compose.production.yml logs --tail=5 restaurant-web-backend 2>/dev/null || echo 'Backend logs not available'
    
    echo '--- Nginx Logs ---'
    docker compose -f docker-compose.production.yml logs --tail=5 restaurant-web-nginx 2>/dev/null || echo 'Nginx logs not available'
    
    echo ''
    echo '🔌 Network Connectivity Tests:'
    echo '==============================='
    # Test internal connectivity
    echo 'Backend health (internal): '
    timeout 10 curl -s http://localhost:8000/api/v1/health/ >/dev/null && echo '✅ OK' || echo '❌ FAILED'
    
    echo 'Nginx response (internal): '
    timeout 10 curl -s http://localhost:80/ >/dev/null && echo '✅ OK' || echo '❌ FAILED'
    
    echo ''
    echo '📊 Docker System Summary:'
    echo '========================='
    docker system df
    
    echo ''
    echo '🔍 Volume Status:'
    echo '================='
    docker volume ls | grep restaurant
    
    echo ''
    echo '✅ Docker validation completed'
    
    log_success "✅ Docker validation completed"
}

# ─────────────────────────────────────────────────────────────────────
# MAIN EXECUTION
# ─────────────────────────────────────────────────────────────────────
main() {
    local start_time=$(date +%s)
    
    # Show initial status
    log_info "🚀 Starting complete deployment to $ENVIRONMENT environment"
    log_info "📅 Started at: $(date)"
    echo ""
    
    # Execute deployment steps in order
    log_info "📋 Deployment Pipeline:"
    echo "   1. 🧹 Clean server resources"
    echo "   2. 🔍 Validate dependencies"
    echo "   3. 🏗️  Build backend"
    echo "   4. 🏗️  Build frontend"
    echo "   5. 🔒 Configure HTTPS/SSL"
    echo "   6. 🚀 Deploy containers"
    echo "   7. ✅ Validate deployment"
    echo "   8. 📊 Show deployment status"
    echo "   9. 🐳 Final Docker validation"
    echo ""
    
    # Execute all steps
    clean_server_resources
    validate_dependencies
    build_backend
    build_frontend
    configure_https_ssl
    deploy_to_server
    validate_deployment
    
    # Show final status if production
    if [[ "$ENVIRONMENT" == "production" ]]; then
        show_deployment_status
        final_docker_validation
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_success "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!"
    log_success "🏁 Total deployment time: ${minutes}m ${seconds}s"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        echo ""
        log_info "🌍 🌟 Your restaurant application is now live! 🌟"
        log_info "🔗 Website: https://www.xn--elfogndedonsoto-zrb.com"
        log_info "🔍 Admin panel: https://www.xn--elfogndedonsoto-zrb.com/admin"
        log_info "📡 API endpoint: https://www.xn--elfogndedonsoto-zrb.com/api/v1/"
        log_info "🩺 Health check: https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/"
        echo ""
        log_info "📚 Next steps:"
        echo "   • Test the application thoroughly"
        echo "   • Configure restaurant tables and menu"
        echo "   • Set up printer connections"
        echo "   • Train staff on the new system"
    else
        log_info "🏠 Development environment ready!"
        log_info "   Start with: cd frontend && npm run dev"
    fi
}

# ─────────────────────────────────────────────────────────────────────
# USAGE EXAMPLES
# ─────────────────────────────────────────────────────────────────────
show_usage() {
    echo "Usage:"
    echo "  $0                    # Deploy to production"
    echo "  $0 production         # Deploy to production"  
    echo "  $0 development        # Build for development"
    echo ""
    echo "Examples:"
    echo "  ./deploy.sh                    # Quick production deploy"
    echo "  ./deploy.sh development        # Build for local development"
}

# Handle help flag
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    show_usage
    exit 0
fi

# Execute main function
main "$@"