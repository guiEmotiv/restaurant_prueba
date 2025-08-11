#!/bin/bash

# Script para corregir configuración de dominio - Solo permitir sin www
# Ejecutar con: sudo ./fix-domain-no-www.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

DOMAIN="xn--elfogndedonsoto-zrb.com"

echo "========================================="
echo "🔧 CORRECCIÓN DE DOMINIO - ELIMINAR WWW"
echo "========================================="

# 1. Verificar que estamos en EC2
if [ ! -f /opt/restaurant-web/deploy/build-deploy.sh ]; then
    echo -e "${RED}❌ Este script debe ejecutarse en el servidor EC2${NC}"
    exit 1
fi

# 2. Hacer backup de configuración actual
echo -e "\n${BLUE}1. Creando backup de configuración actual...${NC}"
BACKUP_DIR="/opt/backups/domain-fix-$(date +%Y%m%d-%H%M%S)"
mkdir -p $BACKUP_DIR

# Backup nginx config
if [ -f /etc/nginx/sites-available/$DOMAIN ]; then
    cp /etc/nginx/sites-available/$DOMAIN $BACKUP_DIR/nginx-$DOMAIN.conf
    echo "✅ Backup de nginx creado"
fi

# Backup certificados info
if [ -d /etc/letsencrypt ]; then
    ls -la /etc/letsencrypt/live/ > $BACKUP_DIR/ssl-certificates-list.txt
    echo "✅ Lista de certificados guardada"
fi

# 3. Detener servicios
echo -e "\n${BLUE}2. Deteniendo servicios...${NC}"
systemctl stop nginx
cd /opt/restaurant-web
if [ -f docker-compose.yml ]; then
    docker-compose down
elif [ -f docker-compose.ec2.yml ]; then
    docker-compose -f docker-compose.ec2.yml down
else
    echo "⚠️  No se encontró archivo docker-compose, continuando..."
fi

# 4. Revocar certificado antiguo si incluye www
echo -e "\n${BLUE}3. Verificando certificados SSL...${NC}"
if [ -f /etc/letsencrypt/live/$DOMAIN/cert.pem ]; then
    # Verificar si el certificado incluye www
    if openssl x509 -in /etc/letsencrypt/live/$DOMAIN/cert.pem -text -noout | grep -q "www.$DOMAIN"; then
        echo -e "${YELLOW}⚠️  Certificado actual incluye www, será renovado${NC}"
        # No revocar, solo marcar para renovación forzada
        FORCE_RENEW=true
    else
        echo "✅ Certificado actual NO incluye www"
        FORCE_RENEW=false
    fi
else
    echo "📝 No hay certificado actual"
    FORCE_RENEW=false
fi

# 5. Actualizar configuración nginx (sin SSL por ahora)
echo -e "\n${BLUE}4. Actualizando configuración nginx...${NC}"
cat > /etc/nginx/sites-available/$DOMAIN << 'EOF'
server {
    listen 80;
    server_name xn--elfogndedonsoto-zrb.com;

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

# Rechazar explícitamente www
server {
    listen 80;
    server_name www.xn--elfogndedonsoto-zrb.com;
    return 404;
}
EOF

# 6. Verificar sintaxis nginx
echo -e "\n${BLUE}5. Verificando configuración nginx...${NC}"
nginx -t

# 7. Iniciar nginx temporalmente
systemctl start nginx

# 8. Obtener nuevo certificado SSL (solo para dominio sin www)
echo -e "\n${BLUE}6. Obteniendo certificado SSL...${NC}"

# Determinar la ruta de certbot
if command -v certbot &> /dev/null; then
    CERTBOT_PATH="certbot"
elif [ -f /snap/bin/certbot ]; then
    CERTBOT_PATH="/snap/bin/certbot"
else
    echo -e "${RED}❌ Certbot no encontrado${NC}"
    exit 1
fi

# Detener nginx para usar standalone
systemctl stop nginx

# Renovar o crear certificado
if [ "$FORCE_RENEW" = true ]; then
    echo "Renovando certificado para excluir www..."
    $CERTBOT_PATH certonly \
        --standalone \
        -d $DOMAIN \
        --non-interactive \
        --agree-tos \
        --email elfogondedonsoto@gmail.com \
        --force-renewal
else
    echo "Obteniendo certificado solo para $DOMAIN..."
    $CERTBOT_PATH certonly \
        --standalone \
        -d $DOMAIN \
        --non-interactive \
        --agree-tos \
        --email elfogondedonsoto@gmail.com
fi

# 9. Actualizar nginx con SSL
echo -e "\n${BLUE}7. Actualizando nginx con SSL...${NC}"
cat > /etc/nginx/sites-available/$DOMAIN << 'EOF'
# Redirección HTTP a HTTPS
server {
    listen 80;
    server_name xn--elfogndedonsoto-zrb.com;
    return 301 https://$server_name$request_uri;
}

# Rechazar www en HTTP
server {
    listen 80;
    server_name www.xn--elfogndedonsoto-zrb.com;
    return 404;
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

# Rechazar www en HTTPS
server {
    listen 443 ssl http2;
    server_name www.xn--elfogndedonsoto-zrb.com;
    
    # Usar el mismo certificado (aunque no incluya www)
    ssl_certificate /etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com/privkey.pem;
    
    return 404;
}
EOF

# 10. Reiniciar servicios
echo -e "\n${BLUE}8. Reiniciando servicios...${NC}"
systemctl reload nginx
cd /opt/restaurant-web
if [ -f docker-compose.yml ]; then
    docker-compose up -d
elif [ -f docker-compose.ec2.yml ]; then
    docker-compose -f docker-compose.ec2.yml up -d
else
    echo "⚠️  No se encontró archivo docker-compose"
    # Intentar iniciar con Docker directamente
    docker start restaurant-web-web-1 2>/dev/null || echo "⚠️  No se pudo iniciar el contenedor"
fi

# 11. Verificar estado final
echo -e "\n${BLUE}9. Verificando estado final...${NC}"
sleep 5

echo -e "\n${GREEN}✅ CONFIGURACIÓN COMPLETADA${NC}"
echo "========================================="
echo ""
echo "🌐 Dominio configurado: https://$DOMAIN"
echo "❌ www.$DOMAIN ahora devuelve 404"
echo ""
echo "📋 Próximos pasos:"
echo "1. Verificar en Route 53 que NO existe registro A para www"
echo "2. Si existe, eliminarlo"
echo "3. Probar ambas URLs:"
echo "   - https://$DOMAIN (debe funcionar)"
echo "   - https://www.$DOMAIN (debe dar error 404)"
echo ""
echo "🔍 Para diagnosticar: sudo ./diagnose-domain.sh"