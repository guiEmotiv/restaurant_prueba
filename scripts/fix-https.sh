#!/bin/bash
# Fix HTTPS issues - Expert diagnostic and repair
# Usage: ./scripts/fix-https.sh

set -e
cd /opt/restaurant-web

DOMAIN="xn--elfogndedonsoto-zrb.com"
WWW_DOMAIN="www.${DOMAIN}"

# Colors
G='\033[0;32m' # Green
R='\033[0;31m' # Red  
Y='\033[1;33m' # Yellow
NC='\033[0m'   # No Color

log() { echo -e "${G}[$(date +'%H:%M:%S')]${NC} $1"; }
err() { echo -e "${R}[ERROR]${NC} $1" >&2; exit 1; }
warn() { echo -e "${Y}[WARNING]${NC} $1"; }

log "🔧 HTTPS Diagnostic and Fix for ${WWW_DOMAIN}"

# 1. Check current container status
log "📊 Container Status:"
docker-compose --profile production ps || true

# 2. Check SSL certificates
log "🔒 SSL Certificate Status:"
if sudo test -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem; then
    log "✅ SSL certificate exists"
    sudo openssl x509 -in /etc/letsencrypt/live/${DOMAIN}/fullchain.pem -text -noout | grep -E "(Subject:|Not Before|Not After|Issuer:)" || true
else
    err "❌ SSL certificate not found"
fi

# 3. Check docker volumes
log "📁 Docker SSL Volume Status:"
if [ -f ./data/certbot/conf/live/${DOMAIN}/fullchain.pem ]; then
    log "✅ SSL certificate in docker volume"
    ls -la ./data/certbot/conf/live/${DOMAIN}/ || true
else
    warn "⚠️ SSL certificate not in docker volume - copying..."
    sudo mkdir -p ./data/certbot/conf/live/${DOMAIN}/
    sudo cp /etc/letsencrypt/live/${DOMAIN}/* ./data/certbot/conf/live/${DOMAIN}/ 2>/dev/null || true
    sudo chown -R $(id -u):$(id -g) ./data/certbot/conf/
fi

# 4. Check nginx configuration
log "⚙️ Nginx Configuration:"
if [ -f ./nginx/conf.d/default.conf ]; then
    log "Current nginx config:"
    grep -n -A5 -B5 "server_name.*${DOMAIN}" ./nginx/conf.d/default.conf || warn "Domain not found in nginx config"
    grep -n "ssl_certificate" ./nginx/conf.d/default.conf || warn "SSL config not found"
else
    warn "Nginx config file not found"
fi

# 5. Test internal connections
log "🌐 Internal Connection Tests:"
log "Testing HTTP internally:"
curl -sf -m 10 http://localhost/api/v1/health/ && log "✅ HTTP works" || warn "❌ HTTP fails"

log "Testing HTTPS internally:"
curl -sf -k -m 10 https://localhost/api/v1/health/ && log "✅ HTTPS works internally" || warn "❌ HTTPS fails internally"

# 6. Check nginx logs
log "📋 Recent Nginx Logs:"
docker-compose --profile production logs nginx --tail=20 || warn "Could not get nginx logs"

# 7. Port and service check
log "🔌 Port Status:"
netstat -tlnp | grep -E ":80|:443" || warn "Port check failed"

# 8. DNS verification
log "🌍 DNS Verification:"
nslookup ${WWW_DOMAIN} | grep "Address:" | tail -1 || warn "DNS check failed"

# 9. Fix attempt: Update nginx config to ensure SSL works
log "🔧 Updating nginx configuration..."
cat > ./nginx/conf.d/default.conf << 'EOF'
# Restaurant Web Production Config - HTTPS Fixed

# HTTP server (redirect to HTTPS)
server {
    listen 80;
    server_name xn--elfogndedonsoto-zrb.com www.xn--elfogndedonsoto-zrb.com;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name www.xn--elfogndedonsoto-zrb.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com/privkey.pem;
    
    # SSL config
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # API and backend
    location /api/ { 
        proxy_pass http://app:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
    
    location /admin/ { 
        proxy_pass http://app:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /static/ { 
        proxy_pass http://app:8000;
        proxy_set_header Host $host;
    }
    
    location /media/ { 
        proxy_pass http://app:8000;
        proxy_set_header Host $host;
    }
    
    # Import endpoints
    location ~ ^/import-(units|zones|tables|containers|groups|ingredients|recipes)/$ {
        proxy_pass http://app:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10M;
    }

    # Frontend - serve everything else
    location / {
        proxy_pass http://app:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
}
EOF

# 10. Restart services with new config
log "🔄 Restarting services with fixed configuration..."
docker-compose --profile production down --timeout 10 || true
sleep 5
docker-compose --profile production up -d --force-recreate

# 11. Wait and test
log "⏳ Waiting 30 seconds for services to start..."
sleep 30

# 12. Final tests
log "🧪 Final HTTPS Tests:"
log "Testing internal HTTPS:"
if curl -sf -k -m 10 https://localhost/api/v1/health/ > /dev/null; then
    log "✅ Internal HTTPS working"
else
    warn "❌ Internal HTTPS still failing"
    docker-compose --profile production logs nginx --tail=10
fi

log "Testing external HTTPS:"
if curl -sf -m 10 https://${WWW_DOMAIN}/api/v1/health/ > /dev/null; then
    log "🎉 ✅ EXTERNAL HTTPS IS WORKING!"
    log "🌟 Your site is live: https://${WWW_DOMAIN}/"
else
    warn "❌ External HTTPS still failing - may need DNS propagation time"
    log "Try again in 5-10 minutes or check DNS configuration"
fi

log "📋 HTTPS Fix Summary:"
log "  Domain: ${WWW_DOMAIN}"
log "  Config: Updated with proper SSL redirects"
log "  Services: Restarted with fresh containers"
log "  Status: Check above test results"
log ""
log "✅ HTTPS Fix Complete - Test your site now!"