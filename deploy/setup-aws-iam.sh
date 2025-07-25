#!/bin/bash

# Script para configurar AWS IAM para el sistema de restaurante
# Este script crea grupos y usuarios con credenciales simples

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() { echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI no está instalado. Por favor instálalo primero."
    exit 1
fi

# Check AWS configuration
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS CLI no está configurado. Ejecuta 'aws configure' primero."
    exit 1
fi

print_status "🏪 Configurando AWS IAM para Sistema de Restaurante"
echo "================================================"

# Define groups and their policies
declare -A GROUPS=(
    ["restaurant-administrators"]="Admin access to restaurant system"
    ["restaurant-cocineros"]="Kitchen staff access"
    ["restaurant-cajeros"]="Cashier access to payments and orders"
)

# Define users for each group
declare -A USERS=(
    ["restaurant-administrators"]="admin:AdminRestaurant2025"
    ["restaurant-cocineros"]="cocinero1:CocineRo2025"
    ["restaurant-cajeros"]="cajero1:CajeRo2025"
)

# Create IAM Groups
print_status "📁 Creando grupos IAM..."
for group in "${!GROUPS[@]}"; do
    description="${GROUPS[$group]}"
    
    if aws iam get-group --group-name "$group" &> /dev/null; then
        print_warning "Grupo '$group' ya existe, saltando..."
    else
        aws iam create-group --group-name "$group" --path "/restaurant/"
        print_success "Grupo '$group' creado"
    fi
done

# Create base policy for restaurant access
print_status "📋 Creando políticas base..."

# Basic restaurant policy (minimal permissions for authentication)
cat > /tmp/restaurant-base-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "iam:GetUser",
                "iam:ListGroupsForUser"
            ],
            "Resource": "*"
        }
    ]
}
EOF

# Create policy
POLICY_NAME="RestaurantBasePolicy"
POLICY_ARN=""

if aws iam get-policy --policy-arn "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/$POLICY_NAME" &> /dev/null; then
    print_warning "Política '$POLICY_NAME' ya existe"
    POLICY_ARN="arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/$POLICY_NAME"
else
    POLICY_ARN=$(aws iam create-policy \
        --policy-name "$POLICY_NAME" \
        --policy-document file:///tmp/restaurant-base-policy.json \
        --query 'Policy.Arn' --output text)
    print_success "Política '$POLICY_NAME' creada"
fi

# Attach policy to groups
print_status "🔗 Asignando políticas a grupos..."
for group in "${!GROUPS[@]}"; do
    aws iam attach-group-policy --group-name "$group" --policy-arn "$POLICY_ARN"
    print_success "Política asignada a grupo '$group'"
done

# Create users and add to groups
print_status "👤 Creando usuarios..."
> /tmp/restaurant-credentials.txt

for group in "${!USERS[@]}"; do
    user_info="${USERS[$group]}"
    username=$(echo "$user_info" | cut -d':' -f1)
    password=$(echo "$user_info" | cut -d':' -f2)
    
    # Create user
    if aws iam get-user --user-name "$username" &> /dev/null; then
        print_warning "Usuario '$username' ya existe, saltando..."
    else
        aws iam create-user --user-name "$username" --path "/restaurant/"
        print_success "Usuario '$username' creado"
    fi
    
    # Set login profile (console password)
    aws iam create-login-profile --user-name "$username" --password "$password" --no-password-reset-required &> /dev/null || true
    
    # Add user to group
    aws iam add-user-to-group --group-name "$group" --user-name "$username"
    print_success "Usuario '$username' agregado al grupo '$group'"
    
    # Create access key
    if aws iam list-access-keys --user-name "$username" --query 'AccessKeyMetadata[0].AccessKeyId' --output text 2>/dev/null | grep -q "AKIA"; then
        print_warning "Usuario '$username' ya tiene access key"
        ACCESS_KEY_ID=$(aws iam list-access-keys --user-name "$username" --query 'AccessKeyMetadata[0].AccessKeyId' --output text)
        echo "⚠️  ACCESS KEY EXISTENTE para $username: $ACCESS_KEY_ID"
        echo "   Para obtener la secret key, elimina la access key existente y ejecuta el script nuevamente"
    else
        ACCESS_KEY_DATA=$(aws iam create-access-key --user-name "$username")
        ACCESS_KEY_ID=$(echo "$ACCESS_KEY_DATA" | jq -r '.AccessKey.AccessKeyId')
        SECRET_ACCESS_KEY=$(echo "$ACCESS_KEY_DATA" | jq -r '.AccessKey.SecretAccessKey')
        
        print_success "Access key creada para '$username'"
        
        # Save credentials
        echo "# $username credentials" >> /tmp/restaurant-credentials.txt
        echo "${username}_ACCESS_KEY_ID=$ACCESS_KEY_ID" >> /tmp/restaurant-credentials.txt
        echo "${username}_SECRET_ACCESS_KEY=$SECRET_ACCESS_KEY" >> /tmp/restaurant-credentials.txt
        echo "" >> /tmp/restaurant-credentials.txt
    fi
done

# Clean up temp files
rm -f /tmp/restaurant-base-policy.json

print_success "🎉 Configuración de AWS IAM completada!"
echo ""
echo "================================================"
echo "📋 RESUMEN DE CONFIGURACIÓN"
echo "================================================"

# List groups and users
print_status "Grupos creados:"
for group in "${!GROUPS[@]}"; do
    echo "  🏷️  $group"
    aws iam get-group --group-name "$group" --query 'Users[].UserName' --output table 2>/dev/null || echo "    (sin usuarios)"
done

echo ""
print_status "Credenciales generadas:"
if [ -f /tmp/restaurant-credentials.txt ]; then
    cat /tmp/restaurant-credentials.txt
    echo ""
    print_warning "⚠️  IMPORTANTE: Guarda estas credenciales en un lugar seguro"
    print_warning "⚠️  Estas credenciales deben agregarse a tu archivo .env"
else
    print_warning "No se generaron nuevas credenciales (usuarios ya existían)"
fi

echo ""
echo "================================================"
echo "🔧 PRÓXIMOS PASOS"
echo "================================================"
echo "1. Copia las credenciales de arriba a tu archivo .env"
echo "2. Ejecuta: ./deploy/update-env-with-aws-credentials.sh"
echo "3. Despliega la aplicación: ./deploy/ec2-deploy.sh"
echo ""
print_success "✨ ¡Listo para usar!"