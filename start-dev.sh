#!/bin/bash
set -e  # Exit on any error

echo "🍽️ Restaurant Web - Local Development Environment"
echo "=================================================="
echo "✨ Enhanced Django Authentication with IPv6 Support"
echo "🔐 Session-based authentication for local development"
echo ""

# Get current directory and local IP
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_IP=${LOCAL_IP:-$(hostname -I | awk '{print $1}')}

echo "📍 Project: $(basename "$SCRIPT_DIR")"
echo "🌐 Local IP: ${LOCAL_IP}"
echo "🔧 Environment: Development"
echo ""

# Verificar dependencias
echo "🔍 Checking dependencies..."
command -v python3 >/dev/null 2>&1 || { echo "❌ Python3 is required but not installed"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ Node.js/npm is required but not installed"; exit 1; }
echo "✅ Dependencies found"

# Crear variables de entorno
if [ ! -f ".env" ]; then
    echo "📋 Creating .env file with local network configuration..."
    cp .env.example .env
    # Add local IP to .env if not present
    if ! grep -q "LOCAL_IP=" .env; then
        echo "LOCAL_IP=${LOCAL_IP}" >> .env
    fi

    # Add ALLOWED_HOSTS to .env if not present
    if ! grep -q "ALLOWED_HOSTS=" .env; then
        echo "ALLOWED_HOSTS=localhost,127.0.0.1,${LOCAL_IP}" >> .env
    fi
    echo "✅ .env created with LOCAL_IP=${LOCAL_IP} and ALLOWED_HOSTS=localhost,127.0.0.1,${LOCAL_IP}"
else
    echo "📋 .env file exists - checking configuration..."
    # Update LOCAL_IP in existing .env
    if grep -q "LOCAL_IP=" .env; then
        sed -i "s/LOCAL_IP=.*/LOCAL_IP=${LOCAL_IP}/" .env
    else
        echo "LOCAL_IP=${LOCAL_IP}" >> .env
    fi
    echo "✅ .env updated with LOCAL_IP=${LOCAL_IP}"

    # Update ALLOWED_HOSTS in existing .env
    if grep -q "ALLOWED_HOSTS=" .env; then
        sed -i "s/ALLOWED_HOSTS=.*/ALLOWED_HOSTS=localhost,127.0.0.1,${LOCAL_IP}/" .env
    else
        echo "ALLOWED_HOSTS=localhost,127.0.0.1,${LOCAL_IP}" >> .env
    fi
    echo "✅ .env updated with ALLOWED_HOSTS=localhost,127.0.0.1,${LOCAL_IP}"
fi

# Crear directorios necesarios
echo "📁 Creating required directories..."
mkdir -p backend/data/logs
mkdir -p backend/staticfiles

# Backend setup
echo ""
echo "🔧 Backend Setup (Django + Enhanced Auth)..."
cd backend/

# Crear virtual environment solo si no existe
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activar virtual environment e instalar dependencias básicas
echo "📦 Installing dependencies..."
source venv/bin/activate

# Install comprehensive package list for full functionality
echo "⚡ Installing Django ecosystem packages..."
pip install -q Django djangorestframework django-cors-headers python-dotenv \
             drf-spectacular openpyxl python-dateutil pytz requests || \
             { echo "⚠️ Some packages may be missing, but trying to continue..."; }

# Setup base de datos
echo "🗄️ Database setup..."
python manage.py migrate --run-syncdb

# Crear usuario admin básico
echo "👤 Creating users..."
python manage.py shell -c "
from django.contrib.auth.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@restaurant.com', 'admin123')
    print('✅ Admin user: admin/admin123')
else:
    print('✅ Admin user already exists: admin/admin123')
"

# Setup grupos (solo si no existen)
echo "👥 Setting up user groups and permissions..."
python manage.py setup_groups > /dev/null 2>&1 || echo "⚠️ Groups already exist or command unavailable"

# Crear usuarios del restaurante
echo "🏪 Creating restaurant users..."
python manage.py create_restaurant_users > /dev/null 2>&1 || echo "⚠️ Restaurant users already exist or command unavailable"

# Collect static files for admin
echo "📋 Collecting static files..."
python manage.py collectstatic --noinput > /dev/null 2>&1 || echo "⚠️ Static files collection skipped"

echo "✅ Backend ready with enhanced authentication logging"
cd ..

# Frontend setup
echo ""
echo "⚛️ Frontend Setup (React + Vite + IPv6)..."
cd frontend/

# Instalar dependencias solo si no existen
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install --silent
else
    echo "📦 Dependencies already installed"
fi

echo "✅ Frontend ready with IPv6 proxy configuration"
cd ..

# Pre-flight checks
echo ""
echo "🔍 Pre-flight checks..."

# Check if ports are available
if lsof -i:8000 > /dev/null 2>&1; then
    echo "⚠️  Port 8000 is in use - stopping existing Django server"
    pkill -f "python manage.py runserver" 2>/dev/null || true
    sleep 2
fi

# Find available frontend port
FRONTEND_PORT=5173
if lsof -i:5173 > /dev/null 2>&1; then
    echo "⚠️  Port 5173 is in use - stopping existing Vite server"
    pkill -f "npm run dev" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    sleep 2
fi

echo "✅ Ports cleared"

# Iniciar servidores
echo ""
echo "🚀 Starting Local Development Environment..."
echo "============================================"
echo "🌐 Network Access:"
echo "   Backend:    http://localhost:8000"
echo "   Backend:    http://${LOCAL_IP}:8000"
echo "   Frontend:   http://localhost:${FRONTEND_PORT}"
echo "   Frontend:   http://${LOCAL_IP}:${FRONTEND_PORT}"
echo "   Admin Panel: http://localhost:8000/admin"
echo ""
echo "👤 Available Users:"
echo "   admin/admin123         (Superuser)"
echo "   fernando/Theboss01@!   (Administrator)"
echo "   brayan/Mesero010@!     (Waiter)"
echo ""
echo "🔍 Debug Information:"
echo "   Auth logs: backend/data/logs/auth_debug.log"
echo "   Django logs: backend/data/logs/django_dev.log"
echo ""
echo "📱 Cross-device access available via ${LOCAL_IP}"
echo "⏹️  Press Ctrl+C to stop all servers"
echo ""

# Función de limpieza mejorada
cleanup() {
    echo ""
    echo "🛑 Stopping all development servers..."

    # Kill specific PIDs if they exist
    [ ! -z "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null
    [ ! -z "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null

    # Fallback kills
    pkill -f "python manage.py runserver" 2>/dev/null || true
    pkill -f "npm run dev" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true

    # Wait a moment for graceful shutdown
    sleep 1

    echo "✅ All servers stopped successfully"
    echo "🍽️ Restaurant development environment terminated"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM EXIT

# Detener procesos existentes por seguridad
echo "🔄 Final cleanup of existing processes..."
cleanup() {
    echo ""
    echo "🛑 Stopping all development servers..."

    # Kill specific PIDs if they exist
    [ ! -z "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null
    [ ! -z "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null

    # Fallback kills
    pkill -f "python manage.py runserver" 2>/dev/null || true
    pkill -f "npm run dev" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true

    # Wait a moment for graceful shutdown
    sleep 1

    echo "✅ All servers stopped successfully"
    echo "🍽️ Restaurant development environment terminated"
    exit 0
}
pkill -f "python manage.py runserver" 2>/dev/null || true
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 2

# Iniciar backend con logging mejorado
echo "🔧 Starting Django backend with enhanced auth logging..."
cd backend/
source venv/bin/activate

# Export environment variables for Django
export LOCAL_IP=${LOCAL_IP}
export DJANGO_SETTINGS_MODULE="backend.settings.development"

python manage.py runserver 0.0.0.0:8000 &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"
cd ..

# Wait a moment for backend to start
sleep 3

# Iniciar frontend con configuración IPv6
echo "⚛️ Starting React frontend with IPv6 support..."
cd frontend/

# Set environment variables for Vite
export LOCAL_IP=${LOCAL_IP}

# Use specific port with host binding for network access
npm run dev -- --port ${FRONTEND_PORT} --host &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"
cd ..

# Monitor startup
echo ""
echo "⏳ Waiting for servers to fully initialize..."
sleep 5

# Health check
echo "🏥 Performing health checks..."

# Test backend
if curl -s http://localhost:8000/api/v1/auth/status/ > /dev/null; then
    echo "✅ Backend health check passed"
else
    echo "⚠️  Backend health check failed - but server may still be starting"
fi

# Display final status
echo ""
echo "🎉 Development environment is ready!"
echo "🔗 Open http://localhost:${FRONTEND_PORT} in your browser"
echo "📱 Access from other devices: http://${LOCAL_IP}:${FRONTEND_PORT}"
echo ""
echo "🔄 Monitoring servers... (Ctrl+C to stop)"

# Monitor processes and keep script alive
while true; do
    # Check if processes are still running
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "❌ Backend process died unexpectedly"
        break
    fi

    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "❌ Frontend process died unexpectedly"
        break
    fi

    sleep 10
done

echo "⚠️  One or more servers stopped unexpectedly"
cleanup