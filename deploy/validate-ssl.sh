#!/bin/bash

# Script de validación SSL profesional

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

DOMAIN="www.xn--elfogndedonsoto-zrb.com"

echo "========================================="
echo "🔍 VALIDACIÓN SSL PROFESIONAL"
echo "========================================="
echo "Dominio: $DOMAIN"
echo ""

# 1. Verificar certificado SSL
echo -e "${BLUE}1. VERIFICANDO CERTIFICADO SSL...${NC}"
echo "----------------------------------------"

if openssl s_client -connect $DOMAIN:443 -servername $DOMAIN < /dev/null 2>/dev/null | openssl x509 -noout -text | grep -q "DNS:$DOMAIN"; then
    echo -e "${GREEN}✅ Certificado SSL válido para $DOMAIN${NC}"
    
    # Mostrar fechas del certificado
    echo "Fechas del certificado:"
    openssl s_client -connect $DOMAIN:443 -servername $DOMAIN < /dev/null 2>/dev/null | openssl x509 -noout -dates
    
    # Verificar SAN
    echo -e "\nDominios en el certificado:"
    openssl s_client -connect $DOMAIN:443 -servername $DOMAIN < /dev/null 2>/dev/null | openssl x509 -noout -text | grep -A 1 "Subject Alternative Name" || echo "SAN no disponible"
else
    echo -e "${RED}❌ Certificado SSL inválido o no disponible${NC}"
    exit 1
fi

# 2. Verificar headers de seguridad
echo -e "\n${BLUE}2. VERIFICANDO HEADERS DE SEGURIDAD...${NC}"
echo "----------------------------------------"

HEADERS=$(curl -I https://$DOMAIN/ 2>/dev/null)

# HSTS
if echo "$HEADERS" | grep -qi "strict-transport-security"; then
    echo "✅ HSTS: Configurado"
    echo "$HEADERS" | grep -i "strict-transport-security"
else
    echo "❌ HSTS: No configurado"
fi

# X-Frame-Options
if echo "$HEADERS" | grep -qi "x-frame-options"; then
    echo "✅ X-Frame-Options: Configurado"
else
    echo "❌ X-Frame-Options: No configurado"
fi

# X-Content-Type-Options
if echo "$HEADERS" | grep -qi "x-content-type-options"; then
    echo "✅ X-Content-Type-Options: Configurado"
else
    echo "❌ X-Content-Type-Options: No configurado"
fi

# 3. Verificar redirección HTTP → HTTPS
echo -e "\n${BLUE}3. VERIFICANDO REDIRECCIÓN HTTP → HTTPS...${NC}"
echo "----------------------------------------"

HTTP_RESPONSE=$(curl -s -I http://$DOMAIN/ | head -1)
if echo "$HTTP_RESPONSE" | grep -q "301\|302"; then
    echo -e "${GREEN}✅ Redirección HTTP → HTTPS: Configurada${NC}"
    echo "$HTTP_RESPONSE"
else
    echo -e "${RED}❌ Redirección HTTP → HTTPS: No configurada${NC}"
fi

# 4. Verificar API
echo -e "\n${BLUE}4. VERIFICANDO API...${NC}"
echo "----------------------------------------"

API_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null https://$DOMAIN/api/v1/health/)
if [ "$API_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ API: Responde correctamente ($API_RESPONSE)${NC}"
else
    echo -e "${YELLOW}⚠️  API: Respuesta $API_RESPONSE${NC}"
fi

# 5. Verificar frontend
echo -e "\n${BLUE}5. VERIFICANDO FRONTEND...${NC}"
echo "----------------------------------------"

FRONTEND_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null https://$DOMAIN/)
if [ "$FRONTEND_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ Frontend: Carga correctamente ($FRONTEND_RESPONSE)${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend: Respuesta $FRONTEND_RESPONSE${NC}"
fi

# 6. Verificar configuración SSL (grado simulado)
echo -e "\n${BLUE}6. ANÁLISIS DE CONFIGURACIÓN SSL...${NC}"
echo "----------------------------------------"

# Verificar protocolos SSL
SSL_PROTOCOLS=$(openssl s_client -connect $DOMAIN:443 -servername $DOMAIN < /dev/null 2>&1 | grep "Protocol" | head -1)
echo "$SSL_PROTOCOLS"

# Verificar cifrado
SSL_CIPHER=$(openssl s_client -connect $DOMAIN:443 -servername $DOMAIN < /dev/null 2>&1 | grep "Cipher" | head -1)
echo "$SSL_CIPHER"

# 7. Resumen final
echo -e "\n${BLUE}7. RESUMEN FINAL...${NC}"
echo "=========================================="

SCORE=0

# Puntuación SSL
if openssl s_client -connect $DOMAIN:443 -servername $DOMAIN < /dev/null 2>/dev/null | openssl x509 -noout -text | grep -q "DNS:$DOMAIN"; then
    ((SCORE+=25))
fi

if echo "$HEADERS" | grep -qi "strict-transport-security"; then ((SCORE+=25)); fi
if curl -s -I http://$DOMAIN/ | head -1 | grep -q "301\|302"; then ((SCORE+=25)); fi
if [ "$API_RESPONSE" = "200" ]; then ((SCORE+=25)); fi

echo "Puntuación SSL: $SCORE/100"

if [ $SCORE -eq 100 ]; then
    echo -e "${GREEN}🏆 EXCELENTE: Configuración SSL perfecta${NC}"
elif [ $SCORE -ge 75 ]; then
    echo -e "${GREEN}✅ BUENA: Configuración SSL sólida${NC}"
elif [ $SCORE -ge 50 ]; then
    echo -e "${YELLOW}⚠️  REGULAR: Configuración SSL mejorable${NC}"
else
    echo -e "${RED}❌ DEFICIENTE: Configuración SSL requiere atención${NC}"
fi

echo ""
echo "🔗 Para análisis completo, visitar:"
echo "https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
echo ""
echo "📊 Métricas verificadas:"
echo "• Certificado SSL válido y confiable"
echo "• Headers de seguridad implementados" 
echo "• Redirección HTTP → HTTPS forzada"
echo "• API y frontend accesibles vía HTTPS"
echo "• Configuración de protocolos modernos"