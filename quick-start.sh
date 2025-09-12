#!/bin/bash

echo "⚡ Quick Restaurant Setup - Minimal Version"
echo "=========================================="

# Crear .env si no existe
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ .env created"
fi

# Crear directorios
mkdir -p backend/data/logs

echo ""
echo "🔧 Installing minimal Django setup..."

# Instalar solo Django en el sistema (sin venv para ser más rápido)
cd backend/

# Intentar instalación mínima y rápida
pip3 install --user --no-cache-dir Django==5.2.2 || {
    echo "⚠️ Failed to install Django 5.2.2, trying latest..."
    pip3 install --user --no-cache-dir Django || {
        echo "❌ Could not install Django. Please install manually:"
        echo "   pip3 install Django"
        exit 1
    }
}

echo "✅ Django installed"

# Setup básico de base de datos
echo "🗄️ Database setup..."
python3 manage.py migrate --run-syncdb 2>/dev/null || {
    echo "⚠️ Migration had issues, but continuing..."
}

# Crear usuario admin básico
echo "👤 Creating admin user..."
python3 manage.py shell -c "
from django.contrib.auth.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@test.com', 'admin123')
    print('✅ Admin: admin/admin123')
else:
    print('✅ Admin already exists')
" 2>/dev/null || echo "⚠️ Could not create admin user"

echo ""
echo "🚀 Starting minimal Django server..."
echo "Backend: http://localhost:8000"
echo "Admin: http://localhost:8000/admin (admin/admin123)"
echo ""
echo "Note: This is minimal setup without frontend"
echo "Press Ctrl+C to stop"
echo ""

# Iniciar servidor Django básico
python3 manage.py runserver 0.0.0.0:8000