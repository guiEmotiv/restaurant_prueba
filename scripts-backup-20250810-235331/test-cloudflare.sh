#!/bin/bash

# Test if CloudFlare is handling SSL
echo "☁️  TESTING CLOUDFLARE CONFIGURATION"
echo "===================================="

cd /opt/restaurant-web

# 1. Check DNS resolution
echo -e "\n1️⃣ Checking DNS resolution..."
host www.xn--elfogndedonsoto-zrb.com

# 2. Check HTTP headers
echo -e "\n2️⃣ Checking HTTP headers (looking for CloudFlare)..."
curl -I http://www.xn--elfogndedonsoto-zrb.com/ 2>&1 | grep -i -E "(cf-ray|cloudflare|server)"

# 3. Try using CloudFlare config
echo -e "\n3️⃣ Switching to CloudFlare configuration..."
docker-compose -f docker-compose.simple.yml down

# Update nginx to use cloudflare config
docker-compose -f docker-compose.simple.yml up -d --scale nginx=0
docker run -d \
  --name restaurant-nginx-cf \
  --network restaurant-web_restaurant_network \
  -p 80:80 \
  -v $(pwd)/nginx/conf.d/cloudflare.conf:/etc/nginx/conf.d/default.conf:ro \
  -v $(pwd)/frontend/dist:/var/www/html:ro \
  nginx:alpine

sleep 5

# 4. Test the site
echo -e "\n4️⃣ Testing the site..."
echo "Local test:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost/

echo -e "\nRemote test:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://www.xn--elfogndedonsoto-zrb.com/

echo -e "\nHTTPS test (via CloudFlare):"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" https://www.xn--elfogndedonsoto-zrb.com/

echo -e "\n5️⃣ Container status:"
docker ps | grep -E "(nginx|web)"

echo -e "\n📝 If CloudFlare is handling SSL:"
echo "- You should see 'cf-ray' headers"
echo "- HTTPS should work even without local SSL"
echo "- The site should be accessible via https://"