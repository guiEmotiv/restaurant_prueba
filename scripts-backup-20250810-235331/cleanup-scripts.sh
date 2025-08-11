#!/bin/bash

# Automated Script Cleanup
echo "🧹 LIMPIEZA AUTOMATIZADA DE SCRIPTS"
echo "==================================="

cd /Users/guillermosotozuniga/restaurant-web/deploy

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. Create backup directory
echo -e "\n1️⃣ ${BLUE}Creando backup de scripts...${NC}"
BACKUP_DIR="../scripts-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r . "$BACKUP_DIR/"
echo "✅ Backup creado en: $BACKUP_DIR"

# 2. Define scripts to keep
ESSENTIAL_SCRIPTS=(
    "build-deploy.sh"
    "setup-initial.sh" 
    "final-fix.sh"
    "diagnose-connection.sh"
    "enable-ssl.sh"
    "audit-scripts.sh"
    "cleanup-scripts.sh"
)

ESSENTIAL_DOCS=(
    "README.md"
    "cleanup-plan.md"
)

ESSENTIAL_CONF=(
    "nginx.conf"
)

# 3. Create consolidated maintenance script
echo -e "\n2️⃣ ${BLUE}Creando script consolidado de mantenimiento...${NC}"
cat > maintenance.sh << 'EOF'
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
EOF

chmod +x maintenance.sh
echo "✅ maintenance.sh creado"

# 4. Optimize build-deploy.sh (keep current, it's already good)
echo -e "\n3️⃣ ${BLUE}build-deploy.sh ya está optimizado${NC}"

# 5. Create consolidated documentation
echo -e "\n4️⃣ ${BLUE}Creando documentación consolidada...${NC}"
cat > DEPLOYMENT.md << 'EOF'
# 🚀 Restaurant Web - Deployment Guide

## Quick Start

### Initial Setup
```bash
sudo ./setup-initial.sh
```

### Main Deployment
```bash
# Full deployment
sudo ./build-deploy.sh

# Frontend only
sudo ./build-deploy.sh --frontend-only

# Backend only  
sudo ./build-deploy.sh --backend-only
```

### SSL/HTTPS
```bash
sudo ./enable-ssl.sh
```

### Maintenance
```bash
# System status
./maintenance.sh --status

# Fix issues
./maintenance.sh --fix-all

# Restart services
./maintenance.sh --restart
```

### Diagnostics
```bash
./diagnose-connection.sh
```

### Final Fixes (if needed)
```bash
sudo ./final-fix.sh
```

## File Structure

- `build-deploy.sh` - Main deployment script
- `setup-initial.sh` - Initial project setup
- `maintenance.sh` - System maintenance tasks
- `enable-ssl.sh` - SSL configuration
- `final-fix.sh` - Final fixes and validation
- `diagnose-connection.sh` - Complete system diagnosis

## Troubleshooting

1. **Site not accessible**: Run `./diagnose-connection.sh`
2. **API errors**: Run `./maintenance.sh --fix-all`
3. **SSL issues**: Run `./enable-ssl.sh`
4. **Dashboard errors**: Check if user is logged in with AWS Cognito

## Support

For issues, check logs:
```bash
docker-compose logs -f
```
EOF

echo "✅ DEPLOYMENT.md creado"

# 6. List files to delete
echo -e "\n5️⃣ ${BLUE}Identificando archivos para eliminar...${NC}"

TO_DELETE=()

# Debug/Test scripts
for script in debug-*.sh test-*.sh check-*.sh; do
    if [[ -f "$script" && "$script" != "diagnose-connection.sh" ]]; then
        TO_DELETE+=("$script")
    fi
done

# Fix scripts (keeping only final-fix.sh)
for script in fix-*.sh; do
    if [[ -f "$script" && "$script" != "final-fix.sh" ]]; then
        TO_DELETE+=("$script")
    fi
done

# Specific obsolete scripts
OBSOLETE_SCRIPTS=(
    "emergency-fix-www.sh"
    "force-fix-allowed-hosts.sh"
    "quick-fix-domain.sh"
    "smart-deploy.sh"  
    "update-and-deploy.sh"
    "backend-only.sh"
    "frontend-only.sh"
    "rebuild-frontend-ec2.sh"
    "rebuild-frontend-www.sh"
    "frontend-build.sh"
    "setup-ssl-https-only.sh"
    "setup-ssl-production.sh"
    "validate-ssl.sh"
    "verify-dns-route53.sh"
)

for script in "${OBSOLETE_SCRIPTS[@]}"; do
    if [[ -f "$script" ]]; then
        TO_DELETE+=("$script")
    fi
done

# Redundant docs
REDUNDANT_DOCS=(
    "DOMAIN-FIX-README.md"
    "DOMAIN-SETUP-GUIDE.md"
    "EC2-DEPLOYMENT.md"
    "FRONTEND_TROUBLESHOOTING.md"
)

for doc in "${REDUNDANT_DOCS[@]}"; do
    if [[ -f "$doc" ]]; then
        TO_DELETE+=("$doc")
    fi
done

# 7. Show deletion plan
echo -e "\n6️⃣ ${BLUE}Plan de eliminación:${NC}"
echo "Archivos a eliminar (${#TO_DELETE[@]} total):"
for file in "${TO_DELETE[@]}"; do
    echo "  🗑️  $file"
done

# 8. Ask for confirmation
echo -e "\n7️⃣ ${YELLOW}¿Proceder con la eliminación? [y/N]${NC}"
read -r CONFIRM

if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo -e "\n${RED}Eliminando archivos...${NC}"
    for file in "${TO_DELETE[@]}"; do
        if [[ -f "$file" ]]; then
            rm "$file"
            echo "🗑️  Eliminado: $file"
        fi
    done
    
    echo -e "\n${GREEN}✅ LIMPIEZA COMPLETADA${NC}"
    echo "=============================="
    echo "Archivos eliminados: ${#TO_DELETE[@]}"
    echo "Backup disponible en: $BACKUP_DIR"
    
    echo -e "\n${BLUE}Archivos restantes:${NC}"
    ls -la
    
    echo -e "\n${GREEN}Archivos esenciales mantenidos:${NC}"
    for script in "${ESSENTIAL_SCRIPTS[@]}"; do
        if [[ -f "$script" ]]; then
            echo "✅ $script"
        fi
    done
    echo "✅ maintenance.sh (nuevo)"
    echo "✅ DEPLOYMENT.md (nuevo)"
    
else
    echo "Operación cancelada. No se eliminó ningún archivo."
fi

echo -e "\n${BLUE}Para completar la limpieza:${NC}"
echo "1. Revisar archivos restantes"
echo "2. Probar scripts esenciales"
echo "3. Actualizar documentación si necesario"
echo "4. Hacer commit de los cambios"