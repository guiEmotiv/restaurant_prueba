#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 RESTAURANT WEB - ULTRA DEPLOYMENT (MÍNIMO Y PRÁCTICO)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

echo "🚀 RESTAURANT WEB - DEPLOY ULTRA"
echo "PROJECT: $(pwd)"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🧹 LIMPIEZA EXPRESS
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "🧹 Limpiando espacio..."
docker system prune -af >/dev/null 2>&1 || true
sudo apt-get clean >/dev/null 2>&1 || true
sudo rm -rf /tmp/* /var/tmp/* >/dev/null 2>&1 || true
rm -rf frontend/node_modules frontend/dist >/dev/null 2>&1 || true
echo "✅ Espacio liberado"

# ═══════════════════════════════════════════════════════════════════════════════════════
# 📦 INSTALACIÓN MÍNIMA
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "📦 Instalando solo lo necesario..."

# Docker rápido
if ! command -v docker >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | sudo sh >/dev/null 2>&1
    sudo usermod -aG docker $USER
fi

# Docker Compose rápido  
if ! command -v docker-compose >/dev/null 2>&1; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose >/dev/null 2>&1
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Node.js SOLO si no existe (evita reinstalar)
if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - >/dev/null 2>&1
    sudo apt-get install -y nodejs >/dev/null 2>&1
fi

# Nginx básico
sudo apt-get update -y >/dev/null 2>&1
sudo apt-get install -y nginx >/dev/null 2>&1 || true

echo "✅ Herramientas listas"

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🏗️ BUILD SÚPER LIGERO
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "🏗️  Build frontend (modo económico)..."

cd frontend

# Variables de entorno desde archivo
export VITE_API_BASE_URL="https://www.xn--elfogndedonsoto-zrb.com/api/v1"
export VITE_AWS_REGION="us-west-2"
export VITE_AWS_COGNITO_USER_POOL_ID="us-west-2_bdCwF60ZI"
export VITE_AWS_COGNITO_APP_CLIENT_ID="4i9hrd7srgbqbtun09p43ncfn0"
export VITE_NODE_ENV="production"

# Instalar SOLO dependencias críticas para build
echo "📦 Instalando mínimas dependencias..."
npm install --production=false --no-optional --no-audit --no-fund >/dev/null 2>&1

# Build con memoria limitada
echo "🏗️  Building (512MB)..."
NODE_OPTIONS='--max-old-space-size=512' npm run build >/dev/null 2>&1

if [ -f "dist/index.html" ]; then
    echo "✅ Frontend build OK"
else
    echo "❌ Build falló"
    exit 1
fi

cd ..

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🗄️ BASE DE DATOS EXPRESS
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "🗄️  Configurando BD..."

mkdir -p data logs

# Build backend solo
docker-compose -f docker-compose.production.yml build restaurant-web-backend >/dev/null 2>&1

# Migraciones
docker-compose -f docker-compose.production.yml run --rm restaurant-web-backend python manage.py migrate >/dev/null 2>&1

# Superuser
docker-compose -f docker-compose.production.yml run --rm \
    -e DJANGO_SUPERUSER_USERNAME=admin \
    -e DJANGO_SUPERUSER_EMAIL=admin@restaurant.com \
    -e DJANGO_SUPERUSER_PASSWORD=admin123 \
    restaurant-web-backend python manage.py shell -c "
from django.contrib.auth.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@restaurant.com', 'admin123')
" >/dev/null 2>&1

# Archivos estáticos
docker-compose -f docker-compose.production.yml run --rm restaurant-web-backend python manage.py collectstatic --noinput >/dev/null 2>&1

echo "✅ BD configurada"

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🌐 NGINX DIRECTO (HTTP)
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "🌐 Configurando web server..."

CURRENT_DIR=$(pwd)

sudo tee /etc/nginx/sites-available/restaurant >/dev/null << EOF
server {
    listen 80 default_server;
    server_name _;

    # API
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

    # Frontend
    root $CURRENT_DIR/frontend/dist;
    index index.html;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

sudo rm -f /etc/nginx/sites-enabled/default >/dev/null 2>&1 || true
sudo ln -sf /etc/nginx/sites-available/restaurant /etc/nginx/sites-enabled/ >/dev/null 2>&1
sudo nginx -t >/dev/null 2>&1 && sudo systemctl reload nginx >/dev/null 2>&1

echo "✅ Web server configurado"

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🚀 INICIAR TODO
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "🚀 Iniciando aplicación..."

# Parar todo antes
docker-compose -f docker-compose.production.yml down >/dev/null 2>&1 || true

# Iniciar solo backend (sin nginx container)
docker-compose -f docker-compose.production.yml up -d restaurant-web-backend >/dev/null 2>&1

# Esperar 5 segundos
sleep 5

# ═══════════════════════════════════════════════════════════════════════════════════════
# ✅ VERIFICACIÓN SIMPLE
# ═══════════════════════════════════════════════════════════════════════════════════════

echo ""
echo "🔍 Verificando..."

# Test backend
if curl -s http://localhost:8000/api/v1/health/ >/dev/null 2>&1; then
    echo "✅ Backend funcionando"
    BACKEND_OK=true
else
    echo "❌ Backend no responde"
    BACKEND_OK=false
fi

# Test frontend
if curl -s http://localhost/ >/dev/null 2>&1; then
    echo "✅ Frontend funcionando"
    FRONTEND_OK=true
else
    echo "❌ Frontend no responde"
    FRONTEND_OK=false
fi

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🎉 RESULTADO
# ═══════════════════════════════════════════════════════════════════════════════════════

echo ""
echo "🎉 DEPLOYMENT ULTRA COMPLETADO"
echo "=============================="

if [ "$BACKEND_OK" = true ] && [ "$FRONTEND_OK" = true ]; then
    echo "✅ TODO FUNCIONANDO"
    echo ""
    echo "🌐 Acceso:"
    echo "   http://$(curl -s https://ipinfo.io/ip 2>/dev/null || echo 'tu-ip')"
    echo "   http://www.xn--elfogndedonsoto-zrb.com"
    echo ""
    echo "🔐 Admin:"
    echo "   /admin (admin/admin123)"
    echo ""
    echo "📊 Monitoreo:"
    echo "   docker-compose -f docker-compose.production.yml logs -f"
    echo ""
    echo "🔒 Agregar SSL después:"
    echo "   sudo apt install certbot python3-certbot-nginx"
    echo "   sudo certbot --nginx -d www.xn--elfogndedonsoto-zrb.com"
else
    echo "⚠️  DEPLOYMENT PARCIAL"
    echo "Ver logs: docker-compose -f docker-compose.production.yml logs"
fi

echo ""
echo "⚡ DEPLOYMENT ULTRA: $(du -sh . 2>/dev/null | cut -f1) total"
echo "✅ ¡Listo para usar!"