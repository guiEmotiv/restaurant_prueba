#!/bin/bash

# Main deployment script for restaurant application

set -e

echo "🚀 Starting Restaurant App Deployment..."

# Configuration
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_ENABLED=${BACKUP_ENABLED:-true}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if environment file exists
if [ ! -f .env ]; then
    print_error ".env file not found! Please create it from .env.example"
    exit 1
fi

# Load environment variables
source .env

# Check required environment variables
required_vars=("DJANGO_SECRET_KEY" "RDS_HOSTNAME" "RDS_USERNAME" "RDS_PASSWORD" "AWS_S3_BUCKET_NAME")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        print_error "Required environment variable $var is not set"
        exit 1
    fi
done

print_status "Environment variables verified"

# Create backup before deployment if enabled
if [ "$BACKUP_ENABLED" = true ]; then
    print_status "Creating database backup..."
    if [ -f "./deploy/backup-db.sh" ]; then
        ./deploy/backup-db.sh || print_warning "Backup failed, continuing with deployment"
    else
        print_warning "Backup script not found, skipping backup"
    fi
fi

# Pull latest code (if using git)
if [ -d ".git" ]; then
    print_status "Pulling latest code..."
    git pull origin main || print_warning "Git pull failed, using current code"
fi

# Stop existing containers
print_status "Stopping existing containers..."
docker-compose -f $DOCKER_COMPOSE_FILE down || true

# Build new image
print_status "Building application image..."
docker-compose -f $DOCKER_COMPOSE_FILE build --no-cache

# Start containers
print_status "Starting containers..."
docker-compose -f $DOCKER_COMPOSE_FILE up -d

# Wait for application to be ready
print_status "Waiting for application to start..."
sleep 30

# Run database migrations
print_status "Running database migrations..."
docker-compose -f $DOCKER_COMPOSE_FILE exec -T web python manage.py migrate

# Collect static files
print_status "Collecting static files..."
docker-compose -f $DOCKER_COMPOSE_FILE exec -T web python manage.py collectstatic --noinput

# Health check
print_status "Performing health check..."
if curl -f http://localhost:8000/admin/ > /dev/null 2>&1; then
    print_status "Backend health check passed"
else
    print_error "Backend health check failed"
    exit 1
fi

# Deploy frontend if build directory exists
if [ -d "frontend/dist" ]; then
    print_status "Deploying frontend..."
    cd frontend
    if [ -f "../deploy/frontend-deploy.sh" ]; then
        ../deploy/frontend-deploy.sh
    else
        print_warning "Frontend deploy script not found"
    fi
    cd ..
else
    print_warning "Frontend build not found. Run 'npm run build' in frontend directory"
fi

# Show container status
print_status "Container status:"
docker-compose -f $DOCKER_COMPOSE_FILE ps

# Show logs (last 20 lines)
print_status "Recent logs:"
docker-compose -f $DOCKER_COMPOSE_FILE logs --tail=20

echo ""
print_status "🎉 Deployment completed successfully!"
echo ""
echo "Application URLs:"
echo "  Backend API: http://$(curl -s ifconfig.me):8000/"
echo "  Admin Panel: http://$(curl -s ifconfig.me):8000/admin/"
echo "  Frontend: https://your-cloudfront-domain.cloudfront.net/"
echo ""
echo "To view logs: docker-compose -f $DOCKER_COMPOSE_FILE logs -f"
echo "To stop app: docker-compose -f $DOCKER_COMPOSE_FILE down"