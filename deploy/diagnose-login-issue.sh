#!/bin/bash

# Diagnose Login Issue Script
# Run this on EC2 to identify the login problem

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

echo "🔍 Diagnosing Login Issue"
echo "========================"

# 1. Check if container is running
print_info "1. Checking container status..."
if docker ps | grep -q restaurant_web_ec2; then
    print_success "Container is running"
    docker ps | grep restaurant_web_ec2
else
    print_error "Container is not running!"
    echo "Run: docker-compose -f docker-compose.ec2.yml up -d"
    exit 1
fi

echo ""

# 2. Check if API is responding
print_info "2. Testing API availability..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/ | grep -q "200\|404"; then
    print_success "API is responding"
else
    print_error "API is not responding"
    print_info "Recent container logs:"
    docker logs restaurant_web_ec2 --tail 10
fi

echo ""

# 3. Test auth endpoint specifically
print_info "3. Testing auth endpoint..."
auth_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/auth/login/ || echo "000")
echo "Auth endpoint status: $auth_status"

if [ "$auth_status" = "405" ]; then
    print_success "Auth endpoint exists (Method Not Allowed is expected for GET)"
elif [ "$auth_status" = "400" ]; then
    print_warning "Auth endpoint exists but returns 400 (likely missing data)"
else
    print_error "Auth endpoint issue - Status: $auth_status"
fi

echo ""

# 4. Check if restaurant users exist in database
print_info "4. Checking if restaurant users exist in database..."
user_count=$(docker-compose -f docker-compose.ec2.yml exec -T web python manage.py shell -c "
from authentication.models import RestaurantUser
print(RestaurantUser.objects.count())
" 2>/dev/null || echo "0")

echo "Users in database: $user_count"

if [ "$user_count" = "0" ]; then
    print_error "No users found in database!"
    print_info "You need to create users:"
    echo "  docker-compose -f docker-compose.ec2.yml exec web python manage.py create_restaurant_users"
else
    print_success "Users exist in database"
    
    # List users
    print_info "Listing existing users:"
    docker-compose -f docker-compose.ec2.yml exec -T web python manage.py shell -c "
from authentication.models import RestaurantUser
for user in RestaurantUser.objects.all():
    print(f'  - {user.username} ({user.role}) - Active: {user.is_active}')
" 2>/dev/null || print_warning "Could not list users"
fi

echo ""

# 5. Test actual login with curl
print_info "5. Testing login with curl..."
login_response=$(curl -s -X POST http://localhost/api/v1/auth/login/ \
    -H "Content-Type: application/json" \
    -d '{"username": "admin", "password": "Admin123!"}' || echo "curl_failed")

if [ "$login_response" = "curl_failed" ]; then
    print_error "Curl request failed"
else
    echo "Login response:"
    echo "$login_response" | jq . 2>/dev/null || echo "$login_response"
    
    if echo "$login_response" | grep -q "token"; then
        print_success "Login successful!"
    elif echo "$login_response" | grep -q "non_field_errors"; then
        print_error "Login failed - Invalid credentials or user doesn't exist"
    else
        print_warning "Unexpected response"
    fi
fi

echo ""

# 6. Check Django logs for auth errors
print_info "6. Recent Django logs (auth related)..."
docker logs restaurant_web_ec2 --tail 50 | grep -i "auth\|login\|user\|error" | tail -10 || print_info "No recent auth logs found"

echo ""

# 7. Database tables check
print_info "7. Checking database tables..."
tables_info=$(docker-compose -f docker-compose.ec2.yml exec -T web python manage.py shell -c "
from django.db import connection
cursor = connection.cursor()
cursor.execute(\"SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%user%' OR name LIKE '%auth%'\")
tables = cursor.fetchall()
for table in tables:
    print(f'  - {table[0]}')
" 2>/dev/null || echo "Could not check tables")

echo "Database tables:"
echo "$tables_info"

echo ""
echo "🔧 RECOMMENDED ACTIONS:"
echo "======================="

if [ "$user_count" = "0" ]; then
    echo "1. 🚨 CREATE USERS FIRST:"
    echo "   docker-compose -f docker-compose.ec2.yml exec web python manage.py create_restaurant_users"
    echo ""
fi

echo "2. 📋 If users exist but login fails, check:"
echo "   - Username/password are correct"
echo "   - User is active (is_active=True)"
echo "   - No typos in credentials"
echo ""

echo "3. 🔄 If still failing, restart container:"
echo "   docker-compose -f docker-compose.ec2.yml restart"
echo ""

echo "4. 🧹 If migration issues persist:"
echo "   ./deploy/ec2-deploy.sh clean"
echo ""

print_info "Diagnosis complete!"