#!/bin/bash
# Script to test API endpoints on EC2

EC2_IP="${1:-44.248.47.186}"

echo "🧪 Testing API endpoints on EC2: $EC2_IP"
echo "================================================"

# Test root
echo -e "\n1. Testing root endpoint (/)"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://$EC2_IP/

# Test Django admin
echo -e "\n2. Testing Django admin (/admin/)"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://$EC2_IP/admin/

# Test debug endpoint
echo -e "\n3. Testing debug endpoint (/debug-static/)"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://$EC2_IP/debug-static/

# Test API root
echo -e "\n4. Testing API root (/api/)"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://$EC2_IP/api/

# Test API v1 root
echo -e "\n5. Testing API v1 root (/api/v1/)"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://$EC2_IP/api/v1/

# Test categories endpoint
echo -e "\n6. Testing categories endpoint (/api/v1/categories/)"
curl -s -w "\nStatus: %{http_code}\n" http://$EC2_IP/api/v1/categories/

# Test from inside the container
echo -e "\n7. Testing from inside container (localhost:8000/api/v1/categories/)"
ssh -o StrictHostKeyChecking=no ubuntu@$EC2_IP "docker exec restaurant_web_ec2 curl -s -w '\nStatus: %{http_code}\n' http://localhost:8000/api/v1/categories/" 2>/dev/null || echo "SSH test failed - run manually on EC2"

echo -e "\n================================================"
echo "✅ Test complete!"