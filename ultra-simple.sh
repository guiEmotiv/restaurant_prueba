#!/bin/bash

echo "⚡ Ultra-Simple Restaurant Setup"
echo "================================"

# Crear .env
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ .env created"
fi

mkdir -p backend/data/logs

cd backend/

# Usar el venv existente o crear uno nuevo
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Intentar instalar solo Django básico
echo "📦 Installing Django (may take a few minutes)..."
pip install Django || {
    echo "❌ Failed to install Django"
    echo "Please check your internet connection"
    exit 1
}

echo "✅ Django installed!"

# Intentar migración básica
echo "🗄️ Setting up database..."
python manage.py migrate --run-syncdb 2>/dev/null || {
    echo "⚠️ Some migration issues, but continuing..."
}

# Crear admin
echo "👤 Creating admin..."
python manage.py shell -c "
from django.contrib.auth.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@test.com', 'admin123')
    print('✅ Admin created: admin/admin123')
else:
    print('✅ Admin exists')
" || echo "⚠️ Admin creation skipped"

echo ""
echo "🚀 Starting Django server..."
echo ""
echo "🌐 URLs:"
echo "  Backend API: http://localhost:8000"
echo "  Admin Panel: http://localhost:8000/admin"
echo ""
echo "🔑 Login:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Iniciar servidor
python manage.py runserver 0.0.0.0:8000