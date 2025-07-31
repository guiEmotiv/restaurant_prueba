#!/bin/bash

# Script to setup AWS Cognito dependencies on EC2
# Run this after pulling the latest code with Cognito integration

echo "🔧 Setting up AWS Cognito dependencies on EC2..."
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Change to project directory
cd /opt/restaurant-web

# Fix permissions first
echo -e "${YELLOW}Fixing permissions...${NC}"
sudo chown -R ubuntu:ubuntu /opt/restaurant-web

# Install frontend dependencies
echo -e "\n${YELLOW}Installing frontend dependencies...${NC}"
cd frontend
if [ -f "package.json" ]; then
    npm install
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Frontend dependencies installed successfully${NC}"
    else
        echo -e "${RED}❌ Failed to install frontend dependencies${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ package.json not found in frontend directory${NC}"
    exit 1
fi

# Build frontend with production configuration
echo -e "\n${YELLOW}Building frontend for production...${NC}"
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend built successfully${NC}"
else
    echo -e "${RED}❌ Failed to build frontend${NC}"
    exit 1
fi

# Check backend dependencies
echo -e "\n${YELLOW}Checking backend Python dependencies...${NC}"
cd ../backend
source venv/bin/activate
pip install -r requirements.txt
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend dependencies up to date${NC}"
else
    echo -e "${RED}❌ Failed to update backend dependencies${NC}"
    exit 1
fi

# Check environment files
echo -e "\n${YELLOW}Checking environment configuration...${NC}"
cd /opt/restaurant-web

# Frontend .env
if [ -f "frontend/.env" ]; then
    echo -e "${GREEN}✅ frontend/.env exists${NC}"
    if grep -q "VITE_AWS_COGNITO_USER_POOL_ID=us-east-1_CHANGEME123" frontend/.env; then
        echo -e "${YELLOW}⚠️  WARNING: Frontend Cognito credentials are still default values!${NC}"
        echo -e "${YELLOW}   Please update frontend/.env with your actual AWS Cognito credentials${NC}"
    fi
else
    echo -e "${RED}❌ frontend/.env not found${NC}"
    echo -e "${YELLOW}   Creating from template...${NC}"
    cp frontend/.env.example frontend/.env
fi

# Backend .env
if [ -f "backend/.env" ]; then
    echo -e "${GREEN}✅ backend/.env exists${NC}"
    if ! grep -q "COGNITO_USER_POOL_ID" backend/.env; then
        echo -e "${YELLOW}⚠️  Adding Cognito configuration to backend/.env...${NC}"
        echo "" >> backend/.env
        echo "# AWS Cognito Configuration" >> backend/.env
        echo "AWS_REGION=us-east-1" >> backend/.env
        echo "COGNITO_USER_POOL_ID=" >> backend/.env
        echo "COGNITO_APP_CLIENT_ID=" >> backend/.env
    fi
else
    echo -e "${RED}❌ backend/.env not found${NC}"
    exit 1
fi

# Create a helper script to update Cognito credentials
echo -e "\n${YELLOW}Creating Cognito configuration helper...${NC}"
cat > /opt/restaurant-web/update-cognito-config.sh << 'EOF'
#!/bin/bash

# Helper script to update Cognito configuration

echo "🔐 Update AWS Cognito Configuration"
echo "==================================="

# Prompt for values
read -p "Enter AWS Region (default: us-east-1): " AWS_REGION
AWS_REGION=${AWS_REGION:-us-east-1}

read -p "Enter Cognito User Pool ID: " USER_POOL_ID
read -p "Enter Cognito App Client ID: " APP_CLIENT_ID

if [ -z "$USER_POOL_ID" ] || [ -z "$APP_CLIENT_ID" ]; then
    echo "❌ User Pool ID and App Client ID are required!"
    exit 1
fi

# Update frontend/.env
echo "Updating frontend/.env..."
sed -i "s/VITE_AWS_REGION=.*/VITE_AWS_REGION=$AWS_REGION/" frontend/.env
sed -i "s/VITE_AWS_COGNITO_USER_POOL_ID=.*/VITE_AWS_COGNITO_USER_POOL_ID=$USER_POOL_ID/" frontend/.env
sed -i "s/VITE_AWS_COGNITO_APP_CLIENT_ID=.*/VITE_AWS_COGNITO_APP_CLIENT_ID=$APP_CLIENT_ID/" frontend/.env

# Update backend/.env
echo "Updating backend/.env..."
sed -i "s/AWS_REGION=.*/AWS_REGION=$AWS_REGION/" backend/.env
sed -i "s/COGNITO_USER_POOL_ID=.*/COGNITO_USER_POOL_ID=$USER_POOL_ID/" backend/.env
sed -i "s/COGNITO_APP_CLIENT_ID=.*/COGNITO_APP_CLIENT_ID=$APP_CLIENT_ID/" backend/.env

echo ""
echo "✅ Cognito configuration updated!"
echo ""
echo "Next steps:"
echo "1. Rebuild frontend: cd frontend && npm run build"
echo "2. Restart the application with Docker"
echo "3. Create users in AWS Cognito console"
EOF

chmod +x /opt/restaurant-web/update-cognito-config.sh

echo -e "\n${GREEN}=============================================="
echo -e "✅ AWS Cognito dependencies setup complete!${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "1. Run ${GREEN}./update-cognito-config.sh${NC} to configure your Cognito credentials"
echo -e "2. Restart the application: ${GREEN}cd /opt/restaurant-web && ./deploy/ec2-deploy.sh restart${NC}"
echo -e "3. Create users in AWS Cognito console with groups: administradores or meseros"
echo -e "\n${YELLOW}To disable Cognito (for testing):${NC}"
echo -e "- Leave the Cognito environment variables empty in both .env files"