#!/bin/bash

# Script para solucionar problemas del frontend

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================="
echo "🔧 SOLUCIONANDO PROBLEMAS DEL FRONTEND"
echo "========================================="

# 1. Verificar que estamos en EC2
if [ ! -f /opt/restaurant-web/frontend/package.json ]; then
    echo -e "${RED}❌ Este script debe ejecutarse en el servidor EC2${NC}"
    exit 1
fi

cd /opt/restaurant-web

# 2. Backup del frontend actual
echo -e "\n${BLUE}1. Creando backup del frontend actual...${NC}"
if [ -d /var/www/restaurant ]; then
    sudo cp -r /var/www/restaurant /var/www/restaurant-backup-$(date +%Y%m%d-%H%M%S)
    echo "✅ Backup creado"
else
    echo "⚠️  No hay frontend actual para hacer backup"
fi

# 3. Verificar/instalar dependencias
echo -e "\n${BLUE}2. Instalando dependencias del frontend...${NC}"
cd /opt/restaurant-web/frontend

# Verificar que tenemos Node.js
if ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}Instalando Node.js...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Instalar dependencias
echo "Instalando dependencias npm..."
sudo npm install

# 4. Verificar archivo .env.production
echo -e "\n${BLUE}3. Verificando configuración...${NC}"
if [ -f .env.production ]; then
    echo "✅ .env.production existe"
    echo "Contenido:"
    cat .env.production
else
    echo -e "${YELLOW}⚠️  Creando .env.production...${NC}"
    cat > .env.production << 'EOF'
# Frontend Production Environment Variables
# These are baked into the build at compile time

# API Configuration - Using production domain
# Note: Do NOT include /api/v1 here as it's added automatically in api.js
VITE_API_URL=https://www.xn--elfogndedonsoto-zrb.com

# AWS Cognito Configuration
VITE_AWS_REGION=us-west-2
VITE_AWS_COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI
VITE_AWS_COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0
EOF
    echo "✅ .env.production creado"
fi

# 5. Limpiar build anterior
echo -e "\n${BLUE}4. Limpiando build anterior...${NC}"
if [ -d dist ]; then
    rm -rf dist
    echo "✅ Directorio dist eliminado"
fi

# 6. Compilar frontend
echo -e "\n${BLUE}5. Compilando frontend...${NC}"
echo "Esto puede tomar varios minutos..."

# Establecer NODE_ENV
export NODE_ENV=production

# Build del proyecto
sudo npm run build

# Verificar que el build se completó
if [ ! -d dist ] || [ ! -f dist/index.html ]; then
    echo -e "${RED}❌ Error: El build no se completó correctamente${NC}"
    echo "Verificando logs..."
    exit 1
fi

echo "✅ Build completado exitosamente"

# 7. Copiar archivos al directorio web
echo -e "\n${BLUE}6. Copiando archivos al servidor web...${NC}"

# Crear directorio si no existe
sudo mkdir -p /var/www/restaurant

# Copiar todos los archivos
sudo cp -r dist/* /var/www/restaurant/

# Establecer permisos correctos
sudo chown -R www-data:www-data /var/www/restaurant
sudo chmod -R 755 /var/www/restaurant

echo "✅ Archivos copiados y permisos establecidos"

# 8. Verificar la copia
echo -e "\n${BLUE}7. Verificando instalación...${NC}"
if [ -f /var/www/restaurant/index.html ]; then
    echo "✅ index.html instalado correctamente"
    echo "Tamaño: $(ls -lh /var/www/restaurant/index.html | awk '{print $5}')"
else
    echo -e "${RED}❌ Error: index.html no se instaló${NC}"
    exit 1
fi

if [ -d /var/www/restaurant/assets ]; then
    echo "✅ Assets instalados correctamente"
    echo "Archivos JS: $(find /var/www/restaurant/assets -name "*.js" | wc -l)"
    echo "Archivos CSS: $(find /var/www/restaurant/assets -name "*.css" | wc -l)"
else
    echo -e "${YELLOW}⚠️  No se encontraron assets${NC}"
fi

# 9. Recargar nginx
echo -e "\n${BLUE}8. Recargando nginx...${NC}"
sudo nginx -t
sudo systemctl reload nginx
echo "✅ Nginx recargado"

# 10. Verificar que el sitio responde
echo -e "\n${BLUE}9. Verificando respuesta del sitio...${NC}"
sleep 2

# Probar localhost
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost 2>/dev/null)
if [ "$HTTP_STATUS" == "200" ] || [ "$HTTP_STATUS" == "301" ] || [ "$HTTP_STATUS" == "302" ]; then
    echo "✅ El sitio responde correctamente (HTTP $HTTP_STATUS)"
else
    echo -e "${YELLOW}⚠️  Respuesta HTTP: $HTTP_STATUS${NC}"
fi

# Probar el dominio (puede fallar si DNS no está propagado)
DOMAIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://www.xn--elfogndedonsoto-zrb.com 2>/dev/null || echo "timeout")
if [ "$DOMAIN_STATUS" == "200" ] || [ "$DOMAIN_STATUS" == "301" ] || [ "$DOMAIN_STATUS" == "302" ]; then
    echo "✅ El dominio responde correctamente (HTTP $DOMAIN_STATUS)"
elif [ "$DOMAIN_STATUS" == "timeout" ]; then
    echo -e "${YELLOW}⚠️  No se pudo conectar al dominio (DNS puede no estar propagado)${NC}"
else
    echo -e "${YELLOW}⚠️  Respuesta del dominio: $DOMAIN_STATUS${NC}"
fi

# 11. Mostrar información final
echo -e "\n${GREEN}✅ FRONTEND SOLUCIONADO${NC}"
echo "========================================="
echo ""
echo "📋 Información:"
echo "• Build generado con la configuración para www"
echo "• Archivos copiados a /var/www/restaurant"
echo "• Permisos establecidos correctamente"
echo "• Nginx recargado"
echo ""
echo "🌐 URLs para probar:"
echo "• https://www.xn--elfogndedonsoto-zrb.com"
echo "• Para probar localmente: curl http://localhost"
echo ""
echo "🔍 Si aún hay problemas:"
echo "• Ejecutar: sudo ./deploy/diagnose-frontend.sh"
echo "• Revisar logs: tail -f /var/log/nginx/restaurant-error.log"
echo "• Verificar consola del navegador"
echo ""
echo "📝 Build información:"
echo "• Compilado: $(date)"
echo "• API URL: https://www.xn--elfogndedonsoto-zrb.com"
echo "• Archivos totales: $(find /var/www/restaurant -type f | wc -l)"