#!/bin/bash
# Activate SSL configuration for the domain

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; exit 1; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

cd /opt/restaurant-web || error "Not on EC2"

log "🔒 Activating SSL configuration..."

# Step 1: Check current nginx config
log "Current nginx configuration:"
if [ -f nginx/conf.d/default.conf ]; then
    head -20 nginx/conf.d/default.conf
else
    warning "No default.conf found"
fi

# Step 2: Check if SSL certificates exist
log "Checking SSL certificates..."
if [ -d data/certbot/conf/live/xn--elfogndedonsoto-zrb.com ]; then
    log "✅ SSL certificates found:"
    ls -la data/certbot/conf/live/xn--elfogndedonsoto-zrb.com/
    
    # Step 3: Activate SSL configuration
    log "Activating SSL configuration..."
    curl -sSL https://raw.githubusercontent.com/guiEmotiv/restaurant-web/main/nginx/conf.d/ssl.conf -o nginx/conf.d/default.conf
    
    log "SSL configuration activated!"
else
    warning "❌ No SSL certificates found. Running SSL setup first..."
    
    # Step 4: Setup SSL if not exists
    log "Setting up SSL certificates..."
    
    # Create certbot directories
    mkdir -p data/certbot/www data/certbot/conf
    
    # Use the existing SSL config
    curl -sSL https://raw.githubusercontent.com/guiEmotiv/restaurant-web/main/nginx/conf.d/ssl.conf -o nginx/conf.d/default.conf
    
    # Create a temporary config for Let's Encrypt
    cat > nginx/conf.d/letsencrypt.conf << 'EOF'
server {
    listen 80;
    server_name xn--elfogndedonsoto-zrb.com www.xn--elfogndedonsoto-zrb.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}
EOF
    
    # Restart nginx with Let's Encrypt config
    docker-compose --profile production exec nginx nginx -s reload || docker-compose --profile production restart nginx
    
    warning "Manual step required: You need to run certbot to get certificates"
    warning "Run this command manually on the EC2 instance:"
    echo ""
    echo "sudo certbot certonly --webroot --webroot-path=/opt/restaurant-web/data/certbot/www --email admin@xn--elfogndedonsoto-zrb.com --agree-tos --no-eff-email -d xn--elfogndedonsoto-zrb.com -d www.xn--elfogndedonsoto-zrb.com"
    echo ""
fi

# Step 5: Update environment for HTTPS
log "Updating environment for HTTPS..."
if grep -q "CSRF_TRUSTED_ORIGINS" .env.ec2; then
    log "CSRF_TRUSTED_ORIGINS already configured"
else
    echo "" >> .env.ec2
    echo "# HTTPS settings" >> .env.ec2
    echo "SECURE_SSL_REDIRECT=True" >> .env.ec2
    echo "SESSION_COOKIE_SECURE=True" >> .env.ec2
    echo "CSRF_COOKIE_SECURE=True" >> .env.ec2
    echo "CSRF_TRUSTED_ORIGINS=https://xn--elfogndedonsoto-zrb.com,https://www.xn--elfogndedonsoto-zrb.com" >> .env.ec2
fi

# Step 6: Restart services
log "Restarting services with SSL..."
docker-compose --profile production restart

# Step 7: Test HTTPS
sleep 10
log "Testing HTTPS access..."
echo ""

# Test HTTP redirect
log "Testing HTTP → HTTPS redirect:"
curl -I http://localhost 2>/dev/null | grep -E "301|Location" || warning "HTTP redirect not working"

# Test HTTPS (will fail without valid cert)
log "Testing HTTPS endpoint:"
curl -k -I https://localhost 2>/dev/null | grep "200 OK" && log "✅ HTTPS is working!" || warning "HTTPS not accessible yet"

log ""
log "🌐 SSL Configuration Summary:"
log "  - Domain: https://xn--elfogndedonsoto-zrb.com"
log "  - HTTP automatically redirects to HTTPS"
log "  - Make sure your DNS points to: $(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
log ""
log "If SSL certificates are not installed yet, follow the certbot command above."