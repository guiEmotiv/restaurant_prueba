#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DESARROLLO - Restaurant Web (Ambiente Local)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e
cd "$(dirname "$0")/.."

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    case $1 in
        ERROR) echo -e "${RED}❌ $2${NC}" ;;
        SUCCESS) echo -e "${GREEN}✅ $2${NC}" ;;
        WARNING) echo -e "${YELLOW}⚠️  $2${NC}" ;;
        INFO) echo -e "${BLUE}ℹ️  $2${NC}" ;;
    esac
}

echo "🔧 DESARROLLO - RESTAURANT WEB"
echo "=============================="

# 1. Validaciones
log INFO "Validando prerrequisitos..."
command -v docker >/dev/null || { log ERROR "Docker no instalado"; exit 1; }
command -v npm >/dev/null || { log ERROR "npm no instalado"; exit 1; }

# 2. Limpieza
log INFO "Limpiando ambiente anterior..."
docker-compose down --remove-orphans 2>/dev/null || true

# Liberar puerto con timeout
if lsof -ti :5173 &>/dev/null; then
    log WARNING "Liberando puerto 5173..."
    timeout 5s bash -c 'lsof -ti :5173 | xargs kill -9' 2>/dev/null || true
    sleep 1
fi

# 3. Dependencias
if [ ! -d "frontend/node_modules" ]; then
    log WARNING "Instalando dependencias..."
    cd frontend && npm ci --prefer-offline && cd ..
fi

# 4. Backend
log INFO "Iniciando backend (desarrollo)..."
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d app

# 5. Esperar backend
log INFO "Esperando backend..."
for i in {1..30}; do
    if docker exec restaurant-backend python -c "import django; print('OK')" &>/dev/null 2>&1; then
        log SUCCESS "Backend listo"
        break
    fi
    sleep 1
    [ $((i % 10)) -eq 0 ] && log INFO "Esperando... ($i/30)"
done

# 6. Migraciones
log INFO "Aplicando migraciones..."
if ! docker exec restaurant-backend python /app/backend/manage.py migrate; then
    log WARNING "Aplicando fixes conocidos..."
    docker exec restaurant-backend python /app/backend/manage.py migrate config 0013 --fake 2>/dev/null || true
    docker exec restaurant-backend python /app/backend/manage.py migrate operation 0021 --fake 2>/dev/null || true
    docker exec restaurant-backend python /app/backend/manage.py migrate
fi

# 7. Validar backend
log INFO "Validando backend..."
if ! curl -s http://localhost:8000/api/v1/health/ &>/dev/null; then
    log ERROR "Backend no responde"
    exit 1
fi

# 8. Frontend
log INFO "Iniciando frontend..."
cd frontend
nohup npm run dev > /tmp/restaurant-dev.log 2>&1 &
echo $! > /tmp/restaurant-dev.pid
cd ..

# Esperar frontend
for i in {1..20}; do
    if curl -s http://localhost:5173 &>/dev/null; then
        log SUCCESS "Frontend listo"
        break
    fi
    sleep 1
done

# 9. Información final
echo ""
log SUCCESS "🎉 DESARROLLO INICIADO"
echo ""
echo "📱 URLs:"
echo "   🌐 Frontend: http://localhost:5173"
echo "   🔧 Backend:  http://localhost:8000/api/v1/"
echo "   📊 Docs:     http://localhost:8000/api/v1/docs/"
echo "   🍽️  Cocina:   http://localhost:5173/operation/kitchen"
echo ""
echo "🔧 Comandos:"
echo "   📋 Logs:    tail -f /tmp/restaurant-dev.log"
echo "   🛑 Parar:   ./dev/stop.sh"
echo ""
echo "✨ Listo para desarrollo"