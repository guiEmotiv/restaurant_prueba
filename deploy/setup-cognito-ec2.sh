#!/bin/bash
# Script para configurar AWS Cognito en EC2

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔐 CONFIGURACIÓN DE AWS COGNITO PARA EC2${NC}"
echo "============================================"
echo ""

# Verificar si estamos en EC2
if [ ! -f "/opt/restaurant-web/docker-compose.ec2.yml" ]; then
    echo -e "${RED}❌ Este script debe ejecutarse en el servidor EC2${NC}"
    echo -e "${YELLOW}📍 Ubicación esperada: /opt/restaurant-web${NC}"
    exit 1
fi

# Verificar que existe el archivo .env.ec2.cognito
if [ ! -f "/opt/restaurant-web/.env.ec2.cognito" ]; then
    echo -e "${RED}❌ No se encontró el archivo .env.ec2.cognito${NC}"
    echo -e "${YELLOW}📝 Primero crea el archivo con tu configuración de Cognito${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Configuración actual de Cognito:${NC}"
echo ""

# Mostrar configuración actual (sin mostrar valores sensibles)
if [ -f "/opt/restaurant-web/.env.ec2" ]; then
    echo "Archivo .env.ec2 existente:"
    grep -E "USE_COGNITO_AUTH|AWS_REGION|COGNITO_USER_POOL_ID|COGNITO_APP_CLIENT_ID" /opt/restaurant-web/.env.ec2 || echo "  No hay configuración de Cognito"
else
    echo "No existe archivo .env.ec2"
fi

echo ""
echo -e "${YELLOW}⚡ ¿Deseas activar la autenticación con AWS Cognito? (s/n)${NC}"
read -r response

if [[ "$response" != "s" && "$response" != "S" ]]; then
    echo -e "${YELLOW}Operación cancelada${NC}"
    exit 0
fi

# Backup del archivo actual si existe
if [ -f "/opt/restaurant-web/.env.ec2" ]; then
    BACKUP_FILE="/opt/restaurant-web/.env.ec2.backup.$(date +%Y%m%d_%H%M%S)"
    cp /opt/restaurant-web/.env.ec2 "$BACKUP_FILE"
    echo -e "${GREEN}✅ Backup creado: $BACKUP_FILE${NC}"
fi

# Copiar configuración de Cognito
cp /opt/restaurant-web/.env.ec2.cognito /opt/restaurant-web/.env.ec2
echo -e "${GREEN}✅ Configuración de Cognito activada${NC}"

echo ""
echo -e "${YELLOW}📝 IMPORTANTE: Ahora debes actualizar los valores en .env.ec2:${NC}"
echo "   1. COGNITO_USER_POOL_ID - Tu User Pool ID de AWS Cognito"
echo "   2. COGNITO_APP_CLIENT_ID - Tu App Client ID de AWS Cognito"
echo "   3. AWS_REGION - La región donde está tu User Pool"
echo ""
echo -e "${YELLOW}Edita el archivo con:${NC}"
echo "   sudo nano /opt/restaurant-web/.env.ec2"
echo ""

# Verificar configuración del frontend
FRONTEND_ENV="/opt/restaurant-web/frontend/.env.production"
if [ -f "$FRONTEND_ENV" ]; then
    echo -e "${YELLOW}📱 También actualiza el frontend:${NC}"
    echo "   sudo nano $FRONTEND_ENV"
    echo ""
    echo "   Asegúrate de que coincidan:"
    echo "   - VITE_AWS_REGION"
    echo "   - VITE_AWS_COGNITO_USER_POOL_ID"
    echo "   - VITE_AWS_COGNITO_APP_CLIENT_ID"
else
    echo -e "${RED}⚠️  No se encontró $FRONTEND_ENV${NC}"
    echo "   Deberás crear este archivo para el frontend"
fi

echo ""
echo -e "${BLUE}🔄 Para aplicar los cambios:${NC}"
echo "   1. Reconstruir el frontend: ./deploy/ec2-deploy.sh build-frontend"
echo "   2. Reiniciar la aplicación: ./deploy/ec2-deploy.sh restart"
echo ""
echo -e "${GREEN}✨ ¡Configuración de Cognito lista para personalizar!${NC}"