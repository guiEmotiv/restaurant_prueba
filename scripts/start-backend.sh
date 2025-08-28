#!/bin/bash
# Quick Backend Startup Script
# Usage: ./scripts/start-backend.sh

set -e

# Colors
G='\033[0;32m' R='\033[0;31m' Y='\033[1;33m' NC='\033[0m'
log() { echo -e "${G}[BACKEND]${NC} $1"; }
err() { echo -e "${R}[ERROR]${NC} $1" >&2; exit 1; }
warn() { echo -e "${Y}[WARNING]${NC} $1"; }

log "🔧 Starting Django Backend..."

# Check backend directory
[ ! -d "backend" ] && err "Backend directory not found. Run from project root."

cd backend

# Check for virtual environment
if [ ! -d "venv" ] && [ ! -d ".venv" ]; then
    warn "Creating virtual environment..."
    python -m venv venv
fi

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d ".venv" ]; then
    source .venv/bin/activate
fi

log "📦 Installing dependencies..."
pip install -r requirements.txt --quiet

log "🗃️ Running migrations..."
python manage.py migrate --noinput

log "📁 Creating data directories..."
mkdir -p data/logs data/media

log "🚀 Starting Django server on http://localhost:8000"
log "📚 API Documentation: http://localhost:8000/api/v1/docs/"
log "👨‍💼 Admin Panel: http://localhost:8000/admin/"
echo ""
log "Press Ctrl+C to stop the server"

python manage.py runserver 0.0.0.0:8000