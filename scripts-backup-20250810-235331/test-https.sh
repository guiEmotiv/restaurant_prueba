#!/bin/bash

# Script simple para probar HTTPS

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

DOMAIN="www.xn--elfogndedonsoto-zrb.com"

echo "========================================="
echo "🌐 PROBANDO CONFIGURACIÓN HTTPS"
echo "========================================="
echo "Dominio: $DOMAIN"
echo ""

# 1. Probar HTTPS principal
echo -e "${BLUE}1. Probando HTTPS principal...${NC}"
HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/ 2>/dev/null || echo "error")
echo "HTTPS Response: $HTTPS_STATUS"

if [ "$HTTPS_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ HTTPS frontend funciona correctamente${NC}"
elif [ "$HTTPS_STATUS" = "301" ] || [ "$HTTPS_STATUS" = "302" ]; then
    echo -e "${YELLOW}⚠️  HTTPS con redirección ($HTTPS_STATUS)${NC}"
else
    echo -e "${RED}❌ HTTPS frontend no funciona ($HTTPS_STATUS)${NC}"
fi

# 2. Probar API
echo -e "\n${BLUE}2. Probando API...${NC}"
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/api/v1/health/ 2>/dev/null || echo "error")
echo "API Response: $API_STATUS"

if [ "$API_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ API funciona correctamente${NC}"
    # Mostrar contenido de la API
    echo -e "\n${BLUE}Contenido de API Health:${NC}"
    curl -s https://$DOMAIN/api/v1/health/ | head -100
else
    echo -e "${RED}❌ API no funciona ($API_STATUS)${NC}"
fi

# 3. Probar redirección HTTP -> HTTPS
echo -e "\n${BLUE}3. Probando redirección HTTP -> HTTPS...${NC}"
HTTP_REDIRECT=$(curl -s -I http://$DOMAIN/ | grep -E "HTTP|Location" | head -2)
echo "$HTTP_REDIRECT"

if echo "$HTTP_REDIRECT" | grep -q "301\|302"; then
    echo -e "${GREEN}✅ Redirección HTTP -> HTTPS activa${NC}"
else
    echo -e "${YELLOW}⚠️  Redirección no detectada${NC}"
fi

# 4. Verificar certificado
echo -e "\n${BLUE}4. Verificando certificado SSL...${NC}"
CERT_INFO=$(echo | openssl s_client -connect $DOMAIN:443 -servername $DOMAIN 2>/dev/null | openssl x509 -noout -subject -dates 2>/dev/null)

if [ -n "$CERT_INFO" ]; then
    echo -e "${GREEN}✅ Certificado SSL válido${NC}"
    echo "$CERT_INFO"
else
    echo -e "${RED}❌ No se pudo verificar certificado SSL${NC}"
fi

# 5. Verificar servicios
echo -e "\n${BLUE}5. Verificando servicios...${NC}"

if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx: ACTIVO${NC}"
else
    echo -e "${RED}❌ Nginx: INACTIVO${NC}"
fi

if docker ps | grep -q restaurant-web-web-1; then
    echo -e "${GREEN}✅ Backend Docker: ACTIVO${NC}"
else
    echo -e "${RED}❌ Backend Docker: INACTIVO${NC}"
fi

# 6. Verificar archivos frontend
echo -e "\n${BLUE}6. Verificando frontend...${NC}"
if [ -f /var/www/restaurant/index.html ]; then
    echo -e "${GREEN}✅ Frontend: DESPLEGADO${NC}"
    echo "Tamaño index.html: $(ls -lh /var/www/restaurant/index.html | awk '{print $5}')"
else
    echo -e "${RED}❌ Frontend: NO DESPLEGADO${NC}"
fi

# Resumen final
echo -e "\n${BLUE}RESUMEN:${NC}"
echo "=========================================="

SCORE=0
if [ "$HTTPS_STATUS" = "200" ]; then ((SCORE+=25)); fi
if [ "$API_STATUS" = "200" ]; then ((SCORE+=25)); fi
if echo "$HTTP_REDIRECT" | grep -q "301\|302"; then ((SCORE+=25)); fi
if [ -n "$CERT_INFO" ]; then ((SCORE+=25)); fi

echo "Puntuación: $SCORE/100"

if [ $SCORE -eq 100 ]; then
    echo -e "${GREEN}🏆 PERFECTO: Todo funciona correctamente${NC}"
elif [ $SCORE -ge 75 ]; then
    echo -e "${GREEN}✅ BUENO: Configuración mayormente funcional${NC}"
elif [ $SCORE -ge 50 ]; then
    echo -e "${YELLOW}⚠️  REGULAR: Algunos problemas detectados${NC}"
else
    echo -e "${RED}❌ CRÍTICO: Múltiples problemas${NC}"
fi

echo ""
echo "🌐 URLs para probar manualmente:"
echo "• https://$DOMAIN"
echo "• https://$DOMAIN/api/v1/health/"
echo ""

if [ $SCORE -lt 100 ]; then
    echo "🔧 Para solucionar problemas:"
    echo "• Compilar frontend: sudo ./deploy/rebuild-frontend-www.sh"
    echo "• Ver logs nginx: tail -f /var/log/nginx/restaurant-error.log"
    echo "• Ver logs docker: docker logs restaurant-web-web-1"
fi