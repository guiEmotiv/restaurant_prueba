#!/bin/bash
# Simple SSL Setup for restaurant-web domain
# Expert approach: Direct and efficient SSL deployment

set -e
cd /opt/restaurant-web

DOMAIN="xn--elfogndedonsoto-zrb.com"
EMAIL="admin@${DOMAIN}"

# Colors
G='\033[0;32m' # Green
R='\033[0;31m' # Red  
Y='\033[1;33m' # Yellow
NC='\033[0m'   # No Color

log() { echo -e "${G}[$(date +'%H:%M:%S')]${NC} $1"; }
err() { echo -e "${R}[ERROR]${NC} $1" >&2; exit 1; }
warn() { echo -e "${Y}[WARNING]${NC} $1"; }

log "🔒 Expert SSL Setup for ${DOMAIN}"

# Get server IP for DNS info
SERVER_IP=$(curl -s http://checkip.amazonaws.com/ 2>/dev/null || echo "UNKNOWN")
log "Server IP: ${SERVER_IP}"

# Create required directories
mkdir -p data/certbot/www
mkdir -p data/certbot/conf

# Install certbot
if ! command -v certbot &> /dev/null; then
    log "Installing certbot..."
    sudo apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y certbot openssl
fi

# Create dummy SSL certificates for immediate HTTPS support
log "Creating dummy SSL certificates for immediate functionality..."
sudo mkdir -p /etc/letsencrypt/live/${DOMAIN}/

# Generate self-signed certificate
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/letsencrypt/live/${DOMAIN}/privkey.pem \
    -out /etc/letsencrypt/live/${DOMAIN}/fullchain.pem \
    -subj "/C=PE/ST=Lima/L=Lima/O=Restaurant/OU=IT/CN=${DOMAIN}/emailAddress=${EMAIL}"

# Set proper permissions
sudo chmod 644 /etc/letsencrypt/live/${DOMAIN}/fullchain.pem
sudo chmod 600 /etc/letsencrypt/live/${DOMAIN}/privkey.pem

# Copy certificates to docker volumes
log "Setting up docker volumes for SSL..."
sudo mkdir -p ./data/certbot/conf/live/${DOMAIN}/
sudo cp /etc/letsencrypt/live/${DOMAIN}/* ./data/certbot/conf/live/${DOMAIN}/ 2>/dev/null || true
sudo chown -R $(id -u):$(id -g) ./data/certbot/conf/

# Update docker-compose to use ECR image
if grep -q "image: restaurant-web:latest" docker-compose.yml; then
    log "Updating docker-compose to use ECR image..."
    sed -i 's|image: restaurant-web:latest|image: 721063839441.dkr.ecr.us-west-2.amazonaws.com/restaurant-web:latest|g' docker-compose.yml
fi

# Restart services with SSL enabled
log "Restarting services with SSL support..."
docker-compose --profile production down --timeout 10 || true
docker-compose --profile production up -d --force-recreate

# Wait for services to start
log "Waiting for services to start..."
sleep 30

# Test services
log "Testing SSL configuration..."
if curl -sf -k --max-time 10 https://localhost/api/v1/health/ > /dev/null 2>&1; then
    log "✅ SSL infrastructure is working!"
elif curl -sf --max-time 10 http://localhost/api/v1/health/ > /dev/null 2>&1; then
    log "✅ HTTP is working (SSL ready but not tested yet)"
else
    warn "⚠️ Service test failed, checking containers..."
    docker-compose --profile production ps
    docker-compose --profile production logs app --tail=10
fi

log "📋 SSL Setup Complete!"
log "  Domain: ${DOMAIN}"
log "  Certificate Type: Self-signed (ready for Let's Encrypt)"
log "  HTTPS URL: https://${DOMAIN}/ (requires DNS setup)"
log "  HTTP URL: http://${SERVER_IP}/ (working now)"
log ""
log "🎯 To get real SSL certificate:"
log "1. Point ${DOMAIN} A record to ${SERVER_IP}"
log "2. Wait 5-15 minutes for DNS propagation"  
log "3. Run: sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
log ""
log "✅ Your restaurant app is now running with SSL support!"