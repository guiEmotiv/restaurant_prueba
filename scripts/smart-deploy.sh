#!/bin/bash

# Smart Deployment Script
# Automatically detects what has changed and deploys only what's needed
# Optimized for public repository efficiency

set -e

echo "🧠 SMART DEPLOYMENT ANALYZER"
echo "============================"

# Navigate to deployment directory
cd /opt/restaurant-web || exit 1

# Function to check if service is running
check_service_running() {
    local service_name="$1"
    docker-compose --profile production ps | grep -q "$service_name.*Up" || return 1
}

# Function to get current image version
get_current_image() {
    docker-compose --profile production ps -q app | xargs -r docker inspect --format='{{.Config.Image}}' 2>/dev/null || echo "none"
}

# Function to compare file checksums
file_changed() {
    local file="$1"
    local url="https://raw.githubusercontent.com/guiEmotiv/restaurant-web/main/$file"
    
    if [ ! -f "$file" ]; then
        echo "true"  # File doesn't exist locally
        return
    fi
    
    local local_hash=$(md5sum "$file" 2>/dev/null | cut -d' ' -f1)
    local remote_hash=$(curl -sSL "$url" 2>/dev/null | md5sum | cut -d' ' -f1)
    
    if [ "$local_hash" != "$remote_hash" ]; then
        echo "true"
    else
        echo "false"
    fi
}

echo "📊 Analyzing current deployment state..."

# Check current image version
CURRENT_IMAGE=$(get_current_image)
NEW_IMAGE="${ECR_REGISTRY}/${ECR_REPOSITORY}:latest"

echo "Current image: $CURRENT_IMAGE"
echo "New image: $NEW_IMAGE"

# Initialize change flags
NEEDS_IMAGE_UPDATE=false
NEEDS_CONFIG_UPDATE=false
NEEDS_NGINX_UPDATE=false
NEEDS_FULL_RESTART=false

# Check if image needs update
if [ "$CURRENT_IMAGE" != "$NEW_IMAGE" ]; then
    echo "🔄 New Docker image detected"
    NEEDS_IMAGE_UPDATE=true
fi

# Check if docker-compose.yml changed
if [ "$(file_changed docker-compose.yml)" = "true" ]; then
    echo "🔄 docker-compose.yml changed"
    NEEDS_CONFIG_UPDATE=true
    NEEDS_FULL_RESTART=true
fi

# Check if nginx config changed
if [ "$(file_changed nginx/conf.d/default.conf)" = "true" ]; then
    echo "🔄 nginx configuration changed"
    NEEDS_NGINX_UPDATE=true
fi

# Smart deployment decisions
echo ""
echo "🚀 DEPLOYMENT PLAN:"
echo "=================="

if [ "$NEEDS_FULL_RESTART" = "true" ]; then
    echo "📋 Full service restart required (configuration changed)"
    DEPLOYMENT_TYPE="full"
elif [ "$NEEDS_IMAGE_UPDATE" = "true" ] && [ "$NEEDS_NGINX_UPDATE" = "true" ]; then
    echo "📋 Rolling update: App + Nginx"
    DEPLOYMENT_TYPE="app_nginx"
elif [ "$NEEDS_IMAGE_UPDATE" = "true" ]; then
    echo "📋 Rolling update: App only"
    DEPLOYMENT_TYPE="app_only"
elif [ "$NEEDS_NGINX_UPDATE" = "true" ]; then
    echo "📋 Rolling update: Nginx only"
    DEPLOYMENT_TYPE="nginx_only"
else
    echo "📋 No changes detected - deployment skipped"
    DEPLOYMENT_TYPE="none"
fi

# Execute deployment based on plan
case $DEPLOYMENT_TYPE in
    "full")
        echo ""
        echo "🔄 FULL DEPLOYMENT"
        echo "=================="
        
        # Backup database
        if [ -f data/restaurant_prod.sqlite3 ]; then
            mkdir -p backups
            cp data/restaurant_prod.sqlite3 "backups/smart-backup-$(date +%Y%m%d-%H%M%S).sqlite3"
            echo "✅ Database backed up"
        fi
        
        # Download updated configurations
        echo "📥 Syncing configurations..."
        curl -sSL https://raw.githubusercontent.com/guiEmotiv/restaurant-web/main/docker-compose.yml -o docker-compose.yml
        mkdir -p nginx/conf.d
        curl -sSL https://raw.githubusercontent.com/guiEmotiv/restaurant-web/main/nginx/conf.d/default.conf -o nginx/conf.d/default.conf
        
        # Update image reference
        sed -i "s|image: restaurant-web:latest|image: ${NEW_IMAGE}|g" docker-compose.yml
        
        # Full restart
        echo "🛑 Stopping services..."
        docker-compose --profile production down --timeout 20 || true
        
        echo "🚀 Starting services..."
        docker-compose --profile production up -d
        ;;
        
    "app_nginx")
        echo ""
        echo "🔄 APP + NGINX UPDATE"
        echo "===================="
        
        # Update nginx config
        echo "📥 Updating nginx configuration..."
        curl -sSL https://raw.githubusercontent.com/guiEmotiv/restaurant-web/main/nginx/conf.d/default.conf -o nginx/conf.d/default.conf
        
        # Rolling update: nginx first, then app
        echo "🔄 Rolling update: nginx..."
        docker-compose --profile production up -d --no-deps nginx
        
        echo "🔄 Rolling update: app..."
        docker-compose --profile production up -d --no-deps app
        ;;
        
    "app_only")
        echo ""
        echo "🔄 APP-ONLY UPDATE"
        echo "=================="
        
        # Update docker-compose with new image
        sed -i "s|image: .*restaurant-web.*|image: ${NEW_IMAGE}|g" docker-compose.yml
        
        # Rolling update: app only
        echo "🔄 Rolling update: app..."
        docker-compose --profile production up -d --no-deps app
        ;;
        
    "nginx_only")
        echo ""
        echo "🔄 NGINX-ONLY UPDATE"
        echo "===================="
        
        # Update nginx config
        echo "📥 Updating nginx configuration..."
        curl -sSL https://raw.githubusercontent.com/guiEmotiv/restaurant-web/main/nginx/conf.d/default.conf -o nginx/conf.d/default.conf
        
        # Rolling update: nginx only
        echo "🔄 Rolling update: nginx..."
        docker-compose --profile production restart nginx
        ;;
        
    "none")
        echo ""
        echo "✅ NO DEPLOYMENT NEEDED"
        echo "======================="
        echo "All services are up-to-date"
        
        # Still check health
        if check_service_running "app"; then
            echo "✅ Services are running correctly"
            exit 0
        else
            echo "⚠️ Services not running, performing health restart..."
            docker-compose --profile production restart
        fi
        ;;
esac

# Health check for all deployment types
if [ "$DEPLOYMENT_TYPE" != "none" ]; then
    echo ""
    echo "🏥 HEALTH CHECK"
    echo "==============="
    
    # Wait for services to stabilize
    case $DEPLOYMENT_TYPE in
        "full") sleep 30 ;;
        "app_nginx") sleep 25 ;;
        "app_only") sleep 20 ;;
        "nginx_only") sleep 10 ;;
    esac
    
    # Run health checks
    for i in {1..10}; do
        echo "⏳ Health check attempt $i/10..."
        
        if curl -f -s http://localhost:8000/api/v1/health/ >/dev/null 2>&1; then
            echo "✅ Direct app health: PASS"
            
            if curl -f -s http://localhost/api/v1/health/ >/dev/null 2>&1; then
                echo "✅ Nginx proxy health: PASS"
                echo ""
                echo "🎉 SMART DEPLOYMENT SUCCESSFUL!"
                echo "Deployment type: $DEPLOYMENT_TYPE"
                echo "Total time saved: ~$(( (5-i) * 8 )) seconds"
                
                # Show final status
                docker-compose --profile production ps
                exit 0
            fi
        fi
        
        sleep 8
    done
    
    echo "❌ Health check failed"
    echo "📊 Service status:"
    docker-compose --profile production ps
    echo "📋 Recent logs:"
    docker-compose --profile production logs --tail=30
    exit 1
fi

echo "✅ Smart deployment completed!"