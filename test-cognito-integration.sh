#!/bin/bash

echo "🔍 Testing AWS Cognito Integration..."
echo "====================================="

# Detect if running on EC2
if [ -f "/opt/restaurant-web/docker-compose.ec2.yml" ]; then
    echo "📍 Running on EC2 environment"
    IS_EC2=true
else
    echo "📍 Running on local development environment"
    IS_EC2=false
fi

# Check if .env files exist
echo ""
echo "📄 Checking environment files..."
if [ -f "frontend/.env" ]; then
    echo "✅ frontend/.env exists"
    grep -E "VITE_AWS_COGNITO|VITE_AWS_REGION" frontend/.env | sed 's/=.*/=***/'
else
    echo "❌ frontend/.env not found - copy from frontend/.env.example"
fi

if [ -f "backend/.env" ]; then
    echo "✅ backend/.env exists"
    grep -E "COGNITO_USER_POOL_ID|COGNITO_APP_CLIENT_ID|AWS_REGION" backend/.env | sed 's/=.*/=***/'
else
    echo "❌ backend/.env not found - copy from backend/.env.example"
fi

# Check Python dependencies
echo ""
echo "📦 Checking Python dependencies..."
cd backend
if [ "$IS_EC2" = true ] && [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi

if pip show PyJWT cryptography requests > /dev/null 2>&1; then
    echo "✅ Required Python packages installed"
else
    echo "❌ Missing Python packages - run: pip install -r requirements.txt"
fi
cd ..

# Check Node dependencies
echo ""
echo "📦 Checking Node dependencies..."
cd frontend
if [ -d "node_modules/aws-amplify" ] && [ -d "node_modules/@aws-amplify/ui-react" ]; then
    echo "✅ AWS Amplify packages installed"
else
    echo "❌ Missing Node packages - run: cd frontend && npm install"
fi
cd ..

echo ""
echo "====================================="
if [ "$IS_EC2" = true ]; then
    echo "🚀 To configure Cognito on EC2:"
    echo "1. Run: ./update-cognito-config.sh"
    echo "2. Rebuild frontend: cd frontend && npm run build"
    echo "3. Restart Docker: ./deploy/ec2-deploy.sh restart"
    echo "4. Create users in AWS Cognito console with groups: administradores or meseros"
else
    echo "🚀 To start the application:"
    echo "1. Configure your AWS Cognito credentials in .env files"
    echo "2. Start backend: cd backend && python manage.py runserver"
    echo "3. Start frontend: cd frontend && npm run dev"
    echo "4. Create users in AWS Cognito console with groups: administradores or meseros"
fi