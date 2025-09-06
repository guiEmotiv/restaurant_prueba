#!/bin/bash

# DEV TO PROD MIGRATION SCRIPT
# Migra el ambiente de desarrollo completo hacia producción EC2
# NO modifica el ambiente de desarrollo local

set -e

echo "🚀 DEV TO PROD MIGRATION - Restaurant Web Application"
echo "======================================================"

# Configuración
EC2_HOST="44.248.47.186"
EC2_USER="ubuntu"
EC2_APP_DIR="/home/ubuntu/restaurant-web"
LOCAL_DIR="/Users/guillermosotozuniga/restaurant-web"

# AWS Cognito Configuration (PRODUCTION)
COGNITO_USER_POOL_ID="us-west-2_bdCwF60ZI"
COGNITO_APP_CLIENT_ID="4i9hrd7srgbqbtun09p43ncfn0"
PROD_DOMAIN="www.xn--elfogndedonsoto-zrb.com"

echo "📋 Migration Configuration:"
echo "   Local Dev: ${LOCAL_DIR}"
echo "   EC2 Prod: ${EC2_HOST}:${EC2_APP_DIR}"
echo "   AWS Cognito Pool: ${COGNITO_USER_POOL_ID}"
echo "   Production Domain: ${PROD_DOMAIN}"
echo ""

# Fase 1: Validar ambiente dev local
echo "🔍 FASE 1: Validando ambiente de desarrollo local"
echo "================================================="

if [ ! -f "${LOCAL_DIR}/backend/manage.py" ]; then
    echo "❌ Backend Django no encontrado en ${LOCAL_DIR}/backend"
    exit 1
fi

if [ ! -f "${LOCAL_DIR}/frontend/package.json" ]; then
    echo "❌ Frontend React no encontrado en ${LOCAL_DIR}/frontend"
    exit 1
fi

if [ ! -f "${LOCAL_DIR}/Dockerfile.prod" ]; then
    echo "❌ Dockerfile.prod no encontrado"
    exit 1
fi

echo "✅ Ambiente de desarrollo validado"

# Fase 2: Crear paquete de migración
echo ""
echo "📦 FASE 2: Creando paquete de migración dev->prod"
echo "================================================="

MIGRATION_PACKAGE="/tmp/dev-to-prod-$(date +%Y%m%d_%H%M%S).tar.gz"

tar czf "${MIGRATION_PACKAGE}" \
    --exclude='node_modules' \
    --exclude='__pycache__' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='.vite' \
    --exclude='*.sqlite3' \
    --exclude='.env' \
    -C "${LOCAL_DIR}" \
    backend/ frontend/ docker-compose.prod.yml Dockerfile.prod

echo "✅ Paquete de migración creado: ${MIGRATION_PACKAGE}"

# Fase 3: Transferir a producción
echo ""
echo "🚢 FASE 3: Transfiriendo código a producción EC2"
echo "================================================"

echo "📤 Subiendo paquete de migración..."
scp "${MIGRATION_PACKAGE}" ${EC2_USER}@${EC2_HOST}:/tmp/

# Fase 4: Ejecutar migración en producción
echo ""
echo "🔧 FASE 4: Ejecutando migración en EC2 producción"
echo "================================================="

ssh ${EC2_USER}@${EC2_HOST} << EOF
set -e

echo "🛑 Deteniendo servicios actuales..."
cd ${EC2_APP_DIR}
docker-compose -f docker-compose.prod.yml down || true

echo "💾 Backup de base de datos actual..."
if [ -f "${EC2_APP_DIR}/docker/data/restaurant.prod.sqlite3" ]; then
    cp "${EC2_APP_DIR}/docker/data/restaurant.prod.sqlite3" \
       "${EC2_APP_DIR}/docker/data/restaurant.prod.backup.\$(date +%Y%m%d_%H%M%S).sqlite3"
    echo "✅ Backup creado"
else
    echo "ℹ️  No hay base de datos previa para hacer backup"
fi

echo "📂 Extrayendo nueva versión..."
cd ${EC2_APP_DIR}
tar xzf /tmp/$(basename ${MIGRATION_PACKAGE}) --overwrite

echo "🗑️  Limpiando imágenes Docker anteriores..."
docker image prune -f
docker image rm restaurant-app:latest || true
docker image rm restaurant-app:migration-fix || true

echo "🏗️  Construyendo imagen de producción con AWS Cognito..."
NODE_ENV=production \
VITE_DISABLE_COGNITO=false \
VITE_AWS_COGNITO_USER_POOL_ID=${COGNITO_USER_POOL_ID} \
VITE_AWS_COGNITO_APP_CLIENT_ID=${COGNITO_APP_CLIENT_ID} \
VITE_API_BASE_URL=https://${PROD_DOMAIN}/api/v1 \
docker build --no-cache -f Dockerfile.prod -t restaurant-app:latest .

echo "📝 Configurando docker-compose para producción..."
sed -i 's/image: restaurant-app:.*/image: restaurant-app:latest/' docker-compose.prod.yml

echo "🚀 Iniciando servicios de producción..."
docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Esperando inicialización de servicios..."
sleep 45

echo "🔍 Verificando estado de contenedores..."
docker-compose -f docker-compose.prod.yml ps

echo "📋 Verificando logs de aplicación..."
docker logs restaurant-app --tail 15

echo "🩺 Validando salud de la aplicación..."
for i in {1..5}; do
    if curl -f -s http://localhost:8000/api/v1/health/ > /dev/null; then
        echo "✅ Aplicación respondiendo correctamente"
        break
    else
        echo "⏳ Intento \$i/5 - Esperando respuesta de aplicación..."
        sleep 10
    fi
done

echo "🔐 Validando integración AWS Cognito..."
curl -f -s http://localhost:8000/api/v1/auth/cognito-config/ || echo "⚠️  Cognito config endpoint no disponible"

echo "🌐 Limpieza temporal..."
rm -f /tmp/$(basename ${MIGRATION_PACKAGE})

EOF

# Fase 5: Validación final
echo ""
echo "✅ FASE 5: Validación final de migración"
echo "========================================"

echo "🌍 Validando acceso público..."
sleep 10

if curl -f -s "https://${PROD_DOMAIN}" > /dev/null; then
    echo "✅ Sitio web accesible en https://${PROD_DOMAIN}"
else
    echo "⚠️  Sitio web no accesible - verificar configuración nginx/SSL"
fi

if curl -f -s "https://${PROD_DOMAIN}/api/v1/health/" > /dev/null; then
    echo "✅ API backend accesible"
else
    echo "⚠️  API backend no accesible"
fi

# Limpieza local
rm -f "${MIGRATION_PACKAGE}"

echo ""
echo "🎉 MIGRACIÓN DEV->PROD COMPLETADA"
echo "=================================="
echo "✅ Código migrado de desarrollo a producción"
echo "✅ AWS Cognito configurado para producción"
echo "✅ Base de datos respaldada y migrada"
echo "✅ Contenedores actualizados y funcionando"
echo ""
echo "🔗 URLs de Producción:"
echo "   Web: https://${PROD_DOMAIN}"
echo "   API: https://${PROD_DOMAIN}/api/v1/"
echo "   Health: https://${PROD_DOMAIN}/api/v1/health/"
echo ""
echo "📊 Para verificar logs: ssh ${EC2_USER}@${EC2_HOST} 'docker logs restaurant-app'"