#!/bin/bash

# EC2 Maintenance Script - ALL-IN-ONE
# Consolidates: cleanup, deep-cleanup, fresh-setup, emergency cleanup
# Usage: ./ec2-maintenance.sh [operation] [confirm]

set -e

OPERATION="${1:-help}"
CONFIRM="${2:-}"

echo "🔧 EC2 MAINTENANCE - ALL-IN-ONE"
echo "==============================="

# Function: Show help
show_help() {
    echo "Usage: $0 [operation] [confirm]"
    echo ""
    echo "Operations:"
    echo "  cleanup      - Standard environment cleanup"
    echo "  deep-cleanup - Aggressive cleanup (removes chaotic files)"
    echo "  fresh-setup  - Complete rebuild with data preservation (RECOMMENDED)"
    echo "  emergency    - Emergency cleanup (critical disk space)"
    echo "  help         - Show this help"
    echo ""
    echo "Confirm (for destructive operations):"
    echo "  CONFIRM      - Required for cleanup/deep-cleanup/fresh-setup/emergency"
    echo ""
    echo "Examples:"
    echo "  $0 fresh-setup CONFIRM"
    echo "  $0 cleanup CONFIRM"
    echo "  $0 emergency CONFIRM"
}

# Function: Backup critical data
backup_critical_data() {
    local backup_dir="/tmp/restaurant-backup-$(date +%Y%m%d_%H%M%S)"
    echo "🛡️ Backing up critical data to $backup_dir..."
    
    mkdir -p "$backup_dir"
    
    # Backup database
    if [ -d "data" ]; then
        cp -r data "$backup_dir/" && echo "✅ Database backed up"
    fi
    
    # Backup official backups
    if [ -d "backups" ]; then
        cp -r backups "$backup_dir/" && echo "✅ Official backups saved"
    fi
    
    # Backup logs
    if [ -d "logs" ]; then
        cp -r logs "$backup_dir/" && echo "✅ Logs backed up"
    fi
    
    # Backup environment files
    if ls .env* 1> /dev/null 2>&1; then
        cp .env* "$backup_dir/" 2>/dev/null || true
        echo "✅ Environment files backed up"
    fi
    
    echo "BACKUP_DIR=$backup_dir"
}

# Function: Restore critical data
restore_critical_data() {
    local backup_dir="$1"
    echo "🔄 Restoring critical data from $backup_dir..."
    
    # Restore database
    if [ -d "$backup_dir/data" ]; then
        mkdir -p data
        cp -r "$backup_dir/data"/* data/ 2>/dev/null || true
        echo "✅ Database restored"
    fi
    
    # Restore official backups
    if [ -d "$backup_dir/backups" ]; then
        mkdir -p backups
        cp -r "$backup_dir/backups"/* backups/ 2>/dev/null || true
        echo "✅ Official backups restored"
    fi
    
    # Restore logs
    if [ -d "$backup_dir/logs" ]; then
        mkdir -p logs
        cp -r "$backup_dir/logs"/* logs/ 2>/dev/null || true
        echo "✅ Logs restored"
    fi
    
    # Restore environment files
    if ls "$backup_dir"/.env* 1> /dev/null 2>&1; then
        cp "$backup_dir"/.env* . 2>/dev/null || true
        echo "✅ Environment files restored"
    fi
}

# Function: Docker cleanup
docker_cleanup() {
    echo "🐳 Docker cleanup..."
    docker stop $(docker ps -aq) 2>/dev/null || true
    docker rm $(docker ps -aq) 2>/dev/null || true
    docker system prune -a -f --volumes || true
}

# Function: System cleanup
system_cleanup() {
    echo "🧹 System cleanup..."
    sudo journalctl --vacuum-time=1d || true
    sudo apt-get clean || true
    sudo apt-get autoremove -y || true
}

# Validate inputs
if [[ "$OPERATION" != "help" && "$OPERATION" != "cleanup" && "$OPERATION" != "deep-cleanup" && "$OPERATION" != "fresh-setup" && "$OPERATION" != "emergency" ]]; then
    echo "❌ Invalid operation: $OPERATION"
    show_help
    exit 1
fi

# Check destructive operations
if [[ "$OPERATION" == "cleanup" || "$OPERATION" == "deep-cleanup" || "$OPERATION" == "fresh-setup" || "$OPERATION" == "emergency" ]]; then
    if [ "$CONFIRM" != "CONFIRM" ]; then
        echo "❌ Destructive operation '$OPERATION' requires CONFIRM as second argument"
        echo "Example: $0 $OPERATION CONFIRM"
        exit 1
    fi
fi

# Navigate to deployment directory
if [ "$OPERATION" != "help" ]; then
    cd /opt/restaurant-web || { echo "❌ /opt/restaurant-web not found!"; exit 1; }
fi

# Execute operation
case "$OPERATION" in
    "help")
        show_help
        ;;
        
    "cleanup")
        echo "🧹 STANDARD CLEANUP"
        echo "==================="
        
        echo "📊 Before cleanup:"
        df -h / && ls -la
        
        # Backup database if exists
        if [ -f data/restaurant_prod.sqlite3 ]; then
            mkdir -p backups
            cp data/restaurant_prod.sqlite3 "backups/backup-$(date +%Y%m%d-%H%M%S).sqlite3"
            echo "✅ Database backed up"
        fi
        
        docker_cleanup
        
        # Remove old configurations
        rm -f docker-compose.yml docker-compose.*.yml
        rm -f .env.* || true
        rm -rf frontend-dist || true
        
        # Clean old backups (keep last 3)
        if [ -d backups ]; then
            cd backups
            ls -t backup-* 2>/dev/null | tail -n +4 | xargs -r rm -rf
            cd ..
        fi
        
        system_cleanup
        
        echo "📊 After cleanup:"
        df -h / && ls -la
        ;;
        
    "deep-cleanup")
        echo "🚨 DEEP AGGRESSIVE CLEANUP"
        echo "=========================="
        echo "⚠️  Removing ALL chaotic files (scripts, duplicates, etc.)"
        
        echo "📊 Before deep cleanup:"
        df -h / && ls -la
        
        # Backup critical data first
        backup_result=$(backup_critical_data)
        backup_dir=$(echo "$backup_result" | grep "BACKUP_DIR=" | cut -d'=' -f2)
        
        docker_cleanup
        
        # Remove chaotic files
        echo "🗑️ Removing chaotic files..."
        rm -rf backup/ database-restore/ dev/ prod/
        rm -f backup.sh info.sh setup-ec2.sh
        rm -f backup_*.json backup_operational_*.json
        rm -f docker-compose.yml.backup docker-compose.yml.bak *.bak
        rm -f full_restore_production.py restore_production*.py
        rm -f *.tmp *.temp
        
        system_cleanup
        
        # Restore critical data
        restore_critical_data "$backup_dir"
        rm -rf "$backup_dir"
        
        echo "📊 After deep cleanup:"
        df -h / && ls -la
        ;;
        
    "fresh-setup")
        echo "🚀 FRESH SETUP - COMPLETE REBUILD"
        echo "=================================="
        echo "⚠️  Complete rebuild with data preservation"
        
        echo "📊 Before fresh setup:"
        df -h / && ls -la
        
        # Backup critical data
        backup_result=$(backup_critical_data)
        backup_dir=$(echo "$backup_result" | grep "BACKUP_DIR=" | cut -d'=' -f2)
        
        docker_cleanup
        
        # Move to parent and complete removal
        cd /opt || exit 1
        sudo rm -rf restaurant-web
        
        # Fresh clone
        echo "📥 Cloning fresh repository..."
        sudo git clone https://github.com/guiEmotiv/restaurant-web.git restaurant-web
        sudo chown -R ubuntu:ubuntu restaurant-web
        
        cd restaurant-web || exit 1
        
        # Restore critical data
        restore_critical_data "$backup_dir"
        rm -rf "$backup_dir"
        
        echo "📊 After fresh setup:"
        df -h / && ls -la
        echo "🔍 Git status:"
        git status
        ;;
        
    "emergency")
        echo "🚨 EMERGENCY CLEANUP"
        echo "==================="
        echo "⚠️  Critical disk space cleanup"
        
        echo "📊 Critical disk status:"
        df -h /
        
        # Emergency backup of database only
        if [ -f data/restaurant_prod.sqlite3 ]; then
            mkdir -p /tmp/emergency-backup
            cp data/restaurant_prod.sqlite3 "/tmp/emergency-backup/restaurant_prod_$(date +%Y%m%d_%H%M%S).sqlite3"
            echo "✅ Database emergency backup"
        fi
        
        # Aggressive cleanup
        docker stop $(docker ps -aq) 2>/dev/null || true
        docker system prune -a -f --volumes || true
        docker rmi $(docker images -q) -f 2>/dev/null || true
        
        # Clean everything possible
        rm -rf logs/* || true
        rm -rf /tmp/docker-* || true
        sudo journalctl --vacuum-time=6h || true
        sudo apt-get clean || true
        sudo apt-get autoremove -y || true
        
        # Clean old backups aggressively (keep only 1)
        if [ -d backups ]; then
            cd backups
            ls -t backup-* 2>/dev/null | tail -n +2 | xargs -r rm -rf
            cd ..
        fi
        
        echo "📊 Post-emergency status:"
        df -h /
        
        # Try to restart services
        echo "🔄 Attempting service restart..."
        docker-compose --profile production up -d || true
        ;;
esac

echo ""
echo "✅ EC2 MAINTENANCE COMPLETED: $OPERATION"
echo "========================================"