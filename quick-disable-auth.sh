#!/bin/bash

# Script para deshabilitar autenticación rápidamente en EC2

echo "🔧 Deshabilitando autenticación AWS Cognito - Quick Fix"
echo "====================================================="

# Verificar ubicación
if [ ! -f ".env.ec2" ]; then
    echo "❌ Error: .env.ec2 no encontrado"
    echo "Ejecuta este script desde /opt/restaurant-web/"
    exit 1
fi

# Backup
echo "📁 Creando backup..."
cp .env.ec2 .env.ec2.backup.auth-disabled.$(date +%Y%m%d-%H%M%S)

# Deshabilitar autenticación
echo "🔧 Deshabilitando USE_COGNITO_AUTH..."
sed -i 's/USE_COGNITO_AUTH=True/USE_COGNITO_AUTH=False/' .env.ec2

echo "✅ Configuración actualizada:"
grep "USE_COGNITO_AUTH" .env.ec2

# Reiniciar solo el backend
echo "🔄 Reiniciando backend..."
docker-compose -f docker-compose.ec2.yml restart web

echo "⏳ Esperando que el backend se inicie..."
sleep 10

echo "🔍 Probando API..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/units/ 2>/dev/null)
echo "Estado de API: $API_STATUS"

if [ "$API_STATUS" = "200" ]; then
    echo "✅ API funcionando correctamente sin autenticación"
    echo "🌐 Aplicación disponible en: http://44.248.47.186/"
else
    echo "❌ API aún no responde correctamente"
    echo "📋 Logs del backend:"
    docker-compose -f docker-compose.ec2.yml logs web --tail=10
fi

echo
echo "🔙 Para revertir:"
echo "  sed -i 's/USE_COGNITO_AUTH=False/USE_COGNITO_AUTH=True/' .env.ec2"
echo "  docker-compose -f docker-compose.ec2.yml restart web"