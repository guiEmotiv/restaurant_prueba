#!/bin/bash

# Security Check Script for Restaurant Web Production
# Validates critical security configurations before deployment

set -e

echo "🔒 RESTAURANT WEB - SECURITY CHECK"
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

echo "📋 Checking production security configuration..."

# Check 1: SECRET_KEY is not default
if grep -q "your-production-secret-key-change-this" .env.ec2 2>/dev/null; then
    echo -e "${RED}❌ CRITICAL: Default SECRET_KEY found in .env.ec2${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ SECRET_KEY is properly configured${NC}"
fi

# Check 2: USE_COGNITO_AUTH is enabled
if ! grep -q "USE_COGNITO_AUTH=True" .env.ec2; then
    echo -e "${RED}❌ CRITICAL: USE_COGNITO_AUTH is not set to True${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ Cognito authentication is enabled${NC}"
fi

# Check 3: DEBUG is disabled
if grep -q "DEBUG=True" .env.ec2; then
    echo -e "${RED}❌ CRITICAL: DEBUG is enabled in production${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ DEBUG is disabled${NC}"
fi

# Check 4: ALLOWED_HOSTS doesn't contain wildcard
if grep -q "ALLOWED_HOSTS=.*\*" .env.ec2; then
    echo -e "${RED}❌ CRITICAL: ALLOWED_HOSTS contains wildcard (*)${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ ALLOWED_HOSTS is properly restricted${NC}"
fi

# Check 5: Required Cognito settings
if ! grep -q "COGNITO_USER_POOL_ID=" .env.ec2 || ! grep -q "COGNITO_APP_CLIENT_ID=" .env.ec2; then
    echo -e "${YELLOW}⚠️  WARNING: Cognito settings may be incomplete${NC}"
fi

# Check 6: SSL configuration exists
if [ ! -f "nginx/conf.d/ssl.conf" ]; then
    echo -e "${RED}❌ CRITICAL: SSL configuration file missing${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ SSL configuration file exists${NC}"
fi

# Check 7: Rate limiting is configured
if ! grep -q "limit_req_zone" nginx/conf.d/ssl.conf; then
    echo -e "${YELLOW}⚠️  WARNING: Rate limiting not configured in nginx${NC}"
else
    echo -e "${GREEN}✅ Rate limiting is configured${NC}"
fi

echo ""
echo "🔒 Security Check Summary:"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All critical security checks passed!${NC}"
    echo "🚀 Safe to deploy to production"
    exit 0
else
    echo -e "${RED}❌ $ERRORS critical security issue(s) found${NC}"
    echo "🛑 Fix these issues before deploying to production"
    exit 1
fi