#!/bin/bash
# 🚀 Script optimizado para iniciar desarrollo

set -e

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Iniciando ambiente de desarrollo optimizado...${NC}"

# Función para verificar servicios
check_service() {
    local port=$1
    local name=$2
    if lsof -i:$port >/dev/null 2>&1; then
        echo -e "${GREEN}✅ $name está corriendo en puerto $port${NC}"
        return 0
    else
        echo -e "${YELLOW}❌ $name no está corriendo${NC}"
        return 1
    fi
}

# Limpiar servicios antiguos
echo -e "${YELLOW}🧹 Limpiando servicios anteriores...${NC}"
docker stop restaurant-web-nginx-1 2>/dev/null || true
docker rm restaurant-web-nginx-1 2>/dev/null || true

# Verificar Backend
if ! check_service 8000 "Backend Django"; then
    echo -e "${BLUE}🔧 Iniciando Backend...${NC}"
    docker-compose -f docker-compose.dev.yml up -d web
    sleep 5
fi

# Verificar Frontend
if ! check_service 5173 "Frontend Vite"; then
    echo -e "${BLUE}🔧 Iniciando Frontend...${NC}"
    cd frontend
    npm run dev &
    cd ..
    sleep 3
fi

# Resumen
echo -e "\n${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}✨ Ambiente de desarrollo listo!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${BLUE}📱 Frontend:${NC} http://localhost:5173"
echo -e "${BLUE}🔧 Backend API:${NC} http://localhost:8000"
echo -e "${BLUE}🗄️ Admin Django:${NC} http://localhost:8000/admin"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${YELLOW}💡 Tip: Los cambios se aplican automáticamente (hot-reload)${NC}"
echo -e "${YELLOW}📝 Logs: docker logs -f restaurant-web-web-1${NC}"