#!/bin/bash
# Script para activar/desactivar autenticación en EC2

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔐 CONTROL DE AUTENTICACIÓN - EC2${NC}"
echo "===================================="
echo ""

# Verificar si estamos en EC2
if [ ! -f "/opt/restaurant-web/docker-compose.ec2.yml" ]; then
    echo -e "${RED}❌ Este script debe ejecutarse en el servidor EC2${NC}"
    exit 1
fi

cd /opt/restaurant-web

# Mostrar estado actual
if [ -f ".env.ec2" ]; then
    CURRENT_AUTH=$(grep "USE_COGNITO_AUTH" .env.ec2 | cut -d'=' -f2)
    if [ "$CURRENT_AUTH" = "True" ] || [ "$CURRENT_AUTH" = "true" ]; then
        echo -e "${GREEN}Estado actual: Autenticación ACTIVADA (Cognito)${NC}"
    else
        echo -e "${YELLOW}Estado actual: Autenticación DESACTIVADA${NC}"
    fi
else
    echo -e "${RED}No se encontró archivo .env.ec2${NC}"
fi

echo ""
echo "Opciones:"
echo "  1) Activar autenticación con AWS Cognito"
echo "  2) Desactivar autenticación (acceso libre)"
echo "  3) Ver estado actual y salir"
echo ""
echo -n "Selecciona una opción (1-3): "
read -r option

case $option in
    1)
        echo ""
        echo -e "${YELLOW}Activando autenticación con AWS Cognito...${NC}"
        
        # Verificar que existe el archivo con Cognito
        if [ ! -f ".env.ec2.cognito" ]; then
            echo -e "${RED}❌ No se encontró .env.ec2.cognito${NC}"
            echo "Primero configura AWS Cognito"
            exit 1
        fi
        
        # Backup actual
        if [ -f ".env.ec2" ]; then
            cp .env.ec2 .env.ec2.backup.$(date +%Y%m%d_%H%M%S)
        fi
        
        # Activar Cognito
        cp .env.ec2.cognito .env.ec2
        
        echo -e "${GREEN}✅ Autenticación activada${NC}"
        echo ""
        echo -e "${YELLOW}⚠️  IMPORTANTE:${NC}"
        echo "   1. Verifica que las variables de Cognito estén configuradas:"
        echo "      - COGNITO_USER_POOL_ID"
        echo "      - COGNITO_APP_CLIENT_ID"
        echo "   2. Actualiza también frontend/.env.production"
        ;;
        
    2)
        echo ""
        echo -e "${YELLOW}Desactivando autenticación...${NC}"
        
        # Verificar que existe el archivo sin auth
        if [ ! -f ".env.ec2.no-auth" ]; then
            echo -e "${RED}❌ No se encontró .env.ec2.no-auth${NC}"
            exit 1
        fi
        
        # Backup actual
        if [ -f ".env.ec2" ]; then
            cp .env.ec2 .env.ec2.backup.$(date +%Y%m%d_%H%M%S)
        fi
        
        # Desactivar auth
        cp .env.ec2.no-auth .env.ec2
        
        echo -e "${GREEN}✅ Autenticación desactivada${NC}"
        echo -e "${YELLOW}⚠️  ADVERTENCIA: El sistema está accesible sin credenciales${NC}"
        ;;
        
    3)
        echo ""
        echo "Sin cambios"
        exit 0
        ;;
        
    *)
        echo -e "${RED}Opción inválida${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${BLUE}Para aplicar los cambios:${NC}"
echo "   sudo ./deploy/ec2-deploy.sh restart"
echo ""

# Si se activó Cognito, mostrar información adicional
if [ "$option" = "1" ]; then
    echo -e "${BLUE}Si Cognito no está configurado correctamente:${NC}"
    echo "   1. Edita .env.ec2 con tus credenciales de Cognito"
    echo "   2. Reconstruye el frontend: sudo ./deploy/ec2-deploy.sh build-frontend"
    echo "   3. O desactiva temporalmente con: sudo ./deploy/toggle-auth-ec2.sh"
fi