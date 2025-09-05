#!/bin/bash

# Initialize Let's Encrypt certificates for production deployment
# This script should be run once on the EC2 instance before the first deployment

if [ -z "$DOMAIN" ]; then
    echo "❌ DOMAIN environment variable is required"
    exit 1
fi

# Skip email requirement for Let's Encrypt
EMAIL_PARAM=""
if [ -n "$EMAIL" ]; then
    EMAIL_PARAM="--email $EMAIL"
else
    EMAIL_PARAM="--register-unsafely-without-email"
fi

echo "🔧 Initializing Let's Encrypt for domain: $DOMAIN"

# Create required directories
sudo mkdir -p /opt/restaurant-web/data/{certbot/conf,certbot/www}
sudo chown -R $(whoami):$(whoami) /opt/restaurant-web/data

# Create temporary nginx configuration for initial certificate request
cat > /tmp/nginx-init.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    server {
        listen 80;
        server_name DOMAIN_PLACEHOLDER;
        
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        
        location / {
            return 200 'Initializing SSL certificate...\n';
            add_header Content-Type text/plain;
        }
    }
}
EOF

# Replace placeholder with actual domain
sed "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /tmp/nginx-init.conf > /opt/restaurant-web/nginx-init.conf

# Start temporary nginx container
echo "🌐 Starting temporary nginx for certificate request..."
docker run -d \
    --name temp-nginx \
    -p 80:80 \
    -v /opt/restaurant-web/nginx-init.conf:/etc/nginx/nginx.conf:ro \
    -v /opt/restaurant-web/data/certbot/www:/var/www/certbot:ro \
    nginx:1.25-alpine

# Wait for nginx to start
sleep 5

# Request certificate
echo "📜 Requesting SSL certificate for $DOMAIN..."
docker run --rm \
    -v /opt/restaurant-web/data/certbot/conf:/etc/letsencrypt \
    -v /opt/restaurant-web/data/certbot/www:/var/www/certbot \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    $EMAIL_PARAM \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

# Check if certificate was created
if [ -f "/opt/restaurant-web/data/certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
    echo "✅ SSL certificate successfully created for $DOMAIN"
    
    # Clean up temporary nginx
    docker stop temp-nginx
    docker rm temp-nginx
    rm /opt/restaurant-web/nginx-init.conf
    
    echo "🎉 Ready for production deployment!"
    echo "You can now run: docker-compose up -d"
else
    echo "❌ Failed to create SSL certificate"
    docker stop temp-nginx
    docker rm temp-nginx
    exit 1
fi