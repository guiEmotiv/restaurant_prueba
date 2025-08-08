#!/bin/bash

# Fix rápido para certificados SSL existentes

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================="
echo "🔧 FIX RÁPIDO CERTIFICADOS SSL"
echo "========================================="

# Detectar certificados existentes
CERT_PATH=""
if [ -d "/etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com" ]; then
    CERT_PATH="xn--elfogndedonsoto-zrb.com"
    echo -e "${GREEN}✅ Certificado encontrado en: $CERT_PATH${NC}"
elif [ -d "/etc/letsencrypt/live/www.xn--elfogndedonsoto-zrb.com" ]; then
    CERT_PATH="www.xn--elfogndedonsoto-zrb.com"
    echo -e "${GREEN}✅ Certificado encontrado en: $CERT_PATH${NC}"
else
    echo -e "${RED}❌ No se encontraron certificados${NC}"
    exit 1
fi

# Verificar archivos del certificado
if [ ! -f "/etc/letsencrypt/live/$CERT_PATH/fullchain.pem" ]; then
    echo -e "${RED}❌ fullchain.pem no encontrado${NC}"
    exit 1
fi

if [ ! -f "/etc/letsencrypt/live/$CERT_PATH/privkey.pem" ]; then
    echo -e "${RED}❌ privkey.pem no encontrado${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Archivos de certificado válidos${NC}"

# Detener nginx
echo -e "\n${BLUE}Deteniendo nginx...${NC}"
systemctl stop nginx 2>/dev/null || true

# Crear configuración nginx con el path correcto
echo -e "\n${BLUE}Configurando nginx con certificados existentes...${NC}"
cat > /etc/nginx/sites-available/xn--elfogndedonsoto-zrb.com << EOF
# Redirección HTTP → HTTPS
server {
    listen 80;
    server_name www.xn--elfogndedonsoto-zrb.com xn--elfogndedonsoto-zrb.com;
    return 301 https://www.xn--elfogndedonsoto-zrb.com\$request_uri;
}

# Servidor HTTPS principal - WWW
server {
    listen 443 ssl http2;
    server_name www.xn--elfogndedonsoto-zrb.com;

    # Certificados SSL
    ssl_certificate /etc/letsencrypt/live/$CERT_PATH/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$CERT_PATH/privkey.pem;
    
    # Configuración SSL moderna
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:50m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/$CERT_PATH/chain.pem;
    resolver 8.8.8.8 8.8.4.4 valid=300s;

    # Headers de seguridad
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Directorio web
    root /var/www/restaurant;
    index index.html;

    # Logs
    access_log /var/log/nginx/restaurant-access.log;
    error_log /var/log/nginx/restaurant-error.log;

    # Frontend SPA
    location / {
        try_files \$uri \$uri/ /index.html;
        
        # No cache para HTML
        location = /index.html {
            add_header Cache-Control "no-cache, no-store, must-revalidate" always;
            add_header Pragma "no-cache" always;
            add_header Expires "0" always;
        }
        
        # Cache para assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
            expires 1y;
            add_header Cache-Control "public, immutable" always;
        }
    }

    # API Backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$server_name;
        
        # CORS para API
        add_header 'Access-Control-Allow-Origin' '\$http_origin' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,Expires,Accept,Accept-Language,Content-Language,Origin' always;
        
        # Handle OPTIONS
        if (\$request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '\$http_origin' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,Expires,Accept,Accept-Language,Content-Language,Origin' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' 86400;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check
    location = /health/ {
        proxy_pass http://127.0.0.1:8000/api/v1/health/;
        proxy_set_header Host \$host;
        access_log off;
    }
}

# Redirigir dominio sin www a www
server {
    listen 443 ssl http2;
    server_name xn--elfogndedonsoto-zrb.com;
    
    ssl_certificate /etc/letsencrypt/live/$CERT_PATH/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$CERT_PATH/privkey.pem;
    
    return 301 https://www.xn--elfogndedonsoto-zrb.com\$request_uri;
}
EOF

# Verificar configuración
echo -e "\n${BLUE}Verificando configuración...${NC}"
if ! nginx -t; then
    echo -e "${RED}❌ Error en configuración nginx${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Configuración nginx válida${NC}"

# Crear directorio web si no existe
mkdir -p /var/www/restaurant
chown -R www-data:www-data /var/www/restaurant

# Habilitar sitio
ln -sf /etc/nginx/sites-available/xn--elfogndedonsoto-zrb.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Iniciar nginx
echo -e "\n${BLUE}Iniciando nginx...${NC}"
systemctl start nginx
systemctl enable nginx

# Verificación final
echo -e "\n${BLUE}Verificación final...${NC}"
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx activo${NC}"
else
    echo -e "${RED}❌ Error: Nginx no está activo${NC}"
    systemctl status nginx
    exit 1
fi

# Test HTTPS
echo -e "\n${BLUE}Probando HTTPS...${NC}"
sleep 3

HTTPS_STATUS=\$(curl -s -o /dev/null -w "%{http_code}" https://www.xn--elfogndedonsoto-zrb.com/ 2>/dev/null)
echo "HTTPS Response: \$HTTPS_STATUS"

API_STATUS=\$(curl -s -o /dev/null -w "%{http_code}" https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/ 2>/dev/null)
echo "API Response: \$API_STATUS"

echo -e "\n${GREEN}🎉 SSL CONFIGURADO CORRECTAMENTE${NC}"
echo "=========================================="
echo ""
echo "🔐 **Certificado SSL activo**"
echo "• Path: /etc/letsencrypt/live/$CERT_PATH/"
echo "• Dominio principal: www.xn--elfogndedonsoto-zrb.com"
echo "• Protocolo: Solo HTTPS"
echo ""
echo "🌐 **URL de acceso:**"
echo "• https://www.xn--elfogndedonsoto-zrb.com"
echo ""
echo "📋 **Próximos pasos:**"
echo "1. Compilar frontend: sudo ./deploy/rebuild-frontend-www.sh"
echo "2. Validar SSL: sudo ./deploy/validate-ssl.sh"
echo ""
echo "🔍 **Información del certificado:**"
openssl x509 -in "/etc/letsencrypt/live/$CERT_PATH/fullchain.pem" -noout -dates
echo ""
echo "🔧 **Configuración completada con certificados existentes**"