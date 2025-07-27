#!/bin/bash

# Script para debugging detallado de autenticación

echo "🔍 Debug Detallado de Autenticación"
echo "=================================="

# Verificar ubicación
if [ ! -f ".env.ec2" ]; then
    echo "❌ Error: .env.ec2 no encontrado"
    echo "Ejecuta este script desde /opt/restaurant-web/"
    exit 1
fi

echo "📋 Estado de .env.ec2:"
echo "====================="
cat .env.ec2
echo

echo "📋 Variables cargadas en el contenedor:"
echo "======================================"
docker-compose -f docker-compose.ec2.yml exec -T web printenv | grep -E "(USE_COGNITO|COGNITO_|AWS_)" | sort

echo
echo "📋 Configuración Django actual:"
echo "=============================="
docker-compose -f docker-compose.ec2.yml exec -T web python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_ec2')
django.setup()
from django.conf import settings

print('USE_COGNITO_AUTH:', getattr(settings, 'USE_COGNITO_AUTH', 'NOT SET'))
print('DEFAULT_PERMISSION_CLASSES:', settings.REST_FRAMEWORK['DEFAULT_PERMISSION_CLASSES'])
print('MIDDLEWARE con Cognito:', 'backend.cognito_auth.CognitoAuthenticationMiddleware' in settings.MIDDLEWARE)
print('COGNITO_USER_POOL_ID:', getattr(settings, 'COGNITO_USER_POOL_ID', 'NOT SET'))
print('COGNITO_APP_CLIENT_ID:', getattr(settings, 'COGNITO_APP_CLIENT_ID', 'NOT SET'))
"

echo
echo "📋 Test directo del endpoint:"
echo "=========================="
echo "Test 1: Sin headers"
curl -s -w "Status: %{http_code}\n" http://localhost:8000/api/v1/units/ || echo "FAILED"

echo
echo "Test 2: Con header Authorization vacío"
curl -s -w "Status: %{http_code}\n" -H "Authorization: " http://localhost:8000/api/v1/units/ || echo "FAILED"

echo
echo "Test 3: Con Bearer token inválido"
curl -s -w "Status: %{http_code}\n" -H "Authorization: Bearer invalid" http://localhost:8000/api/v1/units/ || echo "FAILED"

echo
echo "📋 Logs recientes del backend (últimas 20 líneas):"
echo "==============================================="
docker-compose -f docker-compose.ec2.yml logs web --tail=20

echo
echo "🔧 Acciones recomendadas:"
echo "======================="
echo "1. Si USE_COGNITO_AUTH=False pero aún hay 403:"
echo "   - El problema está en la configuración del middleware o DRF"
echo "2. Si USE_COGNITO_AUTH=True:"
echo "   - Ejecutar: sed -i 's/USE_COGNITO_AUTH=True/USE_COGNITO_AUTH=False/' .env.ec2"
echo "   - Reiniciar: docker-compose -f docker-compose.ec2.yml restart web"
echo "3. Para rebuild completo:"
echo "   - Ejecutar: ./force-no-auth.sh"