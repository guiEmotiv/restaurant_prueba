#!/bin/bash

echo "=== DIAGNÓSTICO DE DEPLOYMENT ==="
echo "================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="/opt/restaurant-web"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

cd "$PROJECT_DIR"

echo -e "\n${BLUE}1. Verificando estado actual del git...${NC}"
echo "Current commit:"
git log --oneline -1

echo -e "\nRemote status:"
git status -b --porcelain=v1

echo -e "\n${BLUE}2. Haciendo git pull...${NC}"
git pull origin main
echo "After git pull:"
git log --oneline -1

echo -e "\n${BLUE}3. Verificando archivo OrderReceipt.jsx...${NC}"
echo "Checking if cleaned version exists:"
if grep -q "handleBluetoothPrint" "$FRONTEND_DIR/src/pages/operation/OrderReceipt.jsx"; then
    echo -e "${RED}❌ OLD VERSION - Still has print functions${NC}"
else
    echo -e "${GREEN}✅ NEW VERSION - Clean without print functions${NC}"
fi

echo "File size and modification time:"
ls -la "$FRONTEND_DIR/src/pages/operation/OrderReceipt.jsx"

echo -e "\n${BLUE}4. Verificando ReceiptFormat.jsx...${NC}"
echo "Checking compact format:"
if grep -q "font-mono" "$FRONTEND_DIR/src/components/ReceiptFormat.jsx"; then
    echo -e "${GREEN}✅ NEW VERSION - Has compact format${NC}"
else
    echo -e "${RED}❌ OLD VERSION - Missing compact format${NC}"
fi

echo -e "\n${BLUE}5. Limpiando cache de npm...${NC}"
cd "$FRONTEND_DIR"
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf dist 2>/dev/null || true
npm cache clean --force 2>/dev/null || true

echo -e "\n${BLUE}6. Building frontend...${NC}"
npm run build

echo -e "\n${BLUE}7. Verificando build output...${NC}"
if [ -d "dist" ]; then
    echo -e "${GREEN}✅ Build directory exists${NC}"
    echo "Build size: $(du -sh dist | cut -f1)"
    echo "Build files: $(find dist -name "*.js" -o -name "*.html" | wc -l) files"
else
    echo -e "${RED}❌ Build directory missing${NC}"
    exit 1
fi

echo -e "\n${BLUE}8. Verificando contenido del build...${NC}"
# Check if the built files contain the new clean version
if find dist -name "*.js" -exec grep -l "handleBluetoothPrint" {} \; | head -1; then
    echo -e "${RED}❌ Built files still contain old print functions${NC}"
else
    echo -e "${GREEN}✅ Built files are clean${NC}"
fi

echo -e "\n${BLUE}9. Desplegando a nginx...${NC}"
systemctl stop nginx
rm -rf /var/www/restaurant/*
mkdir -p /var/www/restaurant
cp -r dist/* /var/www/restaurant/
chown -R www-data:www-data /var/www/restaurant
systemctl start nginx

echo -e "\n${BLUE}10. Verificando deployment...${NC}"
echo "Nginx files deployed: $(find /var/www/restaurant -type f | wc -l) files"
echo "Nginx directory size: $(du -sh /var/www/restaurant | cut -f1)"

if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx is running${NC}"
else
    echo -e "${RED}❌ Nginx is not running${NC}"
fi

echo -e "\n${GREEN}=== DIAGNÓSTICO COMPLETO ===${NC}"
echo "Si aún no ves los cambios:"
echo "1. Limpia la cache del navegador (Ctrl+F5)"
echo "2. Verifica la consola del navegador por errores"
echo "3. Revisa si hay errores en los logs de nginx"

echo -e "\n${BLUE}Nginx logs (últimas 10 líneas):${NC}"
journalctl -u nginx --no-pager | tail -10