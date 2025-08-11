#!/bin/bash

# Simple HTTP Access Test
echo "🌐 TESTING HTTP ACCESS"
echo "======================"

# 1. Internal tests
echo -e "\n1️⃣ Testing from inside EC2..."
echo "Backend API:"
curl -s http://localhost:8000/api/v1/health/ | jq . 2>/dev/null || curl -s http://localhost:8000/api/v1/health/

echo -e "\nFrontend via nginx:"
curl -s http://localhost/ | grep -o "<title>.*</title>" | head -1

echo -e "\nAPI via nginx:"
curl -s http://localhost/api/v1/tables/ | head -100 | jq '.[] | {id, table_number, zone_name}' 2>/dev/null || echo "API response received"

# 2. External test
echo -e "\n2️⃣ Testing from outside (your domain)..."
PUBLIC_IP=$(curl -s http://checkip.amazonaws.com/)
echo "Your public IP: $PUBLIC_IP"

echo -e "\nTesting http://www.xn--elfogndedonsoto-zrb.com/ ..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://www.xn--elfogndedonsoto-zrb.com/)
echo "HTTP Status: $RESPONSE"

if [ "$RESPONSE" = "200" ]; then
    echo "✅ Site is accessible via HTTP!"
    echo ""
    echo "Try opening in your browser:"
    echo "http://www.xn--elfogndedonsoto-zrb.com/"
else
    echo "❌ Site not accessible. Possible issues:"
    echo "- DNS not pointing to $PUBLIC_IP"
    echo "- Security group blocking port 80"
    echo "- Nginx not running"
fi

# 3. DNS check
echo -e "\n3️⃣ DNS Resolution..."
echo "Your domain resolves to:"
dig +short www.xn--elfogndedonsoto-zrb.com A
echo ""
echo "Should match your EC2 public IP: $PUBLIC_IP"

# 4. Container check
echo -e "\n4️⃣ Container status..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(NAME|nginx|web)"

echo -e "\n📝 Summary:"
echo "- If internal tests work but external don't: Check AWS Security Group"
echo "- If DNS doesn't match IP: Update DNS records"
echo "- If containers aren't running: Run deployment script"