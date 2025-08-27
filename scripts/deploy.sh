#!/bin/bash
# Legacy Deployment Script - Redirects to Professional System
# This script exists for backward compatibility
# Usage: ./scripts/deploy.sh [action]

set -e

ACTION=${1:-deploy}

# Colors
G='\033[0;32m' # Green
Y='\033[1;33m' # Yellow
NC='\033[0m'   # No Color

log() { echo -e "${G}[$(date +'%H:%M:%S')]${NC} $1"; }
warn() { echo -e "${Y}[LEGACY]${NC} $1"; }

# Redirect to professional deployment system
warn "This is a legacy script. Redirecting to professional deployment system..."

if [ -f "$(dirname "$0")/production-deploy.sh" ]; then
    log "🚀 Using professional deployment system"
    exec "$(dirname "$0")/production-deploy.sh" "$ACTION"
else
    # Fallback for backward compatibility
    warn "Professional script not found, running legacy deployment..."
fi

# On EC2
cd /opt/restaurant-web

case "$ACTION" in
    deploy)
        log "🚀 Deploying to production..."
        
        # Login to ECR
        aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin 721063839441.dkr.ecr.us-west-2.amazonaws.com
        
        # Pull latest image
        docker pull 721063839441.dkr.ecr.us-west-2.amazonaws.com/restaurant-web:latest
        
        # Setup environment
        mkdir -p data
        [ ! -f data/restaurant_prod.sqlite3 ] && touch data/restaurant_prod.sqlite3
        
        # Create environment file if not exists
        if [ ! -f .env.ec2 ]; then
            cat > .env.ec2 << 'ENVEOF'
SECRET_KEY=django-prod-key-change-this
DEBUG=False
USE_COGNITO_AUTH=True
COGNITO_USER_POOL_ID=TBD
COGNITO_APP_CLIENT_ID=TBD
AWS_REGION=us-west-2
ALLOWED_HOSTS=*
DATABASE_PATH=/opt/restaurant-web/data
DATABASE_NAME=restaurant_prod.sqlite3
DJANGO_SETTINGS_MODULE=backend.settings_ec2
ENVEOF
        fi
        
        # DEEP CLEANUP ALWAYS
        log "🧹 Deep cleanup on every deploy..."
        docker-compose --profile production down --volumes --remove-orphans --timeout 5 || true
        docker system prune -af --volumes || true
        docker network prune -f || true
        
        # Remove old containers if any
        docker ps -aq | xargs -r docker rm -f 2>/dev/null || true
        
        # Clean old logs
        rm -rf logs/* || true
        mkdir -p logs
        
        log "🚀 Starting fresh containers..."
        docker-compose --profile production up -d --force-recreate --remove-orphans
        
        # Health check with retries
        log "⏳ Waiting for services..."
        sleep 20
        
        for i in {1..6}; do
            if curl -sf http://localhost:8000/api/v1/health/; then
                log "✅ Deploy successful!"
                docker-compose --profile production ps
                exit 0
            fi
            log "Health check $i/6 failed, waiting..."
            sleep 10
        done
        
        log "❌ Health check failed after 6 attempts"
        log "Container status:"
        docker-compose --profile production ps
        log "App logs:"
        docker-compose --profile production logs app --tail=30
        exit 1
        ;;
        
    check)
        log "🏥 Health check..."
        docker-compose --profile production ps
        if curl -sf http://localhost:8000/api/v1/health/; then
            log "✅ All good!"
        else
            log "❌ Health check failed"
            docker-compose --profile production logs app --tail=20
        fi
        ;;
        
    logs)
        SERVICE=${2:-app}
        log "📜 Showing logs for $SERVICE..."
        docker-compose --profile production logs $SERVICE --tail=50 -f
        ;;
        
    backup)
        log "💾 Creating backup..."
        mkdir -p backups
        [ -f data/restaurant_prod.sqlite3 ] && cp data/restaurant_prod.sqlite3 "backups/backup-$(date +%Y%m%d-%H%M%S).sqlite3"
        ls -la backups/ | tail -3
        ;;
        
    ultimate-fix)
        log "🔥 Running ultimate fix..."
        curl -sSL https://raw.githubusercontent.com/guiEmotiv/restaurant-web/main/scripts/ultimate-fix.sh -o ultimate-fix.sh
        chmod +x ultimate-fix.sh
        ./ultimate-fix.sh
        ;;
        
    setup-ssl)
        log "🔒 Setting up SSL..."
        curl -sSL https://raw.githubusercontent.com/guiEmotiv/restaurant-web/main/scripts/setup-ssl-simple.sh -o setup-ssl-simple.sh
        chmod +x setup-ssl-simple.sh
        ./setup-ssl-simple.sh
        ;;
        
    activate-ssl)
        log "🔒 Activating REAL SSL..."
        curl -sSL https://raw.githubusercontent.com/guiEmotiv/restaurant-web/main/scripts/activate-real-ssl.sh -o activate-real-ssl.sh
        chmod +x activate-real-ssl.sh
        ./activate-real-ssl.sh
        ;;
        
    fix-https)
        log "🔧 Fixing HTTPS configuration..."
        curl -sSL https://raw.githubusercontent.com/guiEmotiv/restaurant-web/main/scripts/fix-https.sh -o fix-https.sh
        chmod +x fix-https.sh
        ./fix-https.sh
        ;;
        
    *)
        echo "Usage: $0 {deploy|check|logs|backup|ultimate-fix|setup-ssl|activate-ssl|fix-https}"
        echo "  deploy       - Deploy latest version"
        echo "  check        - Health check"
        echo "  logs         - Show logs"  
        echo "  backup       - Backup database"
        echo "  ultimate-fix - Nuclear option - rebuild everything"
        echo "  setup-ssl    - Configure SSL with self-signed certificates"
        echo "  activate-ssl - Activate REAL Let's Encrypt SSL certificates"
        echo "  fix-https    - Diagnostic and fix HTTPS issues"
        exit 1
        ;;
esac