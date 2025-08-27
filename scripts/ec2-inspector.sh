#!/bin/bash

# EC2 Inspector - ALL-IN-ONE Inspection & Diagnostics
# Consolidates: deep-inspection, health checks, analysis
# Usage: ./ec2-inspector.sh [level]

set -e

ANALYSIS_LEVEL="${1:-detailed}"

echo "🔍 EC2 INSPECTOR - COMPREHENSIVE ANALYSIS"
echo "========================================="

# Navigate to deployment directory
cd /opt/restaurant-web || { echo "❌ /opt/restaurant-web not found!"; exit 1; }

echo "Analysis level: $ANALYSIS_LEVEL"
echo "Current directory: $(pwd)"
echo ""

# Function: Basic analysis
basic_analysis() {
    echo "📊 BASIC SYSTEM ANALYSIS"
    echo "========================"
    
    echo "💾 Disk usage:"
    df -h /
    echo ""
    
    echo "🗂️ Directory structure:"
    ls -la
    echo ""
    
    echo "🐳 Docker status:"
    docker ps -a || echo "No containers"
    echo ""
    docker images || echo "No images"
    echo ""
}

# Function: Detailed analysis
detailed_analysis() {
    echo "📋 DETAILED ANALYSIS"
    echo "===================="
    
    echo "🔍 Directory tree (2 levels):"
    find . -maxdepth 2 -type d | sort
    echo ""
    
    echo "📄 Configuration files:"
    find . -name "*.yml" -o -name "*.yaml" -o -name "*.conf" -o -name "*.env*" | sort
    echo ""
    
    echo "🐳 Docker-compose analysis:"
    if [ -f docker-compose.yml ]; then
        echo "✅ docker-compose.yml present"
        echo "Services defined:"
        grep -E "^\\s+[a-zA-Z].*:" docker-compose.yml | sed 's/://g' | sort
    else
        echo "❌ docker-compose.yml missing"
    fi
    echo ""
    
    echo "🌐 Nginx configuration:"
    if [ -d nginx/conf.d ]; then
        echo "Nginx configs:"
        ls -la nginx/conf.d/
    else
        echo "❌ No nginx configs"
    fi
    echo ""
    
    echo "🔧 Environment files:"
    if ls .env* 1> /dev/null 2>&1; then
        for env_file in .env*; do
            echo "=== $env_file ==="
            echo "Size: $(stat -c%s "$env_file") bytes"
            echo "Modified: $(stat -c%y "$env_file")"
            echo ""
        done
    else
        echo "No environment files found"
    fi
    echo ""
}

# Function: Full analysis
full_analysis() {
    echo "🔬 FULL COMPREHENSIVE ANALYSIS"
    echo "=============================="
    
    echo "📁 All files by type:"
    echo "Python files:"
    find . -name "*.py" | sort
    echo ""
    echo "Shell scripts:"
    find . -name "*.sh" | sort
    echo ""
    echo "JSON files:"
    find . -name "*.json" | sort
    echo ""
    
    echo "📊 Directory sizes (top 10):"
    du -h . | sort -hr | head -10
    echo ""
    
    echo "🗄️ Database analysis:"
    if [ -d data ]; then
        echo "Database files:"
        ls -la data/
    else
        echo "No database directory"
    fi
    echo ""
    
    echo "💾 Backup analysis:"
    if [ -d backups ]; then
        echo "Backup count: $(ls backups/ | wc -l)"
        echo "Recent backups (last 5):"
        ls -lt backups/ | head -6
    else
        echo "No backups directory"
    fi
    echo ""
    
    echo "📋 Process analysis:"
    echo "Listening ports:"
    sudo netstat -tlnp | grep -E ":(80|8000|443) " || echo "No relevant processes"
    echo ""
    
    echo "🧹 Temporary files:"
    echo "Log files:"
    find . -name "*log*" -type f | sort
    echo ""
    echo "Temp files:"
    find . -name "tmp" -o -name "temp" -o -name "*.tmp" | sort
    echo ""
}

# Function: Health check
health_check() {
    echo "🏥 HEALTH CHECK"
    echo "==============="
    
    echo "📊 Service status:"
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose --profile production ps 2>/dev/null || echo "No services running"
    else
        echo "docker-compose not available"
    fi
    echo ""
    
    echo "🔍 Endpoint testing:"
    
    # Test direct app
    if curl -f -s http://localhost:8000/api/v1/health/ >/dev/null 2>&1; then
        echo "✅ Direct app (port 8000): HEALTHY"
    else
        echo "❌ Direct app (port 8000): FAILED"
    fi
    
    # Test nginx proxy
    if curl -f -s http://localhost/api/v1/health/ >/dev/null 2>&1; then
        echo "✅ Nginx proxy (port 80): HEALTHY"
    else
        echo "❌ Nginx proxy (port 80): FAILED"
    fi
    echo ""
    
    echo "📋 Recent logs:"
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose --profile production logs --tail=10 2>/dev/null || echo "No logs available"
    fi
    echo ""
}

# Function: Repository comparison
repo_comparison() {
    echo "🏠 REPOSITORY STRUCTURE COMPARISON"
    echo "=================================="
    
    echo "Expected structure should contain:"
    expected_items=("backend" "frontend" "nginx" "data" "scripts" "docker-compose.yml" "Dockerfile" "CLAUDE.md")
    
    echo "✅ PRESENT:"
    for item in "${expected_items[@]}"; do
        if [ -e "$item" ]; then
            echo "✓ $item"
        fi
    done
    echo ""
    
    echo "❌ MISSING:"
    for item in "${expected_items[@]}"; do
        if [ ! -e "$item" ]; then
            echo "✗ $item"
        fi
    done
    echo ""
    
    echo "⚠️  UNEXPECTED FILES (potential chaos):"
    for item in *; do
        case "$item" in
            backend|frontend|nginx|data|scripts|docker-compose.yml|Dockerfile|CLAUDE.md|README.md|.git|.github|.gitignore|logs|backups)
                # Expected files
                ;;
            *)
                echo "⚠️  $item"
                ;;
        esac
    done
    echo ""
}

# Function: Git analysis
git_analysis() {
    echo "🔄 GIT REPOSITORY ANALYSIS"
    echo "=========================="
    
    if [ -d .git ]; then
        echo "✅ Git repository detected"
        echo ""
        echo "Current branch:"
        git branch 2>/dev/null || echo "Branch info unavailable"
        echo ""
        echo "Last 5 commits:"
        git log --oneline -5 2>/dev/null || echo "No git history"
        echo ""
        echo "Git status:"
        git status --porcelain 2>/dev/null || echo "Git status unavailable"
    else
        echo "❌ Not a git repository"
        echo "🎯 RECOMMENDATION: Use fresh-setup for proper git structure"
    fi
    echo ""
}

# Execute analysis based on level
case "$ANALYSIS_LEVEL" in
    "basic")
        basic_analysis
        ;;
    "detailed")
        basic_analysis
        detailed_analysis
        health_check
        ;;
    "full")
        basic_analysis
        detailed_analysis
        full_analysis
        health_check
        repo_comparison
        git_analysis
        ;;
    *)
        echo "❌ Invalid analysis level: $ANALYSIS_LEVEL"
        echo "Valid levels: basic, detailed, full"
        exit 1
        ;;
esac

echo ""
echo "📋 SUMMARY AND RECOMMENDATIONS"
echo "=============================="

# Generate recommendations based on findings
if [ ! -d .git ]; then
    echo "🎯 CRITICAL: Use fresh-setup to establish proper git repository"
fi

if [ ! -f docker-compose.yml ]; then
    echo "🎯 MISSING: docker-compose.yml needs to be downloaded"
fi

chaotic_files=$(ls | grep -vE "^(backend|frontend|nginx|data|scripts|docker-compose.yml|Dockerfile|CLAUDE.md|README.md|logs|backups)$" | wc -l)
if [ "$chaotic_files" -gt 0 ]; then
    echo "🎯 CLEANUP NEEDED: $chaotic_files unexpected files/directories found"
    echo "   Recommended: Use deep-cleanup or fresh-setup"
fi

echo ""
echo "✅ EC2 INSPECTION COMPLETED!"