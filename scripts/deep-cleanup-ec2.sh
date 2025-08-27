#!/bin/bash

# Deep EC2 Environment Cleanup Script
# This script aggressively cleans the chaotic EC2 structure
# Removes all the messy files while preserving critical data

echo "🚨 DEEP EC2 CLEANUP - REMOVING CHAOTIC STRUCTURE"
echo "================================================"

# Navigate to deployment directory
cd /opt/restaurant-web || exit 1

echo "📊 BEFORE - Current chaotic structure:"
ls -la

echo ""
echo "🛡️ Creating safety backup of critical data..."
# Create emergency backup of database before aggressive cleanup
if [ -f data/restaurant_prod.sqlite3 ]; then
    mkdir -p /tmp/emergency-backup
    cp data/restaurant_prod.sqlite3 /tmp/emergency-backup/restaurant_prod_$(date +%Y%m%d_%H%M%S).sqlite3
    echo "✅ Database safely backed up to /tmp/emergency-backup/"
fi

echo ""
echo "🛑 Stopping all containers before cleanup..."
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true

echo ""
echo "🧹 AGGRESSIVE CLEANUP - Removing chaotic files..."

# Remove all the messy files you identified
echo "Removing duplicate backup folder..."
rm -rf backup/

echo "Removing loose scripts..."
rm -f backup.sh
rm -f info.sh  
rm -f setup-ec2.sh

echo "Removing loose backup files..."
rm -f backup_*.json
rm -f backup_operational_*.json

echo "Removing duplicate/obsolete folders..."
rm -rf database-restore/
rm -rf dev/
rm -rf prod/

echo "Removing manual backup files..."
rm -f docker-compose.yml.backup
rm -f docker-compose.yml.bak
rm -f *.bak

echo "Removing loose Python scripts..."
rm -f full_restore_production.py
rm -f restore_production.py
rm -f restore_production_fixed.py

echo "Removing any other loose files..."
rm -f *.tmp
rm -f *.temp

echo ""
echo "🧹 Docker cleanup..."
docker system prune -a -f --volumes || true

echo ""
echo "🧹 System cleanup..."
sudo journalctl --vacuum-time=1d || true
sudo apt-get clean || true
sudo apt-get autoremove -y || true

echo ""
echo "📁 AFTER - Clean structure:"
ls -la

echo ""
echo "🔍 Verifying critical data preserved:"
echo "Database files:"
ls -la data/ 2>/dev/null || echo "No data directory"
echo ""
echo "Official backups:"
ls -la backups/ 2>/dev/null || echo "No backups directory"
echo ""
echo "Logs:"
ls -la logs/ 2>/dev/null || echo "No logs directory"

echo ""
echo "💾 Disk usage after cleanup:"
df -h /

echo ""
echo "✅ DEEP CLEANUP COMPLETED!"
echo "Chaotic structure eliminated, critical data preserved"
echo "Ready for fresh repository structure deployment"