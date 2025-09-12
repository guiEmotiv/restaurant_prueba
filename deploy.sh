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
SSH_KEY="ubuntu_fds_key.pem"
PROD_HOST="ubuntu@44.248.47.186"
PROD_PATH="/home/ubuntu/restaurant-web"

# Validate environment file
[[ ! -f "$ENV_FILE" ]] && log_error "Environment file $ENV_FILE not found!"

# Load environment variables
set -o allexport
source "$ENV_FILE"
set +o allexport

# ─────────────────────────────────────────────────────────────────────
# STEP 1: Build Frontend with Correct Environment
# ─────────────────────────────────────────────────────────────────────
build_frontend() {
    log_info "🏗️  Building frontend for $ENVIRONMENT..."
    
    cd frontend
    
    # Install dependencies if needed
    [[ ! -d "node_modules" ]] && npm ci
    
    # Clean previous build
    rm -rf dist/
    
    # Build with environment variables loaded
    log_info "Building with VITE_API_BASE_URL=$VITE_API_BASE_URL"
    npm run build
    
    # Verify build
    [[ ! -d "dist" ]] && log_error "Frontend build failed - no dist directory"
    [[ ! -f "dist/index.html" ]] && log_error "Frontend build failed - no index.html"
    
    local build_size=$(du -sh dist/ | cut -f1)
    log_success "Frontend built successfully ($build_size)"
    
    cd ..
}

# ─────────────────────────────────────────────────────────────────────
# STEP 2: Deploy to Server (Production only)
# ─────────────────────────────────────────────────────────────────────
deploy_to_server() {
    if [[ "$ENVIRONMENT" != "production" ]]; then
        log_info "Skipping server deployment for $ENVIRONMENT environment"
        return 0
    fi
    
    log_info "📡 Deploying to production server..."
    
    # Test SSH connection first
    log_info "Testing SSH connection..."
    if ! ssh -i "$SSH_KEY" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$PROD_HOST" "echo 'SSH connection OK'"; then
        log_error "Failed to connect to production server"
    fi
    
    # Copy environment file to server
    log_info "Copying environment configuration..."
    if ! scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "$ENV_FILE" "$PROD_HOST:$PROD_PATH/.env"; then
        log_error "Failed to copy environment file"
    fi
    
    # Copy frontend build to server
    log_info "Copying frontend build..."
    if ! scp -r -i "$SSH_KEY" -o StrictHostKeyChecking=no frontend/dist/* "$PROD_HOST:$PROD_PATH/frontend/dist/"; then
        log_error "Failed to copy frontend build"
    fi
    
    # Deploy on server
    log_info "Executing deployment on server..."
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_HOST" "
        cd $PROD_PATH || exit 1
        
        echo '📥 Pulling latest code from repository...'
        git pull origin main || exit 1
        
        echo '🛑 Stopping existing containers...'
        docker compose -f docker-compose.production.yml down 2>/dev/null || true
        
        echo '🧹 Cleaning up Docker resources...'
        docker system prune -f || true
        
        echo '🚀 Starting containers with new environment...'
        docker compose -f docker-compose.production.yml up -d --build || exit 1
        
        echo '⏳ Waiting for containers to start...'
        sleep 15
        
        echo '📋 Checking container status...'
        docker compose -f docker-compose.production.yml ps
        
        echo '🔍 Checking container logs...'
        docker compose -f docker-compose.production.yml logs --tail=10 restaurant-web-backend || true
        
        echo '🩺 Testing internal health check...'
        timeout 30 bash -c 'until curl -sf http://localhost:8000/api/v1/health/ > /dev/null; do sleep 2; done' && echo '✅ Backend is healthy' || echo '❌ Backend health check failed'
    " || log_error "Deployment on server failed"
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
    
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_HOST" "
        cd $PROD_PATH
        
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
    "
}

# ─────────────────────────────────────────────────────────────────────
# MAIN EXECUTION
# ─────────────────────────────────────────────────────────────────────
main() {
    local start_time=$(date +%s)
    
    # Show initial status
    log_info "🚀 Starting deployment to $ENVIRONMENT environment"
    log_info "📅 Started at: $(date)"
    
    # Execute deployment steps
    build_frontend
    deploy_to_server
    validate_deployment
    
    # Show final status if production
    if [[ "$ENVIRONMENT" == "production" ]]; then
        show_deployment_status
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))
    
    echo ""
    log_success "🏁 Deployment completed in ${minutes}m ${seconds}s"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log_info "🌍 Access your application at: https://www.xn--elfogndedonsoto-zrb.com"
        log_info "🔍 Admin panel: https://www.xn--elfogndedonsoto-zrb.com/admin"
        log_info "📡 API docs: https://www.xn--elfogndedonsoto-zrb.com/api/v1/"
    else
        log_info "🏠 Start your development server with: cd frontend && npm run dev"
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