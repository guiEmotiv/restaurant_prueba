#!/bin/bash
# Script para configurar y verificar el ambiente de desarrollo

echo "🚀 Configurando ambiente de desarrollo para El Fogón de Don Soto"
echo "============================================================"

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Verificar Docker
echo -e "\n${YELLOW}1. Verificando Docker...${NC}"
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker no está ejecutándose. Por favor inicia Docker Desktop.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker está ejecutándose${NC}"

# Limpiar contenedores anteriores
echo -e "\n${YELLOW}2. Limpiando contenedores anteriores...${NC}"
cd /Users/guillermosotozuniga/restaurant-web
docker-compose -f docker-compose.dev.yml down
echo -e "${GREEN}✅ Contenedores detenidos${NC}"

# Verificar variables de entorno
echo -e "\n${YELLOW}3. Verificando configuración de Cognito...${NC}"
if [ -f frontend/.env ]; then
    echo -e "${GREEN}✅ Frontend .env encontrado${NC}"
    grep -E "(VITE_AWS_|VITE_API_URL)" frontend/.env
else
    echo -e "${RED}❌ Frontend .env no encontrado${NC}"
fi

if [ -f backend/.env ]; then
    echo -e "${GREEN}✅ Backend .env encontrado${NC}"
    grep -E "(COGNITO_|AWS_)" backend/.env
else
    echo -e "${YELLOW}⚠️ Backend .env no encontrado (usando variables de docker-compose)${NC}"
fi

# Construir frontend
echo -e "\n${YELLOW}4. Construyendo frontend...${NC}"
cd frontend
docker run --rm -v "$(pwd)":/app -w /app node:20-alpine npm run build
cd ..
echo -e "${GREEN}✅ Frontend construido${NC}"

# Iniciar servicios
echo -e "\n${YELLOW}5. Iniciando servicios...${NC}"
docker-compose -f docker-compose.dev.yml up -d
echo -e "${GREEN}✅ Servicios iniciados${NC}"

# Esperar a que los servicios estén listos
echo -e "\n${YELLOW}6. Esperando a que los servicios estén listos...${NC}"
sleep 5

# Verificar salud de los servicios
echo -e "\n${YELLOW}7. Verificando salud de los servicios...${NC}"

# Verificar backend
HEALTH_CHECK=$(curl -s http://localhost:3000/api/v1/health/ || echo "FAILED")
if [[ "$HEALTH_CHECK" == *"ok"* ]]; then
    echo -e "${GREEN}✅ Backend API funcionando${NC}"
else
    echo -e "${RED}❌ Backend API no responde${NC}"
    docker-compose -f docker-compose.dev.yml logs --tail=20 web
fi

# Verificar nginx
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|304"; then
    echo -e "${GREEN}✅ Nginx proxy funcionando${NC}"
else
    echo -e "${RED}❌ Nginx no responde${NC}"
    docker-compose -f docker-compose.dev.yml logs --tail=20 nginx
fi

# Ejecutar migraciones y poblar datos
echo -e "\n${YELLOW}8. Configurando base de datos...${NC}"
docker-compose -f docker-compose.dev.yml exec -T web python manage.py migrate
if [ -f scripts/setup_database.sh ]; then
    ./scripts/setup_database.sh
    echo -e "${GREEN}✅ Base de datos configurada${NC}"
else
    echo -e "${YELLOW}⚠️ Script de población de datos no encontrado${NC}"
fi

# Resumen final
echo -e "\n${GREEN}============================================================${NC}"
echo -e "${GREEN}✅ Ambiente de desarrollo configurado exitosamente${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "🌐 Frontend: ${YELLOW}http://localhost:3000${NC}"
echo -e "🔧 API: ${YELLOW}http://localhost:3000/api/v1/${NC}"
echo -e "🔐 Backend directo: ${YELLOW}http://localhost:8000${NC}"
echo ""
echo -e "${YELLOW}IMPORTANTE para autenticación:${NC}"
echo -e "1. El usuario debe estar asignado a un grupo en AWS Cognito"
echo -e "2. Grupos disponibles: administradores, meseros, cocineros"
echo -e "3. Se usa ID Token para autorización (incluye grupos)"
echo ""
echo -e "${YELLOW}Para ver logs:${NC}"
echo -e "docker-compose -f docker-compose.dev.yml logs -f [web|nginx]"
echo ""
echo -e "${YELLOW}Para detener:${NC}"
echo -e "docker-compose -f docker-compose.dev.yml down"