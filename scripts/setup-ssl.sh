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

# Check if domain resolves to current server
check_domain_dns() {
    local domain=$1
    log "Checking DNS resolution for ${domain}..."
    
    # Get current server IP
    local server_ip=$(curl -s http://checkip.amazonaws.com/ || curl -s http://ipinfo.io/ip)
    log "Server IP: ${server_ip}"
    
    # Check if domain resolves to this server
    local domain_ip=$(nslookup ${domain} | grep "Address:" | grep -v "#53" | tail -1 | awk '{print $2}' 2>/dev/null || echo "")
    
    if [ "$domain_ip" = "$server_ip" ]; then
        log "✅ Domain ${domain} correctly points to this server (${server_ip})"
        return 0
    else
        warn "⚠️ Domain ${domain} does not point to this server"
        warn "   Domain IP: ${domain_ip:-"NOT_FOUND"}"
        warn "   Server IP: ${server_ip}"
        warn "   SSL setup will use HTTP challenge method"
        return 1
    fi
}

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

# Check DNS configuration
if ! check_domain_dns ${DOMAIN}; then
    warn "DNS not configured properly. You need to:"
    warn "1. Point ${DOMAIN} A record to your server IP"
    warn "2. Point www.${DOMAIN} CNAME record to ${DOMAIN}"
    warn "3. Wait for DNS propagation (5-30 minutes)"
    warn ""
    warn "For now, continuing with webroot challenge setup..."
fi

# Create certbot directories
mkdir -p data/certbot/www
mkdir -p data/certbot/conf

# Don't stop nginx - use webroot challenge instead
log "Using webroot challenge method (keeping nginx running)..."

# Install certbot if not present
if ! command -v certbot &> /dev/null; then
    log "Installing certbot..."
    sudo apt-get update
    sudo apt-get install -y certbot
fi

# Request SSL certificate using webroot
log "Requesting SSL certificate for ${DOMAIN}..."
sudo certbot certonly \
    --webroot \
    --webroot-path=/opt/restaurant-web/data/certbot/www \
    --email ${EMAIL} \
    --agree-tos \
    --no-eff-email \
    --domains ${DOMAIN},www.${DOMAIN} \
    --cert-name ${DOMAIN} || {
        warn "SSL certificate request failed (likely DNS not configured)"
        warn "Setting up infrastructure for when DNS is ready..."
        log "Creating dummy certificates for testing..."
        
        # Create dummy certificates for testing
        sudo mkdir -p /etc/letsencrypt/live/${DOMAIN}/
        sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout /tmp/dummy-privkey.pem \
            -out /tmp/dummy-cert.pem \
            -subj "/CN=${DOMAIN}"
        sudo cp /tmp/dummy-cert.pem /etc/letsencrypt/live/${DOMAIN}/fullchain.pem
        sudo cp /tmp/dummy-privkey.pem /etc/letsencrypt/live/${DOMAIN}/privkey.pem
        sudo rm /tmp/dummy-*.pem
    }

# Copy certificates to docker volumes
log "Copying SSL certificates to docker volumes..."
sudo mkdir -p ./data/certbot/conf/live/${DOMAIN}/
sudo cp /etc/letsencrypt/live/${DOMAIN}/* ./data/certbot/conf/live/${DOMAIN}/
sudo chown -R $(id -u):$(id -g) ./data/certbot/conf/

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

# Test SSL configuration
log "Testing SSL configuration..."

# Check if we have real or dummy certificates
if sudo test -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem; then
    # Test with curl but allow self-signed certs for dummy certificates
    if curl -sSf -k https://${DOMAIN}/api/v1/health/ > /dev/null 2>&1; then
        log "✅ SSL infrastructure setup successful!"
        if [[ $(sudo openssl x509 -in /etc/letsencrypt/live/${DOMAIN}/fullchain.pem -text -noout | grep "Issuer:" | grep -i "let's encrypt") ]]; then
            log "✅ Real Let's Encrypt certificate installed!"
            log "✅ Your site is now available at: https://${DOMAIN}"
        else
            warn "⚠️ Using dummy certificate (DNS not configured)"
            log "To get real SSL certificate:"
            log "1. Configure DNS to point ${DOMAIN} to this server"
            log "2. Run: ./scripts/deploy.sh setup-ssl"
        fi
        log "✅ API health check: https://${DOMAIN}/api/v1/health/"
    else
        warn "SSL setup completed but HTTPS test failed"
        log "This might be due to DNS propagation or nginx configuration"
    fi
else
    err "SSL certificate installation failed"
fi

log "📋 SSL Summary:"
log "  Domain: ${DOMAIN}"
log "  Certificate: /etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
log "  Private Key: /etc/letsencrypt/live/${DOMAIN}/privkey.pem"
log "  Auto-renewal: certbot renew (add to crontab if needed)"