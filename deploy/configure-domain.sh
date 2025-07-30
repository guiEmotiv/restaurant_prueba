#!/bin/bash

# ============================================================================
# Domain Configuration Script for EC2 Restaurant Application
# Configures domain name with SSL certificate
# ============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}Domain Configuration for Restaurant App${NC}"
echo -e "${BLUE}=====================================${NC}"

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

# Get domain name from user
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: sudo ./configure-domain.sh <your-domain.com>${NC}"
    echo -e "${YELLOW}Example: sudo ./configure-domain.sh restaurant.example.com${NC}"
    exit 1
fi

DOMAIN_NAME=$1
EMAIL="${2:-admin@$DOMAIN_NAME}"

echo -e "${GREEN}Configuring domain: $DOMAIN_NAME${NC}"
echo -e "${GREEN}Email for SSL: $EMAIL${NC}"

# Update system packages
echo -e "${BLUE}Updating system packages...${NC}"
apt-get update -y

# Install Certbot and Nginx plugin
echo -e "${BLUE}Installing Certbot...${NC}"
apt-get install -y certbot python3-certbot-nginx

# Create Nginx configuration for the domain
echo -e "${BLUE}Creating Nginx configuration...${NC}"
cat > /etc/nginx/sites-available/$DOMAIN_NAME << 'EOF'
server {
    listen 80;
    server_name DOMAIN_NAME_PLACEHOLDER www.DOMAIN_NAME_PLACEHOLDER;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Logging
    access_log /var/log/nginx/DOMAIN_NAME_PLACEHOLDER.access.log;
    error_log /var/log/nginx/DOMAIN_NAME_PLACEHOLDER.error.log;

    # Frontend (React app)
    location / {
        root /opt/restaurant-web/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Django Admin
    location /admin/ {
        proxy_pass http://localhost:8000/admin/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Django static files
    location /static/ {
        alias /opt/restaurant-web/backend/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Django media files
    location /media/ {
        alias /opt/restaurant-web/backend/media/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Security: Deny access to sensitive files
    location ~* \.(env|git|gitignore|pyc|sqlite3|db)$ {
        deny all;
        return 404;
    }
}
EOF

# Replace domain placeholder
sed -i "s/DOMAIN_NAME_PLACEHOLDER/$DOMAIN_NAME/g" /etc/nginx/sites-available/$DOMAIN_NAME

# Enable the site
echo -e "${BLUE}Enabling Nginx site...${NC}"
ln -sf /etc/nginx/sites-available/$DOMAIN_NAME /etc/nginx/sites-enabled/

# Remove default site if exists
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
echo -e "${BLUE}Testing Nginx configuration...${NC}"
nginx -t

# Reload Nginx
echo -e "${BLUE}Reloading Nginx...${NC}"
systemctl reload nginx

# Obtain SSL certificate
echo -e "${BLUE}Obtaining SSL certificate...${NC}"
certbot --nginx -d $DOMAIN_NAME -d www.$DOMAIN_NAME --non-interactive --agree-tos --email $EMAIL --redirect

# Update environment variables
echo -e "${BLUE}Updating environment configuration...${NC}"

# Update .env.ec2 file
ENV_FILE="/opt/restaurant-web/.env.ec2"
if [ -f "$ENV_FILE" ]; then
    # Add or update DOMAIN_NAME
    if grep -q "^DOMAIN_NAME=" "$ENV_FILE"; then
        sed -i "s/^DOMAIN_NAME=.*/DOMAIN_NAME=$DOMAIN_NAME/" "$ENV_FILE"
    else
        echo "DOMAIN_NAME=$DOMAIN_NAME" >> "$ENV_FILE"
    fi
    
    # Update ALLOWED_HOSTS in Django settings
    if grep -q "^ALLOWED_HOSTS=" "$ENV_FILE"; then
        # Get current EC2_PUBLIC_IP
        EC2_PUBLIC_IP=$(grep "^EC2_PUBLIC_IP=" "$ENV_FILE" | cut -d'=' -f2)
        sed -i "s/^ALLOWED_HOSTS=.*/ALLOWED_HOSTS=localhost,127.0.0.1,$EC2_PUBLIC_IP,$DOMAIN_NAME,www.$DOMAIN_NAME/" "$ENV_FILE"
    fi
fi

# Create systemd timer for auto-renewal
echo -e "${BLUE}Setting up auto-renewal...${NC}"
cat > /etc/systemd/system/certbot-renewal.service << 'EOF'
[Unit]
Description=Certbot Renewal
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --quiet --deploy-hook "systemctl reload nginx"
EOF

cat > /etc/systemd/system/certbot-renewal.timer << 'EOF'
[Unit]
Description=Run certbot renewal twice daily

[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=3600
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Enable auto-renewal
systemctl daemon-reload
systemctl enable certbot-renewal.timer
systemctl start certbot-renewal.timer

# Update frontend configuration to use the domain
echo -e "${BLUE}Updating frontend configuration...${NC}"
FRONTEND_ENV="/opt/restaurant-web/frontend/.env.production"
if [ -f "$FRONTEND_ENV" ]; then
    echo "VITE_API_URL=https://$DOMAIN_NAME" > "$FRONTEND_ENV"
else
    echo "VITE_API_URL=https://$DOMAIN_NAME" > "$FRONTEND_ENV"
fi

# Rebuild frontend with new domain
echo -e "${BLUE}Rebuilding frontend...${NC}"
cd /opt/restaurant-web
docker-compose -f docker-compose.ec2.yml exec web npm run build --prefix frontend

# Restart the application
echo -e "${BLUE}Restarting application...${NC}"
docker-compose -f docker-compose.ec2.yml restart

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}Domain configuration completed!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
echo -e "${YELLOW}Important next steps:${NC}"
echo -e "${YELLOW}1. Update your Route53 DNS records:${NC}"
echo -e "${YELLOW}   - A record: $DOMAIN_NAME -> Your EC2 Public IP${NC}"
echo -e "${YELLOW}   - A record: www.$DOMAIN_NAME -> Your EC2 Public IP${NC}"
echo ""
echo -e "${YELLOW}2. Wait for DNS propagation (5-10 minutes)${NC}"
echo ""
echo -e "${YELLOW}3. Your application will be available at:${NC}"
echo -e "${GREEN}   https://$DOMAIN_NAME${NC}"
echo -e "${GREEN}   https://www.$DOMAIN_NAME${NC}"
echo ""
echo -e "${BLUE}SSL Certificate status:${NC}"
certbot certificates

echo ""
echo -e "${GREEN}✅ Configuration complete!${NC}"