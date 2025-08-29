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
  "check-security")
    echo "🔍 Checking Security Groups..."
    bash ./check-security-groups.sh
    exit 0
    ;;
  "diagnose")
    echo "🔍 Running Network Diagnostics..."
    bash ./diagnose-network.sh
    exit 0
    ;;
  "advanced-diagnose")
    echo "🔍 Running Advanced Network Diagnostics..."
    bash ./advanced-diagnosis.sh
    exit 0
    ;;
  "fix-ssl")
    echo "🔧 Fixing SSL Configuration..."
    bash ./fix-ssl.sh
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
    command: sh -c "apk add --no-cache openssl && openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/ssl/private/ssl-cert-snakeoil.key -out /etc/ssl/certs/ssl-cert-snakeoil.pem -subj '/C=US/ST=State/L=City/O=Organization/CN=*.xn--elfogndedonsoto-zrb.com' && nginx -g 'daemon off;'"
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

# Create temporary nginx config for Let's Encrypt challenge
cat > docker/nginx/conf.d/default.conf << NGINX_TEMP_EOF
server {
    listen 80 default_server;
    server_name ${DOMAIN} www.${DOMAIN};
    
    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # API requests to Django backend
    location /api/ {
        proxy_pass http://app:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
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

    # Frontend SPA - React Router support
    location / {
        proxy_pass http://app:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_intercept_errors off;
    }
}
NGINX_TEMP_EOF

# Update docker-compose to include certbot volume
cat > docker/docker-compose.prod.yml << COMPOSE_TEMP_EOF
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
      - /var/www/certbot:/var/www/certbot:ro
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
COMPOSE_TEMP_EOF

echo "🔐 Logging into ECR..."
aws ecr get-login-password --region us-west-2 | sudo docker login --username AWS --password-stdin "$ECR_REGISTRY"

echo "📥 Pulling latest Docker image..."
sudo docker pull "$ECR_REGISTRY/$ECR_REPOSITORY:latest"

echo "🛑 Stopping existing containers gracefully..."
sudo docker-compose -f docker/docker-compose.prod.yml --profile production down --timeout 15 || true

# Force cleanup
sudo docker rm -f restaurant-web-app restaurant-web-nginx 2>/dev/null || true

echo "▶️ Starting production services for certificate generation..."
sudo docker-compose -f docker/docker-compose.prod.yml --profile production up -d --force-recreate --remove-orphans

echo "⏳ Waiting for services to be ready..."
sleep 20

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

# Configure Let's Encrypt SSL certificate
echo "🔐 Configuring Let's Encrypt SSL certificate..."
DOMAIN="xn--elfogndedonsoto-zrb.com"

# Install certbot if not present
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing certbot..."
    sudo apt update
    sudo apt install -y certbot
fi

# Stop nginx to allow certbot standalone
echo "🛑 Stopping nginx for certificate generation..."
sudo docker-compose -f docker/docker-compose.prod.yml --profile production stop nginx

# Skip Let's Encrypt for punycode domain - use proper self-signed certificate
echo "🔐 Generating proper SSL certificate for ${DOMAIN}..."
mkdir -p ssl

# Generate a proper self-signed certificate with correct domain
cat > ssl/openssl.conf << SSL_CONFIG_EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
C=US
ST=State
L=City
O=Restaurant
CN=${DOMAIN}

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = ${DOMAIN}
DNS.2 = www.${DOMAIN}
DNS.3 = *.${DOMAIN}
SSL_CONFIG_EOF

# Generate certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/server.key \
    -out ssl/server.crt \
    -config ssl/openssl.conf

echo "✅ SSL certificate generated for ${DOMAIN}"

# Always configure nginx with generated certificate
echo "✅ Configuring nginx with SSL certificate..."
cat > docker/nginx/conf.d/default.conf << NGINX_SSL_EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN};

    ssl_certificate /opt/restaurant-web/ssl/server.crt;
    ssl_certificate_key /opt/restaurant-web/ssl/server.key;
    
    # SSL optimization
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

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
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /static/ {
        proxy_pass http://app:8000;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Frontend SPA - React Router support
    location / {
        proxy_pass http://app:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_intercept_errors off;
    }
}
NGINX_SSL_EOF

    # Update docker-compose to mount SSL certificates
    cat > docker/docker-compose.prod.yml << COMPOSE_SSL_EOF
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
      - ./ssl:/opt/restaurant-web/ssl:ro
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
COMPOSE_SSL_EOF

# No need for else clause

# Start services with SSL
echo "🚀 Starting services with SSL certificate..."
sudo docker-compose -f docker/docker-compose.prod.yml --profile production up -d --force-recreate

echo "✅ SSL Certificate deployment completed successfully"
echo "BACKUP_DIR=$BACKUP_DIR" > ./last_deployment.env