#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 RESTAURANT WEB - ULTRA DEPLOYMENT CON SSL
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

DOMAIN="www.xn--elfogndedonsoto-zrb.com"
ALT_DOMAIN="xn--elfogndedonsoto-zrb.com"
EMAIL="admin@restaurant.com"

echo "🚀 RESTAURANT WEB - DEPLOY ULTRA + SSL"
echo "======================================"
echo "📁 Proyecto: $(pwd)"
echo "🌐 Dominio: $DOMAIN"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🧹 LIMPIEZA RÁPIDA
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "🧹 PASO 1: Limpieza rápida"
echo "========================="
docker system prune -af || true
sudo apt-get clean || true
rm -rf frontend/node_modules frontend/dist || true
echo "✅ Espacio liberado"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════════════
# 📦 INSTALACIÓN EXPRESS
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "📦 PASO 2: Instalación express"
echo "=============================="

# Docker
if ! command -v docker >/dev/null 2>&1; then
    echo "   🐳 Instalando Docker..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
fi

# Docker Compose
if ! command -v docker-compose >/dev/null 2>&1; then
    echo "   🔧 Instalando Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Node.js 18
if ! command -v node >/dev/null 2>&1; then
    echo "   📱 Instalando Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Nginx + Certbot
echo "   🌐 Instalando Nginx y Certbot..."
sudo apt-get update -y
sudo apt-get install -y nginx certbot python3-certbot-nginx

echo "✅ Herramientas listas: Docker, Node $(node --version), Nginx, Certbot"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🏗️ BUILD OPTIMIZADO
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "🏗️  PASO 3: Build optimizado del frontend"
echo "========================================"

cd frontend

# Variables de producción
export VITE_API_BASE_URL="https://$DOMAIN/api/v1"
export VITE_AWS_REGION="us-west-2"
export VITE_AWS_COGNITO_USER_POOL_ID="us-west-2_bdCwF60ZI"
export VITE_AWS_COGNITO_APP_CLIENT_ID="4i9hrd7srgbqbtun09p43ncfn0"
export VITE_NODE_ENV="production"

echo "   📦 Instalando dependencias..."
npm ci --only=production --no-audit --no-fund

echo "   🏗️  Building con 512MB..."
NODE_OPTIONS='--max-old-space-size=512' npm run build

if [ ! -f "dist/index.html" ]; then
    echo "❌ Error: Build falló"
    exit 1
fi

echo "✅ Frontend build: $(du -sh dist | cut -f1)"
cd ..
echo ""

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🗄️ BASE DE DATOS
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "🗄️  PASO 4: Configuración de base de datos"
echo "========================================"

mkdir -p data logs

echo "   🏗️  Building backend..."
docker-compose -f docker-compose.production.yml build restaurant-web-backend

echo "   🚀 Migraciones..."
docker-compose -f docker-compose.production.yml run --rm restaurant-web-backend python manage.py migrate

echo "   👤 Creando admin..."
docker-compose -f docker-compose.production.yml run --rm \
    -e DJANGO_SUPERUSER_USERNAME=admin \
    -e DJANGO_SUPERUSER_EMAIL=admin@restaurant.com \
    -e DJANGO_SUPERUSER_PASSWORD=admin123 \
    restaurant-web-backend python manage.py shell -c "
from django.contrib.auth.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@restaurant.com', 'admin123')
"

echo "   📦 Archivos estáticos..."
docker-compose -f docker-compose.production.yml run --rm restaurant-web-backend python manage.py collectstatic --noinput

echo "✅ Base de datos configurada"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🌐 NGINX TEMPORAL (PARA SSL)
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "🌐 PASO 5: Configuración temporal de Nginx"
echo "========================================"

CURRENT_DIR=$(pwd)

# Configuración temporal para validación SSL
sudo tee /etc/nginx/sites-available/restaurant-temp >/dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN $ALT_DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 200 'Configurando SSL para $DOMAIN';
        add_header Content-Type text/plain;
    }
}
EOF

sudo mkdir -p /var/www/certbot
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/restaurant-temp /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

echo "✅ Nginx temporal configurado"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🔒 SSL CON LET'S ENCRYPT
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "🔒 PASO 6: Configuración SSL automática"
echo "====================================="

# Verificar DNS
CURRENT_IP=$(curl -s https://ipinfo.io/ip)
DOMAIN_IP=$(dig +short $DOMAIN | tail -n1)

echo "   🌐 IP del servidor: $CURRENT_IP"
echo "   🌐 IP del dominio $DOMAIN: $DOMAIN_IP"

if [ "$DOMAIN_IP" != "$CURRENT_IP" ]; then
    echo "   ⚠️  ADVERTENCIA: DNS no apunta a este servidor"
    echo "   📋 Configura tu DNS:"
    echo "      A    $ALT_DOMAIN        $CURRENT_IP"
    echo "      A    $DOMAIN    $CURRENT_IP"
    echo ""
    read -p "¿Continuar de todos modos? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Abortando deployment"
        exit 1
    fi
fi

# Obtener certificados SSL
echo "   🔐 Obteniendo certificados SSL..."
if sudo certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --domains $DOMAIN,$ALT_DOMAIN \
    --non-interactive; then
    echo "✅ Certificados SSL obtenidos"
else
    echo "❌ Error obteniendo SSL - continuando con HTTP"
    SSL_ENABLED=false
fi

SSL_ENABLED=true
echo ""

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🌐 NGINX PRODUCCIÓN (CON SSL)
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "🌐 PASO 7: Nginx de producción con SSL"
echo "===================================="

if [ "$SSL_ENABLED" = true ]; then
    # Configuración con HTTPS
    sudo tee /etc/nginx/sites-available/restaurant-ssl >/dev/null << EOF
# HTTP redirect to HTTPS
server {
    listen 80;
    server_name $DOMAIN $ALT_DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name $DOMAIN $ALT_DOMAIN;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/$ALT_DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$ALT_DOMAIN/privkey.pem;
    
    # SSL config
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;

    # API routes
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    location /static/ { proxy_pass http://127.0.0.1:8000; }
    location /media/ { proxy_pass http://127.0.0.1:8000; }

    # Frontend
    root $CURRENT_DIR/frontend/dist;
    index index.html;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

    sudo rm -f /etc/nginx/sites-enabled/restaurant-temp
    sudo ln -sf /etc/nginx/sites-available/restaurant-ssl /etc/nginx/sites-enabled/
    
    echo "✅ Nginx configurado con HTTPS"
else
    # Configuración solo HTTP
    sudo tee /etc/nginx/sites-available/restaurant-http >/dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN $ALT_DOMAIN;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
    
    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
    }
    
    location /static/ { proxy_pass http://127.0.0.1:8000; }
    location /media/ { proxy_pass http://127.0.0.1:8000; }

    root $CURRENT_DIR/frontend/dist;
    index index.html;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

    sudo rm -f /etc/nginx/sites-enabled/restaurant-temp
    sudo ln -sf /etc/nginx/sites-available/restaurant-http /etc/nginx/sites-enabled/
    
    echo "✅ Nginx configurado con HTTP"
fi

sudo nginx -t && sudo systemctl reload nginx
echo ""

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🚀 INICIAR SERVICIOS
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "🚀 PASO 8: Iniciando servicios de producción"
echo "=========================================="

docker-compose -f docker-compose.production.yml down || true
docker-compose -f docker-compose.production.yml up -d restaurant-web-backend

echo "   ⏳ Esperando servicios (15 segundos)..."
sleep 15

# ═══════════════════════════════════════════════════════════════════════════════════════
# ✅ VERIFICACIÓN COMPLETA
# ═══════════════════════════════════════════════════════════════════════════════════════

echo ""
echo "✅ VERIFICACIÓN FINAL"
echo "===================="

# Backend
if curl -s http://localhost:8000/api/v1/health/ >/dev/null 2>&1; then
    echo "✅ Backend funcionando"
    BACKEND_OK=true
else
    echo "❌ Backend falla"
    BACKEND_OK=false
fi

# Frontend HTTP
if curl -s http://localhost/ >/dev/null 2>&1; then
    echo "✅ Frontend HTTP funcionando"
    HTTP_OK=true
else
    echo "❌ Frontend HTTP falla"
    HTTP_OK=false
fi

# Frontend HTTPS (si SSL habilitado)
if [ "$SSL_ENABLED" = true ]; then
    if curl -k -s https://localhost/ >/dev/null 2>&1; then
        echo "✅ Frontend HTTPS funcionando"
        HTTPS_OK=true
    else
        echo "❌ Frontend HTTPS falla"
        HTTPS_OK=false
    fi
fi

echo ""
echo "🎉 DEPLOYMENT ULTRA + SSL COMPLETADO"
echo "===================================="

if [ "$BACKEND_OK" = true ] && [ "$HTTP_OK" = true ]; then
    echo "🎯 ¡ÉXITO TOTAL!"
    echo ""
    echo "🌐 ACCESO A TU APLICACIÓN:"
    if [ "$SSL_ENABLED" = true ] && [ "$HTTPS_OK" = true ]; then
        echo "   ✅ https://$DOMAIN (SEGURO)"
        echo "   ✅ https://$ALT_DOMAIN (SEGURO)"
    else
        echo "   ✅ http://$DOMAIN"
        echo "   ✅ http://$ALT_DOMAIN"
    fi
    echo ""
    echo "🔐 ADMINISTRACIÓN:"
    echo "   URL: $([ "$SSL_ENABLED" = true ] && echo "https" || echo "http")://$DOMAIN/admin"
    echo "   Usuario: admin"
    echo "   Contraseña: admin123"
    echo ""
    echo "📊 MONITOREO:"
    echo "   docker-compose -f docker-compose.production.yml logs -f"
    echo "   docker-compose -f docker-compose.production.yml ps"
    echo ""
    if [ "$SSL_ENABLED" = true ]; then
        # Configurar renovación automática
        (sudo crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet && /usr/bin/systemctl reload nginx") | sudo crontab -
        echo "🔄 Renovación SSL automática configurada"
    fi
    echo ""
    echo "🎊 ¡Tu aplicación Restaurant Web está FUNCIONANDO!"
else
    echo "⚠️  DEPLOYMENT PARCIAL"
    echo "Ver logs: docker-compose -f docker-compose.production.yml logs"
fi

echo ""
echo "📊 Espacio total usado: $(du -sh . 2>/dev/null | cut -f1)"
echo "✅ ¡Listo para usar!"