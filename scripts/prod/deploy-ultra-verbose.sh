#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 RESTAURANT WEB - ULTRA DEPLOYMENT (VERBOSE)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

echo "🚀 RESTAURANT WEB - DEPLOY ULTRA (VERBOSE)"
echo "PROJECT: $(pwd)"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🧹 LIMPIEZA EXPRESS
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "🧹 Limpiando espacio..."
echo "   - Limpiando Docker..."
docker system prune -af || true
echo "   - Limpiando apt cache..."
sudo apt-get clean || true
echo "   - Limpiando archivos temp..."
sudo rm -rf /tmp/* /var/tmp/* || true
echo "   - Limpiando build anterior..."
rm -rf frontend/node_modules frontend/dist || true
echo "✅ Espacio liberado"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════════════
# 📦 INSTALACIÓN MÍNIMA
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "📦 Verificando herramientas..."

# Docker
if ! command -v docker >/dev/null 2>&1; then
    echo "   - Instalando Docker..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
    echo "   ✅ Docker instalado"
else
    echo "   ✅ Docker ya existe: $(docker --version)"
fi

# Docker Compose  
if ! command -v docker-compose >/dev/null 2>&1; then
    echo "   - Instalando Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "   ✅ Docker Compose instalado"
else
    echo "   ✅ Docker Compose ya existe: $(docker-compose --version)"
fi

# Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "   - Instalando Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo "   ✅ Node.js instalado: $(node --version)"
else
    echo "   ✅ Node.js ya existe: $(node --version)"
fi

# Nginx
if ! command -v nginx >/dev/null 2>&1; then
    echo "   - Instalando Nginx..."
    sudo apt-get update -y
    sudo apt-get install -y nginx
    echo "   ✅ Nginx instalado"
else
    echo "   ✅ Nginx ya existe"
fi

echo "✅ Herramientas verificadas"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🏗️ BUILD SÚPER LIGERO
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "🏗️  Build frontend (modo económico)..."

cd frontend

# Variables de entorno
echo "   - Configurando variables de entorno..."
export VITE_API_BASE_URL="https://www.xn--elfogndedonsoto-zrb.com/api/v1"
export VITE_AWS_REGION="us-west-2"
export VITE_AWS_COGNITO_USER_POOL_ID="us-west-2_bdCwF60ZI"
export VITE_AWS_COGNITO_APP_CLIENT_ID="4i9hrd7srgbqbtun09p43ncfn0"
export VITE_NODE_ENV="production"

# Verificar espacio antes del build
echo "   - Espacio disponible antes del build:"
df -h . | tail -1

# Instalar dependencias
echo "   - Instalando dependencias mínimas (esto puede tardar)..."
npm install --production=false --no-optional --no-audit --no-fund

echo "   - Espacio después de npm install:"
df -h . | tail -1

# Build
echo "   - Ejecutando build (512MB limit)..."
NODE_OPTIONS='--max-old-space-size=512' npm run build

if [ -f "dist/index.html" ]; then
    echo "✅ Frontend build completado"
    echo "   - Tamaño del build: $(du -sh dist | cut -f1)"
else
    echo "❌ Build falló - verificando..."
    ls -la
    exit 1
fi

cd ..
echo ""

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🗄️ BASE DE DATOS EXPRESS
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "🗄️  Configurando base de datos..."

echo "   - Creando directorios..."
mkdir -p data logs

echo "   - Building backend Docker image..."
docker-compose -f docker-compose.production.yml build restaurant-web-backend

echo "   - Ejecutando migraciones..."
docker-compose -f docker-compose.production.yml run --rm restaurant-web-backend python manage.py migrate

echo "   - Creando superuser..."
docker-compose -f docker-compose.production.yml run --rm \
    -e DJANGO_SUPERUSER_USERNAME=admin \
    -e DJANGO_SUPERUSER_EMAIL=admin@restaurant.com \
    -e DJANGO_SUPERUSER_PASSWORD=admin123 \
    restaurant-web-backend python manage.py shell -c "
from django.contrib.auth.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@restaurant.com', 'admin123')
    print('✅ Superuser creado')
else:
    print('ℹ️  Superuser ya existe')
"

echo "   - Recopilando archivos estáticos..."
docker-compose -f docker-compose.production.yml run --rm restaurant-web-backend python manage.py collectstatic --noinput

echo "✅ Base de datos configurada"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🌐 NGINX DIRECTO (HTTP)
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "🌐 Configurando Nginx..."

CURRENT_DIR=$(pwd)
echo "   - Directorio del proyecto: $CURRENT_DIR"

echo "   - Creando configuración de Nginx..."
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

echo "   - Activando configuración..."
sudo rm -f /etc/nginx/sites-enabled/default || true
sudo ln -sf /etc/nginx/sites-available/restaurant /etc/nginx/sites-enabled/

echo "   - Verificando configuración..."
if sudo nginx -t; then
    echo "   ✅ Configuración de Nginx válida"
    sudo systemctl reload nginx
    echo "   ✅ Nginx recargado"
else
    echo "   ❌ Error en configuración de Nginx"
    exit 1
fi

echo "✅ Nginx configurado"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🚀 INICIAR TODO
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "🚀 Iniciando servicios..."

echo "   - Deteniendo servicios anteriores..."
docker-compose -f docker-compose.production.yml down || true

echo "   - Iniciando backend..."
docker-compose -f docker-compose.production.yml up -d restaurant-web-backend

echo "   - Esperando 10 segundos para que arranque..."
sleep 10

# ═══════════════════════════════════════════════════════════════════════════════════════
# ✅ VERIFICACIÓN DETALLADA
# ═══════════════════════════════════════════════════════════════════════════════════════

echo ""
echo "🔍 Verificando servicios..."

# Estado de contenedores
echo "   - Estado de Docker containers:"
docker-compose -f docker-compose.production.yml ps

# Test backend
echo "   - Probando backend..."
if curl -s http://localhost:8000/api/v1/health/ >/dev/null 2>&1; then
    echo "   ✅ Backend responde correctamente"
    BACKEND_OK=true
else
    echo "   ❌ Backend no responde"
    echo "   📋 Logs del backend:"
    docker-compose -f docker-compose.production.yml logs --tail=10 restaurant-web-backend
    BACKEND_OK=false
fi

# Test nginx
echo "   - Probando Nginx..."
if curl -s http://localhost/ >/dev/null 2>&1; then
    echo "   ✅ Nginx responde correctamente"
    FRONTEND_OK=true
else
    echo "   ❌ Nginx no responde"
    echo "   📋 Estado de Nginx:"
    sudo systemctl status nginx --no-pager -l
    FRONTEND_OK=false
fi

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🎉 RESULTADO FINAL
# ═══════════════════════════════════════════════════════════════════════════════════════

echo ""
echo "🎉 DEPLOYMENT ULTRA COMPLETADO"
echo "=============================="

if [ "$BACKEND_OK" = true ] && [ "$FRONTEND_OK" = true ]; then
    echo "✅ TODO FUNCIONANDO PERFECTO"
    echo ""
    echo "🌐 Accede a tu aplicación:"
    echo "   http://$(curl -s https://ipinfo.io/ip 2>/dev/null || echo 'tu-ip')"
    echo "   http://www.xn--elfogndedonsoto-zrb.com"
    echo ""
    echo "🔐 Panel de administración:"
    echo "   /admin"
    echo "   Usuario: admin"
    echo "   Contraseña: admin123"
    echo ""
    echo "📊 Comandos útiles:"
    echo "   docker-compose -f docker-compose.production.yml logs -f"
    echo "   docker-compose -f docker-compose.production.yml ps"
    echo ""
    echo "🔒 Para agregar SSL después:"
    echo "   sudo apt install certbot python3-certbot-nginx"
    echo "   sudo certbot --nginx -d www.xn--elfogndedonsoto-zrb.com"
else
    echo "⚠️  DEPLOYMENT PARCIAL - Algunos servicios fallan"
    if [ "$BACKEND_OK" = false ]; then
        echo "❌ Backend: Revisar logs con 'docker-compose -f docker-compose.production.yml logs'"
    fi
    if [ "$FRONTEND_OK" = false ]; then
        echo "❌ Frontend/Nginx: Revisar con 'sudo systemctl status nginx'"
    fi
fi

echo ""
echo "📊 Espacio final utilizado: $(du -sh . 2>/dev/null | cut -f1)"
echo "✅ Deployment ultra completado!"