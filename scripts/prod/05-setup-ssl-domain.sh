#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔒 SSL CERTIFICATE & DOMAIN CONFIGURATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOMAIN="xn--elfogndedonsoto-zrb.com"
WWW_DOMAIN="www.xn--elfogndedonsoto-zrb.com"
EMAIL="admin@restaurant.com"

echo "🔒 CONFIGURANDO SSL Y DOMINIO"
echo "============================="

cd "${PROJECT_DIR}"

# Verificar que el dominio apunta a esta IP
echo "🌐 Verificando configuración DNS..."
CURRENT_IP=$(curl -s https://ipinfo.io/ip)
DOMAIN_IP=$(dig +short $DOMAIN | tail -n1)
WWW_DOMAIN_IP=$(dig +short $WWW_DOMAIN | tail -n1)

echo "📍 IP actual del servidor: $CURRENT_IP"
echo "🔍 IP del dominio $DOMAIN: $DOMAIN_IP"
echo "🔍 IP del dominio $WWW_DOMAIN: $WWW_DOMAIN_IP"

if [[ "$DOMAIN_IP" != "$CURRENT_IP" ]] && [[ "$WWW_DOMAIN_IP" != "$CURRENT_IP" ]]; then
    echo "⚠️  Advertencia: El dominio no apunta a esta IP"
    echo "🛠️  Verifica la configuración DNS antes de continuar"
    echo "📋 Configuración DNS requerida:"
    echo "   A    $DOMAIN        $CURRENT_IP"
    echo "   A    $WWW_DOMAIN    $CURRENT_IP"
    echo ""
    read -p "¿Continuar de todos modos? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Crear configuración temporal de Nginx para validación HTTP
echo "🌐 Configurando Nginx temporal para validación..."
sudo tee /etc/nginx/sites-available/restaurant-temp > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN $WWW_DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 200 'Domain validation server for $DOMAIN';
        add_header Content-Type text/plain;
    }
}
EOF

# Activar configuración temporal
sudo rm -f /etc/nginx/sites-enabled/default
sudo rm -f /etc/nginx/sites-enabled/restaurant-temp
sudo ln -sf /etc/nginx/sites-available/restaurant-temp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

echo "✅ Configuración temporal de Nginx activa"

# Crear directorio para certbot
sudo mkdir -p /var/www/certbot
sudo chown -R www-data:www-data /var/www/certbot

# Obtener certificados SSL con Let's Encrypt
echo "🔐 Obteniendo certificados SSL con Let's Encrypt..."

# Verificar que certbot está instalado
if ! command -v certbot &> /dev/null; then
    echo "❌ Error: certbot no está instalado"
    exit 1
fi

# Obtener certificado (modo no interactivo)
echo "📋 Solicitando certificado para: $DOMAIN y $WWW_DOMAIN"
sudo certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --domains $DOMAIN,$WWW_DOMAIN \
    --non-interactive

# Verificar que los certificados se crearon
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "❌ Error: No se pudieron obtener los certificados SSL"
    echo "🔍 Verificando logs de certbot..."
    sudo tail -20 /var/log/letsencrypt/letsencrypt.log
    exit 1
fi

echo "✅ Certificados SSL obtenidos correctamente"

# Crear configuración Nginx de producción con SSL
echo "🔧 Configurando Nginx con SSL..."
sudo tee /etc/nginx/sites-available/restaurant-ssl > /dev/null << EOF
# HTTP server (redirects to HTTPS)
server {
    listen 80;
    server_name xn--elfogndedonsoto-zrb.com www.xn--elfogndedonsoto-zrb.com;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server configuration
server {
    listen 443 ssl http2;
    server_name xn--elfogndedonsoto-zrb.com www.xn--elfogndedonsoto-zrb.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com/privkey.pem;
    
    # SSL config
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # Backend health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # API routes - proxy to Django backend
    location /api/ { 
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
    }
    
    location /admin/ { 
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /static/ { 
        proxy_pass http://127.0.0.1:8000; 
    }
    
    location /media/ { 
        proxy_pass http://127.0.0.1:8000; 
    }

    # Frontend - serve React build files
    root $PROJECT_DIR/frontend/dist;
    index index.html;
    
    # Serve static files with caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }
    
    # Handle React Router - serve index.html for all non-API routes
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# Activar configuración SSL
sudo rm -f /etc/nginx/sites-enabled/restaurant-temp
sudo rm -f /etc/nginx/sites-enabled/restaurant-ssl
sudo ln -sf /etc/nginx/sites-available/restaurant-ssl /etc/nginx/sites-enabled/

# Verificar configuración de Nginx
echo "🧪 Verificando configuración de Nginx..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuración de Nginx válida"
    sudo systemctl reload nginx
else
    echo "❌ Error en la configuración de Nginx"
    exit 1
fi

# Configurar renovación automática de certificados
echo "🔄 Configurando renovación automática de certificados..."
sudo crontab -l 2>/dev/null | grep -v certbot > /tmp/crontab_temp || true
echo "0 12 * * * /usr/bin/certbot renew --quiet && /usr/bin/systemctl reload nginx" >> /tmp/crontab_temp
sudo crontab /tmp/crontab_temp
rm /tmp/crontab_temp

echo "✅ Renovación automática configurada (todos los días a las 12:00)"

# Verificar estado de los certificados
echo ""
echo "🔍 ESTADO DE LOS CERTIFICADOS"
echo "============================"
sudo certbot certificates

# Probar renovación (dry-run)
echo ""
echo "🧪 Probando proceso de renovación..."
sudo certbot renew --dry-run

echo ""
echo "🌐 VERIFICANDO ACCESO HTTPS"
echo "=========================="

# Esperar un momento para que Nginx se reinicie
sleep 5

# Probar acceso HTTPS
if curl -k -s https://$WWW_DOMAIN/health > /dev/null 2>&1; then
    echo "✅ HTTPS funcionando correctamente en $WWW_DOMAIN"
else
    echo "⚠️  Verificar acceso HTTPS manualmente"
fi

echo ""
echo "✅ SSL Y DOMINIO CONFIGURADOS"
echo "============================="
echo "🔒 Certificados SSL: Activos"
echo "🌐 Dominio principal: https://$WWW_DOMAIN"
echo "🌐 Dominio alternativo: https://$DOMAIN"
echo "🔄 Renovación automática: Configurada"
echo ""
echo "🌍 Tu sitio web está disponible en:"
echo "   https://$WWW_DOMAIN"
echo "   https://$DOMAIN"
echo ""