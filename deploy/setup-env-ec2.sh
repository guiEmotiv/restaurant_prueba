#!/bin/bash

# EC2 Environment Setup Script
# Creates .env.ec2 file with proper configuration

echo "🔧 Setting up EC2 environment configuration"
echo "==========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="/opt/restaurant-web"
ENV_FILE="$PROJECT_DIR/.env.ec2"

# Get EC2 public IP using multiple methods
get_ec2_ip() {
    local ip=""
    
    # Method 1: Try EC2 metadata service
    ip=$(curl -s --max-time 5 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null)
    if [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        echo "$ip"
        return
    fi
    
    # Method 2: Try another metadata endpoint
    ip=$(curl -s --max-time 5 http://169.254.169.254/latest/meta-data/local-ipv4 2>/dev/null)
    if [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        echo "$ip"
        return
    fi
    
    # Method 3: Get from current SSH connection
    ip=$(who am i | awk '{print $5}' | sed 's/[()]//g' 2>/dev/null)
    if [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        echo "$ip"
        return
    fi
    
    # Method 4: Try external service
    ip=$(curl -s --max-time 5 https://ipv4.icanhazip.com 2>/dev/null)
    if [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        echo "$ip"
        return
    fi
    
    # Method 5: Get local IP and warn user
    ip=$(hostname -I | awk '{print $1}' 2>/dev/null)
    if [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        echo -e "${YELLOW}⚠️ Using local IP: $ip (you may need to update with public IP)${NC}"
        echo "$ip"
        return
    fi
    
    # Fallback: Return placeholder
    echo "YOUR_EC2_PUBLIC_IP"
}

# Generate a secure Django secret key
generate_secret_key() {
    python3 -c "import secrets; print(''.join(secrets.choice('abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*(-_=+)') for i in range(50)))"
}

echo -e "${BLUE}📍 Creating configuration for EC2 instance${NC}"

# Get EC2 IP
EC2_IP=$(get_ec2_ip)
echo -e "${BLUE}🌐 Detected EC2 IP: $EC2_IP${NC}"

# Generate secret key
SECRET_KEY=$(generate_secret_key)

# Create .env.ec2 file
cat > "$ENV_FILE" << EOF
# EC2 Production Environment Configuration
# Generated automatically on $(date)

# Django Configuration
DJANGO_SECRET_KEY=$SECRET_KEY
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,$EC2_IP,elfogomdedonsoto.com,www.elfogomdedonsoto.com

# Database (SQLite for production)
DATABASE_URL=sqlite:///data/restaurant.sqlite3

# Time and Language
TIME_ZONE=America/Lima
LANGUAGE_CODE=es-pe

# AWS Cognito Configuration (Backend)
AWS_REGION=us-west-2
COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI
COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0

# AWS Cognito Configuration (Frontend)
VITE_AWS_REGION=us-west-2
VITE_AWS_COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI
VITE_AWS_COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0

# EC2 Specific
EC2_PUBLIC_IP=$EC2_IP

# Domain Configuration
DOMAIN_NAME=elfogomdedonsoto.com
EOF

# Set proper permissions
chmod 600 "$ENV_FILE"
chown ubuntu:ubuntu "$ENV_FILE" 2>/dev/null || true

echo -e "${GREEN}✅ Configuration file created: $ENV_FILE${NC}"
echo -e "${BLUE}📋 Configuration summary:${NC}"
echo -e "  🔐 Django secret key: Generated securely"
echo -e "  🌐 EC2 IP: $EC2_IP"
echo -e "  🔒 AWS Cognito: Configured with your credentials"
echo -e "  🛡️ File permissions: Secure (600)"

echo -e "\n${YELLOW}💡 Next steps:${NC}"
echo -e "1. Run deployment: ${GREEN}sudo ./deploy/deploy-optimized.sh${NC}"
echo -e "2. Or use master script: ${GREEN}sudo ./deploy/setup-ec2-complete.sh${NC}"

echo -e "\n${GREEN}🎉 EC2 environment ready!${NC}"