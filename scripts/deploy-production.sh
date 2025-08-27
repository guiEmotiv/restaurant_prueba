#!/bin/bash
set -euo pipefail

# Production Deployment Script
# This script runs ON THE EC2 INSTANCE after environment variables are set

echo "🚀 Production deployment started..."
echo "Working directory: $(pwd)"
echo "User: $(whoami)"

# Validate required environment variables
REQUIRED_VARS=(
    "ECR_REGISTRY"
    "ECR_REPOSITORY" 
    "VERSION"
    "AWS_REGION"
    "COGNITO_USER_POOL_ID"
    "COGNITO_APP_CLIENT_ID"
    "DJANGO_SECRET_KEY"
    "EC2_HOST"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var:-}" ]; then
        echo "❌ Error: Required environment variable $var is not set"
        exit 1
    fi
done

# Set optional variables with defaults
DOMAIN_NAME="${DOMAIN_NAME:-localhost}"
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-guiEmotiv/restaurant-web}"

# Navigate to application directory
cd /opt/restaurant-web || { echo "❌ App directory not found"; exit 1; }

# Create required directories
mkdir -p data backups logs

# Backup existing database if it exists
if [ -f data/restaurant_prod.sqlite3 ]; then
    BACKUP_DIR="backups/backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    cp data/restaurant_prod.sqlite3 "$BACKUP_DIR/"
    echo "✅ Database backed up to $BACKUP_DIR"
fi

# Login to ECR
echo "🔐 Logging into ECR..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"

# Pull the Docker image
echo "📥 Pulling Docker image..."
FULL_IMAGE="${ECR_REGISTRY}/${ECR_REPOSITORY}:${VERSION}"
docker pull "$FULL_IMAGE"

# Create production environment file
echo "⚙️ Creating production environment..."
cat > .env.ec2 << EOF
AWS_REGION=${AWS_REGION}
COGNITO_USER_POOL_ID=${COGNITO_USER_POOL_ID}
COGNITO_APP_CLIENT_ID=${COGNITO_APP_CLIENT_ID}
DATABASE_PATH=/opt/restaurant-web/data
DATABASE_NAME=restaurant_prod.sqlite3
DEBUG=False
USE_COGNITO_AUTH=True
ALLOWED_HOSTS=${EC2_HOST},${DOMAIN_NAME}
SECRET_KEY=${DJANGO_SECRET_KEY}
DOMAIN_NAME=${DOMAIN_NAME}
EC2_PUBLIC_IP=${EC2_HOST}
EOF

# Download latest docker-compose.yml
echo "📥 Downloading docker-compose configuration..."
curl -sSL "https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/main/docker-compose.yml" -o docker-compose.yml

# Stop existing services gracefully
echo "⏹️ Stopping existing services..."
docker-compose --profile production down --timeout 30 || true

# Update docker-compose to use the new image
echo "🔄 Updating docker-compose configuration..."
# Use a more robust sed approach
cp docker-compose.yml docker-compose.yml.backup
sed -i "s|image: restaurant-web:.*|image: ${FULL_IMAGE}|g" docker-compose.yml

# Start production services
echo "🚀 Starting production services..."
docker-compose --profile production up -d

# Wait for services to be ready
echo "⏳ Waiting for services to initialize..."
sleep 45

# Run database migrations
echo "🗄️ Running database migrations..."
docker-compose exec -T app python manage.py migrate

# Collect static files
echo "📁 Collecting static files..."
docker-compose exec -T app python manage.py collectstatic --noinput

# Health check with retries
echo "🏥 Running health checks..."
for i in {1..5}; do
    if curl -f -s http://localhost/api/v1/health/ > /dev/null 2>&1; then
        echo "✅ Health check passed! Deployment successful!"
        docker-compose --profile production ps
        echo "🎉 Production deployment completed successfully!"
        exit 0
    else
        echo "⏳ Health check attempt $i/5..."
        sleep 15
    fi
done

# If we get here, health check failed
echo "❌ Health check failed after 5 attempts"
echo "📊 Container status:"
docker-compose --profile production ps
echo "📋 Container logs:"
docker-compose --profile production logs --tail=50
exit 1