#!/bin/bash

# Script para configurar AWS Cognito en EC2
# Uso: ./configure-cognito-ec2.sh <USER_POOL_ID> <APP_CLIENT_ID> [AWS_REGION]

if [ $# -lt 2 ]; then
    echo "❌ Error: Faltan parámetros"
    echo "Uso: $0 <USER_POOL_ID> <APP_CLIENT_ID> [AWS_REGION]"
    echo ""
    echo "Ejemplo:"
    echo "$0 us-east-1_abc123XYZ 4n6k2jd8l9m3o2p1q5r7s9t2u6v8w1x3"
    echo ""
    echo "Para obtener estas credenciales:"
    echo "1. Ve a AWS Console > Cognito > User Pools"
    echo "2. Selecciona tu User Pool"
    echo "3. Pool ID está en 'General settings'"
    echo "4. Client ID está en 'App integration' > 'App clients'"
    exit 1
fi

USER_POOL_ID=$1
APP_CLIENT_ID=$2
AWS_REGION=${3:-us-east-1}

echo "🔐 Configurando AWS Cognito en EC2..."
echo "USER_POOL_ID: $USER_POOL_ID"
echo "APP_CLIENT_ID: $APP_CLIENT_ID"
echo "AWS_REGION: $AWS_REGION"
echo

# Configurar backend
echo "📝 Configurando backend..."
cp .env.ec2 .env.ec2.backup
sed -i "s/USE_COGNITO_AUTH=.*/USE_COGNITO_AUTH=True/" .env.ec2
sed -i "s/AWS_REGION=.*/AWS_REGION=$AWS_REGION/" .env.ec2
sed -i "s/COGNITO_USER_POOL_ID=.*/COGNITO_USER_POOL_ID=$USER_POOL_ID/" .env.ec2
sed -i "s/COGNITO_APP_CLIENT_ID=.*/COGNITO_APP_CLIENT_ID=$APP_CLIENT_ID/" .env.ec2

# Configurar frontend
echo "📝 Configurando frontend..."
cp frontend/.env.production frontend/.env.production.backup
sed -i "s/VITE_AWS_REGION=.*/VITE_AWS_REGION=$AWS_REGION/" frontend/.env.production
sed -i "s/VITE_AWS_COGNITO_USER_POOL_ID=.*/VITE_AWS_COGNITO_USER_POOL_ID=$USER_POOL_ID/" frontend/.env.production
sed -i "s/VITE_AWS_COGNITO_APP_CLIENT_ID=.*/VITE_AWS_COGNITO_APP_CLIENT_ID=$APP_CLIENT_ID/" frontend/.env.production

echo "✅ Configuración completada!"
echo ""
echo "🚀 Ahora ejecuta el deploy:"
echo "./deploy/ec2-deploy.sh"
echo ""
echo "📱 Después del deploy, la aplicación mostrará la pantalla de login"
echo ""
echo "👥 Usuarios de prueba que debes crear en AWS Cognito:"
echo "- admin (grupo: administradores)"
echo "- mesero01 (grupo: meseros)"