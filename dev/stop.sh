#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PARAR DESARROLLO - Restaurant Web
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🛑 PARANDO DESARROLLO${NC}"
echo "===================="

# Parar containers
echo "📦 Parando containers..."
docker-compose down --remove-orphans 2>/dev/null || true

# Parar frontend
if [ -f "/tmp/restaurant-dev.pid" ]; then
    echo "🎨 Parando frontend..."
    kill $(cat /tmp/restaurant-dev.pid 2>/dev/null) 2>/dev/null || true
    rm -f /tmp/restaurant-dev.pid /tmp/restaurant-dev.log
fi

# Limpiar puerto
if lsof -ti :5173 &>/dev/null; then
    echo "🔄 Liberando puerto 5173..."
    lsof -ti :5173 | xargs kill -9 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}✅ Desarrollo detenido${NC}"