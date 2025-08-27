#!/bin/bash
# Complete fix for all deployment issues

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; exit 1; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }

cd /opt/restaurant-web || error "Not on EC2 instance"

log "🚀 Starting complete deployment fix..."

# Step 1: Fix AWS credentials and ECR login
log "1️⃣ Setting up AWS credentials..."
if [ -z "$AWS_REGION" ]; then
    export AWS_REGION=us-west-2
fi

# Login to ECR
log "🔐 Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin 721063839441.dkr.ecr.$AWS_REGION.amazonaws.com || {
    warning "ECR login failed. Trying alternative method..."
    # Alternative: Use instance profile
    aws configure set region $AWS_REGION
    $(aws ecr get-login --no-include-email --region $AWS_REGION) || error "Cannot login to ECR"
}

# Step 2: Create proper environment file
log "2️⃣ Creating complete environment configuration..."
cat > .env.ec2 << 'EOF'
# Django settings
SECRET_KEY=django-insecure-temporary-key-change-this-in-production-abc123xyz
DEBUG=False
USE_COGNITO_AUTH=False

# Database
DATABASE_PATH=/opt/restaurant-web/data
DATABASE_NAME=restaurant_prod.sqlite3

# AWS
AWS_REGION=us-west-2
COGNITO_USER_POOL_ID=us-west-2_placeholder
COGNITO_APP_CLIENT_ID=placeholder123

# Hosts
ALLOWED_HOSTS=localhost,127.0.0.1,xn--elfogndedonsoto-zrb.com,www.xn--elfogndedonsoto-zrb.com,*
DOMAIN_NAME=xn--elfogndedonsoto-zrb.com
EC2_PUBLIC_IP=*

# Django settings module
DJANGO_SETTINGS_MODULE=backend.settings_ec2

# Additional settings
CSRF_TRUSTED_ORIGINS=http://localhost,https://xn--elfogndedonsoto-zrb.com
EOF

# Step 3: Ensure database exists
log "3️⃣ Setting up database..."
mkdir -p data backups logs
if [ ! -f data/restaurant_prod.sqlite3 ]; then
    info "Creating new production database..."
    if [ -f data/db.sqlite3 ]; then
        cp data/db.sqlite3 data/restaurant_prod.sqlite3
    elif [ -f data/backup_auto_20250825_203752.sqlite3 ]; then
        cp data/backup_auto_20250825_203752.sqlite3 data/restaurant_prod.sqlite3
    else
        # Create empty database
        touch data/restaurant_prod.sqlite3
    fi
fi

# Fix permissions
chown -R $(whoami):$(whoami) data/
chmod -R 755 data/

# Step 4: Clean everything
log "4️⃣ Cleaning up old containers..."
docker-compose --profile production down --remove-orphans || true
docker container prune -f || true
docker image prune -f || true

# Step 5: Pull the latest image
log "5️⃣ Pulling latest Docker image..."
docker pull 721063839441.dkr.ecr.$AWS_REGION.amazonaws.com/restaurant-web:latest || {
    warning "Cannot pull latest image. Using local if available..."
}

# Step 6: Update docker-compose.yml to use ECR image
log "6️⃣ Updating docker-compose configuration..."
sed -i "s|image: restaurant-web:latest|image: 721063839441.dkr.ecr.$AWS_REGION.amazonaws.com/restaurant-web:latest|g" docker-compose.yml

# Step 7: Start only the app first
log "7️⃣ Starting application container..."
docker-compose --profile production up -d app

# Step 8: Wait and check app logs
log "⏳ Waiting for app to start (60 seconds)..."
for i in {1..12}; do
    sleep 5
    if docker-compose --profile production ps app | grep -q "Up"; then
        log "✅ App container is running!"
        break
    fi
    info "Waiting... ($((i*5))/60s)"
done

# Show app logs
log "📜 Application logs:"
docker-compose --profile production logs app --tail=50

# Step 9: Run migrations inside container
log "8️⃣ Running database migrations..."
docker-compose --profile production exec -T app python manage.py migrate --noinput || warning "Migrations failed or already applied"

# Step 10: Create superuser if needed
log "9️⃣ Ensuring superuser exists..."
docker-compose --profile production exec -T app python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print('Superuser created')
else:
    print('Superuser already exists')
" || warning "Could not create superuser"

# Step 11: Start nginx
log "🔟 Starting nginx..."
docker-compose --profile production up -d nginx

# Step 12: Final health check
log "🏥 Running final health check..."
sleep 10

# Try multiple times
success=false
for i in {1..6}; do
    if curl -f -s http://localhost:8000/api/v1/health/; then
        success=true
        break
    fi
    info "Health check attempt $i/6 failed. Waiting..."
    sleep 10
done

# Step 13: Show final status
log "📊 Final deployment status:"
docker-compose --profile production ps

if [ "$success" = true ]; then
    log "✅ DEPLOYMENT FIXED SUCCESSFULLY!"
    log "🌐 Your application is running at:"
    log "   - http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo 'your-ec2-ip')"
    log "   - https://xn--elfogndedonsoto-zrb.com (if DNS is configured)"
else
    warning "⚠️  Deployment is running but health check failed"
    log "Debugging information:"
    docker-compose --profile production logs app --tail=30
    echo ""
    log "Try accessing directly:"
    curl -v http://localhost:8000/api/v1/health/
fi