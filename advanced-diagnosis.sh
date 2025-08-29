#!/bin/bash
set -e

echo "🔍 Advanced Network Diagnosis for External Connectivity"
echo "======================================================"

# Check public IP and network configuration
echo ""
echo "🌐 Public IP Information:"
curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "❌ Cannot get public IP from metadata service"
curl -s https://ifconfig.me 2>/dev/null || echo "❌ Cannot get public IP from external service"

echo ""
echo "🔧 Network Interface Details:"
ip route show default

echo ""
echo "📡 Port Accessibility Test from inside EC2:"
echo "Testing if ports are reachable from localhost:"
nc -z localhost 80 && echo "✅ Port 80 reachable" || echo "❌ Port 80 not reachable"
nc -z localhost 443 && echo "✅ Port 443 reachable" || echo "❌ Port 443 not reachable" 
nc -z localhost 8000 && echo "✅ Port 8000 reachable" || echo "❌ Port 8000 not reachable"

echo ""
echo "🐳 Docker Network Details:"
sudo docker network ls
sudo docker network inspect docker_restaurant-network 2>/dev/null || echo "Network details not available"

echo ""
echo "📋 Nginx Container Logs (last 20 lines):"
sudo docker-compose -f docker/docker-compose.prod.yml --profile production logs nginx --tail=20

echo ""
echo "🔒 SSL Certificate Details:"
if [ -f "ssl/server.crt" ]; then
    echo "Certificate file exists, checking validity..."
    openssl x509 -in ssl/server.crt -noout -dates
    openssl x509 -in ssl/server.crt -noout -subject
else
    echo "❌ SSL certificate file not found"
fi

echo ""
echo "🌍 Testing external connectivity FROM the server:"
echo "Trying to connect to external services..."
curl -s -I google.com --connect-timeout 5 >/dev/null && echo "✅ External internet works" || echo "❌ No external internet access"

echo ""
echo "⚙️ Nginx Configuration Check:"
if [ -f "docker/nginx/conf.d/default.conf" ]; then
    echo "Nginx config exists, checking SSL settings..."
    grep -A 10 -B 5 "ssl_certificate\|listen 443" docker/nginx/conf.d/default.conf || echo "No SSL config found"
else
    echo "❌ Nginx config file not found"
fi