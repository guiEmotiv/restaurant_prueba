#!/bin/bash
# 🔧 DYNAMIC CONFIGURATION GENERATOR
# Generates environment-specific configurations

set -e

ENV=${1:-production}
DOMAIN_NAME=${2:-"www.xn--elfogndedonsoto-zrb.com"}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    local level=$1
    shift
    case $level in
        ERROR) echo -e "${RED}❌ $@${NC}" ;;
        SUCCESS) echo -e "${GREEN}✅ $@${NC}" ;;
        WARNING) echo -e "${YELLOW}⚠️  $@${NC}" ;;
        INFO) echo -e "${BLUE}ℹ️  $@${NC}" ;;
    esac
}

# Generate dynamic nginx configuration
generate_nginx_config() {
    log INFO "Generating nginx configuration for $ENV..."
    
    # Create nginx template if it doesn't exist
    mkdir -p nginx/templates
    
    cat > nginx/templates/ssl.conf.template << 'EOF'
upstream backend {
    server ${BACKEND_HOST}:8000;
}

server {
    listen 80;
    server_name ${DOMAIN_NAME} www.${DOMAIN_NAME};
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN_NAME} www.${DOMAIN_NAME};
    
    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/${DOMAIN_NAME}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN_NAME}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Include proxy params
    include /etc/nginx/proxy_params;
    
    # API routes
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Static files
    location /static/ {
        alias /var/www/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Frontend
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF
    
    # Generate actual config from template
    BACKEND_HOST=${BACKEND_HOST:-"restaurant-backend"}
    envsubst '${DOMAIN_NAME},${BACKEND_HOST}' < nginx/templates/ssl.conf.template > nginx/conf.d/ssl.conf
    
    log SUCCESS "Nginx configuration generated"
}

# Generate dynamic ALLOWED_HOSTS
generate_allowed_hosts() {
    log INFO "Generating ALLOWED_HOSTS for $ENV..."
    
    local backend_host=${BACKEND_HOST:-"restaurant-backend"}
    local allowed_hosts="*,$(hostname -I | tr -d ' ' 2>/dev/null || echo ''),${DOMAIN_NAME},www.${DOMAIN_NAME},${backend_host},localhost,127.0.0.1"
    
    # Update .env.ec2 with new ALLOWED_HOSTS
    if [ -f ".env.ec2" ]; then
        # Remove old ALLOWED_HOSTS line and add new one
        grep -v "^ALLOWED_HOSTS=" .env.ec2 > .env.ec2.tmp || true
        echo "ALLOWED_HOSTS=${allowed_hosts}" >> .env.ec2.tmp
        mv .env.ec2.tmp .env.ec2
        
        log SUCCESS "ALLOWED_HOSTS updated: $allowed_hosts"
    else
        log ERROR ".env.ec2 file not found"
        return 1
    fi
}

# Generate Docker Compose configuration
generate_docker_config() {
    log INFO "Generating Docker Compose configuration for $ENV..."
    
    cat > docker-compose.optimized.yml << EOF
version: '3.8'

services:
  app:
    build: 
      context: ./backend
      dockerfile: Dockerfile
    image: restaurant-backend:\${IMAGE_TAG:-latest}
    container_name: restaurant-backend\${COLOR:+-\${COLOR}}
    environment:
      - ENVIRONMENT=$ENV
      - COLOR=\${COLOR:-blue}
      - DOMAIN_NAME=$DOMAIN_NAME
    env_file: .env.ec2
    volumes:
      - ./data:/app/data
      - ./backups:/app/backups
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    container_name: restaurant-nginx\${COLOR:+-\${COLOR}}
    ports:
      - "\${HTTP_PORT:-80}:80"
      - "\${HTTPS_PORT:-443}:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/proxy_params:/etc/nginx/proxy_params:ro
      - ./frontend/dist:/var/www/html:ro
      - ./backend/staticfiles:/var/www/static:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    environment:
      - BACKEND_HOST=restaurant-backend\${COLOR:+-\${COLOR}}
      - DOMAIN_NAME=$DOMAIN_NAME
    depends_on:
      app:
        condition: service_healthy
    restart: unless-stopped

  # Optional: Monitoring services
  prometheus:
    image: prom/prometheus:latest
    container_name: restaurant-prometheus\${COLOR:+-\${COLOR}}
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    ports:
      - "9090:9090"
    profiles:
      - monitoring
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: restaurant-grafana\${COLOR:+-\${COLOR}}
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=\${GRAFANA_PASSWORD:-admin}
      - GF_SERVER_DOMAIN=$DOMAIN_NAME
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana:/etc/grafana/provisioning
    ports:
      - "3000:3000"
    profiles:
      - monitoring
    restart: unless-stopped

volumes:
  grafana_data:
EOF
    
    log SUCCESS "Docker Compose configuration generated"
}

# Generate monitoring configuration
generate_monitoring_config() {
    log INFO "Generating monitoring configuration..."
    
    mkdir -p monitoring/grafana/dashboards monitoring/grafana/datasources
    
    # Prometheus configuration
    cat > monitoring/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

scrape_configs:
  - job_name: 'restaurant-backend'
    static_configs:
      - targets: ['restaurant-backend:8000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'nginx'
    static_configs:
      - targets: ['restaurant-nginx:80']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
EOF
    
    # Grafana datasource
    cat > monitoring/grafana/datasources/prometheus.yml << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
EOF
    
    log SUCCESS "Monitoring configuration generated"
}

# Generate secrets and security configuration
generate_security_config() {
    log INFO "Generating security configuration..."
    
    # Generate strong Django secret key if not exists
    if ! grep -q "DJANGO_SECRET_KEY" .env.ec2 2>/dev/null; then
        local secret_key=$(openssl rand -base64 50 | tr -d "=+/" | cut -c1-50)
        echo "DJANGO_SECRET_KEY=$secret_key" >> .env.ec2
        log SUCCESS "Django secret key generated"
    fi
    
    # Generate JWT secret if not exists
    if ! grep -q "JWT_SECRET" .env.ec2 2>/dev/null; then
        local jwt_secret=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
        echo "JWT_SECRET=$jwt_secret" >> .env.ec2
        log SUCCESS "JWT secret generated"
    fi
    
    # Set secure defaults
    cat >> .env.ec2 << EOF

# Security Settings (Auto-generated)
SECURE_SSL_REDIRECT=True
SECURE_PROXY_SSL_HEADER=HTTP_X_FORWARDED_PROTO,https
SECURE_HSTS_SECONDS=31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=True
SECURE_CONTENT_TYPE_NOSNIFF=True
SECURE_BROWSER_XSS_FILTER=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
X_FRAME_OPTIONS=DENY
EOF
    
    log SUCCESS "Security configuration generated"
}

# Main function
main() {
    echo -e "${BLUE}🔧 === DYNAMIC CONFIGURATION GENERATOR ===${NC}"
    echo "Environment: $ENV"
    echo "Domain: $DOMAIN_NAME"
    echo ""
    
    # Create directories
    mkdir -p nginx/templates monitoring backups
    
    # Generate configurations
    generate_nginx_config
    generate_allowed_hosts
    generate_docker_config
    generate_monitoring_config
    
    if [ "$ENV" = "production" ]; then
        generate_security_config
    fi
    
    echo ""
    log SUCCESS "Configuration generation completed! ✨"
    echo ""
    echo -e "${GREEN}📋 GENERATED CONFIGURATIONS${NC}"
    echo "   • Nginx SSL configuration"
    echo "   • Dynamic ALLOWED_HOSTS"
    echo "   • Docker Compose optimized"
    echo "   • Monitoring setup"
    if [ "$ENV" = "production" ]; then
        echo "   • Security hardening"
    fi
    echo ""
}

# Show usage
if [ "${1}" = "--help" ] || [ "${1}" = "-h" ]; then
    echo "Usage: $0 [environment] [domain]"
    echo ""
    echo "Arguments:"
    echo "  environment  Target environment (production, staging, development)"
    echo "  domain       Domain name for the application"
    echo ""
    echo "Examples:"
    echo "  $0 production www.example.com"
    echo "  $0 staging staging.example.com"
    echo "  $0 development localhost"
    exit 0
fi

main "$@"