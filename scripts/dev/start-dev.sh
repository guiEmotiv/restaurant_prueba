#!/bin/bash

# DEV ENVIRONMENT START SCRIPT
# Inicia el ambiente de desarrollo local sin afectar producción

set -e

echo "🛠️  INICIANDO AMBIENTE DE DESARROLLO"
echo "====================================="

# Configuración local
LOCAL_DIR="/Users/guillermosotozuniga/restaurant-web"
DEV_PORT_FRONTEND=5173
DEV_PORT_BACKEND=8000

cd "${LOCAL_DIR}"

echo "🔍 Verificando ambiente de desarrollo..."

# Verificar estructura
if [ ! -f "backend/manage.py" ]; then
    echo "❌ Backend Django no encontrado"
    exit 1
fi

if [ ! -f "frontend/package.json" ]; then
    echo "❌ Frontend React no encontrado" 
    exit 1
fi

echo "✅ Estructura de proyecto validada"

# Configurar ambiente Python para backend
echo "🐍 Configurando backend Django..."
cd backend

if [ ! -d "venv" ]; then
    echo "📦 Creando entorno virtual Python..."
    python3 -m venv venv
fi

echo "📦 Activando entorno virtual..."
source venv/bin/activate

echo "📦 Instalando dependencias Python..."
pip install -r requirements.txt

echo "🗄️  Ejecutando migraciones de desarrollo..."
python manage.py migrate

echo "👤 Creando superusuario si no existe..."
echo "from django.contrib.auth.models import User; User.objects.filter(username='admin').exists() or User.objects.create_superuser('admin', 'admin@restaurant.com', 'admin123')" | python manage.py shell

# Configurar ambiente Node.js para frontend
echo ""
echo "⚛️  Configurando frontend React..."
cd ../frontend

if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias Node.js..."
    npm install
fi

echo "✅ Ambiente de desarrollo configurado"
echo ""
echo "🚀 INICIANDO SERVICIOS DE DESARROLLO"
echo "===================================="
echo ""
echo "Backend Django: http://localhost:${DEV_PORT_BACKEND}"
echo "Frontend React: http://localhost:${DEV_PORT_FRONTEND}"
echo ""
echo "Para detener: Ctrl+C en ambas terminales"
echo ""

# Iniciar servicios en background
echo "🚀 Iniciando backend Django..."
cd ../backend
source venv/bin/activate
python manage.py runserver ${DEV_PORT_BACKEND} &
BACKEND_PID=$!

echo "🚀 Iniciando frontend React..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

# Función de limpieza
cleanup() {
    echo ""
    echo "🛑 Deteniendo servicios de desarrollo..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    echo "✅ Servicios detenidos"
    exit 0
}

# Capturar Ctrl+C
trap cleanup INT

echo "✅ Servicios iniciados:"
echo "   Backend PID: $BACKEND_PID"
echo "   Frontend PID: $FRONTEND_PID"
echo ""
echo "Presiona Ctrl+C para detener todos los servicios"

# Esperar
wait