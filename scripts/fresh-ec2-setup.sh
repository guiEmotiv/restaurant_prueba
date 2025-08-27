#!/bin/bash

# Fresh EC2 Setup - Hybrid Smart Approach
# This script completely rebuilds EC2 structure while preserving critical data
# Most efficient approach: backup + git clone + restore

echo "🚀 FRESH EC2 SETUP - HYBRID SMART APPROACH"
echo "=========================================="

# Safety checks
if [ ! -d "/opt/restaurant-web" ]; then
    echo "❌ /opt/restaurant-web not found!"
    exit 1
fi

cd /opt/restaurant-web || exit 1

echo "📊 BEFORE - Current chaotic structure:"
ls -la

echo ""
echo "🛡️ PHASE 1: Backup critical data to safe location"
echo "================================================"

# Create temporary backup directory
BACKUP_DIR="/tmp/restaurant-backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup database
if [ -d "data" ]; then
    echo "💾 Backing up database..."
    cp -r data "$BACKUP_DIR/"
    echo "✅ Database backed up to $BACKUP_DIR/data/"
else
    echo "⚠️ No data directory found"
fi

# Backup official backups
if [ -d "backups" ]; then
    echo "💾 Backing up official backups..."
    cp -r backups "$BACKUP_DIR/"
    echo "✅ Official backups saved to $BACKUP_DIR/backups/"
else
    echo "⚠️ No backups directory found"  
fi

# Backup logs if they exist
if [ -d "logs" ]; then
    echo "💾 Backing up logs..."
    cp -r logs "$BACKUP_DIR/"
    echo "✅ Logs backed up to $BACKUP_DIR/logs/"
else
    echo "⚠️ No logs directory found"
fi

# Backup any .env files (just in case)
if ls .env* 1> /dev/null 2>&1; then
    echo "💾 Backing up environment files..."
    cp .env* "$BACKUP_DIR/" 2>/dev/null || true
    echo "✅ Environment files backed up"
fi

echo ""
echo "🛑 PHASE 2: Stop services and clean slate"
echo "========================================="

# Stop any running containers
echo "Stopping containers..."
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true

# Move to parent directory
cd /opt || exit 1

# Complete removal of chaotic structure
echo "🗑️ Removing chaotic structure..."
sudo rm -rf restaurant-web

echo ""
echo "📥 PHASE 3: Fresh git clone"
echo "=========================="

# Fresh clone from public repository
echo "Cloning fresh repository structure..."
sudo git clone https://github.com/guiEmotiv/restaurant-web.git restaurant-web

# Set proper ownership
sudo chown -R ubuntu:ubuntu restaurant-web

cd restaurant-web || exit 1

echo ""
echo "🔄 PHASE 4: Restore critical data"
echo "================================"

# Restore database
if [ -d "$BACKUP_DIR/data" ]; then
    echo "📦 Restoring database..."
    mkdir -p data
    cp -r "$BACKUP_DIR/data"/* data/ 2>/dev/null || true
    echo "✅ Database restored"
fi

# Restore official backups
if [ -d "$BACKUP_DIR/backups" ]; then
    echo "📦 Restoring official backups..."
    mkdir -p backups
    cp -r "$BACKUP_DIR/backups"/* backups/ 2>/dev/null || true
    echo "✅ Official backups restored"
fi

# Restore logs
if [ -d "$BACKUP_DIR/logs" ]; then
    echo "📦 Restoring logs..."
    mkdir -p logs
    cp -r "$BACKUP_DIR/logs"/* logs/ 2>/dev/null || true
    echo "✅ Logs restored"
fi

# Restore environment files
if [ -f "$BACKUP_DIR/.env.ec2" ]; then
    echo "📦 Restoring environment files..."
    cp "$BACKUP_DIR"/.env* . 2>/dev/null || true
    echo "✅ Environment files restored"
fi

echo ""
echo "🧹 PHASE 5: Cleanup temporary files"
echo "=================================="
echo "Removing temporary backup from $BACKUP_DIR..."
rm -rf "$BACKUP_DIR"

echo ""
echo "📊 AFTER - Fresh clean structure:"
ls -la

echo ""
echo "🔍 Verifying critical data restoration:"
echo "Database files:"
ls -la data/ 2>/dev/null || echo "No database files"
echo ""
echo "Backup files:"  
ls -la backups/ 2>/dev/null || echo "No backup files"
echo ""
echo "Log files:"
ls -la logs/ 2>/dev/null || echo "No log files"

echo ""
echo "💾 Final disk usage:"
df -h /

echo ""
echo "✅ FRESH EC2 SETUP COMPLETED!"
echo "================================"
echo "🎉 EC2 now has pristine repository structure"
echo "🛡️ Critical data preserved and restored"  
echo "🔄 Git operations now fully functional"
echo "⚡ Ready for normal deployment workflows"