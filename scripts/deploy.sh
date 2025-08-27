#!/bin/bash
# Ultra-simple deployment script
# Usage: ./scripts/deploy.sh [action]
# Actions: deploy, check, logs, backup

set -e

ACTION=${1:-deploy}

# Colors
G='\033[0;32m' # Green
R='\033[0;31m' # Red  
Y='\033[1;33m' # Yellow
NC='\033[0m'   # No Color

log() { echo -e "${G}[$(date +'%H:%M:%S')]${NC} $1"; }
err() { echo -e "${R}[ERROR]${NC} $1" >&2; exit 1; }

# Check if on EC2
if [ ! -d "/opt/restaurant-web" ]; then
    log "Running locally - triggering GitHub Actions..."
    command -v gh >/dev/null || err "GitHub CLI not installed"
    gh workflow run deploy.yml -f action="$ACTION"
    exit 0
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
        
        # Ensure database exists
        mkdir -p data
        [ ! -f data/restaurant_prod.sqlite3 ] && touch data/restaurant_prod.sqlite3
        
        # Deploy
        docker-compose --profile production down --timeout 10 || true
        docker-compose --profile production up -d
        
        # Health check
        sleep 20
        if curl -sf http://localhost:8000/api/v1/health/; then
            log "✅ Deploy successful!"
        else
            err "❌ Deploy failed"
        fi
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
        
    *)
        echo "Usage: $0 {deploy|check|logs|backup}"
        echo "  deploy - Deploy latest version"
        echo "  check  - Health check"
        echo "  logs   - Show logs"  
        echo "  backup - Backup database"
        exit 1
        ;;
esac