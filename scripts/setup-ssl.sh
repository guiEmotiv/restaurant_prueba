#!/bin/bash
# Setup SSL certificates with Let's Encrypt

set -e

# Configuration
DOMAIN="xn--elfogndedonsoto-zrb.com"
EMAIL="${SSL_EMAIL:-admin@$DOMAIN}"
NGINX_CONF="/opt/restaurant-web/nginx/conf.d"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; exit 1; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Check if running on EC2
if [ ! -d "/opt/restaurant-web" ]; then
    error "This script must be run on the EC2 instance"
fi

cd /opt/restaurant-web

log "🔒 Setting up SSL certificates for $DOMAIN"

# Step 1: Install certbot if not installed
if ! command -v certbot &> /dev/null; then
    log "Installing certbot..."
    sudo apt-get update
    sudo apt-get install -y certbot python3-certbot-nginx
fi

# Step 2: Stop services temporarily
log "Stopping services..."
docker-compose --profile production down || true

# Step 3: Ensure directories exist
mkdir -p nginx/conf.d
mkdir -p data/certbot/www
mkdir -p data/certbot/conf

# Step 4: Start nginx with temporary config for Let's Encrypt
log "Creating temporary nginx config for certificate generation..."
cat > nginx/conf.d/temp-ssl.conf << 'EOF'
server {
    listen 80;
    server_name xn--elfogndedonsoto-zrb.com www.xn--elfogndedonsoto-zrb.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 404;
    }
}
EOF

# Update docker-compose to use certbot volume
cat > docker-compose.certbot.yml << 'EOF'
services:
  nginx:
    volumes:
      - ./data/certbot/www:/var/www/certbot:ro
      - ./data/certbot/conf:/etc/letsencrypt:ro
      
  certbot:
    image: certbot/certbot
    volumes:
      - ./data/certbot/www:/var/www/certbot
      - ./data/certbot/conf:/etc/letsencrypt
    command: certonly --webroot --webroot-path=/var/www/certbot --email ${SSL_EMAIL} --agree-tos --no-eff-email -d ${DOMAIN} -d www.${DOMAIN}
EOF

# Step 5: Start nginx temporarily
log "Starting temporary nginx..."
docker-compose -f docker-compose.yml -f docker-compose.certbot.yml up -d nginx

# Wait for nginx to start
sleep 5

# Step 6: Generate certificates
log "Generating SSL certificates..."
docker-compose -f docker-compose.yml -f docker-compose.certbot.yml run --rm certbot

# Step 7: Check if certificates were created
if [ ! -f "data/certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
    error "Certificate generation failed!"
fi

log "✅ Certificates generated successfully!"

# Step 8: Activate SSL configuration
log "Activating SSL configuration..."
rm -f nginx/conf.d/temp-ssl.conf
mv nginx/conf.d/default.conf nginx/conf.d/default.conf.backup || true
cp nginx/conf.d/ssl.conf nginx/conf.d/default.conf

# Step 9: Update docker-compose for production
log "Updating docker-compose for SSL..."
cat >> docker-compose.yml << 'EOF'

  # Add certbot service for auto-renewal
  certbot:
    image: certbot/certbot
    volumes:
      - ./data/certbot/www:/var/www/certbot
      - ./data/certbot/conf:/etc/letsencrypt
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
    profiles:
      - production
EOF

# Step 10: Restart with SSL
log "Restarting services with SSL..."
docker-compose --profile production down
docker-compose --profile production up -d

# Step 11: Setup auto-renewal cron
log "Setting up auto-renewal..."
(crontab -l 2>/dev/null; echo "0 0,12 * * * cd /opt/restaurant-web && docker-compose --profile production exec certbot renew --quiet") | crontab -

# Step 12: Health check
sleep 30
if curl -f -s https://$DOMAIN/api/v1/health/; then
    log "✅ SSL setup complete! Your site is now available at https://$DOMAIN"
else
    warning "Health check failed. Checking logs..."
    docker-compose --profile production logs --tail=50
fi

log "🎉 SSL Configuration Summary:"
log "  - Domain: https://$DOMAIN"
log "  - Certificates: /opt/restaurant-web/data/certbot/conf/live/$DOMAIN/"
log "  - Auto-renewal: Enabled (twice daily)"
log "  - Next steps: Update your DNS to point to this server"