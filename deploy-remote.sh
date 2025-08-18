#!/bin/bash
set -e

# 🚀 REMOTE DEPLOYMENT SCRIPT
# Handles deployment to EC2 with database sync options

# Configuration
EC2_HOST="ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com"
EC2_KEY="ubuntu_fds_key.pem"
REMOTE_PATH="/opt/restaurant-web"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    local level=$1
    shift
    case $level in
        ERROR) echo -e "${RED}❌ $@${NC}" ;;
        SUCCESS) echo -e "${GREEN}✅ $@${NC}" ;;
        WARNING) echo -e "${YELLOW}⚠️  $@${NC}" ;;
        INFO) echo -e "${BLUE}ℹ️  $@${NC}" ;;
        *) echo "$@" ;;
    esac
}

show_usage() {
    echo "Usage: $0 [OPTION]"
    echo "Options:"
    echo "  deploy         Standard deployment (code only)"
    echo "  deploy-sync    Deploy with database sync from dev"
    echo "  status         Check remote deployment status"
    echo "  logs           View remote logs"
    echo "  backup         Backup remote database"
    echo "  rollback       Rollback to previous backup"
    echo "  help           Show this help"
}

# Check SSH connection
check_ssh() {
    log INFO "Checking SSH connection..."
    if ! ssh -i "$EC2_KEY" -o ConnectTimeout=5 "$EC2_HOST" "echo 'SSH OK'" &>/dev/null; then
        log ERROR "Cannot connect to EC2 instance"
        exit 1
    fi
    log SUCCESS "SSH connection established"
}

# Standard deployment
deploy_standard() {
    log INFO "Starting standard deployment..."
    
    # Check for uncommitted changes
    if [ -n "$(git status --porcelain)" ]; then
        log WARNING "You have uncommitted changes. Commit them first? (y/N)"
        read -r response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            git add -A
            git commit -m "Auto-commit before deployment $(date +%Y%m%d_%H%M%S)"
            git push origin main
        fi
    fi
    
    # Push latest changes
    log INFO "Pushing latest changes to repository..."
    git push origin main
    
    # Execute remote deployment
    log INFO "Executing remote deployment..."
    ssh -i "$EC2_KEY" "$EC2_HOST" "cd $REMOTE_PATH && git pull origin main && ./deploy.sh --prod"
    
    log SUCCESS "Deployment completed!"
}

# Deploy with database sync
deploy_with_sync() {
    log WARNING "This will sync your local dev database to production!"
    log WARNING "All production data will be replaced. Continue? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        log ERROR "Deployment cancelled"
        exit 1
    fi
    
    # First, do standard deployment
    deploy_standard
    
    # Backup remote database
    log INFO "Backing up remote production database..."
    ssh -i "$EC2_KEY" "$EC2_HOST" "cd $REMOTE_PATH && cp data/restaurant_prod.sqlite3 data/backup_prod_$(date +%Y%m%d_%H%M%S).sqlite3"
    
    # Upload local dev database
    log INFO "Uploading development database..."
    scp -i "$EC2_KEY" data/restaurant_dev.sqlite3 "$EC2_HOST:$REMOTE_PATH/data/restaurant_prod.sqlite3"
    
    # Restart containers to apply new database
    log INFO "Restarting containers..."
    ssh -i "$EC2_KEY" "$EC2_HOST" "cd $REMOTE_PATH && docker-compose restart app"
    
    log SUCCESS "Database sync completed!"
}

# Check deployment status
check_status() {
    log INFO "Checking remote deployment status..."
    
    echo ""
    echo "=== Container Status ==="
    ssh -i "$EC2_KEY" "$EC2_HOST" "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep restaurant || echo 'No containers running'"
    
    echo ""
    echo "=== Recent Commits ==="
    ssh -i "$EC2_KEY" "$EC2_HOST" "cd $REMOTE_PATH && git log --oneline -5"
    
    echo ""
    echo "=== Disk Usage ==="
    ssh -i "$EC2_KEY" "$EC2_HOST" "df -h | grep -E '(Filesystem|/$)'"
    
    echo ""
    echo "=== API Health ==="
    ssh -i "$EC2_KEY" "$EC2_HOST" "curl -s https://www.xn--elfogndedonsoto-zrb.com/api/v1/ | head -1 || echo 'API not responding'"
}

# View logs
view_logs() {
    log INFO "Fetching remote logs..."
    
    echo "Select log to view:"
    echo "1) Backend logs"
    echo "2) Nginx logs"
    echo "3) All logs"
    read -p "Choice (1-3): " choice
    
    case $choice in
        1) ssh -i "$EC2_KEY" "$EC2_HOST" "cd $REMOTE_PATH && docker-compose logs --tail=50 app" ;;
        2) ssh -i "$EC2_KEY" "$EC2_HOST" "cd $REMOTE_PATH && docker-compose logs --tail=50 nginx" ;;
        3) ssh -i "$EC2_KEY" "$EC2_HOST" "cd $REMOTE_PATH && docker-compose logs --tail=50" ;;
        *) log ERROR "Invalid choice" ;;
    esac
}

# Backup database
backup_database() {
    log INFO "Creating remote database backup..."
    
    # Create remote backup
    BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S).sqlite3"
    ssh -i "$EC2_KEY" "$EC2_HOST" "cd $REMOTE_PATH && cp data/restaurant_prod.sqlite3 data/$BACKUP_NAME"
    
    # Download backup
    log INFO "Downloading backup..."
    mkdir -p backups
    scp -i "$EC2_KEY" "$EC2_HOST:$REMOTE_PATH/data/$BACKUP_NAME" "backups/$BACKUP_NAME"
    
    log SUCCESS "Backup saved to: backups/$BACKUP_NAME"
}

# Rollback to previous backup
rollback() {
    log INFO "Fetching available backups..."
    
    # List backups
    echo "Available backups:"
    ssh -i "$EC2_KEY" "$EC2_HOST" "ls -la $REMOTE_PATH/data/backup_*.sqlite3 2>/dev/null | tail -5" || {
        log ERROR "No backups found"
        exit 1
    }
    
    echo ""
    read -p "Enter backup filename to restore: " backup_file
    
    if [ -z "$backup_file" ]; then
        log ERROR "No backup specified"
        exit 1
    fi
    
    # Restore backup
    log WARNING "This will restore: $backup_file. Continue? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        ssh -i "$EC2_KEY" "$EC2_HOST" "cd $REMOTE_PATH && cp data/$backup_file data/restaurant_prod.sqlite3 && docker-compose restart app"
        log SUCCESS "Rollback completed!"
    else
        log ERROR "Rollback cancelled"
    fi
}

# Main
main() {
    check_ssh
    
    case "${1:-}" in
        deploy)
            deploy_standard
            ;;
        deploy-sync)
            deploy_with_sync
            ;;
        status)
            check_status
            ;;
        logs)
            view_logs
            ;;
        backup)
            backup_database
            ;;
        rollback)
            rollback
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            log ERROR "Invalid option: ${1:-none}"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"