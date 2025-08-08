#!/bin/bash

echo "=== Verify DNS and Route 53 Configuration ==="
echo "==========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Domain
DOMAIN="xn--elfogndedonsoto-zrb.com"
WWW_DOMAIN="www.$DOMAIN"

echo -e "${BLUE}🌍 DNS Configuration Check${NC}"
echo ""

# 1. Get EC2 instance public IP
echo -e "${BLUE}📍 EC2 Instance Information:${NC}"
INSTANCE_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null)
if [ -n "$INSTANCE_IP" ]; then
    echo "EC2 Public IP: $INSTANCE_IP"
else
    echo -e "${RED}❌ Could not determine EC2 public IP${NC}"
    INSTANCE_IP=$(curl -s ifconfig.me)
    echo "Detected IP: $INSTANCE_IP"
fi

# 2. Check DNS resolution
echo -e "\n${BLUE}🔍 DNS Resolution Check:${NC}"
echo "Checking $WWW_DOMAIN..."
DNS_IPS=$(dig +short $WWW_DOMAIN A 2>/dev/null | grep -E '^[0-9]')
if [ -n "$DNS_IPS" ]; then
    echo "Resolves to: $DNS_IPS"
    if echo "$DNS_IPS" | grep -q "$INSTANCE_IP"; then
        echo -e "${GREEN}✅ DNS points to this EC2 instance${NC}"
    else
        echo -e "${YELLOW}⚠️ DNS does not point to this instance ($INSTANCE_IP)${NC}"
    fi
else
    echo -e "${RED}❌ DNS resolution failed${NC}"
fi

echo -e "\nChecking $DOMAIN (without www)..."
DNS_IPS_NO_WWW=$(dig +short $DOMAIN A 2>/dev/null | grep -E '^[0-9]')
if [ -n "$DNS_IPS_NO_WWW" ]; then
    echo "Resolves to: $DNS_IPS_NO_WWW"
else
    echo "No A record (this is OK if using CNAME to www)"
fi

# 3. Check SSL certificate validity
echo -e "\n${BLUE}🔐 SSL Certificate Check:${NC}"
echo "Testing HTTPS connection to $WWW_DOMAIN..."
SSL_CHECK=$(echo | openssl s_client -servername $WWW_DOMAIN -connect $WWW_DOMAIN:443 2>/dev/null | openssl x509 -noout -text 2>/dev/null)
if [ -n "$SSL_CHECK" ]; then
    echo -e "${GREEN}✅ SSL certificate is valid${NC}"
    # Show certificate details
    echo | openssl s_client -servername $WWW_DOMAIN -connect $WWW_DOMAIN:443 2>/dev/null | openssl x509 -noout -subject -issuer -dates 2>/dev/null
else
    echo -e "${RED}❌ Could not verify SSL certificate${NC}"
fi

# 4. Test HTTP to HTTPS redirect
echo -e "\n${BLUE}🔄 Redirect Tests:${NC}"
echo "Testing HTTP to HTTPS redirect..."
REDIRECT_TEST=$(curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}" http://$WWW_DOMAIN/)
echo "HTTP Response: $REDIRECT_TEST"

# 5. Test final HTTPS endpoint
echo -e "\n${BLUE}🎯 Endpoint Tests:${NC}"
echo "Testing https://$WWW_DOMAIN..."
HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$WWW_DOMAIN/)
if [ "$HTTPS_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ HTTPS endpoint working (status: $HTTPS_STATUS)${NC}"
else
    echo -e "${RED}❌ HTTPS endpoint issue (status: $HTTPS_STATUS)${NC}"
fi

# 6. Route 53 configuration instructions
echo -e "\n${BLUE}📋 Route 53 Configuration Requirements:${NC}"
echo ""
echo "Your Route 53 hosted zone should have:"
echo ""
echo "1. A Record for www.$DOMAIN:"
echo "   - Type: A"
echo "   - Name: www"
echo "   - Value: $INSTANCE_IP"
echo "   - TTL: 300"
echo ""
echo "2. Optional: Redirect naked domain to www:"
echo "   - Type: A"
echo "   - Name: (leave empty for root)"
echo "   - Value: $INSTANCE_IP"
echo "   - TTL: 300"
echo ""
echo "OR use an ALIAS record pointing to an ALB/CloudFront if available"
echo ""
echo -e "${YELLOW}⚠️ Important: If DNS was recently changed, wait up to 5 minutes for propagation${NC}"

# 7. Security group check reminder
echo -e "\n${BLUE}🔒 Security Group Reminder:${NC}"
echo "Ensure your EC2 security group allows:"
echo "- Port 80 (HTTP) from 0.0.0.0/0"
echo "- Port 443 (HTTPS) from 0.0.0.0/0"
echo "- Port 22 (SSH) from your IP"

echo -e "\n${GREEN}✅ DNS verification complete${NC}"