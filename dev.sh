#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DEVELOPMENT ENVIRONMENT - OPTIMAL SETUP
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Architecture: Backend in Docker + Frontend native (fastest hot-reload)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "🚀 Starting DEVELOPMENT environment..."

# Kill any existing processes
pkill -f "vite" 2>/dev/null || true

# Start backend only (no production profile)
echo "📦 Starting backend container..."
docker-compose up -d app

# Wait for backend
echo "⏳ Waiting for backend..."
sleep 3

# Start frontend natively for optimal hot-reload
echo "🎨 Starting frontend (native)..."
cd frontend && npm run dev &

echo ""
echo "✅ DEVELOPMENT READY!"
echo ""
echo "🌐 Frontend: http://localhost:5173 (Hot-reload enabled)"
echo "🔧 Backend:  http://localhost:8000 (Docker + hot-reload)"
echo "📊 API Docs: http://localhost:8000/api/v1/docs/"
echo ""
echo "📋 Commands:"
echo "   docker-compose logs app -f        # Backend logs"
echo "   docker-compose restart app        # Restart backend"
echo "   docker-compose down               # Stop all"
echo ""