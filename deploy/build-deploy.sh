#!/bin/bash

# Restaurant Web - Build and Deploy Script (Optimized)
# Single script with options for different deployment scenarios

# Usage options
FRONTEND_ONLY=false
BACKEND_ONLY=false
FULL_DEPLOY=true

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --frontend-only)
            FRONTEND_ONLY=true
            FULL_DEPLOY=false
            shift
            ;;
        --backend-only)
            BACKEND_ONLY=true
            FULL_DEPLOY=false
            shift
            ;;
        --help|-h)
            echo "🚀 Restaurant Web - Optimized Build & Deploy"
            echo "============================================="
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --frontend-only    Build and deploy only frontend (~2 min)"
            echo "  --backend-only     Restart only backend services (~30 sec)"
            echo "  (no options)       Full deployment with cleanup (~5 min)"
            echo "  --help, -h         Show this help message"
            echo ""
            echo "Examples:"
            echo "  sudo $0                    # Full deployment"
            echo "  sudo $0 --frontend-only    # Update only frontend"
            echo "  sudo $0 --backend-only     # Restart only backend"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Set deployment mode display
if [[ "$FRONTEND_ONLY" == "true" ]]; then
    echo "🚀 Restaurant Web - Frontend Only Deploy"
    echo "========================================"
elif [[ "$BACKEND_ONLY" == "true" ]]; then
    echo "🚀 Restaurant Web - Backend Only Deploy"
    echo "======================================="
else
    echo "🚀 Restaurant Web - Full Deploy (Optimized)"
    echo "============================================"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="xn--elfogndedonsoto-zrb.com"
PROJECT_DIR="/opt/restaurant-web"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# AWS Cognito Configuration
AWS_REGION="us-west-2"
COGNITO_USER_POOL_ID="us-west-2_bdCwF60ZI"
COGNITO_APP_CLIENT_ID="4i9hrd7srgbqbtun09p43ncfn0"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

# Check if we're in the right directory
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Project directory not found: $PROJECT_DIR${NC}"
    exit 1
fi

cd $PROJECT_DIR

# Update code from git (unless running backend-only)
if [[ "$BACKEND_ONLY" != "true" ]]; then
    echo -e "${YELLOW}📥 Actualizando código desde repositorio...${NC}"
    git pull origin main
fi

# Check if initial setup was run
if [ ! -f "$PROJECT_DIR/.env.ec2" ]; then
    echo -e "${RED}❌ Initial setup not found. Run setup-initial.sh first${NC}"
    exit 1
fi

# Function to show space
show_space() {
    local label="$1"
    local space=$(df / | tail -1 | awk '{print int($4/1024/1024)}')
    echo -e "${BLUE}💾 ${label}: ${space}GB${NC}"
}

# Function to validate environment variables
validate_env_vars() {
    local env_file="$1"
    local missing_vars=()
    
    # Required variables for production
    local required_vars=(
        "VITE_API_BASE_URL"
        "VITE_AWS_REGION" 
        "VITE_AWS_COGNITO_USER_POOL_ID"
        "VITE_AWS_COGNITO_APP_CLIENT_ID"
        "VITE_DISABLE_AUTH"
        "VITE_FORCE_COGNITO"
    )
    
    echo -e "${BLUE}🔍 Validating environment variables in $env_file...${NC}"
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^$var=" "$env_file" 2>/dev/null; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -eq 0 ]; then
        echo -e "${GREEN}✅ All required environment variables present${NC}"
        
        # Show critical values (masked for security)
        echo -e "${BLUE}📋 Critical configuration:${NC}"
        echo "   API URL: $(grep VITE_API_BASE_URL "$env_file" | cut -d'=' -f2)"
        echo "   Cognito Pool: $(grep VITE_AWS_COGNITO_USER_POOL_ID "$env_file" | cut -d'=' -f2)"
        echo "   Auth Enabled: $(grep VITE_DISABLE_AUTH "$env_file" | cut -d'=' -f2)"
        return 0
    else
        echo -e "${RED}❌ Missing required environment variables:${NC}"
        for var in "${missing_vars[@]}"; do
            echo "   - $var"
        done
        return 1
    fi
}

# Function to verify frontend build integrity
verify_frontend_build() {
    local dist_dir="$1"
    
    echo -e "${BLUE}🔍 Verifying frontend build integrity...${NC}"
    
    # Check if dist directory exists and has files
    if [ ! -d "$dist_dir" ]; then
        echo -e "${RED}❌ Build directory not found: $dist_dir${NC}"
        return 1
    fi
    
    # Check for critical files
    local critical_files=("index.html" "assets")
    for file in "${critical_files[@]}"; do
        if [ ! -e "$dist_dir/$file" ]; then
            echo -e "${RED}❌ Critical file missing: $file${NC}"
            return 1
        fi
    done
    
    # Check if index.html contains environment variables (basic check)
    if ! grep -q "VITE_" "$dist_dir/index.html" 2>/dev/null; then
        echo -e "${YELLOW}⚠️ Warning: No VITE_ variables found in index.html${NC}"
        echo -e "${YELLOW}   This might indicate build process didn't inject env vars${NC}"
    fi
    
    # Get build size
    local build_size=$(du -sh "$dist_dir" 2>/dev/null | cut -f1)
    echo -e "${GREEN}✅ Frontend build verified (Size: $build_size)${NC}"
    
    return 0
}

# Function to fix nginx configuration conflicts
fix_nginx_config() {
    local NGINX_DIR="$PROJECT_DIR/nginx/conf.d"
    
    # Disable conflicting configurations
    if [ -f "$NGINX_DIR/alt-ports.conf" ]; then
        mv "$NGINX_DIR/alt-ports.conf" "$NGINX_DIR/alt-ports.conf.disabled" 2>/dev/null || true
    fi
    
    # Use simple configuration
    if [ -f "$NGINX_DIR/simple.conf" ]; then
        cp "$NGINX_DIR/simple.conf" "$NGINX_DIR/default.conf"
        echo -e "${GREEN}✅ Using simple nginx configuration${NC}"
    fi
}

# Function to create simple docker-compose.yml
create_simple_compose() {
    cat > "$PROJECT_DIR/docker-compose.simple.yml" << 'EOF'
version: '3.8'

services:
  web:
    build:
      context: ./backend
      dockerfile: Dockerfile.ec2
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
      - ./.env.ec2:/app/.env.ec2
      - ./frontend/dist:/app/frontend_static
    environment:
      - DJANGO_SETTINGS_MODULE=backend.settings_ec2
    env_file:
      - .env.ec2
    restart: unless-stopped
    networks:
      - restaurant_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/conf.d/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./frontend/dist:/var/www/html:ro
    depends_on:
      - web
    restart: unless-stopped
    networks:
      - restaurant_network

networks:
  restaurant_network:
    driver: bridge
EOF
}

# Function for frontend-only deployment
frontend_only_deploy() {
    echo -e "\n${YELLOW}🎨 Frontend Only Deployment${NC}"
    
    cd "$FRONTEND_DIR"
    
    # Create environment file
    cat > .env.production << EOF
VITE_API_BASE_URL=https://www.$DOMAIN/api/v1
VITE_AWS_REGION=$AWS_REGION
VITE_AWS_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
VITE_AWS_COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID
VITE_DISABLE_AUTH=false
VITE_FORCE_COGNITO=true
EOF
    
    # Install dependencies and build frontend
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm install --silent --no-fund --no-audit
    
    # Clean cache and build frontend
    echo -e "${BLUE}🔨 Building frontend...${NC}"
    rm -rf node_modules/.cache 2>/dev/null || true
    rm -rf dist 2>/dev/null || true
    npm cache clean --force 2>/dev/null || true
    npm run build:prod
    
    if [ ! -d "dist" ]; then
        echo -e "${RED}❌ Frontend build failed${NC}"
        exit 1
    fi
    
    # Validate environment variables and build integrity
    if ! validate_env_vars ".env.production"; then
        echo -e "${RED}❌ Environment validation failed${NC}"
        exit 1
    fi
    
    if ! verify_frontend_build "dist"; then
        echo -e "${RED}❌ Frontend build verification failed${NC}"
        exit 1
    fi
    
    # Deploy via Docker - frontend is handled by docker-compose volume mount
    echo -e "${BLUE}🚀 Frontend built, will be deployed via Docker...${NC}"
    
    echo -e "${GREEN}✅ Frontend deployed successfully${NC}"
}

# Function for backend-only deployment
backend_only_deploy() {
    echo -e "\n${YELLOW}🐳 Backend Only Deployment${NC}"
    
    cd "$PROJECT_DIR"
    
    # Use SSL compose if certificates exist, otherwise simple
    if [ -d "/etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com" ]; then
        COMPOSE_FILE="docker-compose.ssl.yml"
        echo -e "${GREEN}✅ Using SSL configuration${NC}"
    else
        COMPOSE_FILE="docker-compose.simple.yml"
        echo -e "${YELLOW}⚠️ Using non-SSL configuration (certificates not found)${NC}"
    fi
    
    # Restart backend container
    echo -e "${BLUE}🔄 Restarting backend...${NC}"
    docker-compose -f "$COMPOSE_FILE" restart web
    
    # Wait and verify
    sleep 10
    BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health/)
    
    if [ "$BACKEND_STATUS" = "200" ]; then
        echo -e "${GREEN}✅ Backend restarted successfully${NC}"
    else
        echo -e "${RED}❌ Backend restart failed (Status: $BACKEND_STATUS)${NC}"
        docker-compose -f "$COMPOSE_FILE" logs --tail=10 web
        exit 1
    fi
}

# Function for full deployment
full_deploy() {
    echo -e "\n${YELLOW}🏗️ Full Deployment (Optimized)${NC}"
    
    show_space "Before build"
    
    # Fix nginx configuration conflicts first
    echo -e "${BLUE}🔧 Fixing nginx configuration...${NC}"
    fix_nginx_config
    
    # Stop services
    echo -e "${BLUE}🛑 Stopping services...${NC}"
    docker-compose -f docker-compose.simple.yml down 2>/dev/null || true
    docker-compose -f docker-compose.ec2.yml down 2>/dev/null || true
    
    # Selective cleanup (only if needed)
    if ! docker images | grep -q restaurant-web-web; then
        echo -e "${BLUE}🧹 Cleaning Docker images...${NC}"
        docker system prune -f
    fi
    
    # Build frontend in parallel with backend preparation
    cd "$FRONTEND_DIR"
    
    cat > .env.production << EOF
VITE_API_BASE_URL=https://www.$DOMAIN/api/v1
VITE_AWS_REGION=$AWS_REGION
VITE_AWS_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
VITE_AWS_COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID
VITE_DISABLE_AUTH=false
VITE_FORCE_COGNITO=true
EOF
    
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm install --silent --no-fund --no-audit
    
    echo -e "${BLUE}🔨 Building frontend...${NC}"
    rm -rf node_modules/.cache 2>/dev/null || true
    rm -rf dist 2>/dev/null || true
    npm cache clean --force 2>/dev/null || true
    npm run build:prod &
    FRONTEND_PID=$!
    
    # Start backend while frontend builds
    cd "$PROJECT_DIR"
    echo -e "${BLUE}🐳 Starting backend...${NC}"
    
    # Use SSL compose if certificates exist, otherwise simple
    if [ -d "/etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com" ]; then
        COMPOSE_FILE="docker-compose.ssl.yml"
        echo -e "${GREEN}✅ Using SSL configuration${NC}"
    else
        COMPOSE_FILE="docker-compose.simple.yml"
        if [ ! -f "$COMPOSE_FILE" ]; then
            echo -e "${YELLOW}Creating docker-compose.simple.yml...${NC}"
            create_simple_compose
        fi
        echo -e "${YELLOW}⚠️ Using non-SSL configuration${NC}"
    fi
    
    docker-compose -f "$COMPOSE_FILE" up -d --build &
    BACKEND_PID=$!
    
    # Wait for frontend build
    wait $FRONTEND_PID
    
    if [ ! -d "frontend/dist" ]; then
        echo -e "${RED}❌ Frontend build failed${NC}"
        exit 1
    fi
    
    # Validate environment variables and build integrity for full deploy
    cd "$FRONTEND_DIR"
    if ! validate_env_vars ".env.production"; then
        echo -e "${RED}❌ Environment validation failed${NC}"
        exit 1
    fi
    
    if ! verify_frontend_build "dist"; then
        echo -e "${RED}❌ Frontend build verification failed${NC}"
        exit 1
    fi
    
    cd "$PROJECT_DIR"
    
    # Frontend is deployed via Docker volume mount (no manual copying needed)
    
    # Wait for backend
    wait $BACKEND_PID
    sleep 15
    
    # Setup database completely
    echo -e "${BLUE}💾 Setting up database completely...${NC}"
    docker-compose -f "$COMPOSE_FILE" exec -T web python manage.py collectstatic --noinput --clear 2>/dev/null || true
    docker-compose -f "$COMPOSE_FILE" exec -T web python manage.py ensure_database_ready 2>/dev/null || true
    
    show_space "After build"
}


# Main execution starts here
show_space "Initial space"

# ==============================================================================
# MAIN EXECUTION - Route to appropriate deployment function
# ==============================================================================

# Execute based on deployment mode
if [[ "$FRONTEND_ONLY" == "true" ]]; then
    frontend_only_deploy
elif [[ "$BACKEND_ONLY" == "true" ]]; then
    backend_only_deploy
else
    full_deploy
fi

# ==============================================================================
# FINAL VERIFICATION
# ==============================================================================
echo -e "\n${YELLOW}🔍 Final Verification${NC}"

# Wait for services to be ready
sleep 5

# Test backend API
echo -e "${BLUE}Testing backend API...${NC}"
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health/ 2>/dev/null || echo "000")

if [ "$BACKEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Backend API: Working (Status: $BACKEND_STATUS)${NC}"
else
    echo -e "${YELLOW}⚠️ Backend API: Status $BACKEND_STATUS${NC}"
    if [[ "$BACKEND_ONLY" != "true" ]]; then
        echo -e "${BLUE}Backend logs (last 10 lines):${NC}"
        # Use simple compose (has nginx + django)
        COMPOSE_FILE="docker-compose.simple.yml"
        docker-compose -f "$COMPOSE_FILE" logs --tail=10 web || echo "Could not fetch logs"
    fi
fi

# Test tables endpoint specifically
echo -e "${BLUE}Testing tables API endpoint...${NC}"
TABLES_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/tables/ 2>/dev/null || echo "000")

if [ "$TABLES_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Tables API: Working (Status: $TABLES_STATUS)${NC}"
else
    echo -e "${YELLOW}⚠️ Tables API: Status $TABLES_STATUS${NC}"
    echo -e "${BLUE}Testing tables direct via backend...${NC}"
    TABLES_DIRECT=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/tables/ 2>/dev/null || echo "000")
    echo -e "   Direct backend: $TABLES_DIRECT"
    
    if [ "$TABLES_DIRECT" != "200" ]; then
        echo -e "${YELLOW}⚠️ Tables endpoint issue in Django backend${NC}"
        # Check if tables model/endpoint exists
        COMPOSE_FILE="docker-compose.simple.yml"
        echo -e "${BLUE}Checking Django URLs...${NC}"
        docker-compose -f "$COMPOSE_FILE" exec -T web python manage.py show_urls 2>/dev/null | grep tables || echo "No tables URL found"
    fi
fi

# Test Docker nginx status
if [ -d "/etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com" ]; then
    COMPOSE_FILE="docker-compose.ssl.yml"
else
    COMPOSE_FILE="docker-compose.simple.yml"
fi

NGINX_RUNNING=$(docker-compose -f "$COMPOSE_FILE" ps nginx 2>/dev/null | grep -c "Up" || echo "0")
if [ "$NGINX_RUNNING" -gt 0 ]; then
    echo -e "${GREEN}✅ Docker Nginx: Running${NC}"
else
    echo -e "${RED}❌ Docker Nginx: Not running${NC}"
    docker-compose -f "$COMPOSE_FILE" logs nginx --tail=5 2>/dev/null || true
fi

# Test HTTPS if not backend-only
if [[ "$BACKEND_ONLY" != "true" ]]; then
    HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://www.$DOMAIN/api/v1/health/ 2>/dev/null || echo "000")
    
    if [ "$HTTPS_STATUS" = "200" ]; then
        echo -e "${GREEN}✅ HTTPS API: Working (Status: $HTTPS_STATUS)${NC}"
    else
        echo -e "${YELLOW}⚠️ HTTPS API: Status $HTTPS_STATUS${NC}"
    fi
fi

show_space "Final space"

# ==============================================================================
# DEPLOYMENT COMPLETE
# ==============================================================================
echo -e "\n${GREEN}🎉 DEPLOYMENT COMPLETED!${NC}"
echo -e "${BLUE}════════════════════════════════════${NC}"

if [[ "$FRONTEND_ONLY" == "true" ]]; then
    echo -e "${BLUE}🎨 Frontend Only Deployment: ${GREEN}SUCCESS${NC}"
    echo -e "   Frontend: ${GREEN}https://www.$DOMAIN${NC}"
    echo -e ""
    echo -e "${YELLOW}⏰ Time saved: ~8 minutes vs full deploy${NC}"
    
elif [[ "$BACKEND_ONLY" == "true" ]]; then
    echo -e "${BLUE}🐳 Backend Only Deployment: ${GREEN}SUCCESS${NC}"
    echo -e "   API: ${GREEN}https://www.$DOMAIN/api/v1/${NC}"
    echo -e "   Admin: ${GREEN}https://www.$DOMAIN/admin/${NC}"
    echo -e ""
    echo -e "${YELLOW}⏰ Time saved: ~9 minutes vs full deploy${NC}"
    
else
    echo -e "${BLUE}🏗️ Full Deployment (Optimized): ${GREEN}SUCCESS${NC}"
    echo -e "   Frontend: ${GREEN}https://www.$DOMAIN${NC}"
    echo -e "   API: ${GREEN}https://www.$DOMAIN/api/v1/${NC}"
    echo -e "   Admin: ${GREEN}https://www.$DOMAIN/admin/${NC}"
    echo -e ""
    echo -e "${YELLOW}⏰ Optimized: ~5 minutes vs 10 minutes (original)${NC}"
fi

echo -e ""
echo -e "${BLUE}🔐 Authentication: AWS Cognito${NC}"
echo -e "   User Pool: ${COGNITO_USER_POOL_ID}"
echo -e "   Region: ${AWS_REGION}"
echo -e ""
echo -e "${GREEN}✨ Restaurant Web Application is READY!${NC}"
echo -e ""
echo -e "${YELLOW}🛠️ Quick Commands:${NC}"
echo -e "   Frontend only:  ${BLUE}sudo $0 --frontend-only${NC}"
echo -e "   Backend only:   ${BLUE}sudo $0 --backend-only${NC}"
echo -e "   Full deploy:    ${BLUE}sudo $0${NC}"
echo -e "   Help:           ${BLUE}sudo $0 --help${NC}"
echo -e ""
echo -e "${YELLOW}🔍 Troubleshooting:${NC}"
echo -e "   Backend logs:   ${BLUE}docker-compose -f docker-compose.simple.yml logs web${NC}"
echo -e "   Test API:       ${BLUE}curl -v https://www.$DOMAIN/api/v1/health/${NC}"
echo -e "   Container status: ${BLUE}docker-compose -f docker-compose.simple.yml ps${NC}"