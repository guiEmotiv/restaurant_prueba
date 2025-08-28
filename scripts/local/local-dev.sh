#!/bin/bash
# Professional Local Development Environment Launcher
# Usage: ./scripts/local-dev.sh [action]
# Actions: start, stop, restart, status, logs

set -e

ACTION=${1:-start}

# Colors for professional output
readonly G='\033[0;32m' R='\033[0;31m' Y='\033[1;33m' B='\033[0;34m' NC='\033[0m'

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LOGGING FUNCTIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log() { echo -e "${G}[$(date +'%H:%M:%S')]${NC} $1"; }
err() { echo -e "${R}[ERROR]${NC} $1" >&2; exit 1; }
warn() { echo -e "${Y}[WARNING]${NC} $1"; }
info() { echo -e "${B}[INFO]${NC} $1"; }

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CONFIGURATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BACKEND_DIR="backend"
FRONTEND_DIR="frontend"
BACKEND_PORT=8000
FRONTEND_PORT=5173

# PID files for process management
BACKEND_PID_FILE="/tmp/restaurant-web-backend.pid"
FRONTEND_PID_FILE="/tmp/restaurant-web-frontend.pid"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# UTILITY FUNCTIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

kill_process_by_pid_file() {
    local pid_file=$1
    local service_name=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            log "Stopping $service_name (PID: $pid)..."
            kill "$pid" 2>/dev/null || true
            sleep 2
            kill -9 "$pid" 2>/dev/null || true
        fi
        rm -f "$pid_file"
    fi
}

wait_for_service() {
    local port=$1
    local service_name=$2
    local max_attempts=30
    
    log "Waiting for $service_name to start on port $port..."
    
    for i in $(seq 1 $max_attempts); do
        if check_port $port; then
            log "✅ $service_name is ready on port $port"
            return 0
        fi
        sleep 1
    done
    
    warn "❌ $service_name failed to start on port $port after ${max_attempts}s"
    return 1
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# BACKEND MANAGEMENT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

start_backend() {
    log "🔧 Starting Django backend..."
    
    # Check if backend directory exists
    if [ ! -d "$BACKEND_DIR" ]; then
        err "Backend directory '$BACKEND_DIR' not found"
    fi
    
    cd "$BACKEND_DIR"
    
    # Check for virtual environment
    if [ ! -d "venv" ] && [ ! -d ".venv" ]; then
        warn "No virtual environment found. Creating one..."
        python -m venv venv
    fi
    
    # Activate virtual environment
    if [ -d "venv" ]; then
        source venv/bin/activate
    elif [ -d ".venv" ]; then
        source .venv/bin/activate
    fi
    
    # Install dependencies
    log "📦 Installing Python dependencies..."
    pip install -r requirements.txt --quiet
    
    # Run migrations
    log "🗃️ Running database migrations..."
    python manage.py migrate --noinput
    
    # Create data directories
    mkdir -p data/logs data/media
    
    # Start Django server in background
    log "🚀 Starting Django server on port $BACKEND_PORT..."
    nohup python manage.py runserver 0.0.0.0:$BACKEND_PORT > ../logs/backend.log 2>&1 &
    echo $! > "$BACKEND_PID_FILE"
    
    cd ..
    
    # Wait for backend to be ready
    wait_for_service $BACKEND_PORT "Django Backend"
}

stop_backend() {
    log "🛑 Stopping Django backend..."
    kill_process_by_pid_file "$BACKEND_PID_FILE" "Django Backend"
    
    # Kill any remaining Django processes on the port
    if check_port $BACKEND_PORT; then
        local pid=$(lsof -ti:$BACKEND_PORT)
        if [ -n "$pid" ]; then
            kill "$pid" 2>/dev/null || true
        fi
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# FRONTEND MANAGEMENT  
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

start_frontend() {
    log "🎨 Starting React frontend..."
    
    # Check if frontend directory exists
    if [ ! -d "$FRONTEND_DIR" ]; then
        err "Frontend directory '$FRONTEND_DIR' not found"
    fi
    
    cd "$FRONTEND_DIR"
    
    # Check for Node.js
    if ! command -v node >/dev/null 2>&1; then
        err "Node.js is not installed"
    fi
    
    # Check for npm
    if ! command -v npm >/dev/null 2>&1; then
        err "npm is not installed"
    fi
    
    # Install dependencies
    log "📦 Installing Node.js dependencies..."
    npm install --silent
    
    # Start Vite dev server in background
    log "🚀 Starting Vite dev server on port $FRONTEND_PORT..."
    nohup npm run dev > ../logs/frontend.log 2>&1 &
    echo $! > "$FRONTEND_PID_FILE"
    
    cd ..
    
    # Wait for frontend to be ready
    wait_for_service $FRONTEND_PORT "React Frontend"
}

stop_frontend() {
    log "🛑 Stopping React frontend..."
    kill_process_by_pid_file "$FRONTEND_PID_FILE" "React Frontend"
    
    # Kill any remaining Node processes on the port
    if check_port $FRONTEND_PORT; then
        local pid=$(lsof -ti:$FRONTEND_PORT)
        if [ -n "$pid" ]; then
            kill "$pid" 2>/dev/null || true
        fi
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MAIN EXECUTION LOGIC
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

show_status() {
    log "📊 Development Environment Status"
    echo ""
    
    # Backend status
    if check_port $BACKEND_PORT; then
        echo -e "🔧 Backend:   ${G}✅ RUNNING${NC} on http://localhost:$BACKEND_PORT"
        echo -e "   Admin:     ${G}✅ AVAILABLE${NC} on http://localhost:$BACKEND_PORT/admin/"
        echo -e "   API:       ${G}✅ AVAILABLE${NC} on http://localhost:$BACKEND_PORT/api/v1/"
        echo -e "   Docs:      ${G}✅ AVAILABLE${NC} on http://localhost:$BACKEND_PORT/api/v1/docs/"
    else
        echo -e "🔧 Backend:   ${R}❌ STOPPED${NC}"
    fi
    
    # Frontend status  
    if check_port $FRONTEND_PORT; then
        echo -e "🎨 Frontend:  ${G}✅ RUNNING${NC} on http://localhost:$FRONTEND_PORT"
        echo -e "   App:       ${G}✅ AVAILABLE${NC} on http://localhost:$FRONTEND_PORT/"
    else
        echo -e "🎨 Frontend:  ${R}❌ STOPPED${NC}"
    fi
    
    echo ""
    
    # Process information
    if [ -f "$BACKEND_PID_FILE" ]; then
        local backend_pid=$(cat "$BACKEND_PID_FILE")
        if kill -0 "$backend_pid" 2>/dev/null; then
            echo -e "   Backend PID: ${B}$backend_pid${NC}"
        fi
    fi
    
    if [ -f "$FRONTEND_PID_FILE" ]; then
        local frontend_pid=$(cat "$FRONTEND_PID_FILE")
        if kill -0 "$frontend_pid" 2>/dev/null; then
            echo -e "   Frontend PID: ${B}$frontend_pid${NC}"
        fi
    fi
}

show_logs() {
    local service=${2:-both}
    
    mkdir -p logs
    
    case "$service" in
        "backend")
            if [ -f "logs/backend.log" ]; then
                log "📜 Backend logs (last 50 lines):"
                tail -50 logs/backend.log
            else
                warn "No backend logs found"
            fi
            ;;
        "frontend")
            if [ -f "logs/frontend.log" ]; then
                log "📜 Frontend logs (last 50 lines):"
                tail -50 logs/frontend.log
            else
                warn "No frontend logs found"
            fi
            ;;
        "both"|*)
            show_logs "" "backend"
            echo ""
            show_logs "" "frontend"
            ;;
    esac
}

main() {
    log "🌟 Professional Restaurant Web Development Environment"
    log "🎯 Action: $ACTION"
    
    # Create logs directory
    mkdir -p logs
    
    case "$ACTION" in
        "start")
            log "🚀 Starting full development environment..."
            
            # Stop any existing services
            stop_backend 2>/dev/null || true
            stop_frontend 2>/dev/null || true
            
            # Start services
            start_backend
            start_frontend
            
            # Show final status
            echo ""
            show_status
            
            echo ""
            log "🎉 Development environment is ready!"
            info "Backend:  http://localhost:$BACKEND_PORT"
            info "Frontend: http://localhost:$FRONTEND_PORT"
            info "Admin:    http://localhost:$BACKEND_PORT/admin/"
            info "API Docs: http://localhost:$BACKEND_PORT/api/v1/docs/"
            echo ""
            log "💡 Use './scripts/local-dev.sh stop' to stop all services"
            ;;
            
        "stop")
            log "🛑 Stopping development environment..."
            stop_backend
            stop_frontend
            log "✅ All services stopped"
            ;;
            
        "restart")
            log "🔄 Restarting development environment..."
            stop_backend
            stop_frontend
            sleep 2
            start_backend
            start_frontend
            show_status
            ;;
            
        "status")
            show_status
            ;;
            
        "logs")
            show_logs
            ;;
            
        *)
            info "Usage: $0 {start|stop|restart|status|logs}"
            info "  start   - Start backend and frontend servers"
            info "  stop    - Stop all development servers"
            info "  restart - Restart all development servers"
            info "  status  - Show status of development servers"
            info "  logs    - Show development server logs"
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"