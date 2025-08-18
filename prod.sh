#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PRODUCTION DEPLOYMENT - EC2 OPTIMIZED
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Architecture: Complete Docker stack with Nginx + SSL
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "🏗️ PRODUCTION DEPLOYMENT"

# Build frontend
echo "📦 Building frontend..."
cd frontend && npm run build && cd ..

# Deploy with production profile
echo "🚀 Deploying production stack..."
PROD=1 docker-compose --profile production up -d

echo ""
echo "✅ PRODUCTION DEPLOYED!"
echo ""
echo "🌐 Website: https://www.xn--elfogndedonsoto-zrb.com/"
echo "🔧 Backend: https://www.xn--elfogndedonsoto-zrb.com/api/v1/"
echo "📊 API Docs: https://www.xn--elfogndedonsoto-zrb.com/api/v1/docs/"
echo ""
echo "📋 Commands:"
echo "   docker-compose logs -f               # All logs"
echo "   docker-compose restart backend       # Restart backend"
echo "   docker-compose restart nginx         # Restart nginx"
echo ""