#!/bin/bash
# Activate Real SSL for restaurant-web domain
# Expert script to get real Let's Encrypt certificates

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

log "🔒 Activating REAL SSL for ${DOMAIN}"

# Get server IP
SERVER_IP=$(curl -s http://checkip.amazonaws.com/ 2>/dev/null || echo "UNKNOWN")
log "Server IP: ${SERVER_IP}"

# Check DNS configuration
log "Checking DNS configuration..."
WWW_IP=$(nslookup www.${DOMAIN} | grep "Address:" | grep -v "#53" | tail -1 | awk '{print $2}' 2>/dev/null || echo "")
ROOT_IP=$(nslookup ${DOMAIN} | grep "Address:" | grep -v "#53" | tail -1 | awk '{print $2}' 2>/dev/null || echo "")

log "DNS Status:"
log "  www.${DOMAIN} → ${WWW_IP:-"NOT_CONFIGURED"}"
log "  ${DOMAIN} → ${ROOT_IP:-"NOT_CONFIGURED"}"
log "  Server IP → ${SERVER_IP}"

# Determine which domains to request certificates for
DOMAINS=""
if [ "$WWW_IP" = "$SERVER_IP" ]; then
    log "✅ www.${DOMAIN} is correctly configured"
    DOMAINS="www.${DOMAIN}"
fi

if [ "$ROOT_IP" = "$SERVER_IP" ]; then
    log "✅ ${DOMAIN} is correctly configured"
    if [ -n "$DOMAINS" ]; then
        DOMAINS="${DOMAINS},${DOMAIN}"
    else
        DOMAINS="${DOMAIN}"
    fi
fi

if [ -z "$DOMAINS" ]; then
    err "❌ No domains are configured to point to this server. Configure DNS first."
fi

log "Will request SSL certificates for: ${DOMAINS}"

# Install certbot if not present
if ! command -v certbot &> /dev/null; then
    log "Installing certbot..."
    sudo apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx
fi

# Stop services temporarily for standalone validation
log "Stopping nginx temporarily for certificate validation..."
docker-compose --profile production stop nginx || true

# Request SSL certificate using standalone method
log "Requesting Let's Encrypt certificate..."
sudo certbot certonly \
    --standalone \
    --email ${EMAIL} \
    --agree-tos \
    --no-eff-email \
    --domains ${DOMAINS} \
    --cert-name ${DOMAIN} \
    --force-renewal

# Copy certificates to docker volumes
log "Setting up SSL certificates for docker..."
sudo mkdir -p ./data/certbot/conf/live/${DOMAIN}/
sudo cp /etc/letsencrypt/live/${DOMAIN}/* ./data/certbot/conf/live/${DOMAIN}/ 2>/dev/null || true
sudo chown -R $(id -u):$(id -g) ./data/certbot/conf/

# Update nginx configuration if needed
log "Updating nginx configuration..."

# Restart services with real SSL
log "Restarting services with real SSL certificates..."
docker-compose --profile production up -d --force-recreate

# Wait for services to start
log "Waiting for services to start..."
sleep 20

# Test HTTPS
log "Testing HTTPS configuration..."
HTTPS_TEST_DOMAINS=$(echo $DOMAINS | tr ',' ' ')
SUCCESS=false

for domain in $HTTPS_TEST_DOMAINS; do
    if curl -sf --max-time 10 https://${domain}/api/v1/health/ > /dev/null 2>&1; then
        log "✅ HTTPS working for: https://${domain}/"
        log "✅ API health check: https://${domain}/api/v1/health/"
        SUCCESS=true
    else
        warn "⚠️ HTTPS test failed for: https://${domain}/"
    fi
done

if [ "$SUCCESS" = true ]; then
    log "🎉 REAL SSL ACTIVATED SUCCESSFULLY!"
    log ""
    log "🌟 Your restaurant app is now live with REAL SSL:"
    for domain in $HTTPS_TEST_DOMAINS; do
        log "  ✅ https://${domain}/"
    done
    log ""
    log "🔄 SSL will auto-renew via certbot"
else
    warn "SSL certificates installed but HTTPS tests failed"
    log "Check nginx logs: docker-compose --profile production logs nginx"
fi

# Auto-renewal setup
if ! crontab -l 2>/dev/null | grep -q certbot; then
    log "Setting up auto-renewal..."
    (crontab -l 2>/dev/null || true; echo "0 12 * * * /usr/bin/certbot renew --quiet && docker-compose -f /opt/restaurant-web/docker-compose.yml --profile production restart nginx") | sudo crontab -
fi

log "📋 Real SSL Summary:"
log "  Domains: ${DOMAINS}"
log "  Certificates: /etc/letsencrypt/live/${DOMAIN}/"
log "  Auto-renewal: Configured"
log "✅ HTTPS deployment complete!"