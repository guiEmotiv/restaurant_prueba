#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🐳 PHASE 5: DOCKER DEPLOYMENT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

# Configuration
readonly SSH_KEY="${SSH_KEY:-./ubuntu_fds_key.pem}"
readonly PROD_SERVER="${PROD_SERVER:-ubuntu@44.248.47.186}"

# Colors
readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly RED='\033[0;31m'
readonly NC='\033[0m'

# Logging functions
log_info() { printf "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - %s\n" "$*"; }
log_success() { printf "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - %s\n" "$*"; }
log_error() { printf "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - %s\n" "$*"; exit 1; }

deploy_containers() {
    log_info "🐳 PHASE 5: Docker Deployment"
    
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_SERVER" << 'REMOTE_SCRIPT'
        set -euo pipefail
        cd /home/ubuntu/restaurant-web
        
        echo "🔨 Building Docker image..."
        /usr/bin/docker build -f Dockerfile.production -t restaurant-app:latest .
        
        echo "🏗️ Starting containers..."
        /usr/bin/docker compose -f docker-compose.production.yml down 2>/dev/null || true
        /usr/bin/docker compose -f docker-compose.production.yml up -d
        
        echo "⏳ Waiting for containers to start..."
        sleep 15
        
        echo "🔍 Checking container status..."
        /usr/bin/docker ps --filter "name=restaurant"
        
        # Verify containers are running
        if ! /usr/bin/docker ps | grep -q "restaurant-app.*Up"; then
            echo "❌ Backend container failed to start"
            /usr/bin/docker logs restaurant-app --tail 20
            exit 1
        fi
        
        if ! /usr/bin/docker ps | grep -q "restaurant-nginx.*Up"; then
            echo "❌ Nginx container failed to start"  
            /usr/bin/docker logs restaurant-nginx --tail 20
            exit 1
        fi
        
        echo "✅ All containers running successfully"
REMOTE_SCRIPT
    
    log_success "Docker deployment completed"
}

# Execute deployment if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    deploy_containers
fi