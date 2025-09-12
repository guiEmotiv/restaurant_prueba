#!/bin/bash
set -e  # Exit on any error

echo "🍽️ Restaurant Web - Development Setup"
echo "====================================="

# Verificar dependencias
echo "🔍 Checking dependencies..."
command -v python3 >/dev/null 2>&1 || { echo "❌ Python3 is required but not installed"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ Node.js/npm is required but not installed"; exit 1; }
echo "✅ Dependencies found"

# Crear variables de entorno
if [ ! -f ".env" ]; then
    echo "📋 Creating .env file..."
    cp .env.example .env
    echo "✅ .env created"
fi

# Crear directorios necesarios
echo "📁 Creating required directories..."
mkdir -p backend/data/logs
mkdir -p backend/staticfiles

# Backend setup
echo ""
echo "🔧 Backend Setup..."
cd backend/

# Crear virtual environment solo si no existe
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activar virtual environment e instalar dependencias básicas
echo "📦 Installing dependencies..."
source venv/bin/activate
echo "⚡ Installing core packages only (faster setup)..."
pip install -q Django djangorestframework django-cors-headers python-dotenv || echo "⚠️ Some packages may be missing, but trying to continue..."

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
"

# Setup grupos (solo si no existen)
python manage.py setup_groups > /dev/null 2>&1 || echo "⚠️ Groups already exist"

# Crear usuarios del restaurante
python manage.py create_restaurant_users > /dev/null 2>&1 || echo "⚠️ Restaurant users already exist"

echo "✅ Backend ready"
cd ..

# Frontend setup
echo ""
echo "⚛️ Frontend Setup..."
cd frontend/

# Instalar dependencias solo si no existen
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install --silent
else
    echo "📦 Dependencies already installed"
fi

echo "✅ Frontend ready"
cd ..

# Iniciar servidores
echo ""
echo "🚀 Starting servers..."
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo "Admin: http://localhost:8000/admin"
echo ""
echo "Users:"
echo "  admin/admin123 (Demo)"
echo "  fernando/Theboss01@! (Admin)"
echo "  brayan/Mesero010@! (Mesero)"
echo ""
echo "Press Ctrl+C to stop servers"
echo ""

# Función de limpieza
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    jobs -p | xargs -r kill
    echo "✅ Stopped"
    exit 0
}
trap cleanup SIGINT SIGTERM

# Iniciar backend en background
cd backend/
source venv/bin/activate
python manage.py runserver 0.0.0.0:8000 &
cd ..

# Iniciar frontend en background
cd frontend/
npm run dev &
cd ..

# Esperar
wait