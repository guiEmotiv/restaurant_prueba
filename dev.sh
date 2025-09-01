#!/bin/bash

# Restaurant Management System - Development Controller
# Simple, clean commands for development

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[DEV]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; exit 1; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }

# Commands
case "${1:-help}" in
    up)
        log "Starting development environment..."
        docker-compose up -d postgres backend
        success "Backend running at http://localhost:8000"
        log "Start frontend with: cd frontend && npm run dev"
        ;;
    
    down)
        log "Stopping all services..."
        docker-compose down
        success "All services stopped"
        ;;
    
    logs)
        service="${2:-backend}"
        docker-compose logs -f "$service"
        ;;
    
    migrate)
        log "Running database migrations..."
        docker-compose exec backend python manage.py migrate
        success "Migrations completed"
        ;;
    
    shell)
        log "Opening Django shell..."
        docker-compose exec backend python manage.py shell
        ;;
    
    psql)
        log "Connecting to PostgreSQL..."
        docker-compose exec postgres psql -U restaurant_user -d restaurant_db
        ;;
    
    test)
        log "Running tests..."
        if [[ "${2:-}" == "frontend" ]]; then
            cd frontend && npm test
        else
            docker-compose exec backend python manage.py test
        fi
        ;;
    
    build)
        log "Building production image for EC2..."
        docker build --platform linux/amd64 -f Dockerfile.prod -t restaurant-web:production .
        success "Production image built for Ubuntu EC2"
        ;;
    
    status)
        log "Environment Status:"
        docker-compose ps
        ;;
    
    reset)
        log "Resetting database..."
        docker-compose down -v
        docker-compose up -d postgres
        sleep 5
        docker-compose up -d backend
        success "Database reset completed"
        ;;
    
    help|*)
        cat << EOF
Restaurant Development Commands

Usage: ./dev.sh [COMMAND]

Commands:
  up        Start development environment (PostgreSQL + Backend)
  down      Stop all services
  logs      Show logs (default: backend, or specify service)
  migrate   Run Django migrations
  shell     Open Django shell
  psql      Connect to PostgreSQL
  test      Run tests (backend or frontend)
  build     Build production image for EC2
  status    Show environment status
  reset     Reset database (WARNING: destroys data)

Examples:
  ./dev.sh up              # Start development
  ./dev.sh logs postgres   # View PostgreSQL logs
  ./dev.sh test frontend   # Run frontend tests
  ./dev.sh build          # Build for production

Frontend Development:
  cd frontend && npm run dev    # Start frontend dev server

Production Deployment:
  git push origin main          # Triggers GitHub Actions
EOF
        ;;
esac