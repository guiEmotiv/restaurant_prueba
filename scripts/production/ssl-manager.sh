#!/bin/bash
# Professional SSL Certificate Management System
# Handles all SSL operations with expert-level automation
# Usage: ./scripts/ssl-manager.sh [action]

set -e
cd "$(dirname "$0")/.."

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CONFIGURATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DOMAIN="xn--elfogndedonsoto-zrb.com"
WWW_DOMAIN="www.${DOMAIN}"
EMAIL="admin@${DOMAIN}"
ACTION=${1:-status}

# Colors for professional output
readonly G='\033[0;32m' R='\033[0;31m' Y='\033[1;33m' B='\033[0;34m' NC='\033[0m'

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LOGGING FUNCTIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log() { echo -e "${G}[$(date +'%H:%M:%S')]${NC} $1"; }
err() { echo -e "${R}[ERROR]${NC} $1" >&2; exit 1; }
warn() { echo -e "${Y}[WARNING]${NC} $1"; }
info() { echo -e "${B}[INFO]${NC} $1"; }

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DNS VERIFICATION SYSTEM
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

verify_dns_configuration() {
    log "🌍 Verifying DNS configuration..."
    
    local server_ip=$(curl -s http://checkip.amazonaws.com/ 2>/dev/null || echo "UNKNOWN")
    local www_ip=$(nslookup $WWW_DOMAIN | grep "Address:" | grep -v "#53" | tail -1 | awk '{print $2}' 2>/dev/null || echo "")
    local root_ip=$(nslookup $DOMAIN | grep "Address:" | grep -v "#53" | tail -1 | awk '{print $2}' 2>/dev/null || echo "")
    
    info "DNS Status Report:"
    info "  Server IP: $server_ip"
    info "  $WWW_DOMAIN → ${www_ip:-'NOT_CONFIGURED'}"
    info "  $DOMAIN → ${root_ip:-'NOT_CONFIGURED'}"
    
    local domains=""
    if [ "$www_ip" = "$server_ip" ]; then
        domains="$WWW_DOMAIN"
        log "✅ $WWW_DOMAIN correctly configured"
    fi
    
    if [ "$root_ip" = "$server_ip" ]; then
        if [ -n "$domains" ]; then
            domains="${domains},$DOMAIN"
        else
            domains="$DOMAIN"
        fi
        log "✅ $DOMAIN correctly configured"
    fi
    
    if [ -z "$domains" ]; then
        err "❌ No domains point to this server. Configure DNS first."
    fi
    
    echo "$domains"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SSL CERTIFICATE STATUS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

check_certificate_status() {
    log "🔒 Checking SSL certificate status..."
    
    if sudo test -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem; then
        log "✅ SSL certificate exists"
        
        # Get certificate details
        local cert_info=$(sudo openssl x509 -in /etc/letsencrypt/live/${DOMAIN}/fullchain.pem -text -noout 2>/dev/null)
        local expiry=$(echo "$cert_info" | grep "Not After" | cut -d: -f2- | xargs)
        local issuer=$(echo "$cert_info" | grep "Issuer:" | cut -d= -f2- | xargs)
        
        info "Certificate Details:"
        info "  Issuer: $issuer"
        info "  Expires: $expiry"
        
        # Check if certificate expires in next 30 days
        local expiry_epoch=$(date -d "$expiry" +%s 2>/dev/null || echo "0")
        local current_epoch=$(date +%s)
        local days_left=$(( (expiry_epoch - current_epoch) / 86400 ))
        
        if [ $days_left -lt 30 ]; then
            warn "⚠️ Certificate expires in $days_left days - renewal recommended"
            return 2
        else
            log "✅ Certificate valid for $days_left days"
            return 0
        fi
    else
        warn "❌ SSL certificate not found"
        return 1
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# NGINX CONFIGURATION MANAGEMENT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

update_nginx_ssl_config() {
    log "⚙️ Updating nginx SSL configuration..."
    
    cat > ./nginx/conf.d/default.conf << 'EOF'
# Professional Restaurant Web SSL Configuration  
# NO RATE LIMITING - AWS Cognito handles authentication, unlimited requests
# Optimized for performance and security

# HTTP server (redirect to HTTPS)
server {
    listen 80;
    server_name xn--elfogndedonsoto-zrb.com www.xn--elfogndedonsoto-zrb.com;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files $uri =404;
    }

    # Security headers for HTTP
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;

    # Redirect to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server - Production optimized WITHOUT rate limiting
server {
    listen 443 ssl http2;
    server_name www.xn--elfogndedonsoto-zrb.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com/privkey.pem;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Performance optimizations
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;

    # API and backend proxying
    location /api/ { 
        proxy_pass http://app:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /admin/ { 
        proxy_pass http://app:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /static/ { 
        proxy_pass http://app:8000;
        proxy_set_header Host $host;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    location /media/ { 
        proxy_pass http://app:8000;
        proxy_set_header Host $host;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Import endpoints with increased body size
    location ~ ^/import-(units|zones|tables|containers|groups|ingredients|recipes)/$ {
        proxy_pass http://app:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
        proxy_read_timeout 300s;
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
    
    log "✅ Nginx SSL configuration updated"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SSL CERTIFICATE OPERATIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

install_certbot() {
    if ! command -v certbot &> /dev/null; then
        log "📦 Installing certbot..."
        sudo apt-get update -qq
        sudo DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx
        log "✅ Certbot installed successfully"
    else
        log "📋 Certbot already installed"
    fi
}

request_ssl_certificate() {
    local domains=$(verify_dns_configuration)
    
    log "🔒 Requesting SSL certificate for: $domains"
    
    # Stop nginx temporarily for standalone validation
    docker-compose -f docker/docker-compose.prod.yml --profile production stop nginx || true
    
    # Request certificate
    sudo certbot certonly \
        --standalone \
        --email $EMAIL \
        --agree-tos \
        --no-eff-email \
        --domains $domains \
        --cert-name $DOMAIN \
        --force-renewal
    
    # Setup docker volumes
    sudo mkdir -p ./data/certbot/conf/live/${DOMAIN}/
    sudo cp /etc/letsencrypt/live/${DOMAIN}/* ./data/certbot/conf/live/${DOMAIN}/ 2>/dev/null || true
    sudo chown -R $(id -u):$(id -g) ./data/certbot/conf/
    
    log "✅ SSL certificate installed successfully"
}

setup_auto_renewal() {
    log "🔄 Setting up automatic SSL renewal..."
    
    # Create renewal script
    cat > /tmp/ssl-renewal.sh << 'EOF'
#!/bin/bash
# Automatic SSL certificate renewal
/usr/bin/certbot renew --quiet && docker-compose -f /opt/restaurant-web/docker/docker-compose.prod.yml --profile production restart nginx
EOF
    
    sudo mv /tmp/ssl-renewal.sh /opt/ssl-renewal.sh
    sudo chmod +x /opt/ssl-renewal.sh
    
    # Add to crontab if not exists
    if ! sudo crontab -l 2>/dev/null | grep -q ssl-renewal; then
        (sudo crontab -l 2>/dev/null || true; echo "0 3 * * * /opt/ssl-renewal.sh >> /var/log/ssl-renewal.log 2>&1") | sudo crontab -
        log "✅ Auto-renewal configured (daily at 3 AM)"
    else
        log "📋 Auto-renewal already configured"
    fi
}

test_ssl_configuration() {
    log "🧪 Testing SSL configuration..."
    
    # Start services with SSL config
    update_nginx_ssl_config
    docker-compose -f docker/docker-compose.prod.yml --profile production up -d --force-recreate
    
    # Wait for services to start
    sleep 15
    
    # Test internal HTTPS
    if curl -sf -k --max-time 10 https://localhost/api/v1/health/ > /dev/null; then
        log "✅ Internal HTTPS working"
    else
        warn "❌ Internal HTTPS test failed"
        docker-compose -f docker/docker-compose.prod.yml --profile production logs nginx --tail=10
        return 1
    fi
    
    # Test external HTTPS
    if curl -sf --max-time 15 https://${WWW_DOMAIN}/api/v1/health/ > /dev/null; then
        log "🎉 ✅ EXTERNAL HTTPS IS WORKING!"
        log "🌟 Your site is live: https://${WWW_DOMAIN}/"
        return 0
    else
        warn "❌ External HTTPS test failed - may need DNS propagation time"
        return 1
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MAIN EXECUTION LOGIC
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

main() {
    log "🌟 Professional SSL Certificate Management System"
    log "🎯 Action: $ACTION"
    log "🌐 Domain: $WWW_DOMAIN"
    
    # Only run on EC2
    if [ ! -d "/opt/restaurant-web" ]; then
        err "SSL management can only be run on EC2 production server"
    fi
    
    cd /opt/restaurant-web
    
    case "$ACTION" in
        "status")
            verify_dns_configuration
            check_certificate_status
            ;;
            
        "install")
            install_certbot
            request_ssl_certificate
            setup_auto_renewal
            test_ssl_configuration
            ;;
            
        "renew")
            log "🔄 Renewing SSL certificate..."
            sudo certbot renew
            docker-compose -f docker/docker-compose.prod.yml --profile production restart nginx
            test_ssl_configuration
            ;;
            
        "test")
            test_ssl_configuration
            ;;
            
        "fix")
            log "🔧 Fixing SSL configuration..."
            update_nginx_ssl_config
            docker-compose -f docker/docker-compose.prod.yml --profile production restart nginx
            test_ssl_configuration
            ;;
            
        *)
            info "Usage: $0 {status|install|renew|test|fix}"
            info "  status   - Check SSL certificate and DNS status"
            info "  install  - Install new SSL certificate with Let's Encrypt"
            info "  renew    - Renew existing SSL certificate"
            info "  test     - Test SSL configuration"
            info "  fix      - Fix SSL configuration and restart services"
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"