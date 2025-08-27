#!/bin/bash

# Deep EC2 Environment Inspection Script
# This script analyzes the current state of the EC2 environment
# and compares it with what should be the clean repository structure

echo "🔍 DEEP EC2 ENVIRONMENT INSPECTION"
echo "=================================="
echo ""

# Navigate to deployment directory
cd /opt/restaurant-web || exit 1

echo "📊 CURRENT DIRECTORY STRUCTURE ANALYSIS"
echo "========================================"
echo "Current working directory: $(pwd)"
echo ""

echo "🗂️ TOP-LEVEL FILES AND DIRECTORIES:"
ls -la
echo ""

echo "🔍 DETAILED DIRECTORY TREE (2 levels):"
find . -maxdepth 2 -type d | sort
echo ""

echo "📄 ALL CONFIGURATION FILES FOUND:"
find . -name "*.yml" -o -name "*.yaml" -o -name "*.conf" -o -name "*.env*" | sort
echo ""

echo "🐳 DOCKER-COMPOSE FILES ANALYSIS:"
echo "Docker-compose files found:"
find . -name "*docker-compose*" -type f | sort
echo ""
if [ -f docker-compose.yml ]; then
    echo "Current docker-compose.yml contents:"
    echo "---"
    cat docker-compose.yml
    echo "---"
else
    echo "❌ No docker-compose.yml found in current directory"
fi
echo ""

echo "🌐 NGINX CONFIGURATION ANALYSIS:"
if [ -d nginx ]; then
    echo "Nginx directory structure:"
    find nginx -type f | sort
    echo ""
    if [ -d nginx/conf.d ]; then
        echo "Nginx conf.d directory contents:"
        ls -la nginx/conf.d/
        echo ""
        for conf_file in nginx/conf.d/*.conf; do
            if [ -f "$conf_file" ]; then
                echo "=== $conf_file ==="
                head -20 "$conf_file"
                echo "... (truncated)"
                echo ""
            fi
        done
    fi
else
    echo "❌ No nginx directory found"
fi
echo ""

echo "🔧 ENVIRONMENT FILES ANALYSIS:"
echo "Environment files found:"
find . -name ".env*" -type f | sort
echo ""
for env_file in .env*; do
    if [ -f "$env_file" ]; then
        echo "=== $env_file ==="
        echo "File size: $(stat -c%s "$env_file") bytes"
        echo "Last modified: $(stat -c%y "$env_file")"
        echo "First 10 lines (sensitive data masked):"
        head -10 "$env_file" | sed 's/=.*/=***MASKED***/'
        echo ""
    fi
done

echo "📁 BACKUP AND DATA DIRECTORIES:"
echo "Backup directories:"
find . -name "*backup*" -type d | sort
echo ""
echo "Data directories:"
find . -name "*data*" -type d | sort
echo ""
if [ -d backups ]; then
    echo "Recent backups (last 5):"
    ls -lt backups/ | head -6
fi
echo ""

echo "🧹 TEMPORARY AND LOG FILES:"
echo "Log directories and files:"
find . -name "*log*" -type f -o -name "*log*" -type d | sort
echo ""
echo "Temporary files and directories:"
find . -name "tmp" -o -name "temp" -o -name "*.tmp" | sort
echo ""

echo "🐳 DOCKER STATE ANALYSIS:"
echo "Docker containers (should be empty after cleanup):"
docker ps -a || echo "No containers"
echo ""
echo "Docker images (should be empty after cleanup):"
docker images || echo "No images"
echo ""
echo "Docker networks:"
docker network ls || echo "No custom networks"
echo ""

echo "💾 DISK USAGE ANALYSIS:"
echo "Current disk usage:"
df -h /
echo ""
echo "Directory sizes (top 10 largest):"
du -h . | sort -hr | head -10
echo ""

echo "🔍 COMPARING WITH EXPECTED REPOSITORY STRUCTURE:"
echo "Expected top-level structure should contain:"
echo "- backend/"
echo "- frontend/"
echo "- nginx/"
echo "- data/"
echo "- scripts/"
echo "- docker-compose.yml"
echo "- Dockerfile"
echo "- CLAUDE.md"
echo ""

echo "✅ WHAT'S CORRECT:"
for expected_item in backend frontend nginx data scripts docker-compose.yml Dockerfile CLAUDE.md; do
    if [ -e "$expected_item" ]; then
        echo "✓ $expected_item exists"
    else
        echo "✗ $expected_item MISSING"
    fi
done
echo ""

echo "❌ UNEXPECTED FILES/DIRECTORIES (not in clean repo):"
echo "Files that shouldn't be here:"
for item in *; do
    case "$item" in
        backend|frontend|nginx|data|scripts|docker-compose.yml|Dockerfile|CLAUDE.md|README.md|.git|.github|.gitignore|logs|backups)
            # These are expected
            ;;
        *)
            echo "⚠️  Unexpected: $item"
            ;;
    esac
done
echo ""

echo "🚀 DEPLOYMENT HISTORY ANALYSIS:"
echo "Git status (if git repo):"
if [ -d .git ]; then
    echo "Current branch:"
    git branch 2>/dev/null || echo "Not a git repository"
    echo ""
    echo "Last 5 commits:"
    git log --oneline -5 2>/dev/null || echo "No git history"
    echo ""
    echo "Git status:"
    git status --porcelain 2>/dev/null || echo "No git status available"
else
    echo "Not a git repository"
fi
echo ""

echo "📋 PROCESSES AND PORTS:"
echo "Processes listening on ports 80, 8000, 443:"
sudo netstat -tlnp | grep -E ":(80|8000|443) " || echo "No processes found"
echo ""

echo "🔐 PERMISSIONS ANALYSIS:"
echo "Directory permissions:"
ls -ld . nginx data logs backups 2>/dev/null || echo "Some directories don't exist"
echo ""

echo "📊 SUMMARY AND RECOMMENDATIONS:"
echo "==============================="
echo "1. Files that need to be removed/cleaned:"
find . -maxdepth 1 \( -name "*.py" -o -name "*.json" -o -name "*.sh" -o -name "*.bak" -o -name "*.backup" \) -not -path "./scripts/*" | sort
echo ""
echo "2. Configuration files that need review:"
find . -name "docker-compose*.yml" | wc -l | xargs echo "Docker-compose files count:"
find . -name ".env*" | wc -l | xargs echo "Environment files count:"
echo ""
echo "3. Next steps needed:"
echo "   - Remove unnecessary files"
echo "   - Consolidate configurations"
echo "   - Ensure proper git sync"
echo "   - Fix directory structure"
echo ""
echo "✅ Deep inspection completed!"