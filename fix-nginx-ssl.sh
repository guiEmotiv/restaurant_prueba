#!/bin/bash
set -e

echo "🔧 Nginx SSL Configuration Fix"
echo "=============================="

DOMAIN="xn--elfogndedonsoto-zrb.com"

# Stop all services
echo "🛑 Stopping all services..."
sudo docker-compose -f docker/docker-compose.prod.yml --profile production down || true

# Clean up any existing containers
sudo docker rm -f restaurant-web-app restaurant-web-nginx 2>/dev/null || true

# Ensure directories exist
mkdir -p ssl docker/nginx/conf.d

# Generate SSL certificate (if not exists)
echo "🔐 Ensuring SSL certificate exists..."
if [ ! -f "ssl/server.crt" ] || [ ! -f "ssl/server.key" ]; then
    echo "Generating new SSL certificate..."
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

    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/server.key \
        -out ssl/server.crt \
        -config ssl/openssl.conf
    echo "✅ New SSL certificate generated"
else
    echo "✅ SSL certificate already exists"
fi

# Verify SSL certificate files
echo "📋 Verifying SSL certificate files..."
ls -la ssl/
openssl x509 -in ssl/server.crt -noout -subject || echo "❌ Certificate verification failed"

# Create nginx configuration with correct SSL paths
echo "⚙️ Creating nginx SSL configuration..."
cat > docker/nginx/conf.d/default.conf << NGINX_CONFIG_EOF
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    return 301 https://\$server_name\$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN};

    # SSL Configuration - corrected paths
    ssl_certificate /etc/ssl/certs/server.crt;
    ssl_certificate_key /etc/ssl/private/server.key;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

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

    # Admin interface
    location /admin/ {
        proxy_pass http://app:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Static files
    location /static/ {
        proxy_pass http://app:8000;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Frontend SPA
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
NGINX_CONFIG_EOF

echo "✅ Nginx configuration created with corrected SSL paths"

# Create Docker Compose with corrected SSL volume mounts
echo "🐳 Creating Docker Compose configuration with corrected SSL mounts..."
cat > docker/docker-compose.prod.yml << COMPOSE_EOF
services:
  app:
    image: 721063839441.dkr.ecr.us-west-2.amazonaws.com/restaurant-web:latest
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
      - ./ssl/server.crt:/etc/ssl/certs/server.crt:ro
      - ./ssl/server.key:/etc/ssl/private/server.key:ro
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

echo "✅ Docker Compose updated with corrected SSL mounts"

# Start services
echo "🚀 Starting services..."
sudo docker-compose -f docker/docker-compose.prod.yml --profile production up -d --force-recreate

# Wait for services
echo "⏳ Waiting for services to start..."
sleep 20

# Check nginx status specifically
echo "🔍 Checking nginx container status..."
sudo docker-compose -f docker/docker-compose.prod.yml --profile production ps nginx

# Test SSL configuration
echo "🧪 Testing SSL configuration..."
echo "Testing internal HTTPS..."
curl -I -k --connect-timeout 10 https://localhost/api/v1/health/ || echo "❌ HTTPS test failed"

echo ""
echo "Testing internal HTTP redirect..."
curl -I --connect-timeout 10 http://localhost/api/v1/health/ || echo "❌ HTTP redirect test failed"

echo ""
echo "✅ Nginx SSL Fix Completed"
echo "🌐 Site should now be accessible at: https://www.${DOMAIN}/"