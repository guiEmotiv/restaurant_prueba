#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 DEPLOYMENT VALIDATION SCRIPT
# ═══════════════════════════════════════════════════════════════════════════════
# 
# Valida que el deployment sea seguro y completo
# Uso: ./deploy/validate-deployment.sh
# 
# ═══════════════════════════════════════════════════════════════════════════════

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DOMAIN="xn--elfogndedonsoto-zrb.com"
API_ENDPOINTS=(
    "/api/v1/health/"
    "/api/v1/tables/"
    "/api/v1/recipes/"
    "/api/v1/groups/"
)

echo -e "${BLUE}🔍 Deployment Validation - Restaurant Web${NC}"
echo "═══════════════════════════════════════════════════════════════"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. INFRASTRUCTURE CHECKS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "\n${YELLOW}🏗️ Infrastructure Validation...${NC}"

# Check SSL Certificate
echo -e "🔒 SSL Certificate..."
if curl -s -I "https://www.$DOMAIN" | grep -q "HTTP/2 200"; then
    echo -e "${GREEN}✅ SSL Certificate working${NC}"
else
    echo -e "${RED}❌ SSL Certificate issue${NC}"
fi

# Check if running on correct docker-compose
echo -e "🐳 Docker Services..."
if docker-compose -f docker-compose.ssl.yml ps | grep -q "Up.*healthy"; then
    echo -e "${GREEN}✅ Docker services healthy${NC}"
else
    echo -e "${RED}❌ Docker services not healthy${NC}"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. SECURITY VALIDATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "\n${YELLOW}🛡️ Security Validation...${NC}"

# Check environment file
echo -e "🔧 Environment Configuration..."
if [ -f ".env.ec2" ]; then
    if grep -q "DEBUG=False" .env.ec2 && grep -q "USE_COGNITO_AUTH=True" .env.ec2; then
        echo -e "${GREEN}✅ Production environment configured${NC}"
    else
        echo -e "${RED}❌ Environment not configured for production${NC}"
    fi
else
    echo -e "${RED}❌ .env.ec2 file missing${NC}"
fi

# Check that sensitive files are not in repository
echo -e "🔍 Repository Security..."
if git ls-files | grep -E "\.(pem|key|sqlite3)$|\.env\.ec2$" | grep -v example; then
    echo -e "${RED}❌ Sensitive files found in repository${NC}"
else
    echo -e "${GREEN}✅ No sensitive files in repository${NC}"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. API ENDPOINTS VALIDATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "\n${YELLOW}🌐 API Endpoints Validation...${NC}"

for endpoint in "${API_ENDPOINTS[@]}"; do
    echo -e "Testing: $endpoint"
    response=$(curl -s -o /dev/null -w "%{http_code}" "https://www.$DOMAIN$endpoint")
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✅ $endpoint (Status: $response)${NC}"
    else
        echo -e "${RED}❌ $endpoint (Status: $response)${NC}"
    fi
done

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. IMPORT ENDPOINTS VALIDATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "\n${YELLOW}📥 Import Endpoints Validation...${NC}"

IMPORT_ENDPOINTS=(
    "/import-units/"
    "/import-zones/"
    "/import-tables/"
    "/import-containers/"
    "/import-groups/"
    "/import-ingredients/"
    "/import-recipes/"
)

for endpoint in "${IMPORT_ENDPOINTS[@]}"; do
    echo -e "Testing: $endpoint"
    # Test with GET (should return 405 Method Not Allowed)
    response=$(curl -s -o /dev/null -w "%{http_code}" "https://www.$DOMAIN$endpoint")
    if [ "$response" = "405" ]; then
        echo -e "${GREEN}✅ $endpoint (Properly configured)${NC}"
    else
        echo -e "${YELLOW}⚠️ $endpoint (Status: $response)${NC}"
    fi
done

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. FRONTEND VALIDATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "\n${YELLOW}🎨 Frontend Validation...${NC}"

# Check if frontend loads
echo -e "🌐 Frontend Loading..."
if curl -s "https://www.$DOMAIN/" | grep -q "El Fogón de Don Soto"; then
    echo -e "${GREEN}✅ Frontend loads correctly${NC}"
else
    echo -e "${RED}❌ Frontend loading issue${NC}"
fi

# Check if templates are available
echo -e "📋 Excel Templates..."
if curl -s -o /dev/null -w "%{http_code}" "https://www.$DOMAIN/templates/plantilla_unidades.xlsx" | grep -q "200"; then
    echo -e "${GREEN}✅ Excel templates accessible${NC}"
else
    echo -e "${YELLOW}⚠️ Excel templates might not be accessible${NC}"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 6. DATABASE VALIDATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "\n${YELLOW}💾 Database Validation...${NC}"

# Check database file exists
if [ -f "data/restaurant_prod.sqlite3" ]; then
    size=$(stat -f%z "data/restaurant_prod.sqlite3" 2>/dev/null || stat -c%s "data/restaurant_prod.sqlite3" 2>/dev/null)
    if [ "$size" -gt 0 ]; then
        echo -e "${GREEN}✅ Production database exists ($(($size / 1024))KB)${NC}"
    else
        echo -e "${RED}❌ Production database is empty${NC}"
    fi
else
    echo -e "${RED}❌ Production database not found${NC}"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 7. PERFORMANCE VALIDATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "\n${YELLOW}⚡ Performance Validation...${NC}"

# Test response time
echo -e "⏱️ Response Time..."
response_time=$(curl -o /dev/null -s -w "%{time_total}" "https://www.$DOMAIN/api/v1/health/")
if (( $(echo "$response_time < 2.0" | bc -l) )); then
    echo -e "${GREEN}✅ Response time: ${response_time}s${NC}"
else
    echo -e "${YELLOW}⚠️ Slow response time: ${response_time}s${NC}"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 8. FINAL SUMMARY
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "\n═══════════════════════════════════════════════════════════════"
echo -e "${BLUE}📊 Deployment Validation Summary${NC}"
echo -e "═══════════════════════════════════════════════════════════════"

# System URLs
echo -e "${GREEN}🌐 System URLs:${NC}"
echo -e "   Frontend: https://www.$DOMAIN"
echo -e "   API:      https://www.$DOMAIN/api/v1/"
echo -e "   Admin:    https://www.$DOMAIN/admin/"

# Next steps
echo -e "\n${BLUE}📋 Recommended Actions:${NC}"
echo -e "   1. Test user authentication with AWS Cognito"
echo -e "   2. Verify Excel import functionality"
echo -e "   3. Monitor logs for any errors"
echo -e "   4. Backup database regularly"

echo -e "\n${GREEN}✅ Deployment validation completed!${NC}"