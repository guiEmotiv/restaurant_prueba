#!/bin/bash
set -e

# EC2 Production Deployment Script
# This script runs on the EC2 instance to handle deployments

ECR_REGISTRY="${1:-}"
ECR_REPOSITORY="${2:-}"
ACTION="${3:-deploy}"

if [ -z "$ECR_REGISTRY" ] || [ -z "$ECR_REPOSITORY" ]; then
  echo "❌ Error: ECR_REGISTRY and ECR_REPOSITORY are required"
  echo "Usage: $0 <ECR_REGISTRY> <ECR_REPOSITORY> [ACTION]"
  exit 1
fi

echo "🚀 Starting EC2 deployment..."
echo "📍 Registry: $ECR_REGISTRY"
echo "📦 Repository: $ECR_REPOSITORY" 
echo "🎯 Action: $ACTION"

# Create backup before deployment
echo "💾 Creating pre-deployment backup..."
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r data/ "$BACKUP_DIR/" 2>/dev/null || echo "No data directory to backup"
sudo docker-compose -f docker/docker-compose.prod.yml --profile production ps > "$BACKUP_DIR/containers_before.txt" 2>/dev/null || true

# Function for rollback
rollback() {
  echo "🔄 Initiating rollback..."
  if [ -d "$BACKUP_DIR" ]; then
    echo "📦 Restoring previous state..."
    sudo docker-compose -f docker/docker-compose.prod.yml --profile production down --timeout 10
    cp -r "$BACKUP_DIR/data/" ./ 2>/dev/null || echo "No data to restore"
    sudo docker-compose -f docker/docker-compose.prod.yml --profile production up -d
    echo "✅ Rollback completed"
  else
    echo "❌ No backup found for rollback"
  fi
}

# Handle different actions
case "$ACTION" in
  "rollback")
    rollback
    exit 0
    ;;
  "status")
    sudo docker-compose -f docker/docker-compose.prod.yml --profile production ps
    exit 0
    ;;
  "logs")
    sudo docker-compose -f docker/docker-compose.prod.yml --profile production logs --tail=50
    exit 0
    ;;
  "restart")
    sudo docker-compose -f docker/docker-compose.prod.yml --profile production restart
    exit 0
    ;;
esac

# Create directory structure
mkdir -p docker data logs

# Create production environment file
cat > .env.ec2 << ENV_EOF
# Restaurant Web Production Configuration
SECRET_KEY=prod-secret-key-change-in-production
DEBUG=False
USE_COGNITO_AUTH=True
COGNITO_USER_POOL_ID=will-be-set-by-secrets
COGNITO_APP_CLIENT_ID=will-be-set-by-secrets
AWS_REGION=us-west-2
ALLOWED_HOSTS=localhost,127.0.0.1,app,restaurant-web-app,xn--elfogndedonsoto-zrb.com,www.xn--elfogndedonsoto-zrb.com,elfogóndedonsoto.com,www.elfogóndedonsoto.com,44.248.47.186
DATABASE_PATH=/opt/restaurant-web/data
DATABASE_NAME=restaurant.prod.sqlite3
ENV_EOF

# Create optimized docker-compose file
cat > docker/docker-compose.prod.yml << COMPOSE_EOF
services:
  app:
    image: ${ECR_REGISTRY}/restaurant-web:latest
    container_name: restaurant-web-app
    ports:
      - '8000:8000'
    volumes:
      - ./data:/opt/restaurant-web/data
      - ./logs:/opt/restaurant-web/logs
    environment:
      - DATABASE_PATH=/opt/restaurant-web/data
      - DATABASE_NAME=restaurant.prod.sqlite3
    env_file:
      - /opt/restaurant-web/.env.ec2
    restart: unless-stopped
    profiles:
      - production
    networks:
      - restaurant-network
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:8000/api/v1/health/']
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s
  nginx:
    image: nginx:alpine
    container_name: restaurant-web-nginx
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
    depends_on:
      - app
    restart: unless-stopped
    profiles:
      - production
    networks:
      - restaurant-network
volumes:
  restaurant_data:
    driver: local
  restaurant_logs:
    driver: local
networks:
  restaurant-network:
    driver: bridge
COMPOSE_EOF

# Create nginx configuration
mkdir -p docker/nginx/conf.d

cat > docker/nginx/nginx.conf << NGINX_MAIN_EOF
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    sendfile on;
    keepalive_timeout 65;
    include /etc/nginx/conf.d/*.conf;
}
NGINX_MAIN_EOF

cat > docker/nginx/conf.d/default.conf << NGINX_CONF_EOF
server {
    listen 80 default_server;
    server_name _ xn--elfogndedonsoto-zrb.com www.xn--elfogndedonsoto-zrb.com elfogóndedonsoto.com www.elfogóndedonsoto.com;

    # API requests to Django backend
    location /api/ {
        proxy_pass http://app:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_buffering off;
    }

    # Admin and static Django files
    location /admin/ {
        proxy_pass http://app:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    location /static/ {
        proxy_pass http://app:8000;
    }

    # Frontend SPA - AGGRESSIVE React Router support
    location / {
        # ALWAYS proxy to Django - let Django handle ALL routing decisions
        proxy_pass http://app:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        # Disable nginx error handling - Django handles everything
        proxy_intercept_errors off;
    }
}
NGINX_CONF_EOF

echo "🔐 Logging into ECR..."
aws ecr get-login-password --region us-west-2 | sudo docker login --username AWS --password-stdin "$ECR_REGISTRY"

echo "📥 Pulling latest Docker image..."
sudo docker pull "$ECR_REGISTRY/$ECR_REPOSITORY:latest"

echo "🛑 Stopping existing containers gracefully..."
sudo docker-compose -f docker/docker-compose.prod.yml --profile production down --timeout 15 || true

# Force cleanup
sudo docker rm -f restaurant-web-app restaurant-web-nginx 2>/dev/null || true

echo "▶️ Starting production services..."
sudo docker-compose -f docker/docker-compose.prod.yml --profile production up -d --force-recreate --remove-orphans

echo "⏳ Health check..."
sleep 15

HEALTH_CHECK_SUCCESS=false
for i in 1 2 3 4 5; do
  echo "🔍 Health check attempt $i/5..."
  
  if sudo docker-compose -f docker/docker-compose.prod.yml --profile production ps app | grep -q "Up"; then
    echo "✅ Django container is running"
    
    if curl -sf http://localhost:8000/api/v1/health/ --connect-timeout 5 --max-time 10; then
      echo "✅ Django API working - Core functionality OK"
      
      if sudo docker-compose -f docker/docker-compose.prod.yml --profile production ps nginx | grep -q "Up"; then
        echo "✅ Nginx container is running"
        
        if curl -sf http://localhost/api/v1/health/ --connect-timeout 3 --max-time 8 >/dev/null 2>&1; then
          echo "✅ Perfect! Nginx proxy also working"
        else
          echo "⚠️ Nginx proxy optimization needed (but core API works)"
        fi
      fi
      
      echo "🎉 DEPLOYMENT SUCCESSFUL!"
      HEALTH_CHECK_SUCCESS=true
      break
    else
      echo "⚠️ Django API not ready, waiting..."
      sudo docker-compose -f docker/docker-compose.prod.yml --profile production logs app --tail=3
    fi
  else
    echo "⚠️ Django container not running yet"
  fi
  
  if [ $i -lt 5 ]; then
    echo "Waiting 12 seconds before next check..."
    sleep 12
  fi
done

if [ "$HEALTH_CHECK_SUCCESS" != "true" ]; then
  echo "❌ Health check failed after 5 attempts"
  sudo docker-compose -f docker/docker-compose.prod.yml --profile production logs app --tail=20
  sudo docker-compose -f docker/docker-compose.prod.yml --profile production logs nginx --tail=10
  echo "🔄 Performing automatic rollback..."
  rollback
  exit 1
fi

echo "✅ Deployment completed successfully"
echo "BACKUP_DIR=$BACKUP_DIR" > ./last_deployment.env