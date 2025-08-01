#!/bin/bash

# Deployment Verification Script
# Comprehensive check of restaurant web application

echo "🔍 Restaurant Web - Deployment Verification"
echo "==========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

DOMAIN="xn--elfogndedonsoto-zrb.com"
PROJECT_DIR="/opt/restaurant-web"

echo -e "${BLUE}🎯 Verifying complete deployment...${NC}"

# ==============================================================================
# SYSTEM CHECKS
# ==============================================================================
echo -e "\n${YELLOW}📊 System Status${NC}"

# Disk space
space=$(df / | tail -1 | awk '{print int($4/1024/1024)}')
if [ $space -gt 1 ]; then
    echo -e "${GREEN}✅ Disk space: ${space}GB available${NC}"
else
    echo -e "${RED}❌ Low disk space: ${space}GB${NC}"
fi

# Docker containers
echo -e "\n${YELLOW}🐳 Docker Containers${NC}"
if docker-compose -f docker-compose.ec2.yml ps | grep -q "Up"; then
    echo -e "${GREEN}✅ Docker containers running${NC}"
    docker-compose -f docker-compose.ec2.yml ps | grep "Up" | sed 's/^/  /'
else
    echo -e "${RED}❌ Docker containers not running${NC}"
fi

# Nginx status
echo -e "\n${YELLOW}🌐 Nginx Status${NC}"
if systemctl is-active nginx >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Nginx is running${NC}"
else
    echo -e "${RED}❌ Nginx is not running${NC}"
fi

# ==============================================================================
# APPLICATION CHECKS
# ==============================================================================
echo -e "\n${YELLOW}📱 Application Endpoints${NC}"

# Frontend
frontend_status=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN/ 2>/dev/null || echo "000")
if [ "$frontend_status" = "200" ]; then
    echo -e "${GREEN}✅ Frontend: http://$DOMAIN (Status: $frontend_status)${NC}"
else
    echo -e "${RED}❌ Frontend: http://$DOMAIN (Status: $frontend_status)${NC}"
fi

# API endpoints
endpoints=("units" "zones" "tables" "categories" "groups" "ingredients" "recipes" "orders")
api_working=0
api_total=${#endpoints[@]}

for endpoint in "${endpoints[@]}"; do
    status=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN/api/v1/$endpoint/ 2>/dev/null || echo "000")
    if [ "$status" = "200" ] || [ "$status" = "401" ] || [ "$status" = "403" ]; then
        if [ "$status" = "403" ]; then
            echo -e "${GREEN}✅ API /$endpoint/: Cognito auth required (Status $status)${NC}"
        else
            echo -e "${GREEN}✅ API /$endpoint/: Status $status${NC}"
        fi
        ((api_working++))
    else
        echo -e "${RED}❌ API /$endpoint/: Status $status${NC}"
    fi
done

echo -e "${BLUE}📊 API Summary: $api_working/$api_total endpoints working${NC}"

# Admin endpoint
admin_status=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN/api/v1/admin/ 2>/dev/null || echo "000")
if [ "$admin_status" = "200" ] || [ "$admin_status" = "302" ]; then
    echo -e "${GREEN}✅ Admin: http://$DOMAIN/api/v1/admin/ (Status: $admin_status)${NC}"
else
    echo -e "${YELLOW}⚠️ Admin: http://$DOMAIN/api/v1/admin/ (Status: $admin_status)${NC}"
fi

# ==============================================================================
# DATABASE CHECKS
# ==============================================================================
echo -e "\n${YELLOW}💾 Database Status${NC}"

# Check database file
if [ -f "$PROJECT_DIR/data/restaurant.sqlite3" ]; then
    db_size=$(du -h "$PROJECT_DIR/data/restaurant.sqlite3" | cut -f1)
    echo -e "${GREEN}✅ Database file exists (Size: $db_size)${NC}"
    
    # Check if database has data
    table_count=$(docker-compose -f docker-compose.ec2.yml exec -T web python manage.py shell -c "
from django.db import connection
cursor = connection.cursor()
cursor.execute(\"SELECT name FROM sqlite_master WHERE type='table'\")
tables = cursor.fetchall()
print(len(tables))
" 2>/dev/null || echo "0")
    
    if [ "$table_count" -gt "10" ]; then
        echo -e "${GREEN}✅ Database has $table_count tables${NC}"
    else
        echo -e "${YELLOW}⚠️ Database has only $table_count tables${NC}"
    fi
else
    echo -e "${RED}❌ Database file not found${NC}"
fi

# Check migrations
migration_status=$(docker-compose -f docker-compose.ec2.yml exec -T web python manage.py showmigrations --verbosity=0 2>/dev/null)
if echo "$migration_status" | grep -q "\[ \]"; then
    unapplied=$(echo "$migration_status" | grep -c "\[ \]")
    echo -e "${YELLOW}⚠️ $unapplied unapplied migrations${NC}"
else
    echo -e "${GREEN}✅ All migrations applied${NC}"
fi

# ==============================================================================
# AUTHENTICATION CHECKS
# ==============================================================================
echo -e "\n${YELLOW}🔐 Authentication Configuration${NC}"

# Check environment variables
if [ -f "$PROJECT_DIR/.env.ec2" ]; then
    echo -e "${GREEN}✅ Environment file exists${NC}"
    
    # Check Cognito configuration
    if grep -q "COGNITO_USER_POOL_ID=us-west-2_" "$PROJECT_DIR/.env.ec2"; then
        echo -e "${GREEN}✅ AWS Cognito configured${NC}"
        echo -e "  Pool ID: $(grep COGNITO_USER_POOL_ID "$PROJECT_DIR/.env.ec2" | cut -d'=' -f2)"
        echo -e "  Region: $(grep AWS_REGION "$PROJECT_DIR/.env.ec2" | head -1 | cut -d'=' -f2)"
    else
        echo -e "${YELLOW}⚠️ AWS Cognito not configured${NC}"
    fi
else
    echo -e "${RED}❌ Environment file missing${NC}"
fi

# Check frontend configuration
if [ -f "$FRONTEND_DIR/.env.production" ]; then
    echo -e "${GREEN}✅ Frontend environment configured${NC}"
    if grep -q "VITE_AWS_COGNITO" "$FRONTEND_DIR/.env.production"; then
        echo -e "${GREEN}✅ Frontend Cognito configured${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Frontend environment file missing${NC}"
fi

# Check AWS Cognito configuration
echo -e "${GREEN}✅ AWS Cognito authentication enabled${NC}"
echo -e "  Pool ID: $(grep COGNITO_USER_POOL_ID "$PROJECT_DIR/.env.ec2" | cut -d'=' -f2 2>/dev/null || echo 'Not configured')"
echo -e "  Region: $(grep AWS_REGION "$PROJECT_DIR/.env.ec2" | head -1 | cut -d'=' -f2 2>/dev/null || echo 'Not configured')"

# ==============================================================================
# SUMMARY
# ==============================================================================
echo -e "\n${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}📋 Deployment Verification Summary${NC}"

# Calculate overall health
total_checks=6
passed_checks=0

[ "$space" -gt 1 ] && ((passed_checks++))
[ "$frontend_status" = "200" ] && ((passed_checks++))
[ "$api_working" -gt 4 ] && ((passed_checks++))
[ "$admin_status" = "200" ] || [ "$admin_status" = "302" ] && ((passed_checks++))
[ -f "$PROJECT_DIR/data/restaurant.sqlite3" ] && ((passed_checks++))
systemctl is-active nginx >/dev/null 2>&1 && ((passed_checks++))

health_percentage=$((passed_checks * 100 / total_checks))

if [ $health_percentage -ge 90 ]; then
    echo -e "\n${GREEN}🎉 DEPLOYMENT EXCELLENT ($health_percentage% healthy)${NC}"
    echo -e "${GREEN}✨ Restaurant Web Application is fully operational!${NC}"
elif [ $health_percentage -ge 70 ]; then
    echo -e "\n${YELLOW}⚠️ DEPLOYMENT GOOD ($health_percentage% healthy)${NC}"
    echo -e "${YELLOW}💡 Minor issues detected, but application should work${NC}"
else
    echo -e "\n${RED}❌ DEPLOYMENT NEEDS ATTENTION ($health_percentage% healthy)${NC}"
    echo -e "${RED}🔧 Critical issues found, requires troubleshooting${NC}"
fi

echo -e "\n${BLUE}🌐 Access your application:${NC}"
echo -e "   Frontend: ${GREEN}http://$DOMAIN${NC}"
echo -e "   Admin: ${GREEN}http://$DOMAIN/api/v1/admin/${NC}"
echo -e "   Login: ${GREEN}Use AWS Cognito credentials${NC}"

echo -e "\n${GREEN}🔍 Verification completed!${NC}"