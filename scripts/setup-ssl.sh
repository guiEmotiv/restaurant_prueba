#!/bin/bash
# SSL Setup for restaurant-web domain
# Usage: ./scripts/setup-ssl.sh

set -e

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

# Check if on EC2
if [ ! -d "/opt/restaurant-web" ]; then
    log "Running locally - triggering SSL setup on EC2..."
    command -v gh >/dev/null || err "GitHub CLI not installed"
    gh workflow run deploy.yml -f action="setup-ssl"
    exit 0
fi

# On EC2
cd /opt/restaurant-web

log "🔒 Setting up SSL for ${DOMAIN}"

# Create certbot directories
mkdir -p data/certbot/www
mkdir -p data/certbot/conf

# Stop nginx temporarily to allow certbot standalone
log "Stopping nginx temporarily..."
docker-compose --profile production stop nginx || true

# Install certbot if not present
if ! command -v certbot &> /dev/null; then
    log "Installing certbot..."
    apt-get update
    apt-get install -y certbot
fi

# Request SSL certificate
log "Requesting SSL certificate for ${DOMAIN}..."
certbot certonly \
    --standalone \
    --email ${EMAIL} \
    --agree-tos \
    --no-eff-email \
    --domains ${DOMAIN},www.${DOMAIN} \
    --cert-path ./data/certbot/conf/live/${DOMAIN}/cert.pem \
    --key-path ./data/certbot/conf/live/${DOMAIN}/privkey.pem \
    --fullchain-path ./data/certbot/conf/live/${DOMAIN}/fullchain.pem \
    --chain-path ./data/certbot/conf/live/${DOMAIN}/chain.pem

# Update docker-compose to include ECR image
if grep -q "image: restaurant-web:latest" docker-compose.yml; then
    log "Updating docker-compose to use ECR image..."
    sed -i 's|image: restaurant-web:latest|image: 721063839441.dkr.ecr.us-west-2.amazonaws.com/restaurant-web:latest|g' docker-compose.yml
fi

# Restart services
log "Starting services with SSL..."
docker-compose --profile production up -d --force-recreate

# Wait for services
sleep 15

# Test SSL
log "Testing SSL configuration..."
if curl -sSf https://${DOMAIN}/api/v1/health/ > /dev/null 2>&1; then
    log "✅ SSL setup successful!"
    log "✅ Your site is now available at: https://${DOMAIN}"
    log "✅ API health check: https://${DOMAIN}/api/v1/health/"
else
    warn "SSL setup completed but HTTPS test failed"
    log "This might be due to DNS propagation - try again in a few minutes"
    log "HTTP is still available at: http://${DOMAIN}"
fi

log "📋 SSL Summary:"
log "  Domain: ${DOMAIN}"
log "  Certificate: /etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
log "  Private Key: /etc/letsencrypt/live/${DOMAIN}/privkey.pem"
log "  Auto-renewal: certbot renew (add to crontab if needed)"