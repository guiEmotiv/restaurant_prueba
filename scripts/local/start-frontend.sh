#!/bin/bash
# Quick Frontend Startup Script
# Usage: ./scripts/start-frontend.sh

set -e

# Colors
G='\033[0;32m' R='\033[0;31m' Y='\033[1;33m' B='\033[0;34m' NC='\033[0m'
log() { echo -e "${G}[FRONTEND]${NC} $1"; }
err() { echo -e "${R}[ERROR]${NC} $1" >&2; exit 1; }
warn() { echo -e "${Y}[WARNING]${NC} $1"; }
info() { echo -e "${B}[INFO]${NC} $1"; }

log "🎨 Starting React Frontend..."

# Check frontend directory
[ ! -d "frontend" ] && err "Frontend directory not found. Run from project root."

cd frontend

# Check for Node.js and npm
command -v node >/dev/null 2>&1 || err "Node.js is not installed"
command -v npm >/dev/null 2>&1 || err "npm is not installed"

log "📦 Installing Node.js dependencies..."
npm install --silent

log "🚀 Starting Vite development server on http://localhost:5173"
info "🔗 Make sure backend is running on http://localhost:8000"
echo ""
log "Press Ctrl+C to stop the server"

npm run dev