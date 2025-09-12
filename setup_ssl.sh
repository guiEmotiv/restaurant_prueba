#!/bin/bash

echo "🔐 SSL Certificate Setup for Restaurant Web"
echo "========================================"

# Variables
DOMAIN="xn--elfogndedonsoto-zrb.com"
WWW_DOMAIN="www.xn--elfogndedonsoto-zrb.com"
EMAIL="admin@xn--elfogndedonsoto-zrb.com"  # Replace with actual email

echo "📧 Domain: $DOMAIN"
echo "📧 WWW Domain: $WWW_DOMAIN"
echo "📧 Email: $EMAIL"

# Update system packages
echo "📦 Updating system packages..."
apt update

# Install certbot and nginx plugin
echo "🔧 Installing certbot..."
apt install -y certbot python3-certbot-nginx

# Stop any existing nginx to free port 80 for certbot
echo "🛑 Stopping existing containers temporarily..."
cd /home/ubuntu/restaurant-web
docker compose -f docker-compose.production.yml down

# Create directory for Let's Encrypt challenge
echo "📁 Creating certbot directories..."
mkdir -p /var/www/certbot

# Generate SSL certificates
echo "🔐 Requesting SSL certificates from Let's Encrypt..."
certbot certonly --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d $DOMAIN \
    -d $WWW_DOMAIN

# Check if certificates were generated
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "✅ SSL certificates generated successfully!"
    echo "📍 Certificate location: /etc/letsencrypt/live/$DOMAIN/"
    
    # Set proper permissions
    chmod 755 /etc/letsencrypt/live
    chmod 755 /etc/letsencrypt/archive
    
    echo "🔄 Starting containers with SSL support..."
    docker compose -f docker-compose.production.yml up -d
    
    echo "✅ SSL setup completed!"
    echo "🌐 Your site should now be available at: https://$WWW_DOMAIN"
else
    echo "❌ SSL certificate generation failed"
    echo "🔄 Starting containers without SSL..."
    docker compose -f docker-compose.production.yml up -d
    exit 1
fi

# Setup auto-renewal
echo "🔄 Setting up automatic certificate renewal..."
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet && docker compose -f /home/ubuntu/restaurant-web/docker-compose.production.yml restart nginx") | crontab -

echo "✅ Auto-renewal configured!"
echo "🎉 SSL setup complete!"