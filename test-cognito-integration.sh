#!/bin/bash

echo "🔍 Testing Restaurant Web Application Setup..."
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detect environment
if [ -f "/opt/restaurant-web/docker-compose.ec2.yml" ]; then
    echo -e "${BLUE}📍 Running on EC2 environment${NC}"
    IS_EC2=true
    PROJECT_DIR="/opt/restaurant-web"
else
    echo -e "${BLUE}📍 Running on local development environment${NC}"
    IS_EC2=false
    PROJECT_DIR="."
fi

cd "$PROJECT_DIR"

# Function to check file and show relevant config
check_env_file() {
    local file="$1"
    local desc="$2"
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $desc exists${NC}"
        
        # Check Cognito configuration
        if grep -q "COGNITO_USER_POOL_ID" "$file" 2>/dev/null; then
            local cognito_configured=false
            if grep -E "(COGNITO_USER_POOL_ID|VITE_AWS_COGNITO_USER_POOL_ID)=" "$file" | grep -v "=$" | grep -v "=us-east-1_CHANGEME123" >/dev/null 2>&1; then
                echo -e "${GREEN}  🔐 Cognito: CONFIGURED${NC}"
                cognito_configured=true
            else
                echo -e "${YELLOW}  🔒 Cognito: DISABLED (empty values)${NC}"
            fi
            
            # Show masked values
            if [ "$cognito_configured" = true ]; then
                grep -E "(AWS_REGION|VITE_AWS_REGION|COGNITO_USER_POOL_ID|VITE_AWS_COGNITO_USER_POOL_ID)" "$file" | sed 's/=.*/=***/' | sed 's/^/    /'
            fi
        else
            echo -e "${YELLOW}  ⚠️ No Cognito configuration found${NC}"
        fi
    else
        echo -e "${RED}❌ $desc not found${NC}"
        return 1
    fi
}

# Check environment files
echo -e "\n${BLUE}📄 Checking environment files...${NC}"
check_env_file "frontend/.env" "frontend/.env"
check_env_file "backend/.env" "backend/.env"

# Check system requirements
echo -e "\n${BLUE}⚙️ Checking system requirements...${NC}"

# Node.js version
node_version=$(node --version 2>/dev/null || echo "none")
if [[ $node_version == v20* ]] || [[ $node_version == v22* ]]; then
    echo -e "${GREEN}✅ Node.js: $node_version (compatible)${NC}"
elif [[ $node_version == v18* ]]; then
    echo -e "${YELLOW}⚠️ Node.js: $node_version (may cause issues with Vite 7+)${NC}"
    echo -e "${BLUE}  💡 Consider upgrading: ./deploy/setup-node-version.sh${NC}"
else
    echo -e "${RED}❌ Node.js: $node_version (incompatible or missing)${NC}"
fi

# Disk space
if [ "$IS_EC2" = true ]; then
    available_space=$(df / | tail -1 | awk '{print int($4/1024/1024)}')
    if [ "$available_space" -gt 1 ]; then
        echo -e "${GREEN}✅ Disk space: ${available_space}GB available${NC}"
    else
        echo -e "${RED}❌ Disk space: ${available_space}GB available (low!)${NC}"
        echo -e "${BLUE}  💡 Run cleanup: sudo ./deploy/cleanup-ec2.sh${NC}"
    fi
fi

# Check Python dependencies
echo -e "\n${BLUE}📦 Checking Python dependencies...${NC}"
cd backend 2>/dev/null || cd .
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate 2>/dev/null
fi

missing_packages=()
for package in PyJWT cryptography requests; do
    if ! pip show "$package" >/dev/null 2>&1; then
        missing_packages+=("$package")
    fi
done

if [ ${#missing_packages[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ Required Python packages installed${NC}"
else
    echo -e "${RED}❌ Missing Python packages: ${missing_packages[*]}${NC}"
    echo -e "${BLUE}  💡 Install: pip install -r requirements.txt${NC}"
fi
cd "$PROJECT_DIR"

# Check Node dependencies
echo -e "\n${BLUE}📦 Checking Node dependencies...${NC}"
cd frontend 2>/dev/null || cd .
if [ -d "node_modules/aws-amplify" ] && [ -d "node_modules/@aws-amplify/ui-react" ]; then
    echo -e "${GREEN}✅ AWS Amplify packages installed${NC}"
elif [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️ node_modules not found${NC}"
    echo -e "${BLUE}  💡 Install: npm install${NC}"
else
    echo -e "${RED}❌ Missing AWS Amplify packages${NC}"
    echo -e "${BLUE}  💡 Install: npm install${NC}"
fi
cd "$PROJECT_DIR"

# Check Docker (EC2 only)
if [ "$IS_EC2" = true ]; then
    echo -e "\n${BLUE}🐳 Checking Docker services...${NC}"
    if docker-compose -f docker-compose.ec2.yml ps 2>/dev/null | grep -q "Up"; then
        echo -e "${GREEN}✅ Docker containers running${NC}"
    else
        echo -e "${YELLOW}⚠️ Docker containers not running${NC}"
        echo -e "${BLUE}  💡 Start: ./deploy/deploy-optimized.sh${NC}"
    fi
fi

# Summary and recommendations
echo -e "\n${BLUE}=====================================${NC}"
echo -e "${BLUE}🎯 Next Steps:${NC}"

if [ "$IS_EC2" = true ]; then
    echo -e "\n${YELLOW}For EC2 deployment:${NC}"
    echo -e "1. ${GREEN}Complete setup:${NC} sudo ./deploy/setup-ec2-complete.sh"
    echo -e "2. ${GREEN}Quick deploy:${NC} ./deploy/deploy-optimized.sh"
    echo -e "3. ${GREEN}Configure Cognito:${NC} ./deploy/configure-cognito.sh"
    echo -e "4. ${GREEN}Cleanup space:${NC} sudo ./deploy/cleanup-ec2.sh"
else
    echo -e "\n${YELLOW}For local development:${NC}"
    echo -e "1. ${GREEN}Start backend:${NC} cd backend && python manage.py runserver"
    echo -e "2. ${GREEN}Start frontend:${NC} cd frontend && npm run dev"
    echo -e "3. ${GREEN}Configure Cognito:${NC} Update .env files with your credentials"
fi

echo -e "\n${YELLOW}For AWS Cognito setup:${NC}"
echo -e "• Create User Pool with groups: ${BLUE}administradores${NC}, ${BLUE}meseros${NC}"
echo -e "• Create users and assign to appropriate groups"
echo -e "• Configure App Client (public, no secret)"

echo -e "\n${GREEN}🎉 Setup check completed!${NC}"