#!/bin/bash
# 📊 Estado del ambiente de desarrollo

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}📊 Estado del Ambiente de Desarrollo${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}\n"

# Función para verificar servicio
check_port() {
    local port=$1
    local service=$2
    local url=$3
    
    if lsof -i:$port >/dev/null 2>&1; then
        echo -e "${GREEN}✅ $service${NC}"
        echo -e "   Puerto: $port"
        echo -e "   URL: ${BLUE}$url${NC}"
        
        # Detalles del proceso
        local process=$(lsof -ti:$port | head -1)
        if [ ! -z "$process" ]; then
            local pname=$(ps -p $process -o comm= 2>/dev/null || echo "Unknown")
            echo -e "   Proceso: $pname (PID: $process)"
        fi
    else
        echo -e "${RED}❌ $service${NC}"
        echo -e "   Puerto $port no está en uso"
    fi
    echo ""
}

# Verificar servicios principales
check_port 5173 "Frontend (Vite Dev Server)" "http://localhost:5173"
check_port 8000 "Backend (Django API)" "http://localhost:8000"
check_port 3000 "Nginx (No necesario en dev)" "http://localhost:3000"

# Docker containers
echo -e "${YELLOW}🐳 Contenedores Docker:${NC}"
docker ps --filter "name=restaurant" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | head -5
echo ""

# Verificar health de API
echo -e "${YELLOW}🏥 Health Check:${NC}"
if curl -s http://localhost:8000/api/v1/health/ >/dev/null 2>&1; then
    echo -e "${GREEN}✅ API Backend responde correctamente${NC}"
else
    echo -e "${RED}❌ API Backend no responde${NC}"
fi

if curl -s http://localhost:5173 >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend responde correctamente${NC}"
else
    echo -e "${RED}❌ Frontend no responde${NC}"
fi

echo -e "\n${BLUE}═══════════════════════════════════════${NC}"

# Sugerencias
echo -e "${YELLOW}💡 Comandos útiles:${NC}"
echo "• Ver logs backend: docker logs -f restaurant-web-web-1"
echo "• Ver logs frontend: Ver terminal donde corre npm"
echo "• Reiniciar backend: docker restart restaurant-web-web-1"
echo "• Detener todo: docker-compose -f docker-compose.dev.yml down"