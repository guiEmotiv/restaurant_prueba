#!/bin/bash
# Migration Validation Script - Test migrations safely before deployment
set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

ECR_REGISTRY="${1:-}"
ECR_REPOSITORY="${2:-}"

[ -z "$ECR_REGISTRY" ] && error "ECR_REGISTRY required"
[ -z "$ECR_REPOSITORY" ] && error "ECR_REPOSITORY required"

log "🔬 Starting Migration Validation"

# Create test environment
TEST_DIR="/tmp/migration-test-$$"
mkdir -p "$TEST_DIR"

# Copy production database for testing
if [ -f "/opt/restaurant-web/data/restaurant.prod.sqlite3" ]; then
    cp "/opt/restaurant-web/data/restaurant.prod.sqlite3" "$TEST_DIR/test.sqlite3"
    log "📋 Copied production database for testing"
else
    touch "$TEST_DIR/test.sqlite3"
    warn "No production database found, using empty database"
fi

# Test migrations in container
log "🧪 Testing migrations in isolated container"
VALIDATION_RESULT=$(sudo docker run --rm \
    -v "$TEST_DIR:/test" \
    "$ECR_REGISTRY/$ECR_REPOSITORY:latest" \
    bash -c "
        export DATABASE_PATH=/test
        export DATABASE_NAME=test.sqlite3
        export DEBUG=True
        
        # Check current migration status
        echo '📊 Current migration status:'
        python manage.py showmigrations --verbosity=1 2>/dev/null || echo 'Error checking migrations'
        
        # Check for pending migrations
        PENDING=\$(python manage.py showmigrations --plan | grep '\\[ \\]' | wc -l)
        echo \"Pending migrations: \$PENDING\"
        
        if [ \$PENDING -gt 0 ]; then
            echo '🔍 Pending migrations found, testing...'
            
            # Try normal migration first
            python manage.py migrate --dry-run --verbosity=2 2>&1 | head -20
            
            # Test actual migration
            if timeout 30 python manage.py migrate --verbosity=1 2>/dev/null; then
                echo 'MIGRATION_SUCCESS'
            else
                echo 'MIGRATION_FAILED'
                # Try with fake strategy
                if timeout 30 python manage.py migrate --fake-initial 2>/dev/null; then
                    echo 'MIGRATION_FAKE_SUCCESS'
                else
                    echo 'MIGRATION_TOTAL_FAILURE'
                fi
            fi
        else
            echo 'NO_PENDING_MIGRATIONS'
        fi
    " 2>&1)

echo "$VALIDATION_RESULT" > "$TEST_DIR/validation_log.txt"

# Analyze results
if echo "$VALIDATION_RESULT" | grep -q "MIGRATION_SUCCESS"; then
    success "✅ Migrations validated successfully - safe to deploy normally"
    echo "STRATEGY=normal" > "$TEST_DIR/strategy.txt"
elif echo "$VALIDATION_RESULT" | grep -q "MIGRATION_FAKE_SUCCESS"; then
    warn "⚠️ Normal migration failed, but fake migration worked"
    echo "STRATEGY=fake" > "$TEST_DIR/strategy.txt"
elif echo "$VALIDATION_RESULT" | grep -q "NO_PENDING_MIGRATIONS"; then
    success "ℹ️ No pending migrations - deployment safe"
    echo "STRATEGY=none" > "$TEST_DIR/strategy.txt"
else
    error "❌ Migration validation failed completely"
    echo "STRATEGY=abort" > "$TEST_DIR/strategy.txt"
    cat "$TEST_DIR/validation_log.txt"
    exit 1
fi

# Output strategy for use by deployment script
cat "$TEST_DIR/strategy.txt"

# Cleanup
rm -rf "$TEST_DIR"