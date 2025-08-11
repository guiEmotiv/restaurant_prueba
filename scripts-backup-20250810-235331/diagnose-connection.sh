#!/bin/bash

# Diagnose Frontend-Backend-Database Connection
echo "🔍 DIAGNOSTICANDO CONEXIÓN COMPLETA"
echo "==================================="

cd /opt/restaurant-web

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. Verificar Base de Datos
echo -e "\n1️⃣ ${BLUE}VERIFICANDO BASE DE DATOS${NC}"
echo "==============================="

# Check if database file exists
DB_PATH="/opt/restaurant-web/data/db.sqlite3"
if [ -f "$DB_PATH" ]; then
    echo -e "${GREEN}✅ Archivo de base de datos existe${NC}"
    ls -lh $DB_PATH
else
    echo -e "${RED}❌ Base de datos no encontrada en $DB_PATH${NC}"
fi

# Check database inside container
echo -e "\nVerificando base de datos en el contenedor..."
docker-compose -f docker-compose.ssl.yml exec -T web python manage.py shell << 'EOF'
from django.db import connection
from django.conf import settings
import os

print(f"Database path: {settings.DATABASES['default']['NAME']}")
print(f"Database exists: {os.path.exists(settings.DATABASES['default']['NAME'])}")

# Test connection
try:
    with connection.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
        table_count = cursor.fetchone()[0]
        print(f"✅ Database connection OK - Tables: {table_count}")
except Exception as e:
    print(f"❌ Database error: {e}")

# Check specific tables
from config.models import Table, Zone
from inventory.models import Recipe
from operation.models import Order

try:
    print(f"\nData counts:")
    print(f"  Zones: {Zone.objects.count()}")
    print(f"  Tables: {Table.objects.count()}")
    print(f"  Recipes: {Recipe.objects.count()}")
    print(f"  Orders: {Order.objects.count()}")
    print(f"  Paid Orders: {Order.objects.filter(status='PAID').count()}")
except Exception as e:
    print(f"❌ Error counting data: {e}")
EOF

# 2. Verificar Backend API
echo -e "\n2️⃣ ${BLUE}VERIFICANDO BACKEND API${NC}"
echo "=========================="

# Test health endpoint
echo -e "\nHealth check:"
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" http://localhost:8000/api/v1/health/)
echo "$HEALTH_RESPONSE" | head -n -1
HTTP_STATUS=$(echo "$HEALTH_RESPONSE" | tail -n 1 | cut -d':' -f2)
if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Backend API está funcionando${NC}"
else
    echo -e "${RED}❌ Backend API no responde (Status: $HTTP_STATUS)${NC}"
fi

# Test tables endpoint
echo -e "\nTables endpoint:"
TABLES_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" http://localhost:8000/api/v1/tables/)
TABLES_COUNT=$(echo "$TABLES_RESPONSE" | head -n -1 | jq '. | length' 2>/dev/null || echo "0")
echo "Tables found: $TABLES_COUNT"

# Test dashboard endpoint
echo -e "\nDashboard endpoint (sin autenticación):"
DASHBOARD_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "http://localhost:8000/api/v1/dashboard/report/?date=$(date +%Y-%m-%d)")
DASHBOARD_STATUS=$(echo "$DASHBOARD_RESPONSE" | tail -n 1 | cut -d':' -f2)
echo "Status: $DASHBOARD_STATUS"
if [ "$DASHBOARD_STATUS" != "200" ]; then
    echo "Response body:"
    echo "$DASHBOARD_RESPONSE" | head -n -1 | jq . 2>/dev/null || echo "$DASHBOARD_RESPONSE" | head -n -1
fi

# 3. Verificar Frontend
echo -e "\n3️⃣ ${BLUE}VERIFICANDO FRONTEND${NC}"
echo "======================="

# Check if frontend files exist
echo "Frontend files in nginx:"
docker-compose -f docker-compose.ssl.yml exec -T nginx ls -la /var/www/html/ | head -10

# Check frontend environment
echo -e "\nFrontend API configuration:"
docker-compose -f docker-compose.ssl.yml exec -T nginx grep -E "VITE_API_URL|VITE_AWS" /var/www/html/index.html || echo "No env vars found in index.html"

# 4. Verificar CORS
echo -e "\n4️⃣ ${BLUE}VERIFICANDO CORS${NC}"
echo "==================="

# Test CORS headers
echo "Testing CORS headers:"
curl -s -I -X OPTIONS \
  -H "Origin: https://www.xn--elfogndedonsoto-zrb.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  http://localhost:8000/api/v1/tables/ | grep -i "access-control"

# 5. Verificar Cognito
echo -e "\n5️⃣ ${BLUE}VERIFICANDO AWS COGNITO${NC}"
echo "=========================="

# Check Cognito configuration
docker-compose -f docker-compose.ssl.yml exec -T web python -c "
import os
print(f'AWS_COGNITO_USER_POOL_ID: {os.getenv(\"AWS_COGNITO_USER_POOL_ID\", \"NOT SET\")}')
print(f'AWS_COGNITO_APP_CLIENT_ID: {os.getenv(\"AWS_COGNITO_APP_CLIENT_ID\", \"NOT SET\")}')
print(f'AWS_REGION: {os.getenv(\"AWS_REGION\", \"NOT SET\")}')
"

# 6. Verificar Logs
echo -e "\n6️⃣ ${BLUE}ÚLTIMOS ERRORES${NC}"
echo "=================="

echo "Django errors (últimas 20 líneas):"
docker-compose -f docker-compose.ssl.yml logs --tail=20 web 2>&1 | grep -E "(ERROR|CRITICAL|400|401|403|500)" || echo "No errors found"

echo -e "\nNginx errors:"
docker-compose -f docker-compose.ssl.yml exec -T nginx tail -20 /var/log/nginx/error.log 2>/dev/null || echo "No nginx error log"

# 7. Test from browser perspective
echo -e "\n7️⃣ ${BLUE}TEST DESDE NAVEGADOR${NC}"
echo "======================="

# Test public API access
echo "Testing public API access:"
PUBLIC_API_TEST=$(curl -s -w "\nSTATUS:%{http_code}" https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/)
echo "$PUBLIC_API_TEST"

# Summary
echo -e "\n📊 ${YELLOW}RESUMEN DE DIAGNÓSTICO${NC}"
echo "========================"

echo -e "\n${YELLOW}Posibles problemas:${NC}"
echo "1. Si la base de datos está vacía: Ejecute populate_production_data"
echo "2. Si el dashboard devuelve 400: Puede ser falta de autenticación"
echo "3. Si CORS falla: Revisar configuración de nginx"
echo "4. Si Cognito no está configurado: Revisar variables de entorno"

echo -e "\n${GREEN}Comandos útiles:${NC}"
echo "- Popular base de datos: docker-compose -f docker-compose.ssl.yml exec web python manage.py populate_production_data"
echo "- Ver logs en tiempo real: docker-compose -f docker-compose.ssl.yml logs -f"
echo "- Reiniciar servicios: docker-compose -f docker-compose.ssl.yml restart"