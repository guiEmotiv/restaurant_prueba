#!/bin/bash

# EC2 Deployment Script
# Restaurant Management System - Production Deployment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Functions
show_help() {
    echo "EC2 Deployment Script - Restaurant Management System"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  deploy    Deploy the application (default)"
    echo "  status    Check application status"
    echo "  logs      View application logs"
    echo "  restart   Restart the application"
    echo "  stop      Stop the application"
    echo "  backup    Create database backup"
    echo "  help      Show this help message"
    echo ""
}

check_requirements() {
    print_info "Checking deployment requirements..."
    
    # Check if Docker is installed and accessible
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Run ./deploy/ec2-setup.sh first"
        exit 1
    fi
    
    if ! docker ps &> /dev/null; then
        print_error "Cannot access Docker. Make sure you're in the docker group and logged in again"
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Run ./deploy/ec2-setup.sh first"
        exit 1
    fi
    
    # Check if environment file exists
    if [ ! -f ".env.ec2" ]; then
        print_error ".env.ec2 file not found. Please create it from template"
        exit 1
    fi
    
    print_status "All requirements met"
}

validate_environment() {
    print_info "Validating environment configuration..."
    
    # Source environment file
    set -a
    source .env.ec2
    set +a
    
    # Check required variables
    if [ -z "${DJANGO_SECRET_KEY:-}" ] || [ "$DJANGO_SECRET_KEY" = "your-secret-key-here" ]; then
        print_error "Please set DJANGO_SECRET_KEY in .env.ec2"
        exit 1
    fi
    
    if [ -z "${EC2_PUBLIC_IP:-}" ] || [ "$EC2_PUBLIC_IP" = "your-ec2-public-ip" ]; then
        print_warning "EC2_PUBLIC_IP not set. Application will only be accessible locally"
    fi
    
    print_status "Environment configuration validated"
}

deploy_application() {
    print_info "Starting application deployment..."
    
    # Create data directory
    mkdir -p data
    print_status "Created data directory"
    
    # Stop existing containers
    docker-compose -f docker-compose.ec2.yml down 2>/dev/null || true
    print_status "Stopped existing containers"
    
    # Build application
    print_info "Building application image..."
    docker-compose -f docker-compose.ec2.yml build --no-cache
    print_status "Application built successfully"
    
    # Start application
    print_info "Starting application..."
    docker-compose -f docker-compose.ec2.yml up -d
    
    # Wait for container to be ready
    print_info "Waiting for application to start..."
    sleep 15
    
    # Check if container is running
    if docker ps | grep -q "restaurant_web_ec2"; then
        print_status "Application started successfully"
        
        # Get application URL
        get_application_url
        
        print_status "Deployment completed successfully!"
        echo ""
        show_application_info
    else
        print_error "Application failed to start"
        echo "Check logs with: docker logs restaurant_web_ec2"
        exit 1
    fi
}

show_status() {
    print_info "Application Status"
    echo "=================="
    
    if docker ps | grep -q "restaurant_web_ec2"; then
        print_status "Application is running"
        
        # Show container stats
        docker stats --no-stream restaurant_web_ec2 2>/dev/null || true
        
        # Get application URL
        get_application_url
        show_application_info
    else
        print_warning "Application is not running"
        
        # Check if container exists but stopped
        if docker ps -a | grep -q "restaurant_web_ec2"; then
            echo "Container exists but is stopped. Check logs:"
            docker logs --tail=20 restaurant_web_ec2 2>/dev/null || true
        fi
    fi
}

show_logs() {
    print_info "Application Logs"
    echo "================"
    
    if docker ps -a | grep -q "restaurant_web_ec2"; then
        docker logs -f restaurant_web_ec2
    else
        print_warning "No container found"
    fi
}

restart_application() {
    print_info "Restarting application..."
    
    if docker ps | grep -q "restaurant_web_ec2"; then
        docker-compose -f docker-compose.ec2.yml restart
        sleep 10
        
        if docker ps | grep -q "restaurant_web_ec2"; then
            print_status "Application restarted successfully"
            get_application_url
            show_application_info
        else
            print_error "Failed to restart application"
            exit 1
        fi
    else
        print_warning "Application is not running. Use 'deploy' command to start it"
    fi
}

stop_application() {
    print_info "Stopping application..."
    
    docker-compose -f docker-compose.ec2.yml down
    print_status "Application stopped"
}

backup_database() {
    print_info "Creating database backup..."
    
    if [ ! -f "data/db.sqlite3" ]; then
        print_error "Database file not found"
        exit 1
    fi
    
    BACKUP_NAME="db_backup_$(date +%Y%m%d_%H%M%S).sqlite3"
    cp "data/db.sqlite3" "data/$BACKUP_NAME"
    
    print_status "Database backup created: data/$BACKUP_NAME"
}

get_application_url() {
    # Try to get EC2 public IP
    if command -v curl &> /dev/null; then
        PUBLIC_IP=$(curl -s --connect-timeout 5 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "")
        
        if [ -n "$PUBLIC_IP" ]; then
            APP_URL="http://$PUBLIC_IP"
        else
            APP_URL="http://localhost"
        fi
    else
        APP_URL="http://localhost"
    fi
}

show_application_info() {
    echo ""
    echo "🎉 Restaurant Management System"
    echo "==============================="
    echo "📱 Application: $APP_URL"
    echo "🔧 Admin Panel: $APP_URL/admin/"
    echo "📖 API Documentation: $APP_URL/api/"
    echo ""
    echo "📋 Useful Commands:"
    echo "  Status: ./deploy/ec2-deploy.sh status"
    echo "  Logs: ./deploy/ec2-deploy.sh logs"
    echo "  Restart: ./deploy/ec2-deploy.sh restart"
    echo "  Backup: ./deploy/ec2-deploy.sh backup"
    echo ""
}

# Main script logic
COMMAND=${1:-deploy}

case $COMMAND in
    deploy)
        echo "🚀 EC2 Deployment - Restaurant Management System"
        echo "==============================================="
        check_requirements
        validate_environment
        deploy_application
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    restart)
        restart_application
        ;;
    stop)
        stop_application
        ;;
    backup)
        backup_database
        ;;
    help)
        show_help
        ;;
    *)
        print_error "Unknown command: $COMMAND"
        show_help
        exit 1
        ;;
esac