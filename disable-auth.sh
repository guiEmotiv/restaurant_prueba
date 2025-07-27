#!/bin/bash

# Script simple para deshabilitar autenticación rápidamente

echo "🔧 Deshabilitando autenticación AWS Cognito..."

# Verificar que estamos en la ubicación correcta
if [ -f ".env.ec2" ]; then
    # Hacer backup
    cp .env.ec2 .env.ec2.backup.$(date +%Y%m%d-%H%M%S)
    
    # Deshabilitar autenticación
    sed -i 's/USE_COGNITO_AUTH=True/USE_COGNITO_AUTH=False/' .env.ec2
    
    echo "✅ Autenticación deshabilitada en .env.ec2"
    echo "📋 Estado actual:"
    grep "USE_COGNITO_AUTH" .env.ec2
    
    echo
    echo "🔄 Para aplicar cambios, ejecuta:"
    echo "  docker-compose -f docker-compose.ec2.yml restart web"
    echo
    echo "🔙 Para revertir:"
    echo "  sed -i 's/USE_COGNITO_AUTH=False/USE_COGNITO_AUTH=True/' .env.ec2"
    echo "  docker-compose -f docker-compose.ec2.yml restart web"
    
else
    echo "❌ Error: .env.ec2 no encontrado"
    echo "Ejecuta este script desde /opt/restaurant-web/"
    exit 1
fi