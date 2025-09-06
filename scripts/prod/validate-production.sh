#!/bin/bash

# PRODUCTION VALIDATION SCRIPT
# Valida completamente el ambiente de producción después de deployment

set -e

echo "🔍 VALIDACIÓN COMPLETA DE PRODUCCIÓN"
echo "====================================="

# Configuración
EC2_HOST="44.248.47.186"
EC2_USER="ubuntu"
PROD_DOMAIN="www.xn--elfogndedonsoto-zrb.com"
COGNITO_USER_POOL_ID="us-west-2_bdCwF60ZI"

echo "🌐 Validando infraestructura de producción..."
echo "=============================================="

# Validación 1: Conectividad EC2
echo "📡 1. Conectividad EC2..."
if ping -c 3 ${EC2_HOST} > /dev/null 2>&1; then
    echo "   ✅ EC2 instance accesible"
else
    echo "   ❌ EC2 instance no accesible"
    exit 1
fi

# Validación 2: Servicios Docker
echo "🐳 2. Servicios Docker..."
ssh ${EC2_USER}@${EC2_HOST} << 'EOF'
    echo "   📋 Estado de contenedores:"
    docker-compose -f /home/ubuntu/restaurant-web/docker-compose.prod.yml ps
    
    echo "   🔍 Verificando contenedor aplicación:"
    if docker ps | grep restaurant-app | grep -q "Up"; then
        echo "   ✅ Contenedor aplicación ejecutándose"
    else
        echo "   ❌ Contenedor aplicación no ejecutándose"
        exit 1
    fi
    
    echo "   🔍 Verificando contenedor nginx:"
    if docker ps | grep restaurant-nginx | grep -q "Up"; then
        echo "   ✅ Contenedor nginx ejecutándose"
    else
        echo "   ❌ Contenedor nginx no ejecutándose"
        exit 1
    fi
EOF

# Validación 3: Health Endpoints
echo "🩺 3. Health Endpoints..."
sleep 5

# Health check interno
if ssh ${EC2_USER}@${EC2_HOST} "curl -f -s http://localhost:8000/api/v1/health/" > /dev/null; then
    echo "   ✅ Health endpoint interno respondiendo"
else
    echo "   ❌ Health endpoint interno no responde"
fi

# Health check público
if curl -f -s "https://${PROD_DOMAIN}/api/v1/health/" > /dev/null; then
    echo "   ✅ Health endpoint público respondiendo"
else
    echo "   ⚠️  Health endpoint público no responde (verificar SSL/nginx)"
fi

# Validación 4: AWS Cognito Integration
echo "🔐 4. AWS Cognito Integration..."

# Verificar configuración Cognito en backend
COGNITO_CONFIG=$(ssh ${EC2_USER}@${EC2_HOST} "curl -s http://localhost:8000/api/v1/auth/cognito-config/" 2>/dev/null || echo "ERROR")

if [[ "$COGNITO_CONFIG" != "ERROR" ]] && echo "$COGNITO_CONFIG" | grep -q "$COGNITO_USER_POOL_ID"; then
    echo "   ✅ AWS Cognito configurado correctamente"
    echo "   📋 Pool ID: $COGNITO_USER_POOL_ID"
else
    echo "   ❌ AWS Cognito no configurado correctamente"
    echo "   📋 Respuesta: $COGNITO_CONFIG"
fi

# Validación 5: Base de Datos
echo "🗄️  5. Base de Datos..."
ssh ${EC2_USER}@${EC2_HOST} << 'EOF'
    cd /home/ubuntu/restaurant-web
    
    echo "   📊 Verificando migraciones:"
    if docker exec restaurant-app python manage.py showmigrations --list | grep -q "\[X\]"; then
        echo "   ✅ Migraciones aplicadas correctamente"
    else
        echo "   ⚠️  Verificar estado de migraciones"
    fi
    
    echo "   📋 Tablas principales:"
    docker exec restaurant-app python manage.py shell -c "
from django.db import connection
cursor = connection.cursor()
cursor.execute(\"SELECT name FROM sqlite_master WHERE type='table'\")
tables = [row[0] for row in cursor.fetchall()]
print(f'   📊 {len(tables)} tablas encontradas')
for table in sorted(tables)[:10]:  # Mostrar primeras 10
    print(f'   - {table}')
" || echo "   ⚠️  Error accediendo a base de datos"
EOF

# Validación 6: APIs Principales
echo "🌐 6. APIs Principales..."

# Lista de endpoints críticos para validar
ENDPOINTS=(
    "/api/v1/health/"
    "/api/v1/auth/cognito-config/"
    "/api/v1/config/restaurant/"
    "/api/v1/operation/menu/"
)

for endpoint in "${ENDPOINTS[@]}"; do
    if curl -f -s "https://${PROD_DOMAIN}${endpoint}" > /dev/null; then
        echo "   ✅ ${endpoint}"
    else
        echo "   ❌ ${endpoint}"
    fi
done

# Validación 7: Frontend Assets
echo "📱 7. Frontend Assets..."

if curl -f -s "https://${PROD_DOMAIN}/" | grep -q "Restaurant Web"; then
    echo "   ✅ Frontend cargando correctamente"
else
    echo "   ⚠️  Frontend no carga correctamente"
fi

# Validación 8: Performance básico
echo "⚡ 8. Performance básico..."

RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' "https://${PROD_DOMAIN}/api/v1/health/")
if (( $(echo "$RESPONSE_TIME < 2.0" | bc -l) )); then
    echo "   ✅ Tiempo de respuesta: ${RESPONSE_TIME}s (< 2s)"
else
    echo "   ⚠️  Tiempo de respuesta: ${RESPONSE_TIME}s (> 2s)"
fi

# Reporte final
echo ""
echo "📊 REPORTE DE VALIDACIÓN COMPLETO"
echo "=================================="
echo "🔗 URLs Validadas:"
echo "   Frontend: https://${PROD_DOMAIN}"
echo "   API: https://${PROD_DOMAIN}/api/v1/"
echo "   Health: https://${PROD_DOMAIN}/api/v1/health/"
echo ""
echo "🔐 AWS Cognito:"
echo "   Pool ID: ${COGNITO_USER_POOL_ID}"
echo "   Region: us-west-2"
echo ""
echo "📋 Para logs detallados:"
echo "   ssh ${EC2_USER}@${EC2_HOST} 'docker logs restaurant-app --tail 50'"
echo "   ssh ${EC2_USER}@${EC2_HOST} 'docker logs restaurant-nginx --tail 20'"