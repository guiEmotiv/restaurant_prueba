#!/bin/bash

# SSL Setup Script for Restaurant Web
# This script configures SSL certificates for both unicode and punycode domains

set -e

echo "🔐 CONFIGURANDO SSL PARA RESTAURANT WEB"
echo "======================================"

PUNYCODE_DOMAIN="xn--elfogndedonsoto-zrb.com"
UNICODE_DOMAIN="elfogóndedonsoto.com"

# Install certbot if not present
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing certbot..."
    sudo apt update
    sudo apt install -y certbot python3-certbot-nginx
fi

# Stop nginx temporarily
echo "🛑 Stopping Nginx for certificate generation..."
sudo docker-compose -f docker/docker-compose.prod.yml --profile production stop nginx

# Generate certificates for both domains
echo "🔐 Generating SSL certificates..."

# Try punycode domain first
sudo certbot certonly --standalone --non-interactive --agree-tos \
    --email admin@${PUNYCODE_DOMAIN} \
    -d ${PUNYCODE_DOMAIN} -d www.${PUNYCODE_DOMAIN} || echo "❌ Punycode certificate failed"

# Try unicode domain (only if DNS is configured)
echo "🌐 Testing DNS for unicode domain..."
if nslookup www.${UNICODE_DOMAIN} >/dev/null 2>&1; then
    echo "✅ Unicode domain resolves, generating certificate..."
    sudo certbot certonly --standalone --non-interactive --agree-tos \
        --email admin@${UNICODE_DOMAIN} \
        -d ${UNICODE_DOMAIN} -d www.${UNICODE_DOMAIN} || echo "❌ Unicode certificate failed"
else
    echo "⚠️ Unicode domain DNS not configured yet"
fi

# Update Nginx configuration with SSL
echo "🔧 Updating Nginx configuration for SSL..."
cat > docker/nginx/conf.d/default.conf << NGINX_SSL_EOF
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name ${PUNYCODE_DOMAIN} www.${PUNYCODE_DOMAIN} ${UNICODE_DOMAIN} www.${UNICODE_DOMAIN};
    return 301 https://\$host\$request_uri;
}

# HTTPS server for punycode domain
server {
    listen 443 ssl http2;
    server_name ${PUNYCODE_DOMAIN} www.${PUNYCODE_DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${PUNYCODE_DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${PUNYCODE_DOMAIN}/privkey.pem;
    
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
echo "🔧 Updating docker-compose for SSL..."
cat >> docker/docker-compose.prod.yml << SSL_VOLUME_EOF

# Add SSL certificate volumes to nginx service
  nginx:
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
SSL_VOLUME_EOF

echo "🚀 Restarting services with SSL..."
sudo docker-compose -f docker/docker-compose.prod.yml --profile production up -d --force-recreate

echo "✅ SSL configuration completed!"
echo ""
echo "🌐 Your site should now be available at:"
echo "  - https://www.${PUNYCODE_DOMAIN}"
if nslookup www.${UNICODE_DOMAIN} >/dev/null 2>&1; then
    echo "  - https://www.${UNICODE_DOMAIN}"
fi