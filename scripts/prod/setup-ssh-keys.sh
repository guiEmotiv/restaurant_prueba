#!/bin/bash

# SSH SETUP PARA EC2 PRODUCTION
# Configura las claves SSH necesarias para deployment

set -e

echo "🔐 CONFIGURACIÓN SSH PARA EC2 PRODUCTION"
echo "========================================"

EC2_HOST="44.248.47.186"
EC2_USER="ubuntu"

# Verificar si ya existe conexión
echo "🔍 Verificando conexión SSH actual..."
if ssh -o ConnectTimeout=10 -o BatchMode=yes ${EC2_USER}@${EC2_HOST} exit 2>/dev/null; then
    echo "✅ Conexión SSH ya configurada correctamente"
    exit 0
fi

echo "❌ Conexión SSH no disponible"
echo ""
echo "🔧 OPCIONES DE CONFIGURACIÓN:"
echo "1. Usar AWS Systems Manager Session Manager (recomendado)"
echo "2. Configurar clave SSH manualmente"
echo "3. Usar túnel SSH existente"
echo ""

# Opción 1: AWS Session Manager
echo "🌐 Opción 1: AWS Systems Manager Session Manager"
echo "----------------------------------------------"
echo "Comando para conectar via AWS CLI:"
echo "aws ssm start-session --target i-instanceid --region us-west-2"
echo ""

# Opción 2: Clave SSH manual
echo "🔑 Opción 2: Configuración manual de clave SSH"
echo "---------------------------------------------"
echo "1. Descargar la clave .pem desde AWS Console"
echo "2. Guardar en ~/.ssh/restaurant-ec2.pem"
echo "3. chmod 600 ~/.ssh/restaurant-ec2.pem"
echo "4. Agregar a ~/.ssh/config:"
echo ""
echo "Host restaurant-ec2"
echo "    HostName ${EC2_HOST}"
echo "    User ${EC2_USER}"
echo "    IdentityFile ~/.ssh/restaurant-ec2.pem"
echo "    StrictHostKeyChecking no"
echo ""

# Opción 3: Verificar configuración existente
echo "🔍 Opción 3: Verificar configuración SSH existente"
echo "-------------------------------------------------"

if [ -f ~/.ssh/config ]; then
    echo "📋 Configuración SSH encontrada:"
    grep -A 5 -B 1 "${EC2_HOST}" ~/.ssh/config || echo "❌ No hay configuración para ${EC2_HOST}"
else
    echo "❌ No existe archivo ~/.ssh/config"
fi

echo ""
echo "🔑 Claves SSH disponibles:"
ls -la ~/.ssh/*.pem 2>/dev/null || echo "❌ No se encontraron claves .pem"

echo ""
echo "📋 SIGUIENTE PASO:"
echo "1. Configure la conexión SSH usando una de las opciones anteriores"
echo "2. Ejecute: scripts/prod/dev-to-prod-migration.sh"
echo ""
echo "Para probar la conexión:"
echo "ssh ${EC2_USER}@${EC2_HOST} 'echo Conexión exitosa'"