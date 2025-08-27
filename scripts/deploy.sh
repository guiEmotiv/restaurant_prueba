#!/bin/bash
# Ultra-efficient deployment script for restaurant-web
# Combines all deployment, maintenance, and inspection tasks

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Default values
ACTION=${1:-help}
EC2_HOST=${EC2_HOST:-$(aws ec2 describe-instances --filters "Name=tag:Name,Values=restaurant-prod" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text 2>/dev/null || echo "")}
REPO_URL="https://raw.githubusercontent.com/guiEmotiv/restaurant-web/main"

# Functions
log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; exit 1; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

check_requirements() {
    command -v docker >/dev/null 2>&1 || error "Docker not installed"
    command -v aws >/dev/null 2>&1 || warning "AWS CLI not installed - some features disabled"
}

# Main actions
case "$ACTION" in
    deploy)
        log "🚀 Starting smart deployment..."
        check_requirements
        
        # Auto-detect if running on EC2 or locally
        if [ -d "/opt/restaurant-web" ]; then
            cd /opt/restaurant-web
            
            # Backup database
            [ -f data/restaurant_prod.sqlite3 ] && cp data/restaurant_prod.sqlite3 "backups/backup-$(date +%Y%m%d-%H%M%S).sqlite3"
            
            # Update configs
            curl -sSL $REPO_URL/docker-compose.yml -o docker-compose.yml
            mkdir -p nginx/conf.d
            curl -sSL $REPO_URL/nginx/conf.d/default.conf -o nginx/conf.d/default.conf
            
            # Deploy
            docker-compose --profile production pull
            docker-compose --profile production down --timeout 20
            docker-compose --profile production up -d
            
            # Health check
            sleep 20
            curl -f -s http://localhost:8000/api/v1/health/ && log "✅ Deployment successful!" || error "Health check failed"
        else
            # Trigger GitHub Actions deployment
            log "Triggering remote deployment..."
            gh workflow run deploy.yml || error "Failed to trigger deployment"
        fi
        ;;
        
    status)
        log "📊 System Status"
        if [ -d "/opt/restaurant-web" ]; then
            cd /opt/restaurant-web
            docker-compose --profile production ps
            echo -e "\n🔍 Resource usage:"
            docker stats --no-stream
            echo -e "\n💾 Database info:"
            [ -f data/restaurant_prod.sqlite3 ] && ls -lh data/restaurant_prod.sqlite3
        else
            [ -n "$EC2_HOST" ] && ssh ubuntu@$EC2_HOST "cd /opt/restaurant-web && docker-compose --profile production ps"
        fi
        ;;
        
    backup)
        log "💾 Creating backup..."
        if [ -d "/opt/restaurant-web" ]; then
            cd /opt/restaurant-web
            mkdir -p backups
            [ -f data/restaurant_prod.sqlite3 ] && cp data/restaurant_prod.sqlite3 "backups/manual-$(date +%Y%m%d-%H%M%S).sqlite3"
            ls -la backups/ | tail -5
        else
            error "Backup only available on EC2 instance"
        fi
        ;;
        
    logs)
        SERVICE=${2:-all}
        log "📜 Showing logs for: $SERVICE"
        if [ -d "/opt/restaurant-web" ]; then
            cd /opt/restaurant-web
            [ "$SERVICE" = "all" ] && docker-compose --profile production logs --tail=100 -f || docker-compose --profile production logs --tail=100 -f $SERVICE
        else
            [ -n "$EC2_HOST" ] && ssh ubuntu@$EC2_HOST "cd /opt/restaurant-web && docker-compose --profile production logs --tail=100 $SERVICE"
        fi
        ;;
        
    cleanup)
        log "🧹 Cleaning up Docker resources..."
        docker system prune -af --volumes
        log "✅ Cleanup complete"
        ;;
        
    help|*)
        cat << EOF
🍽️  Restaurant Web Deployment Script

Usage: $0 [action] [options]

Actions:
  deploy    - Smart deployment (auto-detects local/remote)
  status    - Show system status
  backup    - Create database backup
  logs      - Show container logs (logs [service])
  cleanup   - Clean Docker resources
  help      - Show this help

Examples:
  $0 deploy              # Deploy latest version
  $0 status              # Check system status
  $0 logs app            # Show app logs
  $0 backup              # Backup database

Environment:
  EC2_HOST=$EC2_HOST
EOF
        ;;
esac