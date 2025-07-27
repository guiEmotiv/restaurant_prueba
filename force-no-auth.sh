#!/bin/bash

# Script para forzar deshabilitación completa de autenticación

echo "🚫 Forzando deshabilitación completa de autenticación"
echo "==================================================="

# Verificar ubicación
if [ ! -f ".env.ec2" ]; then
    echo "❌ Error: .env.ec2 no encontrado"
    echo "Ejecuta este script desde /opt/restaurant-web/"
    exit 1
fi

echo "📁 Creando backup completo..."
cp .env.ec2 .env.ec2.backup.force-no-auth.$(date +%Y%m%d-%H%M%S)

echo "🔧 Configurando para NO autenticación..."

# Asegurar que USE_COGNITO_AUTH=False
sed -i 's/USE_COGNITO_AUTH=True/USE_COGNITO_AUTH=False/' .env.ec2
sed -i 's/USE_COGNITO_AUTH=true/USE_COGNITO_AUTH=False/' .env.ec2

# Asegurar que está presente
if ! grep -q "USE_COGNITO_AUTH" .env.ec2; then
    echo "USE_COGNITO_AUTH=False" >> .env.ec2
fi

echo "🗂️ Crear .env.production SIN Cognito..."
cat > frontend/.env.production << 'EOF'
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Frontend Production Environment Variables (NO AUTH)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# NO AWS Cognito Configuration - Running without authentication

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# NOTA: Sin variables VITE_AWS_COGNITO_* para evitar problemas de Amplify
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF

echo "✅ Configuración actualizada:"
echo "Backend (.env.ec2):"
grep "USE_COGNITO_AUTH" .env.ec2
echo
echo "Frontend (.env.production):"
echo "  Sin variables VITE_AWS_COGNITO_* (modo sin auth)"

echo "🔄 Rebuild completo sin caché..."

# Limpiar build anterior
rm -rf frontend/dist frontend/node_modules

# Rebuild frontend
cd frontend
export NODE_OPTIONS="--max-old-space-size=512"
npm install --no-package-lock --no-audit --no-fund --prefer-offline

echo "🏗️ Building frontend SIN variables Cognito..."
npm run build

cd ..

echo "🐳 Reiniciando contenedores..."
docker-compose -f docker-compose.ec2.yml down
docker-compose -f docker-compose.ec2.yml build --no-cache
docker-compose -f docker-compose.ec2.yml up -d

echo "⏳ Esperando que los servicios se inicien..."
sleep 15

echo "🔍 Probando API..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/units/ 2>/dev/null)
echo "Estado de API: $API_STATUS"

echo "🔍 Probando Frontend..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/ 2>/dev/null)
echo "Estado de Frontend: $FRONTEND_STATUS"

if [ "$API_STATUS" = "200" ] && [ "$FRONTEND_STATUS" = "200" ]; then
    echo "✅ Aplicación funcionando SIN autenticación"
    echo "🌐 Aplicación disponible en: http://44.248.47.186/"
    echo "🎯 Modo: Sin autenticación - Acceso libre a todas las funciones"
else
    echo "❌ Aún hay problemas"
    echo "📋 Logs del backend:"
    docker-compose -f docker-compose.ec2.yml logs web --tail=10
fi

echo
echo "🔄 Para volver a habilitar autenticación en el futuro:"
echo "  1. Ejecutar: ./configure-cognito-production.sh <USER_POOL_ID> <CLIENT_ID>"
echo "  2. Actualizar .env.ec2: USE_COGNITO_AUTH=True"  
echo "  3. Rebuild: ./deploy/ec2-deploy.sh"