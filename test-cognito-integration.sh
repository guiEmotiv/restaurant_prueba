#!/bin/bash

echo "🔍 Testing AWS Cognito Integration..."
echo "====================================="

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
    echo "❌ Missing Node packages - run: npm install"
fi
cd ..

echo ""
echo "====================================="
echo "🚀 To start the application:"
echo "1. Configure your AWS Cognito credentials in .env files"
echo "2. Start backend: cd backend && python manage.py runserver"
echo "3. Start frontend: cd frontend && npm run dev"
echo "4. Create users in AWS Cognito console with groups: administradores or meseros"