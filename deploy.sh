#!/bin/bash
set -e

# 🚀 UNIFIED DEPLOYMENT SCRIPT - Restaurant Web Application
# Optimized, efficient, zero-error deployment

show_usage() {
    echo "Usage: $0 [OPTION]"
    echo "Options:"
    echo "  --dev         Start development environment"
    echo "  --prod        Deploy to production (EC2)"
    echo "  --build       Build frontend only"
    echo "  --help        Show this help"
}

# Development Environment
start_dev() {
    echo "🔧 Starting Development Environment..."
    
    # Backend (Docker)
    docker-compose up -d app
    sleep 3
    
    # Frontend (Native for hot-reload)
    echo "🌐 Frontend: http://localhost:5173"
    echo "🔧 Backend: http://localhost:8000/api/v1/"
    echo "📊 Docs: http://localhost:8000/api/v1/docs/"
    
    cd frontend && npm run dev
}

# Production Deployment
deploy_prod() {
    echo "🚀 PRODUCTION DEPLOYMENT"
    
    # Build frontend
    echo "📦 Building frontend..."
    cd frontend && npm run build && cd ..
    
    # Deploy containers
    echo "🐳 Deploying containers..."
    docker-compose down
    docker-compose up -d app nginx
    
    # Apply migrations
    echo "📊 Applying migrations..."
    sleep 10
    
    docker exec restaurant-backend python /app/backend/manage.py migrate || {
        echo "⚠️ Handling known migration issues..."
        docker exec restaurant-backend python /app/backend/manage.py migrate config 0013 --fake || true
        docker exec restaurant-backend python /app/backend/manage.py migrate operation 0021 --fake || true
        docker exec restaurant-backend python /app/backend/manage.py migrate
    }
    
    # Health check
    echo "🔍 Health Check..."
    docker ps --format "table {{.Names}}\t{{.Status}}"
    
    echo "✅ DEPLOYMENT COMPLETE!"
    echo "🌐 https://www.xn--elfogndedonsoto-zrb.com/"
}

# Build frontend only
build_frontend() {
    echo "📦 Building frontend..."
    cd frontend && npm run build
    echo "✅ Frontend built successfully"
}

# Main logic
case "${1:-}" in
    --dev)
        start_dev
        ;;
    --prod)
        deploy_prod
        ;;
    --build)
        build_frontend
        ;;
    --help)
        show_usage
        ;;
    "")
        start_dev  # Default to development
        ;;
    *)
        echo "❌ Unknown option: $1"
        show_usage
        exit 1
        ;;
esac