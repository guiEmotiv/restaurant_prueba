#!/bin/bash

# Script to check if all required files are in place

echo "🔍 Checking project structure..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅ $1${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 (MISSING)${NC}"
        return 1
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✅ $1/${NC}"
        return 0
    else
        echo -e "${RED}❌ $1/ (MISSING)${NC}"
        return 1
    fi
}

echo "Current directory: $(pwd)"
echo ""

# Check main files
echo "Main configuration files:"
check_file ".env"
check_file ".env.example"
check_file "docker-compose.prod.yml"

echo ""
echo "Backend files:"
check_dir "backend"
check_file "backend/Dockerfile.prod"
check_file "backend/requirements-prod.txt"
check_file "backend/manage.py"
check_file "backend/backend/settings_prod.py"

echo ""
echo "Deploy files:"
check_dir "deploy"
check_file "deploy/deploy.sh"
check_file "deploy/frontend-deploy.sh"

echo ""
echo "Frontend files:"
check_dir "frontend"
if [ -d "frontend" ]; then
    echo "  Frontend structure:"
    ls -la frontend/ | head -5
fi

echo ""
echo "🔧 Quick fixes:"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env from .env.example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ .env created${NC}"
    else
        echo -e "${RED}❌ .env.example not found${NC}"
    fi
fi

# Check backend directory structure
if [ -d "backend" ]; then
    echo "Backend directory contents:"
    ls -la backend/
fi

echo ""
echo "🐳 Docker commands to try:"
echo "1. docker-compose -f docker-compose.prod.yml config  # Validate config"
echo "2. docker-compose -f docker-compose.prod.yml build --no-cache  # Build"
echo "3. docker-compose -f docker-compose.prod.yml up -d  # Run"