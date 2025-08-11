#!/bin/bash

# Script de emergencia para configurar www.xn--elfogndedonsoto-zrb.com
# Ejecutar cuando solo existe el registro DNS para www

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

DOMAIN="xn--elfogndedonsoto-zrb.com"
WWW_DOMAIN="www.xn--elfogndedonsoto-zrb.com"

echo "========================================="
echo "🚨 CONFIGURACIÓN DE EMERGENCIA - WWW"
echo "========================================="
echo "Configurando para usar: https://$WWW_DOMAIN"
echo ""

# 1. Actualizar archivo .env de Django
echo -e "${BLUE}1. Actualizando configuración Django...${NC}"
if [ -f /opt/restaurant-web/backend/.env ]; then
    # Backup
    cp /opt/restaurant-web/backend/.env /opt/restaurant-web/backend/.env.backup-www
    
    # Actualizar ALLOWED_HOSTS
    sed -i "s/ALLOWED_HOSTS=.*/ALLOWED_HOSTS=localhost,127.0.0.1,172.31.44.32,$DOMAIN,$WWW_DOMAIN/" /opt/restaurant-web/backend/.env
    echo "✅ ALLOWED_HOSTS actualizado con www"
    
    # Actualizar DOMAIN_NAME si existe
    if grep -q "DOMAIN_NAME=" /opt/restaurant-web/backend/.env; then
        sed -i "s/DOMAIN_NAME=.*/DOMAIN_NAME=$DOMAIN/" /opt/restaurant-web/backend/.env
    else
        echo "DOMAIN_NAME=$DOMAIN" >> /opt/restaurant-web/backend/.env
    fi
    echo "✅ DOMAIN_NAME configurado"
else
    echo "❌ No se encontró archivo .env"
fi

# 2. Detener nginx temporalmente
echo -e "\n${BLUE}2. Deteniendo nginx...${NC}"
systemctl stop nginx

# 3. Obtener/renovar certificado SSL para www
echo -e "\n${BLUE}3. Obteniendo certificado SSL para www...${NC}"

# Determinar la ruta de certbot
if command -v certbot &> /dev/null; then
    CERTBOT_PATH="certbot"
elif [ -f /snap/bin/certbot ]; then
    CERTBOT_PATH="/snap/bin/certbot"
else
    echo -e "${RED}❌ Certbot no encontrado${NC}"
    exit 1
fi

# Obtener certificado para www (y dominio sin www por si acaso)
$CERTBOT_PATH certonly \
    --standalone \
    -d $WWW_DOMAIN \
    -d $DOMAIN \
    --non-interactive \
    --agree-tos \
    --email elfogondedonsoto@gmail.com \
    --force-renewal

# 4. Configurar nginx
echo -e "\n${BLUE}4. Configurando nginx...${NC}"
cat > /etc/nginx/sites-available/$DOMAIN << 'EOF'
# Redirección HTTP a HTTPS
server {
    listen 80;
    server_name www.xn--elfogndedonsoto-zrb.com xn--elfogndedonsoto-zrb.com;
    return 301 https://www.xn--elfogndedonsoto-zrb.com$request_uri;
}

# Configuración HTTPS principal - WWW
server {
    listen 443 ssl http2;
    server_name www.xn--elfogndedonsoto-zrb.com;

    ssl_certificate /etc/letsencrypt/live/www.xn--elfogndedonsoto-zrb.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.xn--elfogndedonsoto-zrb.com/privkey.pem;
    
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
        
        # Handle OPTIONS
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '$http_origin' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE, PATCH' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,Expires' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' 1728000;
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

# Configuración para dominio sin www (redirige a www)
server {
    listen 443 ssl http2;
    server_name xn--elfogndedonsoto-zrb.com;
    
    ssl_certificate /etc/letsencrypt/live/www.xn--elfogndedonsoto-zrb.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.xn--elfogndedonsoto-zrb.com/privkey.pem;
    
    return 301 https://www.xn--elfogndedonsoto-zrb.com$request_uri;
}
EOF

# 5. Verificar configuración nginx
echo -e "\n${BLUE}5. Verificando configuración nginx...${NC}"
nginx -t

# 6. Iniciar nginx
echo -e "\n${BLUE}6. Iniciando nginx...${NC}"
systemctl start nginx

# 7. Reiniciar contenedor Docker
echo -e "\n${BLUE}7. Reiniciando aplicación...${NC}"
cd /opt/restaurant-web
if docker ps -a | grep -q restaurant-web-web-1; then
    docker restart restaurant-web-web-1
    echo "✅ Contenedor Docker reiniciado"
else
    echo "⚠️  Intentando iniciar contenedor..."
    if [ -f docker-compose.yml ]; then
        docker-compose up -d
    elif [ -f docker-compose.ec2.yml ]; then
        docker-compose -f docker-compose.ec2.yml up -d
    else
        # Intentar con docker run directamente
        docker run -d \
            --name restaurant-web-web-1 \
            -p 8000:8000 \
            -v /opt/restaurant-web/backend:/app \
            -v /opt/restaurant-web/data:/app/data \
            --env-file /opt/restaurant-web/backend/.env \
            --restart unless-stopped \
            restaurant-web-web
    fi
fi

# 8. Verificar estado
echo -e "\n${BLUE}8. Verificando estado...${NC}"
sleep 5

# Verificar servicios
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx está activo"
else
    echo "❌ Nginx no está activo"
fi

if docker ps | grep -q restaurant-web-web-1; then
    echo "✅ Contenedor Docker está ejecutándose"
else
    echo "❌ Contenedor Docker no está ejecutándose"
fi

# Verificar respuesta HTTP
echo -e "\n${BLUE}9. Verificando respuesta HTTP...${NC}"
if curl -s -o /dev/null -w "%{http_code}" https://$WWW_DOMAIN 2>/dev/null | grep -q "200\|301\|302"; then
    echo "✅ El sitio responde correctamente"
else
    echo "⚠️  El sitio puede tardar unos segundos en estar disponible"
fi

# Mostrar logs recientes
echo -e "\n${BLUE}10. Logs recientes:${NC}"
echo "Nginx:"
tail -n 5 /var/log/nginx/restaurant-error.log 2>/dev/null || echo "Sin errores recientes"
echo -e "\nDocker:"
docker logs --tail 5 restaurant-web-web-1 2>/dev/null || echo "No se pudieron obtener logs"

echo -e "\n${GREEN}✅ CONFIGURACIÓN DE EMERGENCIA COMPLETADA${NC}"
echo "========================================="
echo ""
echo "🌐 URL configurada: https://$WWW_DOMAIN"
echo ""
echo "📋 Estado:"
echo "- Certificado SSL: Configurado para www"
echo "- Nginx: Configurado para servir desde www"
echo "- Django: ALLOWED_HOSTS incluye www"
echo ""
echo "⚠️  IMPORTANTE:"
echo "Para volver a usar sin www, debes:"
echo "1. Crear registro A en Route 53 para $DOMAIN"
echo "2. Ejecutar: sudo ./deploy/build-deploy.sh"
echo ""
echo "🔍 Para diagnosticar: sudo ./deploy/diagnose-domain.sh"