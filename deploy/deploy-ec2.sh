#!/bin/bash
# 🚀 Unified EC2 Deployment Script for Restaurant Management System
# This script handles the complete deployment process on EC2

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if .env.ec2 exists
if [ ! -f .env.ec2 ]; then
    print_error ".env.ec2 file not found!"
    echo "Please create .env.ec2 with at least:"
    echo "  DJANGO_SECRET_KEY=your-secret-key"
    echo "  EC2_PUBLIC_IP=your-ec2-ip"
    exit 1
fi

# Load environment variables
source .env.ec2

# Verify required variables
if [ -z "$EC2_PUBLIC_IP" ]; then
    print_error "EC2_PUBLIC_IP not set in .env.ec2!"
    exit 1
fi

if [ -z "$DJANGO_SECRET_KEY" ]; then
    print_error "DJANGO_SECRET_KEY not set in .env.ec2!"
    exit 1
fi

# Function to check disk space
check_disk_space() {
    local available=$(df / | awk 'NR==2 {print $4}')
    local available_gb=$(echo "scale=2; $available / 1048576" | bc 2>/dev/null || echo "0")
    
    if (( $(echo "$available < 1048576" | bc -l) )); then
        print_error "Insufficient disk space! Only ${available_gb}GB available."
        print_warning "At least 1GB free space is required."
        echo "Run: ./deploy/clean-ec2-space.sh"
        return 1
    fi
    return 0
}

# Main deployment function
deploy() {
    print_status "🚀 Starting EC2 deployment for Restaurant Management System"
    print_status "EC2 IP: $EC2_PUBLIC_IP"
    
    # Check disk space
    print_status "💾 Checking disk space..."
    if ! check_disk_space; then
        exit 1
    fi
    print_success "Sufficient disk space available"
    
    # Step 1: Update code
    print_status "📥 Pulling latest code from Git..."
    git pull origin main || {
        print_error "Failed to pull from Git"
        exit 1
    }
    print_success "Code updated"
    
    # Step 2: Stop existing containers
    print_status "🛑 Stopping existing containers..."
    docker-compose -f docker-compose.ec2.yml down || true
    print_success "Containers stopped"
    
    # Step 3: Clean up old images (optional)
    if [ "$1" == "--clean" ]; then
        print_status "🧹 Cleaning up old Docker images..."
        docker system prune -f
        docker image prune -a -f
        print_success "Cleanup complete"
    fi
    
    # Step 4: Build new image
    print_status "🔨 Building Docker image (this may take a few minutes)..."
    docker-compose -f docker-compose.ec2.yml build --no-cache || {
        print_error "Docker build failed"
        exit 1
    }
    print_success "Docker image built"
    
    # Step 5: Start containers
    print_status "🚀 Starting containers..."
    docker-compose -f docker-compose.ec2.yml up -d || {
        print_error "Failed to start containers"
        exit 1
    }
    print_success "Containers started"
    
    # Step 6: Wait for health check
    print_status "⏳ Waiting for application to be ready..."
    sleep 10
    
    # Step 7: Check container status
    print_status "📊 Checking container status..."
    docker-compose -f docker-compose.ec2.yml ps
    
    # Step 8: Run health checks
    print_status "🏥 Running health checks..."
    
    # Check if Django admin is accessible
    if curl -s -o /dev/null -w "%{http_code}" http://localhost/admin/ | grep -q "302\|200"; then
        print_success "Django admin is accessible"
    else
        print_warning "Django admin might not be ready yet"
    fi
    
    # Check API endpoints
    if curl -s http://localhost/api/v1/categories/ | grep -q "results"; then
        print_success "API endpoints are working"
    else
        print_warning "API endpoints might not be ready yet"
    fi
    
    # Step 9: Show logs
    print_status "📜 Recent logs:"
    docker-compose -f docker-compose.ec2.yml logs --tail=20
    
    print_success "🎉 Deployment complete!"
    echo ""
    echo "Your application should be available at:"
    echo "  🌐 http://$EC2_PUBLIC_IP/"
    echo "  🔧 http://$EC2_PUBLIC_IP/admin/"
    echo "  📡 http://$EC2_PUBLIC_IP/api/v1/"
    echo ""
    echo "Useful commands:"
    echo "  View logs:    docker-compose -f docker-compose.ec2.yml logs -f"
    echo "  Stop app:     docker-compose -f docker-compose.ec2.yml down"
    echo "  Restart app:  docker-compose -f docker-compose.ec2.yml restart"
    echo "  Enter shell:  docker-compose -f docker-compose.ec2.yml exec web bash"
}

# Additional utility functions
case "$1" in
    "")
        deploy
        ;;
    "--clean")
        deploy --clean
        ;;
    "status")
        print_status "📊 Checking application status..."
        docker-compose -f docker-compose.ec2.yml ps
        echo ""
        print_status "🏥 Health check:"
        curl -s -o /dev/null -w "Admin: %{http_code}\n" http://localhost/admin/
        curl -s -o /dev/null -w "API: %{http_code}\n" http://localhost/api/v1/
        ;;
    "logs")
        docker-compose -f docker-compose.ec2.yml logs -f
        ;;
    "restart")
        print_status "🔄 Restarting application..."
        docker-compose -f docker-compose.ec2.yml restart
        print_success "Application restarted"
        ;;
    "stop")
        print_status "🛑 Stopping application..."
        docker-compose -f docker-compose.ec2.yml down
        print_success "Application stopped"
        ;;
    "backup")
        print_status "💾 Creating database backup..."
        BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S).sqlite3"
        docker-compose -f docker-compose.ec2.yml exec -T web cp /app/data/db.sqlite3 /app/data/$BACKUP_NAME
        docker cp restaurant_web_ec2:/app/data/$BACKUP_NAME ./data/
        print_success "Backup created: ./data/$BACKUP_NAME"
        ;;
    "shell")
        docker-compose -f docker-compose.ec2.yml exec web bash
        ;;
    "manage")
        shift
        docker-compose -f docker-compose.ec2.yml exec web python manage.py "$@"
        ;;
    *)
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  (no command)  Deploy the application"
        echo "  --clean       Deploy with Docker cleanup"
        echo "  status        Check application status"
        echo "  logs          View application logs"
        echo "  restart       Restart the application"
        echo "  stop          Stop the application"
        echo "  backup        Create database backup"
        echo "  shell         Enter Django shell"
        echo "  manage        Run Django manage.py commands"
        echo ""
        echo "Examples:"
        echo "  $0                    # Normal deployment"
        echo "  $0 --clean            # Clean deployment"
        echo "  $0 status             # Check status"
        echo "  $0 logs               # View logs"
        echo "  $0 manage migrate     # Run migrations"
        echo "  $0 manage createsuperuser  # Create admin user"
        ;;
esac