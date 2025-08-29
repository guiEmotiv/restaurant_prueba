#!/bin/bash
# Auto Cleanup Script - Run before every deployment
set -e

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

echo "🧹 Starting automatic cleanup..."

# Show space before
echo "📊 Space before:"
/bin/df -h / | /bin/grep -v Filesystem

# Clean old backups (keep only 3 most recent)
if [ -d "/opt/restaurant-web/backups" ]; then
    echo "🗄️ Cleaning old backups..."
    cd /opt/restaurant-web/backups
    /bin/ls -t | /usr/bin/tail -n +4 | /usr/bin/xargs /bin/rm -rf 2>/dev/null || true
fi

# Clean temp files
echo "🗑️ Cleaning temp files..."
/bin/rm -rf /tmp/* 2>/dev/null || true
/bin/rm -rf /opt/restaurant-web/frontend/node_modules 2>/dev/null || true
/bin/rm -rf /opt/restaurant-web/frontend/dist 2>/dev/null || true
/bin/rm -rf /opt/restaurant-web/frontend/coverage 2>/dev/null || true

# Clean Python cache
echo "🐍 Cleaning Python cache..."
/usr/bin/find /opt/restaurant-web/backend -name "__pycache__" -type d -exec /bin/rm -rf {} + 2>/dev/null || true
/usr/bin/find /opt/restaurant-web/backend -name "*.pyc" -delete 2>/dev/null || true

# Show space after
echo "📊 Space after cleanup:"
/bin/df -h / | /bin/grep -v Filesystem

echo "✅ Cleanup completed"