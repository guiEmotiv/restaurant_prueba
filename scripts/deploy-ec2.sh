#!/bin/bash
# EC2 Deployment Script for Restaurant Web
# Supports both DEV and PROD environments

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
ENVIRONMENT="dev"
FORCE_UPDATE=false
SKIP_BACKUP=false

# Function to display help
show_help() {
    echo "Restaurant Web EC2 Deployment Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --environment ENV    Environment (dev|prod) - default: dev"
    echo "  -f, --force             Force update without confirmation"
    echo "  -s, --skip-backup       Skip database backup (not recommended for prod)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -e dev                # Deploy to development"
    echo "  $0 -e prod -f            # Force deploy to production"
    echo "  $0 --environment prod    # Deploy to production with confirmation"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -f|--force)
            FORCE_UPDATE=true
            shift
            ;;
        -s|--skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate environment
if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "prod" ]]; then
    echo -e "${RED}❌ Invalid environment: $ENVIRONMENT${NC}"
    echo -e "${YELLOW}Valid options: dev, prod${NC}"
    exit 1
fi

# Set environment-specific variables
if [[ "$ENVIRONMENT" == "prod" ]]; then
    DATABASE_NAME="restaurant_prod.sqlite3"
    COMPOSE_PROFILE="production"
    CONFIRMATION_REQUIRED=true
else
    DATABASE_NAME="restaurant_dev.sqlite3"
    COMPOSE_PROFILE=""
    CONFIRMATION_REQUIRED=false
fi

echo -e "${BLUE}🚀 Restaurant Web EC2 Deployment${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Database: ${DATABASE_NAME}${NC}"
echo ""

# Confirmation for production
if [[ "$CONFIRMATION_REQUIRED" == "true" && "$FORCE_UPDATE" != "true" ]]; then
    echo -e "${YELLOW}⚠️  You are about to deploy to PRODUCTION!${NC}"
    echo -e "${YELLOW}This will affect live users and data.${NC}"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo -e "${BLUE}Deployment cancelled.${NC}"
        exit 0
    fi
fi

# Create deployment directory
DEPLOY_DIR="/opt/restaurant-web"
sudo mkdir -p $DEPLOY_DIR
cd $DEPLOY_DIR

# Backup existing database
if [[ "$SKIP_BACKUP" != "true" && -f "data/$DATABASE_NAME" ]]; then
    BACKUP_DIR="backups/backup-$(date +%Y%m%d-%H%M%S)"
    echo -e "${YELLOW}📦 Creating database backup...${NC}"
    sudo mkdir -p $BACKUP_DIR
    sudo cp data/$DATABASE_NAME $BACKUP_DIR/
    echo -e "${GREEN}✅ Database backed up to $BACKUP_DIR${NC}"
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Docker...${NC}"
    sudo yum update -y
    sudo yum install -y docker
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -a -G docker $USER
    echo -e "${GREEN}✅ Docker installed${NC}"
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Docker Compose...${NC}"
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✅ Docker Compose installed${NC}"
fi

# Install AWS CLI if needed
if ! command -v aws &> /dev/null; then
    echo -e "${YELLOW}📦 Installing AWS CLI...${NC}"
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip -o awscliv2.zip
    sudo ./aws/install
    rm -rf aws awscliv2.zip
    echo -e "${GREEN}✅ AWS CLI installed${NC}"
fi

# Create necessary directories
sudo mkdir -p data nginx/conf.d
sudo chown -R $USER:$USER $DEPLOY_DIR

# Stop existing services
echo -e "${YELLOW}⏸️  Stopping existing services...${NC}"
if [[ "$ENVIRONMENT" == "prod" ]]; then
    docker-compose --profile production down --timeout 30 2>/dev/null || true
else
    docker-compose down --timeout 30 2>/dev/null || true
fi

# Pull latest code or use provided image
if [[ -n "$ECR_REGISTRY" && -n "$IMAGE_TAG" ]]; then
    # Using ECR image (from GitHub Actions)
    echo -e "${YELLOW}🐳 Pulling Docker image...${NC}"
    aws ecr get-login-password --region ${AWS_REGION:-us-west-2} | docker login --username AWS --password-stdin $ECR_REGISTRY
    docker pull $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
    echo -e "${GREEN}✅ Image pulled${NC}"
else
    # Local build
    echo -e "${YELLOW}🔨 Building Docker image locally...${NC}"
    docker build -t restaurant-web:latest .
    echo -e "${GREEN}✅ Image built${NC}"
fi

# Start services
echo -e "${YELLOW}🚀 Starting services...${NC}"
if [[ "$ENVIRONMENT" == "prod" ]]; then
    docker-compose --profile production up -d
else
    docker-compose up -d
fi

# Wait for services
echo -e "${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 30

# Run migrations
echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
if [[ "$ENVIRONMENT" == "prod" ]]; then
    docker-compose exec -T app python manage.py migrate
else
    docker exec restaurant-web-app python manage.py migrate 2>/dev/null || docker-compose exec -T app python manage.py migrate
fi
echo -e "${GREEN}✅ Migrations completed${NC}"

# Collect static files
echo -e "${YELLOW}📁 Collecting static files...${NC}"
if [[ "$ENVIRONMENT" == "prod" ]]; then
    docker-compose exec -T app python manage.py collectstatic --noinput
else
    docker exec restaurant-web-app python manage.py collectstatic --noinput 2>/dev/null || docker-compose exec -T app python manage.py collectstatic --noinput
fi
echo -e "${GREEN}✅ Static files collected${NC}"

# Health check
echo -e "${YELLOW}🏥 Running health check...${NC}"
for i in {1..5}; do
    if [[ "$ENVIRONMENT" == "prod" ]]; then
        HEALTH_URL="http://localhost/api/v1/health/"
    else
        HEALTH_URL="http://localhost:8000/api/v1/health/"
    fi
    
    if curl -f $HEALTH_URL > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Health check passed${NC}"
        break
    else
        if [[ $i -eq 5 ]]; then
            echo -e "${RED}❌ Health check failed after 5 attempts${NC}"
            echo -e "${RED}Deployment may have issues${NC}"
            exit 1
        fi
        echo -e "${YELLOW}⏳ Health check attempt $i/5 failed, retrying...${NC}"
        sleep 10
    fi
done

# Cleanup old images
echo -e "${YELLOW}🧹 Cleaning up old Docker images...${NC}"
docker image prune -f
echo -e "${GREEN}✅ Cleanup completed${NC}"

# Display final status
echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${GREEN}Environment: ${ENVIRONMENT}${NC}"
echo -e "${GREEN}Database: ${DATABASE_NAME}${NC}"

if [[ "$ENVIRONMENT" == "prod" ]]; then
    echo -e "${GREEN}🔗 Production URL: https://your-domain.com${NC}"
    echo -e "${BLUE}📊 Monitor logs: docker-compose --profile production logs -f${NC}"
else
    echo -e "${GREEN}🔗 Development URL: http://localhost:8000${NC}"
    echo -e "${BLUE}📊 Monitor logs: docker logs restaurant-web-app -f${NC}"
fi

echo ""
echo -e "${BLUE}📋 Useful commands:${NC}"
echo -e "${BLUE}  View logs:     docker-compose logs -f${NC}"
echo -e "${BLUE}  Restart:       docker-compose restart${NC}"
echo -e "${BLUE}  Shell access:  docker-compose exec app bash${NC}"
echo -e "${BLUE}  Django shell:  docker-compose exec app python manage.py shell${NC}"