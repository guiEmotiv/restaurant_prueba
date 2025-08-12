#!/bin/bash
# 🚀 Deployment con rutas absolutas

# Configuración
EC2_HOST="44.248.47.186"
EC2_USER="ubuntu"
EC2_KEY="$HOME/Downloads/ubuntu_fds_key.pem"

echo "🚀 Deployment a Producción - Version Fixed"
echo "=========================================="

# Script remoto con rutas absolutas
REMOTE_SCRIPT='
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
cd /opt/restaurant-web

echo "📥 Actualizando código desde GitHub..."
/usr/bin/git fetch origin main
/usr/bin/git reset --hard origin/main

echo "🏗️ Construyendo frontend..."
cd frontend
/usr/bin/docker run --rm -v $(pwd):/app -w /app node:22-alpine sh -c "npm install && npm run build:prod"
cd ..

echo "🐳 Reiniciando servicios..."
/usr/bin/docker-compose -f docker-compose.prod.yml down
/usr/bin/docker-compose -f docker-compose.prod.yml up -d --build

echo "⏳ Esperando servicios..."
/bin/sleep 30

echo "✅ Verificando health..."
/usr/bin/curl -f -s http://localhost:8000/api/v1/health/ > /dev/null && echo "Backend: ✅ OK" || echo "Backend: ❌ Error"
/usr/bin/curl -f -s http://localhost/ > /dev/null && echo "Frontend: ✅ OK" || echo "Frontend: ❌ Error"

echo "🎉 Deployment completado!"
'

echo "📡 Conectando y ejecutando deployment..."
ssh -i "$EC2_KEY" "$EC2_USER@$EC2_HOST" "$REMOTE_SCRIPT"

echo ""
echo "✅ Proceso completado"
echo "🌐 Sitio: https://www.xn--elfogndedonsoto-zrb.com"
echo "⏰ Los cambios pueden tardar 1-2 minutos en reflejarse"