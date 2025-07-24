#!/bin/bash

# Script para eliminar usuarios IAM del sistema de restaurante

set -e

echo "🗑️  Deleting AWS IAM Users for Restaurant System"
echo "=============================================="

# Verificar que AWS CLI esté configurado
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI no está configurado correctamente"
    echo "Por favor ejecute: aws configure"
    exit 1
fi

echo "✅ AWS CLI configurado correctamente"

# Lista de usuarios a eliminar
users=(
    "restaurant-admin-system"
    "restaurant-mesero-carlos"
    "restaurant-mesero-ana"
    "restaurant-cajero-luis"
    "restaurant-cajero-maria"
)

# Lista de políticas a eliminar
policies=(
    "RestaurantPolicy-Admin"
    "RestaurantPolicy-Mesero"
    "RestaurantPolicy-Cajero"
)

echo ""
echo "🗑️  Eliminando usuarios..."

# Eliminar usuarios
for user in "${users[@]}"; do
    echo "📝 Eliminando usuario: $user"
    
    # Desadjuntar todas las políticas del usuario
    aws iam list-attached-user-policies --user-name "$user" --query 'AttachedPolicies[].PolicyArn' --output text | \
    while read policy_arn; do
        if [ ! -z "$policy_arn" ]; then
            echo "   Desadjuntando política: $policy_arn"
            aws iam detach-user-policy --user-name "$user" --policy-arn "$policy_arn" || true
        fi
    done
    
    # Eliminar access keys
    aws iam list-access-keys --user-name "$user" --query 'AccessKeyMetadata[].AccessKeyId' --output text | \
    while read access_key; do
        if [ ! -z "$access_key" ]; then
            echo "   Eliminando access key: $access_key"
            aws iam delete-access-key --user-name "$user" --access-key-id "$access_key" || true
        fi
    done
    
    # Eliminar usuario
    aws iam delete-user --user-name "$user" || true
    echo "✅ Usuario $user eliminado"
done

echo ""
echo "🗑️  Eliminando políticas..."

# Eliminar políticas personalizadas
for policy in "${policies[@]}"; do
    echo "📝 Eliminando política: $policy"
    
    # Obtener ARN de la política
    policy_arn=$(aws iam list-policies --path-prefix "/restaurant/" --query "Policies[?PolicyName=='$policy'].Arn | [0]" --output text)
    
    if [ "$policy_arn" != "None" ] && [ ! -z "$policy_arn" ]; then
        # Eliminar política
        aws iam delete-policy --policy-arn "$policy_arn" || true
        echo "✅ Política $policy eliminada"
    else
        echo "⚠️  Política $policy no encontrada"
    fi
done

echo ""
echo "🎉 Todos los usuarios y políticas IAM han sido eliminados!"
echo ""
echo "📋 Usuarios eliminados:"
echo "======================="
for user in "${users[@]}"; do
    echo "   - $user"
done
echo ""
echo "📋 Políticas eliminadas:"
echo "========================"
for policy in "${policies[@]}"; do
    echo "   - $policy"
done