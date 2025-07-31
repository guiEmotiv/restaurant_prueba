#!/bin/bash

# ============================================================================
# Complete AWS Cognito Setup Script for Restaurant Management System
# This script creates and configures AWS Cognito for authentication
# ============================================================================

set -e  # Exit on any error

echo "🔐 Complete AWS Cognito Setup"
echo "============================="
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first:"
    echo "   curl 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o 'awscliv2.zip'"
    echo "   unzip awscliv2.zip"
    echo "   sudo ./aws/install"
    exit 1
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI is not configured. Please run:"
    echo "   aws configure"
    echo "   Then provide your AWS Access Key ID, Secret Access Key, and region"
    exit 1
fi

REGION="us-east-1"
USER_POOL_NAME="restaurant-management-users"
APP_CLIENT_NAME="restaurant-web-client"

echo "📋 Creating AWS Cognito User Pool..."

# Create User Pool
USER_POOL_RESPONSE=$(aws cognito-idp create-user-pool \
    --pool-name "$USER_POOL_NAME" \
    --policies '{
        "PasswordPolicy": {
            "MinimumLength": 8,
            "RequireUppercase": false,
            "RequireLowercase": false,
            "RequireNumbers": false,
            "RequireSymbols": false,
            "TemporaryPasswordValidityDays": 7
        }
    }' \
    --admin-create-user-config '{
        "AllowAdminCreateUserOnly": true,
        "UnusedAccountValidityDays": 7,
        "TemporaryPasswordValidityDays": 7
    }' \
    --username-configuration '{
        "CaseSensitive": false
    }' \
    --region $REGION)

USER_POOL_ID=$(echo $USER_POOL_RESPONSE | jq -r '.UserPool.Id')
echo "✅ User Pool created: $USER_POOL_ID"

# Create App Client
APP_CLIENT_RESPONSE=$(aws cognito-idp create-user-pool-client \
    --user-pool-id $USER_POOL_ID \
    --client-name "$APP_CLIENT_NAME" \
    --explicit-auth-flows ADMIN_NO_SRP_AUTH ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
    --prevent-user-existence-errors ENABLED \
    --region $REGION)

APP_CLIENT_ID=$(echo $APP_CLIENT_RESPONSE | jq -r '.UserPoolClient.ClientId')
echo "✅ App Client created: $APP_CLIENT_ID"

# Create User Groups
echo "📋 Creating user groups..."

aws cognito-idp create-group \
    --user-pool-id $USER_POOL_ID \
    --group-name "administradores" \
    --description "Administrators with full access" \
    --region $REGION

aws cognito-idp create-group \
    --user-pool-id $USER_POOL_ID \
    --group-name "meseros" \
    --description "Waiters with limited access" \
    --region $REGION

echo "✅ Groups created: administradores, meseros"

# Create Admin User
echo "📋 Creating admin user..."
TEMP_PASSWORD="TempPass123!"

aws cognito-idp admin-create-user \
    --user-pool-id $USER_POOL_ID \
    --username "admin" \
    --user-attributes Name=email,Value=admin@restaurant.com Name=email_verified,Value=true \
    --temporary-password "$TEMP_PASSWORD" \
    --message-action SUPPRESS \
    --region $REGION

# Add admin to administrators group
aws cognito-idp admin-add-user-to-group \
    --user-pool-id $USER_POOL_ID \
    --username "admin" \
    --group-name "administradores" \
    --region $REGION

echo "✅ Admin user created with temporary password: $TEMP_PASSWORD"

# Create Waiter User
echo "📋 Creating waiter user..."

aws cognito-idp admin-create-user \
    --user-pool-id $USER_POOL_ID \
    --username "mesero01" \
    --user-attributes Name=email,Value=mesero01@restaurant.com Name=email_verified,Value=true \
    --temporary-password "$TEMP_PASSWORD" \
    --message-action SUPPRESS \
    --region $REGION

# Add waiter to meseros group
aws cognito-idp admin-add-user-to-group \
    --user-pool-id $USER_POOL_ID \
    --username "mesero01" \
    --group-name "meseros" \
    --region $REGION

echo "✅ Waiter user created with temporary password: $TEMP_PASSWORD"

# Set permanent passwords
echo "📋 Setting permanent passwords..."

# Set admin permanent password
aws cognito-idp admin-set-user-password \
    --user-pool-id $USER_POOL_ID \
    --username "admin" \
    --password "AdminPass123!" \
    --permanent \
    --region $REGION

# Set waiter permanent password  
aws cognito-idp admin-set-user-password \
    --user-pool-id $USER_POOL_ID \
    --username "mesero01" \
    --password "MeseroPass123!" \
    --permanent \
    --region $REGION

echo "✅ Permanent passwords set"

# Get EC2 public IP
EC2_PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "your-ec2-ip")

# Generate configuration files
echo "📋 Generating configuration files..."

# Create backend .env.ec2 configuration
cat > .env.ec2.new << EOF
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# EC2 Production Environment Variables
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Django Settings
DJANGO_SECRET_KEY=your-production-secret-key-change-this
DEBUG=False
EC2_PUBLIC_IP=$EC2_PUBLIC_IP
DOMAIN_NAME=your-domain-name-optional

# Authentication Mode - ENABLED WITH REAL COGNITO
USE_COGNITO_AUTH=True

# AWS Cognito Configuration - REAL VALUES
AWS_REGION=$REGION
COGNITO_USER_POOL_ID=$USER_POOL_ID
COGNITO_APP_CLIENT_ID=$APP_CLIENT_ID

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# USUARIOS CONFIGURADOS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# admin (grupo: administradores) - Password: AdminPass123!
# mesero01 (grupo: meseros) - Password: MeseroPass123!
EOF

# Create frontend .env.production configuration
mkdir -p frontend
cat > frontend/.env.production.new << EOF
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Frontend Production Environment Variables (AWS Cognito REAL CONFIGURATION)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# AWS Cognito Configuration - REAL VALUES
VITE_AWS_REGION=$REGION
VITE_AWS_COGNITO_USER_POOL_ID=$USER_POOL_ID
VITE_AWS_COGNITO_APP_CLIENT_ID=$APP_CLIENT_ID

# API URL for production
VITE_API_URL=http://$EC2_PUBLIC_IP

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# USUARIOS CONFIGURADOS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Username: admin | Password: AdminPass123! | Grupo: administradores
# Username: mesero01 | Password: MeseroPass123! | Grupo: meseros
EOF

echo ""
echo "🎉 AWS Cognito setup completed successfully!"
echo ""
echo "📋 Configuration Summary:"
echo "------------------------"
echo "🔹 User Pool ID: $USER_POOL_ID"
echo "🔹 App Client ID: $APP_CLIENT_ID"
echo "🔹 Region: $REGION"
echo ""
echo "👥 Users Created:"
echo "🔹 admin (administradores) - Password: AdminPass123!"
echo "🔹 mesero01 (meseros) - Password: MeseroPass123!"
echo ""
echo "📁 Configuration files generated:"
echo "🔹 .env.ec2.new (backend configuration)"
echo "🔹 frontend/.env.production.new (frontend configuration)"
echo ""
echo "🚀 Next Steps:"
echo "1. Review and apply configuration files:"
echo "   mv .env.ec2.new .env.ec2"
echo "   mv frontend/.env.production.new frontend/.env.production"
echo ""
echo "2. Update frontend App.jsx to enable authentication:"
echo "   Change: const isCognitoConfigured = false;"
echo "   To:     const isCognitoConfigured = true;"
echo ""
echo "3. Deploy the application with authentication enabled"
echo ""
echo "🔐 Your application will now have login functionality!"