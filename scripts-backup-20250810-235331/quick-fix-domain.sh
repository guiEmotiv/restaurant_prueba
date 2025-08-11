#!/bin/bash

# Script rápido para corregir el problema del dominio
# Mantiene el certificado actual pero configura nginx correctamente

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

DOMAIN="xn--elfogndedonsoto-zrb.com"

echo "========================================="
echo "🔧 CORRECCIÓN RÁPIDA DE DOMINIO"
echo "========================================="

# 1. Actualizar archivo .env de Django
echo -e "\n${BLUE}1. Actualizando configuración Django...${NC}"
if [ -f /opt/restaurant-web/backend/.env ]; then
    # Backup
    cp /opt/restaurant-web/backend/.env /opt/restaurant-web/backend/.env.backup
    
    # Actualizar ALLOWED_HOSTS
    sed -i "s/ALLOWED_HOSTS=.*/ALLOWED_HOSTS=localhost,127.0.0.1,172.31.44.32,$DOMAIN/" /opt/restaurant-web/backend/.env
    echo "✅ ALLOWED_HOSTS actualizado (sin www)"
else
    echo "❌ No se encontró archivo .env"
fi

# 2. Actualizar nginx para aceptar ambos pero redirigir www a sin www
echo -e "\n${BLUE}2. Actualizando configuración nginx...${NC}"
cat > /etc/nginx/sites-available/$DOMAIN << 'EOF'
# Redirección HTTP a HTTPS
server {
    listen 80;
    server_name xn--elfogndedonsoto-zrb.com www.xn--elfogndedonsoto-zrb.com;
    return 301 https://xn--elfogndedonsoto-zrb.com$request_uri;
}

# Configuración HTTPS principal
server {
    listen 443 ssl http2;
    server_name xn--elfogndedonsoto-zrb.com;

    ssl_certificate /etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    root /var/www/restaurant;
    index index.html;

    # Logs
    access_log /var/log/nginx/restaurant-access.log;
    error_log /var/log/nginx/restaurant-error.log;

    # Frontend React App
    location / {
        try_files $uri $uri/ /index.html;
        
        # Headers de seguridad
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }

    # API proxy
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
    }

    # Health check
    location /health/ {
        proxy_pass http://127.0.0.1:8000/api/v1/health/;
        proxy_set_header Host $host;
    }
}

# Redirección de www a sin www en HTTPS
server {
    listen 443 ssl http2;
    server_name www.xn--elfogndedonsoto-zrb.com;
    
    ssl_certificate /etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com/privkey.pem;
    
    return 301 https://xn--elfogndedonsoto-zrb.com$request_uri;
}
EOF

# 3. Verificar sintaxis nginx
echo -e "\n${BLUE}3. Verificando configuración nginx...${NC}"
nginx -t

# 4. Reiniciar servicios
echo -e "\n${BLUE}4. Reiniciando servicios...${NC}"
systemctl reload nginx

# Reiniciar Docker
cd /opt/restaurant-web
if docker ps | grep -q restaurant-web-web-1; then
    docker restart restaurant-web-web-1
    echo "✅ Contenedor Docker reiniciado"
else
    echo "⚠️  Contenedor no encontrado, intentando iniciar..."
    # Intentar con diferentes métodos
    if [ -f docker-compose.yml ]; then
        docker-compose up -d
    elif [ -f docker-compose.ec2.yml ]; then
        docker-compose -f docker-compose.ec2.yml up -d
    else
        echo "❌ No se pudo iniciar el contenedor"
    fi
fi

# 5. Verificar estado
echo -e "\n${BLUE}5. Verificando estado...${NC}"
sleep 3

# Verificar nginx
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx está activo"
else
    echo "❌ Nginx no está activo"
fi

# Verificar Docker
if docker ps | grep -q restaurant-web-web-1; then
    echo "✅ Contenedor Docker está ejecutándose"
else
    echo "❌ Contenedor Docker no está ejecutándose"
fi

# Verificar respuesta HTTP
echo -e "\n${BLUE}6. Verificando respuesta HTTP...${NC}"
if curl -s -o /dev/null -w "%{http_code}" http://localhost | grep -q "301\|200"; then
    echo "✅ El sitio responde correctamente"
else
    echo "❌ El sitio no responde"
fi

echo -e "\n${GREEN}✅ CONFIGURACIÓN COMPLETADA${NC}"
echo "========================================="
echo ""
echo "🌐 URL correcta: https://xn--elfogndedonsoto-zrb.com"
echo "🔄 www redirige automáticamente a la URL sin www"
echo ""
echo "📋 Próximos pasos recomendados:"
echo "1. Eliminar registro DNS A de www en Route 53"
echo "2. En el próximo mantenimiento, renovar certificado sin www"
echo ""
echo "🔍 Para diagnosticar: sudo ./deploy/diagnose-domain.sh"