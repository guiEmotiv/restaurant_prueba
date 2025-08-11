#!/bin/bash

# Script de emergencia para arreglar nginx y certificados SSL

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================="
echo "🚨 REPARACIÓN DE EMERGENCIA - NGINX"
echo "========================================="

# 1. Verificar certificados existentes
echo -e "\n${BLUE}1. VERIFICANDO CERTIFICADOS SSL...${NC}"
echo "----------------------------------------"

if [ -d /etc/letsencrypt/live ]; then
    echo "Certificados encontrados:"
    ls -la /etc/letsencrypt/live/
    
    # Verificar si existe certificado para dominio sin www
    if [ -d "/etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com" ]; then
        CERT_PATH="xn--elfogndedonsoto-zrb.com"
        echo -e "${GREEN}✅ Certificado encontrado para dominio sin www${NC}"
    elif [ -d "/etc/letsencrypt/live/www.xn--elfogndedonsoto-zrb.com" ]; then
        CERT_PATH="www.xn--elfogndedonsoto-zrb.com"
        echo -e "${GREEN}✅ Certificado encontrado para dominio con www${NC}"
    else
        echo -e "${RED}❌ No se encontraron certificados SSL${NC}"
        CERT_PATH=""
    fi
else
    echo -e "${RED}❌ No existe directorio de certificados${NC}"
    CERT_PATH=""
fi

# 2. Detener nginx
echo -e "\n${BLUE}2. DETENIENDO NGINX...${NC}"
systemctl stop nginx 2>/dev/null || true

# 3. Crear configuración que funcione
echo -e "\n${BLUE}3. CREANDO CONFIGURACIÓN NGINX...${NC}"
echo "----------------------------------------"

if [ -n "$CERT_PATH" ]; then
    echo "Creando configuración con SSL usando: $CERT_PATH"
    
    cat > /etc/nginx/sites-available/xn--elfogndedonsoto-zrb.com << EOF
# HTTP - Redirigir a HTTPS
server {
    listen 80;
    server_name www.xn--elfogndedonsoto-zrb.com xn--elfogndedonsoto-zrb.com;
    return 301 https://www.xn--elfogndedonsoto-zrb.com\$request_uri;
}

# HTTPS - Servidor principal
server {
    listen 443 ssl http2;
    server_name www.xn--elfogndedonsoto-zrb.com;

    # Certificados SSL
    ssl_certificate /etc/letsencrypt/live/$CERT_PATH/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$CERT_PATH/privkey.pem;
    
    # Configuración SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Directorio del sitio
    root /var/www/restaurant;
    index index.html;

    # Logs
    access_log /var/log/nginx/restaurant-access.log;
    error_log /var/log/nginx/restaurant-error.log;

    # Headers de seguridad
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Servir archivos estáticos del frontend
    location / {
        try_files \$uri \$uri/ /index.html;
        
        # Cache para assets estáticos
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            add_header X-Frame-Options "SAMEORIGIN" always;
            add_header X-Content-Type-Options "nosniff" always;
        }
    }

    # Proxy para API del backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$server_name;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '\$http_origin' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE, PATCH' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,Expires,Accept,Accept-Language,Content-Language,Origin' always;
        
        # Handle preflight OPTIONS requests
        if (\$request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '\$http_origin' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE, PATCH' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,Expires,Accept,Accept-Language,Content-Language,Origin' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' 86400;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }

    # Health check
    location /health/ {
        proxy_pass http://127.0.0.1:8000/api/v1/health/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
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

else
    echo -e "${YELLOW}⚠️  No hay certificados SSL, creando configuración solo HTTP${NC}"
    
    cat > /etc/nginx/sites-available/xn--elfogndedonsoto-zrb.com << 'EOF'
# Configuración HTTP temporal (sin SSL)
server {
    listen 80;
    server_name www.xn--elfogndedonsoto-zrb.com xn--elfogndedonsoto-zrb.com;

    root /var/www/restaurant;
    index index.html;

    # Logs
    access_log /var/log/nginx/restaurant-access.log;
    error_log /var/log/nginx/restaurant-error.log;

    # Headers de seguridad básicos
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Servir archivos estáticos del frontend
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy para API del backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '$http_origin' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE, PATCH' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,Expires' always;
        
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '$http_origin' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE, PATCH' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,Expires' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' 86400;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }

    # Health check
    location /health/ {
        proxy_pass http://127.0.0.1:8000/api/v1/health/;
        proxy_set_header Host $host;
    }
}
EOF
fi

# 4. Verificar configuración
echo -e "\n${BLUE}4. VERIFICANDO CONFIGURACIÓN...${NC}"
if nginx -t; then
    echo -e "${GREEN}✅ Configuración nginx válida${NC}"
else
    echo -e "${RED}❌ Configuración nginx inválida${NC}"
    exit 1
fi

# 5. Habilitar sitio
echo -e "\n${BLUE}5. HABILITANDO SITIO...${NC}"
ln -sf /etc/nginx/sites-available/xn--elfogndedonsoto-zrb.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 6. Iniciar nginx
echo -e "\n${BLUE}6. INICIANDO NGINX...${NC}"
systemctl start nginx

if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx iniciado correctamente${NC}"
else
    echo -e "${RED}❌ Error al iniciar nginx${NC}"
    systemctl status nginx
    exit 1
fi

# 7. Verificar que el directorio del frontend existe
echo -e "\n${BLUE}7. VERIFICANDO FRONTEND...${NC}"
if [ ! -d /var/www/restaurant ]; then
    echo -e "${YELLOW}⚠️  Creando directorio del frontend${NC}"
    mkdir -p /var/www/restaurant
    echo '<h1>Frontend no disponible</h1><p>Ejecutar script de compilación del frontend</p>' > /var/www/restaurant/index.html
    chown -R www-data:www-data /var/www/restaurant
fi

# 8. Verificación final
echo -e "\n${BLUE}8. VERIFICACIÓN FINAL...${NC}"
echo "=========================================="

# Status de nginx
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx: ACTIVO"
else
    echo "❌ Nginx: INACTIVO"
fi

# Test HTTP
HTTP_STATUS=\$(curl -s -o /dev/null -w "%{http_code}" http://localhost 2>/dev/null)
echo "• HTTP localhost: \$HTTP_STATUS"

# Test con dominio (si hay certificados)
if [ -n "$CERT_PATH" ]; then
    echo "• Configuración: HTTPS habilitado"
    echo "• Certificado: /etc/letsencrypt/live/$CERT_PATH/"
else
    echo "• Configuración: Solo HTTP (temporal)"
    echo "• ⚠️  Necesario obtener certificados SSL"
fi

echo -e "\n${GREEN}🎉 NGINX REPARADO${NC}"
echo "=========================================="
echo ""
if [ -n "$CERT_PATH" ]; then
    echo "🌐 URL: https://www.xn--elfogndedonsoto-zrb.com"
else
    echo "🌐 URL temporal: http://www.xn--elfogndedonsoto-zrb.com"
    echo "⚠️  IMPORTANTE: Obtener certificados SSL con:"
    echo "   sudo certbot certonly --standalone -d www.xn--elfogndedonsoto-zrb.com -d xn--elfogndedonsoto-zrb.com"
fi
echo ""
echo "📋 Siguiente paso:"
echo "• Compilar frontend: sudo ./deploy/rebuild-frontend-www.sh"
echo ""
echo "🔍 Verificar logs:"
echo "• tail -f /var/log/nginx/restaurant-error.log"
echo "• systemctl status nginx"