#!/bin/bash

# Script para debuggear la configuración de AWS Cognito

echo "🔍 Debug de Configuración AWS Cognito"
echo "====================================="
echo

echo "📋 Backend (.env.ec2):"
if [ -f ".env.ec2" ]; then
    echo "✅ .env.ec2 exists"
    echo "Variables relevantes:"
    grep -E "^(USE_COGNITO_AUTH|AWS_REGION|COGNITO_)" .env.ec2 | sed 's/\(.*=\)\(.*\)/\1[REDACTED]/'
else
    echo "❌ .env.ec2 NOT FOUND"
fi

echo

echo "📋 Frontend (.env.production):"
if [ -f "frontend/.env.production" ]; then
    echo "✅ frontend/.env.production exists"
    echo "Variables relevantes:"
    grep -E "^VITE_" frontend/.env.production | sed 's/\(.*=\)\(.*\)/\1[REDACTED]/'
else
    echo "❌ frontend/.env.production NOT FOUND"
fi

echo

echo "📋 Build del Frontend:"
if [ -f "frontend/dist/index.html" ]; then
    echo "✅ Frontend build exists"
    echo "Verificando si las variables están en el build..."
    
    # Buscar referencias a variables VITE_ en el build
    if grep -q "VITE_AWS_COGNITO_USER_POOL_ID" frontend/dist/assets/*.js 2>/dev/null; then
        echo "✅ Variables VITE_ encontradas en el build"
    else
        echo "❌ Variables VITE_ NO encontradas en el build"
    fi
    
    # Verificar si Cognito está configurado en el build
    if grep -q "us-east-1_XXXXXXXXX" frontend/dist/assets/*.js 2>/dev/null; then
        echo "⚠️  Usando valores por defecto (us-east-1_XXXXXXXXX)"
    else
        echo "✅ Parece usar valores reales (no valores por defecto)"
    fi
else
    echo "❌ Frontend build NOT FOUND (frontend/dist/index.html)"
fi

echo

echo "📋 Docker Containers:"
if command -v docker-compose >/dev/null 2>&1; then
    echo "Estado de containers:"
    docker-compose -f docker-compose.ec2.yml ps 2>/dev/null || echo "❌ No se pudo verificar containers"
else
    echo "❌ docker-compose no disponible"
fi

echo

echo "📋 Logs de Backend (últimas 10 líneas):"
if [ -f "data/logs/django.log" ]; then
    tail -10 data/logs/django.log | grep -E "(COGNITO|AUTH)" || echo "No hay logs de autenticación recientes"
else
    echo "❌ Log file not found"
fi

echo

echo "🔧 Recomendaciones:"
echo "1. Si .env.ec2 o .env.production no existen, ejecuta: ./configure-cognito-ec2.sh <USER_POOL_ID> <APP_CLIENT_ID>"
echo "2. Si existen pero usan valores por defecto, actualiza con credenciales reales"
echo "3. Después de cambiar configuración, ejecuta: ./deploy/ec2-deploy.sh"
echo "4. Verifica en el navegador que aparezca el login"