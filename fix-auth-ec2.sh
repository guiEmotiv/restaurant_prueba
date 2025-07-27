#!/bin/bash

# Script para diagnosticar y corregir problemas de autenticación en EC2

echo "🔍 Diagnóstico de Autenticación - EC2"
echo "===================================="
echo

# Verificar si estamos en EC2
if [ ! -d "/opt/restaurant-web" ]; then
    echo "❌ Error: Este script debe ejecutarse en EC2 en /opt/restaurant-web/"
    exit 1
fi

cd /opt/restaurant-web

echo "📋 Estado actual de configuración:"
echo "================================="

# Verificar .env.ec2
if [ -f ".env.ec2" ]; then
    echo "✅ .env.ec2 encontrado"
    echo "Variables de autenticación:"
    grep -E "^(USE_COGNITO_AUTH|AWS_REGION|COGNITO_)" .env.ec2 || echo "No se encontraron variables de Cognito"
else
    echo "❌ .env.ec2 no encontrado"
fi

echo

# Verificar .env.production
if [ -f "frontend/.env.production" ]; then
    echo "✅ frontend/.env.production encontrado"
    echo "Variables VITE:"
    grep -E "^VITE_" frontend/.env.production || echo "No se encontraron variables VITE"
else
    echo "❌ frontend/.env.production no encontrado"
fi

echo
echo "📋 Estado de contenedores:"
echo "========================="
docker-compose -f docker-compose.ec2.yml ps

echo
echo "📋 Logs recientes del backend:"
echo "============================="
docker-compose -f docker-compose.ec2.yml logs web --tail=20

echo
echo "🔍 Probando endpoints:"
echo "====================="

# Probar endpoint sin autenticación (health check)
echo -n "Health check (sin auth): "
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health/ 2>/dev/null || echo "FAILED"

# Probar endpoint que requiere autenticación
echo -n "API Units (con auth): "
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/units/ 2>/dev/null || echo "FAILED"

echo
echo
echo "🔧 Opciones de corrección:"
echo "========================="
echo "1. Deshabilitar autenticación temporalmente"
echo "2. Verificar configuración de Cognito"
echo "3. Ver logs detallados"
echo "4. Reiniciar contenedores"
echo

read -p "¿Qué acción deseas realizar? (1-4): " choice

case $choice in
    1)
        echo "🔧 Deshabilitando autenticación..."
        
        # Crear backup
        cp .env.ec2 .env.ec2.backup
        
        # Deshabilitar autenticación
        sed -i 's/USE_COGNITO_AUTH=True/USE_COGNITO_AUTH=False/' .env.ec2
        
        echo "✅ Autenticación deshabilitada"
        echo "📋 Nueva configuración:"
        grep "USE_COGNITO_AUTH" .env.ec2
        
        echo "🔄 Reiniciando contenedores..."
        docker-compose -f docker-compose.ec2.yml restart web
        
        echo "⏳ Esperando que el servicio se inicie..."
        sleep 10
        
        echo -n "🔍 Probando API después del cambio: "
        curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/units/ 2>/dev/null || echo "FAILED"
        echo
        
        echo "✅ Para revertir, ejecuta:"
        echo "  sed -i 's/USE_COGNITO_AUTH=False/USE_COGNITO_AUTH=True/' .env.ec2"
        echo "  docker-compose -f docker-compose.ec2.yml restart web"
        ;;
        
    2)
        echo "🔍 Verificando configuración de Cognito..."
        
        echo "Backend (.env.ec2):"
        grep -E "^(USE_COGNITO_AUTH|AWS_REGION|COGNITO_)" .env.ec2
        
        echo
        echo "Frontend (.env.production):"
        grep -E "^VITE_" frontend/.env.production
        
        echo
        echo "💡 Para reconfigurar Cognito:"
        echo "  ./configure-cognito-production.sh <USER_POOL_ID> <APP_CLIENT_ID>"
        ;;
        
    3)
        echo "📋 Logs detallados del backend:"
        docker-compose -f docker-compose.ec2.yml logs web --tail=50
        ;;
        
    4)
        echo "🔄 Reiniciando contenedores..."
        docker-compose -f docker-compose.ec2.yml restart
        
        echo "⏳ Esperando que los servicios se inicien..."
        sleep 15
        
        echo "🔍 Estado después del reinicio:"
        docker-compose -f docker-compose.ec2.yml ps
        
        echo -n "API después del reinicio: "
        curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/units/ 2>/dev/null || echo "FAILED"
        echo
        ;;
        
    *)
        echo "❌ Opción no válida"
        exit 1
        ;;
esac

echo
echo "🏁 Diagnóstico completado"