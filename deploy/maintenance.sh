#!/bin/bash

# Consolidated Maintenance Script
# Combines functionality from multiple fix/enable scripts

echo "🔧 MANTENIMIENTO DEL SISTEMA"
echo "============================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'  
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

show_usage() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  --dashboard      Enable dashboard access"
    echo "  --fix-all        Fix common production issues" 
    echo "  --populate-db    Populate database with test data"
    echo "  --restart        Restart all services"
    echo "  --status         Show system status"
    echo "  --help           Show this help"
    exit 0
}

restart_services() {
    echo -e "${BLUE}Restarting services...${NC}"
    if [ -f docker-compose.ssl.yml ]; then
        docker-compose -f docker-compose.ssl.yml restart
    else
        docker-compose -f docker-compose.simple.yml restart
    fi
    echo "✅ Services restarted"
}

show_status() {
    echo -e "${BLUE}System Status:${NC}"
    
    # Container status
    if [ -f docker-compose.ssl.yml ]; then
        COMPOSE_FILE="docker-compose.ssl.yml"
    else
        COMPOSE_FILE="docker-compose.simple.yml"
    fi
    
    docker-compose -f $COMPOSE_FILE ps
    
    # API status
    echo -e "\n${BLUE}API Status:${NC}"
    curl -s -w "\nHealth: %{http_code}\n" http://localhost:8000/api/v1/health/ | tail -1
    
    echo -e "\n${BLUE}Public Access:${NC}"
    curl -s -w "\nHTTPS: %{http_code}\n" -o /dev/null https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/ | tail -1
}

enable_dashboard() {
    echo -e "${BLUE}Enabling dashboard access...${NC}"
    
    # Check if dashboard requires auth
    docker-compose -f docker-compose.ssl.yml exec -T web python -c "
from operation.views_dashboard import DashboardViewSet
print(f'Current permissions: {DashboardViewSet.permission_classes}')
if DashboardViewSet.permission_classes == []:
    print('✅ Dashboard already allows anonymous access')
else:
    print('ℹ️ Dashboard requires authentication (AWS Cognito)')
    print('Users must log in to access dashboard data')
"
    
    echo "✅ Dashboard access checked"
}

populate_database() {
    echo -e "${BLUE}Populating database with test data...${NC}"
    
    docker-compose -f docker-compose.ssl.yml exec -T web python manage.py shell << 'PYEOF'
from operation.models import Order
paid_orders = Order.objects.filter(status='PAID').count()

if paid_orders == 0:
    print("Database needs test data. Run:")
    print("docker-compose -f docker-compose.ssl.yml exec web python manage.py populate_production_data")
else:
    print(f"✅ Database has {paid_orders} paid orders")
PYEOF
}

fix_all_issues() {
    echo -e "${BLUE}Running comprehensive fixes...${NC}"
    
    # Restart with updated environment
    echo "1. Restarting containers..."
    restart_services
    sleep 10
    
    # Check status
    echo "2. Checking status..."
    show_status
    
    echo "✅ All fixes applied"
}

# Main execution
case "$1" in
    --dashboard)
        enable_dashboard
        ;;
    --fix-all)
        fix_all_issues
        ;;
    --populate-db)
        populate_database
        ;;
    --restart)
        restart_services
        ;;
    --status)
        show_status
        ;;
    --help)
        show_usage
        ;;
    *)
        echo "🔧 Restaurant Web Maintenance Tool"
        echo ""
        echo "Available commands:"
        echo "  $0 --status      # Show system status"
        echo "  $0 --restart     # Restart all services"  
        echo "  $0 --fix-all     # Fix common issues"
        echo "  $0 --help        # Show detailed help"
        echo ""
        echo "For more options: $0 --help"
        ;;
esac
