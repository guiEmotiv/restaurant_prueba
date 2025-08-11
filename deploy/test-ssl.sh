#!/bin/bash

# Test SSL Configuration
echo "🔍 TESTING SSL CONFIGURATION"
echo "============================"

cd /opt/restaurant-web

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 1. Check what's listening on ports
echo -e "\n1️⃣ Checking port listeners..."
sudo netstat -tlnp | grep -E ':80|:443'

# 2. Check nginx configuration
echo -e "\n2️⃣ Testing nginx configuration..."
docker-compose -f docker-compose.ssl.yml exec -T nginx nginx -t

# 3. Check if frontend files are accessible
echo -e "\n3️⃣ Checking frontend files in nginx container..."
docker-compose -f docker-compose.ssl.yml exec -T nginx ls -la /var/www/html/

# 4. Check certificates are mounted
echo -e "\n4️⃣ Checking SSL certificates in container..."
docker-compose -f docker-compose.ssl.yml exec -T nginx ls -la /etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com/ 2>&1

# 5. Check actual nginx config being used
echo -e "\n5️⃣ Current nginx configuration..."
docker-compose -f docker-compose.ssl.yml exec -T nginx cat /etc/nginx/conf.d/default.conf | head -50

# 6. Test HTTP and HTTPS locally
echo -e "\n6️⃣ Testing HTTP (should redirect to HTTPS)..."
curl -I http://localhost/

echo -e "\n7️⃣ Testing HTTPS locally..."
curl -kI https://localhost/ 2>&1

# 8. Check nginx error logs
echo -e "\n8️⃣ Nginx error logs..."
docker-compose -f docker-compose.ssl.yml exec -T nginx tail -20 /var/log/nginx/error.log 2>/dev/null || echo "No error logs found"

# 9. Test from outside
echo -e "\n9️⃣ Testing from outside..."
echo "HTTP test (should redirect):"
curl -I http://www.xn--elfogndedonsoto-zrb.com/ 2>&1 | head -5

echo -e "\nHTTPS test:"
curl -I https://www.xn--elfogndedonsoto-zrb.com/ 2>&1 | head -5

# 10. Check EC2 security groups
echo -e "\n1️⃣0️⃣ EC2 instance info..."
EC2_INSTANCE_ID=$(ec2-metadata --instance-id 2>/dev/null | cut -d' ' -f2)
if [ -n "$EC2_INSTANCE_ID" ]; then
    echo "Instance ID: $EC2_INSTANCE_ID"
    echo "Public IP: $(ec2-metadata --public-ipv4 2>/dev/null | cut -d' ' -f2)"
else
    echo "Could not retrieve EC2 metadata"
fi

echo -e "\n${YELLOW}💡 Common issues:${NC}"
echo "1. Security group not allowing port 443"
echo "2. Certificate path mismatch"
echo "3. Frontend files not in correct location"
echo "4. Nginx configuration syntax error"