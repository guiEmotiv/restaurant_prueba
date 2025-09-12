#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 RESTAURANT WEB - SIMPLE PRODUCTION DEPLOYMENT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOMAIN="www.xn--elfogndedonsoto-zrb.com"

echo "🚀 RESTAURANT WEB - DEPLOYMENT SIMPLE"
echo "====================================="
echo "📁 Directorio: $PROJECT_DIR"
echo "🌐 Dominio: $DOMAIN"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🧹 PASO 1: LIMPIEZA RÁPIDA
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "🧹 PASO 1: Limpieza rápida del sistema"
echo "======================================"

# Limpiar Docker para liberar espacio
echo "🐳 Limpiando Docker..."
docker system prune -af || true

# Limpiar cache de paquetes
echo "📦 Limpiando cache..."
sudo apt-get clean || true
sudo apt-get autoremove -y || true

# Limpiar archivos temporales
echo "🗑️  Limpiando temporales..."
sudo rm -rf /tmp/* || true
rm -rf ~/.cache/* || true

echo "✅ Limpieza completada"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════════════
# 📦 PASO 2: INSTALACIÓN MÍNIMA NECESARIA
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "📦 PASO 2: Instalando dependencias esenciales"
echo "============================================="

# Actualizar sistema
echo "🔄 Actualizando Ubuntu..."
sudo apt-get update -y

# Instalar solo lo esencial
echo "🛠️  Instalando herramientas básicas..."
sudo apt-get install -y curl wget git build-essential

# Docker (si no existe)
if ! command -v docker &> /dev/null; then
    echo "🐳 Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
else
    echo "✅ Docker ya instalado"
fi

# Docker Compose (si no existe)
if ! command -v docker-compose &> /dev/null; then
    echo "🔧 Instalando Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
else
    echo "✅ Docker Compose ya instalado"
fi

# Node.js (solo si se necesita para builds)
if ! command -v node &> /dev/null; then
    echo "📱 Instalando Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js ya instalado: $(node --version)"
fi

echo "✅ Dependencias instaladas"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🏗️ PASO 3: BUILD OPTIMIZADO
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "🏗️  PASO 3: Build de la aplicación"
echo "=================================="

cd "$PROJECT_DIR"

# Crear directorios necesarios
echo "📁 Creando directorios..."
mkdir -p data logs
sudo chown -R $USER:$USER data logs

# Build del frontend (más ligero)
echo "⚛️  Building frontend..."
cd frontend

# Limpiar instalación anterior
rm -rf node_modules dist .vite

# Instalar solo dependencias de producción
echo "📦 Instalando dependencias mínimas..."
npm ci --only=production --no-audit --no-fund

# Build optimizado
echo "🏗️  Creando build optimizado..."
export $(grep -v '^#' ../.env.production | grep '^VITE_' | xargs)
NODE_OPTIONS='--max-old-space-size=1024' npm run build:prod

# Verificar build
if [ ! -f "dist/index.html" ]; then
    echo "❌ Error: Build del frontend falló"
    exit 1
fi

echo "✅ Frontend build completado"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🗄️ PASO 4: BASE DE DATOS SIMPLE
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "🗄️  PASO 4: Configurando base de datos"
echo "====================================="

cd "$PROJECT_DIR"

# Build solo del backend
echo "🏗️  Building backend..."
docker-compose -f docker-compose.production.yml build restaurant-web-backend

# Migraciones
echo "🚀 Ejecutando migraciones..."
docker-compose -f docker-compose.production.yml run --rm restaurant-web-backend python manage.py migrate

# Crear superuser
echo "👤 Creando superuser..."
docker-compose -f docker-compose.production.yml run --rm \
    -e DJANGO_SUPERUSER_USERNAME=admin \
    -e DJANGO_SUPERUSER_EMAIL=admin@restaurant.com \
    -e DJANGO_SUPERUSER_PASSWORD=admin123 \
    restaurant-web-backend python manage.py shell -c "
from django.contrib.auth.models import User
import os
username = os.getenv('DJANGO_SUPERUSER_USERNAME', 'admin')
email = os.getenv('DJANGO_SUPERUSER_EMAIL', 'admin@restaurant.com')  
password = os.getenv('DJANGO_SUPERUSER_PASSWORD', 'admin123')
if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username, email, password)
    print('✅ Superuser creado')
else:
    print('ℹ️  Superuser ya existe')
"

# Archivos estáticos
echo "📦 Recopilando archivos estáticos..."
docker-compose -f docker-compose.production.yml run --rm restaurant-web-backend python manage.py collectstatic --noinput

echo "✅ Base de datos configurada"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🌐 PASO 5: NGINX SIMPLE (Sin SSL por ahora)
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "🌐 PASO 5: Configurando Nginx básico"
echo "==================================="

# Instalar Nginx si no existe
if ! command -v nginx &> /dev/null; then
    echo "📦 Instalando Nginx..."
    sudo apt-get install -y nginx
    sudo systemctl enable nginx
fi

# Configuración básica HTTP (sin SSL por ahora)
echo "🔧 Configurando Nginx para HTTP..."
sudo tee /etc/nginx/sites-available/restaurant-http > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN xn--elfogndedonsoto-zrb.com;

    # Backend API
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
    root $PROJECT_DIR/frontend/dist;
    index index.html;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

# Activar configuración
sudo rm -f /etc/nginx/sites-enabled/default
sudo rm -f /etc/nginx/sites-enabled/restaurant-http
sudo ln -sf /etc/nginx/sites-available/restaurant-http /etc/nginx/sites-enabled/

# Verificar y recargar
sudo nginx -t && sudo systemctl reload nginx

echo "✅ Nginx configurado para HTTP"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════════════
# 🚀 PASO 6: INICIAR SERVICIOS
# ═══════════════════════════════════════════════════════════════════════════════════════

echo "🚀 PASO 6: Iniciando servicios"
echo "=============================="

cd "$PROJECT_DIR"

# Detener servicios anteriores
echo "🛑 Deteniendo servicios anteriores..."
docker-compose -f docker-compose.production.yml down || true

# Iniciar servicios
echo "🚀 Iniciando aplicación..."
docker-compose -f docker-compose.production.yml up -d restaurant-web-backend

# Esperar y verificar
sleep 10

# Verificar backend
if curl -f -s "http://localhost:8000/api/v1/health/" > /dev/null 2>&1; then
    echo "✅ Backend funcionando"
else
    echo "❌ Backend no responde"
    docker-compose -f docker-compose.production.yml logs restaurant-web-backend
fi

# Verificar Nginx
sudo systemctl restart nginx
if curl -f -s "http://localhost/" > /dev/null 2>&1; then
    echo "✅ Nginx funcionando"
else
    echo "❌ Nginx no responde"
fi

echo ""
echo "🎉 DEPLOYMENT COMPLETADO"
echo "======================="
echo "🌐 Tu aplicación está disponible en:"
echo "   http://$DOMAIN"
echo "   http://$(curl -s https://ipinfo.io/ip)"
echo ""
echo "🔐 Admin Django:"
echo "   http://$DOMAIN/admin"
echo "   Usuario: admin"
echo "   Contraseña: admin123"
echo ""
echo "📊 Monitoreo:"
echo "   docker-compose -f docker-compose.production.yml logs -f"
echo "   docker-compose -f docker-compose.production.yml ps"
echo ""
echo "⚠️  SIGUIENTE PASO: Configurar SSL con:"
echo "   sudo apt-get install certbot python3-certbot-nginx"
echo "   sudo certbot --nginx -d $DOMAIN -d xn--elfogndedonsoto-zrb.com"
echo ""
echo "✅ ¡Tu primera aplicación está funcionando!"