#!/bin/bash

echo "=== EC2 Frontend Debug Script ==="
echo "================================"

# Check if we're on EC2
if [ -f /etc/os-release ]; then
    echo -e "\n📍 System Info:"
    cat /etc/os-release | grep -E "^(NAME|VERSION)="
    echo "Instance IP: $(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo 'Not on EC2')"
fi

# Check Docker containers
echo -e "\n🐳 Docker Containers:"
sudo docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" || echo "Docker not running"

# Check container logs
echo -e "\n📋 Web Container Logs (last 20 lines):"
sudo docker logs --tail 20 restaurant-web_web_1 2>&1 || echo "Container not found"

# Check Nginx status
echo -e "\n🌐 Nginx Process:"
ps aux | grep -E "nginx|PID" | grep -v grep || echo "Nginx not running"

# Check Nginx configuration
echo -e "\n⚙️ Nginx Configuration Test:"
sudo docker exec restaurant-web_web_1 nginx -t 2>&1 || echo "Cannot test nginx config"

# Check Nginx error logs
echo -e "\n❌ Nginx Error Logs (last 20 lines):"
sudo docker exec restaurant-web_web_1 tail -20 /var/log/nginx/error.log 2>&1 || echo "Cannot read error logs"

# Check Nginx access logs
echo -e "\n✅ Nginx Access Logs (last 10 lines):"
sudo docker exec restaurant-web_web_1 tail -10 /var/log/nginx/access.log 2>&1 || echo "Cannot read access logs"

# Check frontend build files
echo -e "\n📁 Frontend Build Files:"
sudo docker exec restaurant-web_web_1 ls -la /usr/share/nginx/html/ 2>&1 || echo "Cannot list frontend files"

# Check index.html
echo -e "\n📄 Index.html (first 10 lines):"
sudo docker exec restaurant-web_web_1 head -10 /usr/share/nginx/html/index.html 2>&1 || echo "index.html not found"

# Check file permissions
echo -e "\n🔐 File Permissions:"
sudo docker exec restaurant-web_web_1 ls -la /usr/share/nginx/html/index.html 2>&1 || echo "Cannot check permissions"

# Check ports
echo -e "\n🔌 Port Listening:"
sudo netstat -tlnp | grep -E ":80|:443|:8000" || sudo ss -tlnp | grep -E ":80|:443|:8000" || echo "Cannot check ports"

# Check firewall/security groups
echo -e "\n🔥 Firewall Status:"
sudo ufw status 2>/dev/null || echo "UFW not installed"

# Check environment variables in container
echo -e "\n🔧 Frontend Environment:"
sudo docker exec restaurant-web_web_1 printenv | grep -E "VITE_|NODE_" || echo "No frontend env vars found"

# Test backend connectivity from container
echo -e "\n🔗 Backend Connectivity Test:"
sudo docker exec restaurant-web_web_1 curl -s http://backend:8000/api/v1/health/ || echo "Cannot reach backend"

# Check DNS resolution
echo -e "\n🌍 DNS Resolution:"
sudo docker exec restaurant-web_web_1 nslookup backend 2>&1 || echo "Cannot resolve backend"

# Check Docker network
echo -e "\n🔧 Docker Network:"
sudo docker network ls
echo -e "\nContainers in restaurant-web network:"
sudo docker network inspect restaurant-web_default 2>/dev/null | grep -A 5 "Containers" || echo "Network not found"

# Memory and disk usage
echo -e "\n💾 System Resources:"
free -h
df -h /

# Check for any CORS or SSL issues
echo -e "\n🔒 SSL/CORS Headers Test:"
curl -I -s https://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null) 2>&1 | head -20 || echo "Cannot test HTTPS"

echo -e "\n================================"
echo "Debug complete. Check output above for issues."