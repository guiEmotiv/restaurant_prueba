#!/bin/bash

echo "🔍 DEBUGGING CONTAINER STATUS"
echo "============================="

# Change to project directory
cd /home/ubuntu/restaurant-web

echo "📁 Current directory: $(pwd)"
echo "📁 Directory contents:"
ls -la

echo ""
echo "🐳 Docker containers status:"
/usr/local/bin/docker compose -f docker-compose.production.yml ps

echo ""
echo "📊 System processes listening on ports:"
netstat -tlnp | grep -E ':80|:8000' || echo "netstat not found"

echo ""
echo "🔍 Backend container logs (last 20 lines):"
/usr/local/bin/docker compose -f docker-compose.production.yml logs restaurant-web-backend-prod --tail 20

echo ""
echo "🔍 Nginx container logs (last 10 lines):"
/usr/local/bin/docker compose -f docker-compose.production.yml logs restaurant-web-nginx-prod --tail 10

echo ""
echo "🌐 Testing internal connectivity:"
curl -s -m 5 -I http://localhost:8000/api/v1/health/ || echo "Backend not responding on localhost:8000"
curl -s -m 5 -I http://localhost:80/ | head -3 || echo "Nginx not responding on localhost:80"