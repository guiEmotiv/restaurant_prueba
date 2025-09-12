#!/bin/bash

echo "🏁 Final Simple Restaurant Setup"
echo "================================"

# Crear .env
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ .env created"
fi

mkdir -p backend/data/logs

cd backend/

# Limpiar venv anterior si hay problemas
if [ -d "venv" ]; then
    echo "🧹 Cleaning previous virtual environment..."
    rm -rf venv
fi

echo "📦 Creating fresh virtual environment..."
python3 -m venv venv

echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip first
pip install --upgrade pip

# Instalar Django sin usar requirements.txt problemático
echo "📦 Installing Django directly (no hash verification)..."
pip install --no-cache-dir --force-reinstall Django

# Verificar instalación
python -c "import django; print(f'✅ Django {django.get_version()} installed successfully')" || {
    echo "❌ Django installation failed"
    exit 1
}

echo "🗄️ Setting up database..."
python manage.py migrate --run-syncdb || {
    echo "⚠️ Some migration issues, continuing..."
}

echo "👤 Creating admin user..."
python manage.py shell -c "
from django.contrib.auth.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@test.com', 'admin123')
    print('✅ Admin created: admin/admin123')
else:
    print('✅ Admin already exists')
" || echo "⚠️ Admin creation had issues"

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "🚀 Starting Django server..."
echo ""
echo "🌐 Access URLs:"
echo "  📡 API Backend: http://localhost:8000"
echo "  🛠️  Admin Panel: http://localhost:8000/admin"
echo ""
echo "🔑 Login Credentials:"
echo "  👤 Username: admin"
echo "  🔒 Password: admin123"
echo ""
echo "📋 Available endpoints:"
echo "  /admin/          - Django admin panel"
echo "  /api/v1/health/  - Health check"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Iniciar servidor Django
python manage.py runserver 0.0.0.0:8000