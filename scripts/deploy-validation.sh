#!/bin/bash
# 🔍 PRE-DEPLOY VALIDATION SCRIPT
# Validates configuration and environment before deployment

set -e

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
    esac
}

echo -e "${BLUE}🔍 === PRE-DEPLOY VALIDATION ===${NC}"
echo ""

# 1. Validate Git status
log INFO "Checking Git status..."
if [ -n "$(git status --porcelain)" ]; then
    log WARNING "Uncommitted changes found"
    git status --short
    echo ""
else
    log SUCCESS "Git working directory clean"
fi

# 2. Validate required files
log INFO "Checking required files..."
REQUIRED_FILES=(
    "nginx/proxy_params"
    "nginx/conf.d/ssl.conf"
    ".env.ec2"
    "docker-compose.yml"
    "deploy.sh"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        log SUCCESS "Found: $file"
    else
        log ERROR "Missing required file: $file"
        exit 1
    fi
done

# 3. Validate nginx configuration
log INFO "Validating nginx configuration..."
if docker run --rm -v $(pwd)/nginx/conf.d:/etc/nginx/conf.d:ro nginx nginx -t 2>/dev/null; then
    log SUCCESS "Nginx configuration valid"
else
    log ERROR "Nginx configuration invalid"
    exit 1
fi

# 4. Validate environment configuration
log INFO "Checking environment configuration..."
if grep -q "USE_COGNITO_AUTH=True" .env.ec2; then
    log SUCCESS "Production auth enabled"
else
    log WARNING "Production auth disabled - verify this is intentional"
fi

if grep -q "DEBUG=False" .env.ec2; then
    log SUCCESS "Debug mode disabled for production"
else
    log ERROR "Debug mode should be disabled in production"
    exit 1
fi

# 5. Validate Docker environment
log INFO "Checking Docker environment..."
if command -v docker &> /dev/null; then
    log SUCCESS "Docker available"
else
    log ERROR "Docker not available"
    exit 1
fi

if command -v docker-compose &> /dev/null; then
    log SUCCESS "Docker Compose available"
else
    log ERROR "Docker Compose not available"
    exit 1
fi

# 6. Check for security issues
log INFO "Security validation..."
if grep -r "SECRET_KEY.*=.*dev" . --exclude-dir=node_modules 2>/dev/null; then
    log ERROR "Development secret key found in production files"
    exit 1
else
    log SUCCESS "No development secrets found"
fi

# 7. Validate database migration status
log INFO "Checking database migrations..."
if [ -f "backend/manage.py" ]; then
    cd backend
    if python manage.py showmigrations --plan | grep -q "\[ \]"; then
        log WARNING "Unapplied migrations found - will be applied during deployment"
    else
        log SUCCESS "All migrations applied"
    fi
    cd ..
else
    log WARNING "Backend directory not found - skipping migration check"
fi

# 8. Check frontend build
log INFO "Checking frontend configuration..."
if [ -f "frontend/package.json" ]; then
    if [ -f "frontend/dist/index.html" ]; then
        log SUCCESS "Frontend build exists"
    else
        log WARNING "Frontend not built - will be built during deployment"
    fi
else
    log WARNING "Frontend package.json not found"
fi

echo ""
log SUCCESS "All validations passed! ✨"
echo ""
echo -e "${BLUE}📋 DEPLOYMENT READY${NC}"
echo "   • Configuration files valid"
echo "   • Security checks passed"
echo "   • Environment properly configured"
echo "   • Dependencies available"
echo ""