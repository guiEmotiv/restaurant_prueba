#!/bin/bash
# Development environment setup

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEV]${NC} $1"; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }

log "🚀 Setting up development environment..."

# 1. Create development database
log "Creating development database..."
mkdir -p data logs
if [ ! -f data/restaurant_dev.sqlite3 ]; then
    touch data/restaurant_dev.sqlite3
    log "✅ Development database created"
fi

# 2. Install backend dependencies
if [ -f backend/requirements.txt ]; then
    log "Installing Python dependencies..."
    cd backend
    pip install -r requirements.txt
    cd ..
fi

# 3. Install frontend dependencies
if [ -f frontend/package.json ]; then
    log "Installing Node.js dependencies..."
    cd frontend
    npm install
    cd ..
fi

# 4. Run migrations
log "Running Django migrations..."
docker-compose -f docker-compose.dev.yml up -d app
sleep 5
docker-compose -f docker-compose.dev.yml exec app python manage.py migrate
docker-compose -f docker-compose.dev.yml exec app python manage.py collectstatic --noinput

log "✅ Development environment ready!"
info ""
info "🔧 Development commands:"
info "  Backend only:     docker-compose -f docker-compose.dev.yml up app"
info "  With nginx:       docker-compose -f docker-compose.dev.yml --profile with-nginx up"
info "  Frontend dev:     cd frontend && npm run dev"
info "  Django shell:     docker-compose -f docker-compose.dev.yml exec app python manage.py shell"
info "  Run tests:        docker-compose -f docker-compose.dev.yml exec app python manage.py test"
info ""
info "🌐 URLs:"
info "  Backend API:      http://localhost:8000"
info "  Frontend (Vite):  http://localhost:5173"
info "  Full stack:       http://localhost:8080"