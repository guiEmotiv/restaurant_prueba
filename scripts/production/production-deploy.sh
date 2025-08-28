#!/bin/bash
# Professional Production Deployment System
# Ultra-efficient, intelligent deployment with change detection
# Usage: ./scripts/production-deploy.sh [action]

set -e
cd "$(dirname "$0")/.."

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CONFIGURATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ACTION=${1:-deploy}
DOMAIN="xn--elfogndedonsoto-zrb.com"
ECR_REGISTRY="721063839441.dkr.ecr.us-west-2.amazonaws.com"
ECR_REPOSITORY="restaurant-web"
AWS_REGION="us-west-2"

# Colors for professional output
readonly G='\033[0;32m' R='\033[0;31m' Y='\033[1;33m' B='\033[0;34m' NC='\033[0m'

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LOGGING FUNCTIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log() { echo -e "${G}[$(date +'%H:%M:%S')]${NC} $1"; }
err() { echo -e "${R}[ERROR]${NC} $1" >&2; exit 1; }
warn() { echo -e "${Y}[WARNING]${NC} $1"; }
info() { echo -e "${B}[INFO]${NC} $1"; }

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ENVIRONMENT DETECTION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

detect_environment() {
    if [ -d "/opt/restaurant-web" ]; then
        echo "ec2"
    else
        echo "local"
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# INTELLIGENT CHANGE DETECTION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

detect_changes() {
    local commit_hash=${1:-"HEAD"}
    local previous_hash=${2:-"HEAD~1"}
    
    # Check if commits exist
    if ! git rev-parse --verify "$commit_hash" >/dev/null 2>&1; then
        warn "Commit $commit_hash not found, deploying all components"
        echo "frontend backend infrastructure ssl"
        return
    fi
    
    if ! git rev-parse --verify "$previous_hash" >/dev/null 2>&1; then
        warn "Previous commit not found, deploying all components"
        echo "frontend backend infrastructure ssl"
        return
    fi
    
    local changes=$(git diff --name-only "$previous_hash" "$commit_hash" 2>/dev/null || echo "")
    local components=""
    
    # Frontend changes
    if echo "$changes" | grep -q "^frontend/"; then
        components="$components frontend"
        log "🎨 Frontend changes detected"
    fi
    
    # Backend changes
    if echo "$changes" | grep -q "^backend/"; then
        components="$components backend"
        log "🔧 Backend changes detected"
    fi
    
    # Infrastructure changes
    if echo "$changes" | grep -qE "^(docker/|Dockerfile)"; then
        components="$components infrastructure"
        log "🏗️ Infrastructure changes detected"
    fi
    
    # SSL/Security changes
    if echo "$changes" | grep -qE "^(scripts/.*ssl|docker/nginx/.*conf)"; then
        components="$components ssl"
        log "🔒 SSL/Security changes detected"
    fi
    
    # GitHub Actions changes
    if echo "$changes" | grep -q "^\.github/"; then
        components="$components infrastructure"
        log "⚙️ CI/CD changes detected"
    fi
    
    # If no specific changes, deploy everything
    if [ -z "$components" ]; then
        components="frontend backend infrastructure"
        log "📦 No specific changes detected, deploying core components"
    fi
    
    echo "$components"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PERFORMANCE OPTIMIZED HEALTH CHECK
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

health_check() {
    local max_attempts=${1:-12}
    local interval=${2:-5}
    
    log "🏥 Starting intelligent health check..."
    
    for i in $(seq 1 $max_attempts); do
        if curl -sf -m 3 http://localhost:8000/api/v1/health/ >/dev/null 2>&1; then
            log "✅ Service healthy (attempt $i/$max_attempts)"
            return 0
        fi
        
        if [ $i -lt $max_attempts ]; then
            info "Health check $i/$max_attempts failed, retrying in ${interval}s..."
            sleep $interval
        fi
    done
    
    err "❌ Health check failed after $max_attempts attempts"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PRODUCTION ENVIRONMENT SETUP
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

setup_production_environment() {
    log "🔧 Setting up production environment..."
    
    # Create necessary directories
    mkdir -p data logs backups
    
    # Initialize database if needed
    [ ! -f data/restaurant_prod.sqlite3 ] && touch data/restaurant_prod.sqlite3
    
    # Create optimized environment file
    if [ ! -f .env.ec2 ]; then
        log "📝 Creating production environment configuration..."
        cat > .env.ec2 << 'EOF'
# Restaurant Web Production Configuration
SECRET_KEY=prod-secret-key-change-in-production
DEBUG=False
USE_COGNITO_AUTH=True
COGNITO_USER_POOL_ID=will-be-set-by-secrets
COGNITO_APP_CLIENT_ID=will-be-set-by-secrets  
AWS_REGION=us-west-2
ALLOWED_HOSTS=xn--elfogndedonsoto-zrb.com,www.xn--elfogndedonsoto-zrb.com,44.248.47.186
DATABASE_PATH=/opt/restaurant-web/data
DATABASE_NAME=restaurant_prod.sqlite3
DJANGO_SETTINGS_MODULE=backend.settings_ec2
EOF
        log "✅ Environment file created"
    else
        log "📋 Using existing environment configuration"
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# EFFICIENT DEPLOYMENT EXECUTION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

execute_deployment() {
    local components="$1"
    
    log "🚀 Executing efficient production deployment..."
    log "📦 Components to deploy: $components"
    
    # ECR Authentication (only if image pull is needed)
    if echo "$components" | grep -q "frontend\|backend\|infrastructure"; then
        log "🔐 Authenticating with ECR..."
        aws ecr get-login-password --region $AWS_REGION | \
            docker login --username AWS --password-stdin $ECR_REGISTRY
    fi
    
    # Intelligent container management
    if echo "$components" | grep -q "infrastructure"; then
        log "🧹 Deep infrastructure cleanup..."
        docker-compose -f docker/docker-compose.prod.yml --profile production down --volumes --remove-orphans --timeout 10 || true
        docker system prune -af --volumes || true
    else
        log "🔄 Graceful service restart..."
        docker-compose -f docker/docker-compose.prod.yml --profile production down --timeout 10 || true
    fi
    
    # Pull latest image (only if needed)
    if echo "$components" | grep -q "frontend\|backend"; then
        log "⬇️ Pulling latest application image..."
        docker pull $ECR_REGISTRY/$ECR_REPOSITORY:latest
    fi
    
    # Start services
    log "▶️ Starting production services..."
    docker-compose -f docker/docker-compose.prod.yml --profile production up -d --force-recreate --remove-orphans
    
    # Optimized health check
    health_check 12 5
    
    # Display final status
    log "📊 Final deployment status:"
    docker-compose -f docker/docker-compose.prod.yml --profile production ps
    
    log "✅ Deployment completed successfully!"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MAIN EXECUTION LOGIC
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

main() {
    local environment=$(detect_environment)
    
    log "🌟 Professional Restaurant Web Deployment System"
    log "📍 Environment: $environment"
    log "🎯 Action: $ACTION"
    
    case "$environment" in
        "local")
            if [ "$ACTION" = "deploy" ] && command -v gh >/dev/null; then
                log "🚀 Triggering GitHub Actions deployment..."
                gh workflow run deploy.yml
                log "✅ GitHub Actions triggered successfully"
            else
                err "Local deployment not supported. Use GitHub Actions or run on EC2."
            fi
            ;;
            
        "ec2")
            cd /opt/restaurant-web
            
            case "$ACTION" in
                "deploy")
                    setup_production_environment
                    local changes=$(detect_changes)
                    execute_deployment "$changes"
                    ;;
                    
                "status"|"check")
                    log "🏥 System health check..."
                    docker-compose -f docker/docker-compose.prod.yml --profile production ps
                    if health_check 3 2; then
                        log "✅ All systems operational"
                    else
                        err "❌ System health check failed"
                    fi
                    ;;
                    
                "logs")
                    local service=${2:-app}
                    log "📜 Displaying logs for service: $service"
                    docker-compose -f docker/docker-compose.prod.yml --profile production logs $service --tail=50 -f
                    ;;
                    
                "backup")
                    log "💾 Creating database backup..."
                    mkdir -p backups
                    if [ -f data/restaurant_prod.sqlite3 ]; then
                        cp data/restaurant_prod.sqlite3 "backups/backup-$(date +%Y%m%d-%H%M%S).sqlite3"
                        log "✅ Backup created successfully"
                        ls -la backups/ | tail -3
                    else
                        warn "No database found to backup"
                    fi
                    ;;
                    
                "restart")
                    log "🔄 Restarting services..."
                    docker-compose -f docker/docker-compose.prod.yml --profile production restart
                    health_check 6 5
                    ;;
                    
                *)
                    info "Usage: $0 {deploy|status|logs|backup|restart}"
                    info "  deploy  - Smart deployment with change detection"
                    info "  status  - System health and status check"
                    info "  logs    - View service logs"
                    info "  backup  - Create database backup"
                    info "  restart - Restart services"
                    exit 1
                    ;;
            esac
            ;;
    esac
}

# Execute main function
main "$@"