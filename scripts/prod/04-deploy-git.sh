#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📦 PHASE 4: GIT DEPLOYMENT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

# Configuration
readonly SSH_KEY="${SSH_KEY:-./ubuntu_fds_key.pem}"
readonly PROD_SERVER="${PROD_SERVER:-ubuntu@44.248.47.186}"
readonly REMOTE_DIR="${REMOTE_DIR:-/home/ubuntu/restaurant-web}"

# Colors
readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly RED='\033[0;31m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

# Logging functions
log_info() { printf "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - %s\n" "$*"; }
log_success() { printf "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - %s\n" "$*"; }
log_warning() { printf "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - %s\n" "$*"; }
log_error() { printf "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - %s\n" "$*"; exit 1; }

deploy_with_git() {
    log_info "📦 PHASE 4: Git Deployment"
    
    # Get current branch and commit
    local current_branch=$(git branch --show-current)
    local commit_hash=$(git rev-parse HEAD)
    
    log_info "Deploying branch: $current_branch ($commit_hash)"
    
    # Push to remote (assuming origin exists)
    log_info "Pushing to remote repository..."
    git push origin "$current_branch" || log_warning "Could not push to origin (may not exist)"
    
    # Deploy to server via git
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_SERVER" << REMOTE_SCRIPT
        set -euo pipefail
        cd $REMOTE_DIR
        
        # Initialize git repo if needed
        if [[ ! -d .git ]]; then
            echo "🆕 Initializing git repository..."
            /usr/bin/git init
            /usr/bin/git remote add origin https://github.com/guiEmotiv/restaurant-web.git 2>/dev/null || true
        fi
        
        # Configure git for server (minimal config)
        /usr/bin/git config --global --add safe.directory $REMOTE_DIR 2>/dev/null || true
        /usr/bin/git config user.name "Production Server" 2>/dev/null || true
        /usr/bin/git config user.email "server@restaurant-web.com" 2>/dev/null || true
        
        # Pull latest changes from GitHub
        echo "📥 Fetching latest code from GitHub..."
        /usr/bin/git fetch origin main 2>/dev/null || {
            echo "🔄 Could not fetch from origin, cloning fresh..."
            cd /home/ubuntu
            rm -rf restaurant-web
            /usr/bin/git clone https://github.com/guiEmotiv/restaurant-web.git
            cd restaurant-web
        }
        
        # Reset to latest main branch
        /usr/bin/git reset --hard origin/main 2>/dev/null || /usr/bin/git reset --hard HEAD
        
        echo "✅ Repository updated to latest version"
        /usr/bin/git log --oneline -1 || echo "Git log not available"
REMOTE_SCRIPT
    
    # Git deployment - no manual file copying needed
    
    # Verify Git repository and files
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_SERVER" << REMOTE_SCRIPT
        cd $REMOTE_DIR
        
        # Verify critical files exist from Git
        [[ -f "backend/manage.py" ]] || { echo "❌ Backend files missing"; exit 1; }
        [[ -f "frontend/package.json" ]] || { echo "❌ Frontend source missing"; exit 1; }
        [[ -f "docker-compose.production.yml" ]] || { echo "❌ Docker compose missing"; exit 1; }
        [[ -f "Dockerfile.production" ]] || { echo "❌ Dockerfile.production missing"; exit 1; }
        
        echo "✅ All project files verified from Git"
        
        # Set proper permissions
        /usr/bin/sudo chown -R ubuntu:ubuntu . 2>/dev/null || true
        chmod 755 .
REMOTE_SCRIPT
    
    log_success "Git deployment completed"
}

# Execute deployment if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    deploy_with_git
fi