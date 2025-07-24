#!/bin/bash

# Script para crear usuarios IAM para el sistema de restaurante
# Este script debe ejecutarse con credenciales de AWS que tengan permisos para crear usuarios IAM

set -e

echo "🔐 Creating AWS IAM Users for Restaurant System"
echo "=============================================="

# Verificar que AWS CLI esté configurado
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI no está configurado correctamente"
    echo "Por favor ejecute: aws configure"
    exit 1
fi

echo "✅ AWS CLI configurado correctamente"

# Función para crear usuario IAM
create_iam_user() {
    local username=$1
    local role=$2
    local real_name=$3
    
    echo "📝 Creando usuario IAM: $username ($role)"
    
    # Crear usuario
    aws iam create-user --user-name "$username" --path "/restaurant/" || true
    
    # Crear credenciales de acceso
    local credentials=$(aws iam create-access-key --user-name "$username")
    local access_key=$(echo "$credentials" | jq -r '.AccessKey.AccessKeyId')
    local secret_key=$(echo "$credentials" | jq -r '.AccessKey.SecretAccessKey')
    
    # Crear política personalizada para el rol
    local policy_document=""
    case $role in
        "admin")
            policy_document='{
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Action": "*",
                        "Resource": "*"
                    }
                ]
            }'
            ;;
        "mesero")
            policy_document='{
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Action": [
                            "dynamodb:GetItem",
                            "dynamodb:PutItem",
                            "dynamodb:UpdateItem",
                            "dynamodb:Query",
                            "dynamodb:Scan"
                        ],
                        "Resource": [
                            "arn:aws:dynamodb:*:*:table/restaurant-orders*",
                            "arn:aws:dynamodb:*:*:table/restaurant-kitchen*"
                        ]
                    }
                ]
            }'
            ;;
        "cajero")
            policy_document='{
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Action": [
                            "dynamodb:GetItem",
                            "dynamodb:PutItem",
                            "dynamodb:UpdateItem",
                            "dynamodb:Query",
                            "dynamodb:Scan"
                        ],
                        "Resource": [
                            "arn:aws:dynamodb:*:*:table/restaurant-payments*"
                        ]
                    }
                ]
            }'
            ;;
    esac
    
    # Crear política
    local policy_name="RestaurantPolicy-${role^}"
    aws iam create-policy \
        --policy-name "$policy_name" \
        --policy-document "$policy_document" \
        --path "/restaurant/" || true
    
    # Obtener ARN de la política
    local policy_arn=$(aws iam list-policies --path-prefix "/restaurant/" --query "Policies[?PolicyName=='$policy_name'].Arn | [0]" --output text)
    
    # Adjuntar política al usuario
    aws iam attach-user-policy --user-name "$username" --policy-arn "$policy_arn"
    
    # Agregar tags al usuario
    aws iam tag-user --user-name "$username" --tags \
        Key=Role,Value="$role" \
        Key=RealName,Value="$real_name" \
        Key=System,Value="Restaurant" \
        Key=CreatedBy,Value="DeploymentScript"
    
    echo "✅ Usuario $username creado exitosamente"
    echo "   Access Key: $access_key"
    echo "   Secret Key: $secret_key"
    echo "   Política: $policy_name"
    echo ""
}

# Crear usuarios para cada rol
echo ""
echo "🏪 Creando usuarios del restaurante..."
echo ""

create_iam_user "restaurant-admin-system" "admin" "Administrador Sistema"
create_iam_user "restaurant-mesero-carlos" "mesero" "Carlos Mesero"
create_iam_user "restaurant-mesero-ana" "mesero" "Ana Mesero"
create_iam_user "restaurant-cajero-luis" "cajero" "Luis Cajero"
create_iam_user "restaurant-cajero-maria" "cajero" "María Cajero"

echo "🎉 Todos los usuarios IAM han sido creados exitosamente!"
echo ""
echo "📋 Resumen de usuarios creados:"
echo "================================"
echo "👑 Administradores:"
echo "   - restaurant-admin-system (Administrador Sistema)"
echo ""
echo "🍽️  Meseros:"
echo "   - restaurant-mesero-carlos (Carlos Mesero)"
echo "   - restaurant-mesero-ana (Ana Mesero)"
echo ""
echo "💰 Cajeros:"
echo "   - restaurant-cajero-luis (Luis Cajero)"
echo "   - restaurant-cajero-maria (María Cajero)"
echo ""
echo "⚠️  IMPORTANTE: Guarde las credenciales de acceso mostradas arriba"
echo "   Estas son las únicas veces que verá las claves secretas"
echo ""
echo "📝 Para eliminar todos los usuarios, ejecute:"
echo "   ./deploy/delete-aws-iam-users.sh"