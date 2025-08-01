#!/bin/bash

# Fix corrupted .env.ec2 file
# Removes corrupted file and creates a clean one

echo "🔧 Fixing corrupted .env.ec2 file"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="/opt/restaurant-web"
ENV_FILE="$PROJECT_DIR/.env.ec2"

echo -e "${YELLOW}🗑️ Removing corrupted .env.ec2 file...${NC}"
rm -f "$ENV_FILE"

echo -e "${BLUE}🔧 Creating clean configuration...${NC}"

# Get the real IP from the deployment script that worked
REAL_IP="172.31.44.32"  # From your deployment log

# Generate a secure Django secret key
SECRET_KEY=$(python3 -c "import secrets; print(''.join(secrets.choice('abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*(-_=+)') for i in range(50)))" 2>/dev/null || echo "change-this-secret-key-in-production-$(date +%s)")

# Create clean .env.ec2 file
cat > "$ENV_FILE" << EOF
# EC2 Production Environment Configuration
# Generated automatically on $(date)

# Django Configuration
DJANGO_SECRET_KEY=$SECRET_KEY
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,$REAL_IP,xn--elfogndedonsoto-zrb.com,www.xn--elfogndedonsoto-zrb.com

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
EC2_PUBLIC_IP=$REAL_IP

# Domain Configuration
DOMAIN_NAME=xn--elfogndedonsoto-zrb.com
EOF

# Set proper permissions
chmod 600 "$ENV_FILE"
chown ubuntu:ubuntu "$ENV_FILE" 2>/dev/null || true

echo -e "${GREEN}✅ Clean configuration file created: $ENV_FILE${NC}"
echo -e "${BLUE}📋 Configuration summary:${NC}"
echo -e "  🔐 Django secret key: Generated securely"
echo -e "  🌐 EC2 IP: $REAL_IP"
echo -e "  🔒 AWS Cognito: Configured with your credentials"
echo -e "  🛡️ File permissions: Secure (600)"

echo -e "\n${YELLOW}💡 Next step:${NC}"
echo -e "Run deployment: ${GREEN}sudo ./deploy/deploy-optimized.sh${NC}"

echo -e "\n${GREEN}🎉 .env.ec2 file fixed!${NC}"