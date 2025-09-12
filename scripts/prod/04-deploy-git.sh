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
            git init
            git remote add origin https://github.com/your-repo.git 2>/dev/null || true
        fi
        
        # Pull latest changes (or use your actual repo)
        echo "📥 Updating code from repository..."
        git fetch --all 2>/dev/null || echo "Warning: Could not fetch (manual deployment)"
        git reset --hard HEAD 2>/dev/null || true
        
        # For now, we'll sync manually since we don't have remote repo
        echo "📝 Repository status updated"
REMOTE_SCRIPT
    
    # Copy essential files manually (since we don't have actual git remote)
    log_info "Syncing project files..."
    rsync -av --delete \
        --exclude='.git' \
        --exclude='node_modules' \
        --exclude='frontend/dist' \
        --exclude='backend/__pycache__' \
        --exclude='**/*.pyc' \
        --exclude='*.sqlite3' \
        -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
        ./ "$PROD_SERVER:$REMOTE_DIR/"
    
    # Copy frontend dist separately to ensure it goes to the right place
    log_info "Copying frontend build..."
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_SERVER" "mkdir -p $REMOTE_DIR/frontend-dist"
    rsync -av -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
        ./frontend/dist/ "$PROD_SERVER:$REMOTE_DIR/frontend-dist/"
    
    # Verify frontend files copied correctly
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_SERVER" << REMOTE_SCRIPT
        cd $REMOTE_DIR
        
        # Verify critical files exist
        [[ -f "frontend-dist/index.html" ]] || { echo "❌ Frontend dist files missing"; exit 1; }
        [[ -f "backend/manage.py" ]] || { echo "❌ Backend files missing"; exit 1; }
        [[ -f "docker-compose.production.yml" ]] || { echo "❌ Docker compose missing"; exit 1; }
        [[ -f "Dockerfile.production" ]] || { echo "❌ Dockerfile.production missing"; exit 1; }
        
        echo "✅ All project files verified"
        
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