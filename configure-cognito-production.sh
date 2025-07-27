#!/bin/bash

# Script para configurar AWS Cognito en production

echo "🔧 Configurador de AWS Cognito para Producción"
echo "=============================================="
echo

# Verificar si se proporcionaron argumentos
if [ $# -lt 2 ]; then
    echo "❌ Error: Faltan parámetros"
    echo ""
    echo "Uso: $0 <USER_POOL_ID> <APP_CLIENT_ID> [REGION]"
    echo ""
    echo "Ejemplo:"
    echo "  $0 us-east-1_abc123DEF us-east-1_abc123DEFghijklmnop"
    echo "  $0 us-east-1_abc123DEF us-east-1_abc123DEFghijklmnop us-west-2"
    echo ""
    echo "Para obtener estos valores:"
    echo "1. Ve a AWS Cognito Console"
    echo "2. Selecciona tu User Pool"
    echo "3. User Pool ID está en la página principal"
    echo "4. App Client ID está en 'App integration' -> 'App clients'"
    exit 1
fi

USER_POOL_ID="$1"
APP_CLIENT_ID="$2"
REGION="${3:-us-east-1}"

# Extraer el dominio para EC2
if [ -f ".env.ec2" ]; then
    EC2_IP=$(grep "EC2_PUBLIC_IP" .env.ec2 | cut -d'=' -f2)
    if [ -z "$EC2_IP" ]; then
        echo "⚠️  No se encontró EC2_PUBLIC_IP en .env.ec2, usando localhost"
        EC2_IP="localhost"
    fi
else
    echo "⚠️  No se encontró .env.ec2, usando localhost"
    EC2_IP="localhost"
fi

echo "📋 Configuración a aplicar:"
echo "  AWS Region: $REGION"
echo "  User Pool ID: $USER_POOL_ID"
echo "  App Client ID: $APP_CLIENT_ID"
echo "  EC2 IP: $EC2_IP"
echo

# Crear/actualizar .env.production
echo "📝 Creando frontend/.env.production..."
cat > frontend/.env.production << EOF
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Frontend Production Environment Variables (AWS Cognito)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# AWS Cognito Configuration
VITE_AWS_REGION=$REGION
VITE_AWS_COGNITO_USER_POOL_ID=$USER_POOL_ID
VITE_AWS_COGNITO_APP_CLIENT_ID=$APP_CLIENT_ID

# Optional: Cognito Domain for hosted UI
VITE_AWS_COGNITO_DOMAIN=your-domain.auth.$REGION.amazoncognito.com
VITE_REDIRECT_SIGN_IN=http://$EC2_IP
VITE_REDIRECT_SIGN_OUT=http://$EC2_IP

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# NOTA IMPORTANTE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Los valores VITE_* son públicos y se incluyen en el bundle del frontend
# No incluyas secretos o claves privadas aquí
EOF

echo "✅ Archivo frontend/.env.production creado"

# Crear/actualizar .env.ec2 para el backend
echo "📝 Actualizando .env.ec2..."
if [ -f ".env.ec2" ]; then
    # Actualizar valores existentes
    sed -i.bak "s/^AWS_REGION=.*/AWS_REGION=$REGION/" .env.ec2
    sed -i.bak "s/^COGNITO_USER_POOL_ID=.*/COGNITO_USER_POOL_ID=$USER_POOL_ID/" .env.ec2
    sed -i.bak "s/^COGNITO_APP_CLIENT_ID=.*/COGNITO_APP_CLIENT_ID=$APP_CLIENT_ID/" .env.ec2
    
    # Asegurar que USE_COGNITO_AUTH está habilitado
    if grep -q "USE_COGNITO_AUTH" .env.ec2; then
        sed -i.bak "s/^USE_COGNITO_AUTH=.*/USE_COGNITO_AUTH=True/" .env.ec2
    else
        echo "USE_COGNITO_AUTH=True" >> .env.ec2
    fi
    
    rm -f .env.ec2.bak
    echo "✅ Archivo .env.ec2 actualizado"
else
    echo "❌ Error: .env.ec2 no encontrado"
    exit 1
fi

echo
echo "📋 Resumen de configuración:"
echo "=========================="
echo "Frontend (.env.production):"
grep -E "^VITE_" frontend/.env.production

echo
echo "Backend (.env.ec2) - Cognito vars:"
grep -E "^(USE_COGNITO_AUTH|AWS_REGION|COGNITO_)" .env.ec2

echo
echo "🚀 Próximos pasos:"
echo "1. Ejecutar: ./deploy/ec2-deploy.sh"
echo "2. La aplicación ahora mostrará pantalla de login"
echo "3. Usar credenciales: admin / contraseña_temporal"
echo "4. Al primer login, se pedirá cambiar contraseña"

echo
echo "💡 Para crear usuarios:"
echo "aws cognito-idp admin-create-user \\"
echo "  --user-pool-id $USER_POOL_ID \\"
echo "  --username admin \\"
echo "  --temporary-password 'TempPassword123!' \\"
echo "  --message-action SUPPRESS"