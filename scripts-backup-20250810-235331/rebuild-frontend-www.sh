#!/bin/bash

# Script urgente para recompilar frontend con www

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================="
echo "🚨 RECOMPILACIÓN URGENTE DEL FRONTEND"
echo "========================================="
echo "Problema: Frontend apunta a xn--elfogndedonsoto-zrb.com"
echo "Solución: Recompilar para www.xn--elfogndedonsoto-zrb.com"
echo ""

# Verificar que estamos en EC2
if [ ! -f /opt/restaurant-web/frontend/package.json ]; then
    echo -e "${RED}❌ Este script debe ejecutarse en el servidor EC2${NC}"
    exit 1
fi

# 1. Ir al directorio del frontend
cd /opt/restaurant-web/frontend

# 2. Crear/actualizar .env.production con la URL correcta
echo -e "${BLUE}1. Actualizando .env.production...${NC}"
cat > .env.production << 'EOF'
# Frontend Production Environment Variables
# These are baked into the build at compile time

# API Configuration - Using production domain with WWW
# Note: Do NOT include /api/v1 here as it's added automatically in api.js
VITE_API_URL=https://www.xn--elfogndedonsoto-zrb.com

# AWS Cognito Configuration
VITE_AWS_REGION=us-west-2
VITE_AWS_COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI
VITE_AWS_COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0
EOF

echo "✅ .env.production actualizado"
echo "Contenido:"
cat .env.production

# 3. Limpiar cache y build anterior
echo -e "\n${BLUE}2. Limpiando cache y build anterior...${NC}"
rm -rf dist/
rm -rf node_modules/.cache/ 2>/dev/null || true
rm -rf node_modules/.vite/ 2>/dev/null || true

# 4. Reinstalar dependencias (por si acaso)
echo -e "\n${BLUE}3. Verificando dependencias...${NC}"
npm install --silent

# 5. Build con variables explícitas
echo -e "\n${BLUE}4. Compilando frontend...${NC}"
echo "⚠️  Esto puede tomar varios minutos..."

# Establecer variables explícitamente
export NODE_ENV=production
export VITE_API_URL=https://www.xn--elfogndedonsoto-zrb.com
export VITE_AWS_REGION=us-west-2
export VITE_AWS_COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI
export VITE_AWS_COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0

echo "Variables de entorno:"
echo "NODE_ENV=$NODE_ENV"
echo "VITE_API_URL=$VITE_API_URL"
echo ""

# Ejecutar build
npm run build

# 6. Verificar que el build existe
if [ ! -f dist/index.html ]; then
    echo -e "${RED}❌ Error: Build falló${NC}"
    echo "Verificando logs..."
    ls -la dist/ 2>/dev/null || echo "Directorio dist no existe"
    exit 1
fi

echo -e "\n${GREEN}✅ Build completado exitosamente${NC}"

# 7. Hacer backup del frontend actual
echo -e "\n${BLUE}5. Haciendo backup del frontend actual...${NC}"
if [ -d /var/www/restaurant ]; then
    sudo cp -r /var/www/restaurant /var/www/restaurant-backup-$(date +%Y%m%d-%H%M%S)
    echo "✅ Backup creado"
fi

# 8. Detener nginx temporalmente
echo -e "\n${BLUE}6. Actualizando archivos web...${NC}"
sudo systemctl stop nginx

# 9. Copiar nuevos archivos
sudo rm -rf /var/www/restaurant/*
sudo cp -r dist/* /var/www/restaurant/
sudo chown -R www-data:www-data /var/www/restaurant
sudo chmod -R 755 /var/www/restaurant

echo "✅ Archivos copiados"

# 10. Verificar archivos copiados
echo "Verificando instalación:"
ls -la /var/www/restaurant/ | head -10

# 11. Iniciar nginx
sudo systemctl start nginx

# 12. Verificar que nginx inició correctamente
if ! sudo systemctl is-active --quiet nginx; then
    echo -e "${RED}❌ Error: Nginx no pudo iniciarse${NC}"
    sudo systemctl status nginx
    exit 1
fi

echo -e "\n${GREEN}✅ Nginx reiniciado correctamente${NC}"

# 13. Verificar la nueva configuración
echo -e "\n${BLUE}7. Verificando nueva configuración...${NC}"

# Buscar la URL en los archivos JS compilados
echo "Verificando URL en archivos compilados:"
if grep -r "www.xn--elfogndedonsoto-zrb.com" /var/www/restaurant/assets/ 2>/dev/null; then
    echo -e "${GREEN}✅ URL correcta encontrada en archivos compilados${NC}"
else
    echo -e "${YELLOW}⚠️  No se encontró la URL en archivos compilados${NC}"
    echo "Verificando URLs sin www:"
    if grep -r "xn--elfogndedonsoto-zrb.com" /var/www/restaurant/assets/ 2>/dev/null | head -5; then
        echo -e "${RED}❌ Aún hay URLs sin www en el build${NC}"
    fi
fi

# 14. Probar el sitio
echo -e "\n${BLUE}8. Probando el sitio...${NC}"
sleep 2

# Test localhost
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost 2>/dev/null)
echo "Respuesta localhost: $HTTP_STATUS"

# Test API
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/health/ 2>/dev/null)
echo "Respuesta API: $API_STATUS"

if [ "$API_STATUS" == "200" ]; then
    echo -e "${GREEN}✅ API responde correctamente${NC}"
else
    echo -e "${YELLOW}⚠️  API respuesta: $API_STATUS${NC}"
fi

echo -e "\n${GREEN}🎉 RECOMPILACIÓN COMPLETADA${NC}"
echo "========================================="
echo ""
echo "📋 Cambios realizados:"
echo "• Frontend recompilado con VITE_API_URL=https://www.xn--elfogndedonsoto-zrb.com"
echo "• Archivos desplegados en /var/www/restaurant"
echo "• Nginx reiniciado"
echo ""
echo "🌐 Ahora la aplicación debería funcionar en:"
echo "• https://www.xn--elfogndedonsoto-zrb.com"
echo ""
echo "🔍 Para verificar:"
echo "• Abrir la consola del navegador"
echo "• Las llamadas API ahora deberían ir a www.xn--elfogndedonsoto-zrb.com"
echo ""
echo "⚠️  Si aún hay problemas:"
echo "• Limpiar cache del navegador (Ctrl+F5)"
echo "• Verificar que DNS esté propagado"
echo "• Ejecutar: sudo ./deploy/diagnose-frontend.sh"