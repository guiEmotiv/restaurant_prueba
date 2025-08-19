#!/bin/bash
# 🏥 HEALTH CHECK SCRIPT
# Comprehensive health checks for the restaurant application

set -e

# Configuration
COLOR=${1:-"blue"}
DOMAIN=${2:-"localhost"}
MAX_RETRIES=${3:-30}
RETRY_INTERVAL=${4:-10}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    local level=$1
    shift
    case $level in
        ERROR) echo -e "${RED}❌ $@${NC}" ;;
        SUCCESS) echo -e "${GREEN}✅ $@${NC}" ;;
        WARNING) echo -e "${YELLOW}⚠️  $@${NC}" ;;
        INFO) echo -e "${BLUE}ℹ️  $@${NC}" ;;
    esac
}

# Wait for service to be ready
wait_for_service() {
    local service_name=$1
    local check_command=$2
    local timeout=$3
    
    log INFO "Waiting for $service_name to be ready..."
    
    for i in $(seq 1 $timeout); do
        if eval "$check_command" &>/dev/null; then
            log SUCCESS "$service_name is healthy"
            return 0
        fi
        
        if [ $i -eq $timeout ]; then
            log ERROR "$service_name failed to start within ${timeout}s"
            return 1
        fi
        
        log INFO "Retry $i/$timeout for $service_name in ${RETRY_INTERVAL}s..."
        sleep $RETRY_INTERVAL
    done
}

# Database health check
check_database() {
    log INFO "Checking database health..."
    
    local container_name="restaurant-backend-$COLOR"
    if [ "$COLOR" = "blue" ] || [ "$COLOR" = "" ]; then
        container_name="restaurant-backend"
    fi
    
    if docker exec "$container_name" python /app/backend/manage.py check --database default &>/dev/null; then
        log SUCCESS "Database connection healthy"
        return 0
    else
        log ERROR "Database connection failed"
        return 1
    fi
}

# Backend API health check
check_backend_api() {
    log INFO "Checking backend API health..."
    
    local backend_url
    if [ "$DOMAIN" = "localhost" ]; then
        backend_url="http://localhost:8000/api/v1/health/"
    else
        backend_url="https://$DOMAIN/api/v1/health/"
    fi
    
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$backend_url" || echo "000")
    
    if [ "$response" = "200" ]; then
        log SUCCESS "Backend API responding"
        return 0
    else
        log ERROR "Backend API not responding (HTTP $response)"
        return 1
    fi
}

# Frontend health check
check_frontend() {
    log INFO "Checking frontend health..."
    
    local frontend_url
    if [ "$DOMAIN" = "localhost" ]; then
        frontend_url="http://localhost:5173/"
    else
        frontend_url="https://$DOMAIN/"
    fi
    
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$frontend_url" || echo "000")
    
    if [ "$response" = "200" ]; then
        log SUCCESS "Frontend responding"
        return 0
    else
        log ERROR "Frontend not responding (HTTP $response)"
        return 1
    fi
}

# Container health check
check_containers() {
    log INFO "Checking container health..."
    
    local backend_container="restaurant-backend"
    local nginx_container="restaurant-nginx"
    
    if [ "$COLOR" != "blue" ] && [ "$COLOR" != "" ]; then
        backend_container="restaurant-backend-$COLOR"
        nginx_container="restaurant-nginx-$COLOR"
    fi
    
    # Check backend container
    if docker ps --filter "name=$backend_container" --filter "status=running" | grep -q "$backend_container"; then
        log SUCCESS "Backend container running"
    else
        log ERROR "Backend container not running"
        return 1
    fi
    
    # Check nginx container (if not localhost)
    if [ "$DOMAIN" != "localhost" ]; then
        if docker ps --filter "name=$nginx_container" --filter "status=running" | grep -q "$nginx_container"; then
            log SUCCESS "Nginx container running"
        else
            log ERROR "Nginx container not running"
            return 1
        fi
    fi
}

# SSL certificate check (for production)
check_ssl() {
    if [ "$DOMAIN" != "localhost" ] && [ "$DOMAIN" != "127.0.0.1" ]; then
        log INFO "Checking SSL certificate..."
        
        local ssl_info=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN":443 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "SSL_ERROR")
        
        if [ "$ssl_info" != "SSL_ERROR" ]; then
            log SUCCESS "SSL certificate valid"
            echo "$ssl_info" | while read line; do
                log INFO "  $line"
            done
        else
            log WARNING "SSL certificate check failed (may be normal for staging)"
        fi
    fi
}

# Functional API tests
check_api_endpoints() {
    log INFO "Testing critical API endpoints..."
    
    local base_url
    if [ "$DOMAIN" = "localhost" ]; then
        base_url="http://localhost:8000/api/v1"
    else
        base_url="https://$DOMAIN/api/v1"
    fi
    
    # Test health endpoint
    if curl -s "$base_url/health/" | grep -q "ok"; then
        log SUCCESS "Health endpoint working"
    else
        log ERROR "Health endpoint failed"
        return 1
    fi
    
    # Test auth debug endpoint
    if curl -s "$base_url/auth-debug/" | grep -q "is_authenticated"; then
        log SUCCESS "Auth debug endpoint working"
    else
        log WARNING "Auth debug endpoint may not be available"
    fi
}

# Memory and resource check
check_resources() {
    log INFO "Checking system resources..."
    
    # Check memory usage
    local memory_usage=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}' 2>/dev/null || echo "unknown")
    if [ "$memory_usage" != "unknown" ]; then
        log INFO "Memory usage: ${memory_usage}%"
        if (( $(echo "$memory_usage > 90" | bc -l 2>/dev/null || echo 0) )); then
            log WARNING "High memory usage detected"
        fi
    fi
    
    # Check disk usage
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//' 2>/dev/null || echo "unknown")
    if [ "$disk_usage" != "unknown" ]; then
        log INFO "Disk usage: ${disk_usage}%"
        if [ "$disk_usage" -gt 85 ]; then
            log WARNING "High disk usage detected"
        fi
    fi
}

# Main health check function
main() {
    echo -e "${BLUE}🏥 === COMPREHENSIVE HEALTH CHECK ===${NC}"
    echo "Environment: $COLOR"
    echo "Domain: $DOMAIN"
    echo ""
    
    local failed_checks=0
    
    # Run all health checks
    check_containers || ((failed_checks++))
    check_database || ((failed_checks++))
    check_backend_api || ((failed_checks++))
    check_frontend || ((failed_checks++))
    check_ssl
    check_api_endpoints || ((failed_checks++))
    check_resources
    
    echo ""
    if [ $failed_checks -eq 0 ]; then
        log SUCCESS "All health checks passed! 🎉"
        echo ""
        echo -e "${GREEN}🚀 SYSTEM READY FOR TRAFFIC${NC}"
        return 0
    else
        log ERROR "$failed_checks health check(s) failed"
        echo ""
        echo -e "${RED}⚠️  SYSTEM NOT READY${NC}"
        return 1
    fi
}

# Wait mode - continuously check until healthy
if [ "${1}" = "--wait" ]; then
    wait_for_service "Complete System" "main" $MAX_RETRIES
else
    main
fi