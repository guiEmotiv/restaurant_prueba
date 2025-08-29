#!/bin/bash
set -e

echo "🔍 Network Diagnostics for Restaurant Web Application"
echo "=================================================="

# Check if services are running
echo ""
echo "📦 Docker Container Status:"
sudo docker-compose -f docker/docker-compose.prod.yml --profile production ps

echo ""
echo "🌐 Network Interface Status:"
ip addr show

echo ""
echo "🔌 Port Listening Status:"
sudo netstat -tulnp | grep -E "(80|443|8000)"

echo ""
echo "🏠 Internal connectivity tests:"
echo "Testing Django app on port 8000..."
curl -I http://localhost:8000/api/v1/health/ || echo "❌ Django not accessible on localhost:8000"

echo ""
echo "Testing Nginx on port 80..."
curl -I http://localhost:80/api/v1/health/ || echo "❌ Nginx not accessible on localhost:80"

echo ""
echo "Testing HTTPS on port 443..."
curl -I -k https://localhost:443/api/v1/health/ || echo "❌ HTTPS not accessible on localhost:443"

echo ""
echo "🚪 Firewall Status:"
sudo ufw status || echo "UFW not available"
sudo iptables -L -n | grep -E "(80|443|8000)" || echo "No specific iptables rules for ports 80/443/8000"

echo ""
echo "🔒 SSL Certificate Status:"
if [ -f "ssl/server.crt" ]; then
    echo "✅ SSL certificate exists"
    openssl x509 -in ssl/server.crt -text -noout | grep -E "(Subject:|DNS:|Not After)" || echo "Certificate info not readable"
else
    echo "❌ SSL certificate not found"
fi

echo ""
echo "📋 Docker Compose Configuration Check:"
if [ -f "docker/docker-compose.prod.yml" ]; then
    echo "✅ Docker compose file exists"
    grep -A 5 -B 5 "ports:" docker/docker-compose.prod.yml || echo "No port mappings found"
else
    echo "❌ Docker compose file not found"
fi

echo ""
echo "📊 Final Summary:"
echo "- Check if containers are running"  
echo "- Check if ports are being listened on"
echo "- Check internal connectivity"
echo "- Check firewall rules"