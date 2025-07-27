#!/bin/bash

# Script para configurar AWS Cognito en la aplicación
# Este script te ayudará a configurar las credenciales de AWS Cognito

echo "🔐 Configuración de AWS Cognito para El Fogón de Don Soto"
echo "======================================================"
echo

# Verificar si tenemos las credenciales
echo "Para configurar AWS Cognito, necesitas las siguientes credenciales de tu User Pool:"
echo "1. User Pool ID (formato: us-east-1_XXXXXXXXX)"
echo "2. App Client ID (formato: xxxxxxxxxxxxxxxxxxxxxxxxxx)"
echo "3. AWS Region (por defecto: us-east-1)"
echo

# Solicitar credenciales
read -p "Ingresa tu AWS Region [us-east-1]: " AWS_REGION
AWS_REGION=${AWS_REGION:-us-east-1}

read -p "Ingresa tu User Pool ID: " USER_POOL_ID

read -p "Ingresa tu App Client ID: " APP_CLIENT_ID

read -p "Ingresa tu EC2 Public IP (opcional): " EC2_IP

if [[ -z "$USER_POOL_ID" || -z "$APP_CLIENT_ID" ]]; then
    echo "❌ Error: User Pool ID y App Client ID son requeridos"
    exit 1
fi

echo
echo "📝 Configurando archivos..."

# Configurar backend (.env.ec2)
echo "Actualizando .env.ec2..."
sed -i.bak "s/USE_COGNITO_AUTH=False/USE_COGNITO_AUTH=True/" .env.ec2
sed -i.bak "s/AWS_REGION=us-east-1/AWS_REGION=$AWS_REGION/" .env.ec2
sed -i.bak "s/COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX/COGNITO_USER_POOL_ID=$USER_POOL_ID/" .env.ec2
sed -i.bak "s/COGNITO_APP_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx/COGNITO_APP_CLIENT_ID=$APP_CLIENT_ID/" .env.ec2

if [[ ! -z "$EC2_IP" ]]; then
    sed -i.bak "s/EC2_PUBLIC_IP=your-ec2-public-ip/EC2_PUBLIC_IP=$EC2_IP/" .env.ec2
fi

# Configurar frontend (.env.production)
echo "Actualizando frontend/.env.production..."
sed -i.bak "s/VITE_AWS_REGION=us-east-1/VITE_AWS_REGION=$AWS_REGION/" frontend/.env.production
sed -i.bak "s/VITE_AWS_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX/VITE_AWS_COGNITO_USER_POOL_ID=$USER_POOL_ID/" frontend/.env.production
sed -i.bak "s/VITE_AWS_COGNITO_APP_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx/VITE_AWS_COGNITO_APP_CLIENT_ID=$APP_CLIENT_ID/" frontend/.env.production

if [[ ! -z "$EC2_IP" ]]; then
    sed -i.bak "s/VITE_REDIRECT_SIGN_IN=http:\/\/your-ec2-ip/VITE_REDIRECT_SIGN_IN=http:\/\/$EC2_IP/" frontend/.env.production
    sed -i.bak "s/VITE_REDIRECT_SIGN_OUT=http:\/\/your-ec2-ip/VITE_REDIRECT_SIGN_OUT=http:\/\/$EC2_IP/" frontend/.env.production
fi

echo
echo "✅ Configuración completada!"
echo
echo "📋 Resumen de configuración:"
echo "  AWS Region: $AWS_REGION"
echo "  User Pool ID: $USER_POOL_ID"
echo "  App Client ID: ${APP_CLIENT_ID:0:10}..."
echo "  Authentication: Activada"
echo

echo "🚀 Próximos pasos:"
echo "1. Verifica que tus usuarios estén creados en AWS Cognito:"
echo "   - admin (grupo: administradores)"
echo "   - mesero01 (grupo: meseros)"
echo
echo "2. Deploy la aplicación:"
echo "   ./deploy/ec2-deploy.sh"
echo
echo "3. Accede a tu aplicación en el navegador"
echo "   Ahora debería aparecer la pantalla de login"
echo

echo "🔍 Para verificar la configuración:"
echo "   cat .env.ec2"
echo "   cat frontend/.env.production"