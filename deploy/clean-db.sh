#!/bin/bash
#
# Script para limpiar la base de datos en EC2
# Ejecutar desde el directorio raíz del proyecto: ./deploy/clean-db.sh
#

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🗑️  Restaurant Database Cleanup${NC}"
echo -e "${BLUE}==============================${NC}"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "docker-compose.ec2.yml" ]; then
    echo -e "${RED}❌ Error: docker-compose.ec2.yml not found${NC}"
    echo -e "${RED}Please run this script from the project root directory${NC}"
    echo -e "${YELLOW}Usage: ./deploy/clean-db.sh${NC}"
    exit 1
fi

# Verificar que docker-compose está disponible
if ! command -v docker-compose >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: docker-compose not found${NC}"
    echo -e "${RED}Please make sure Docker Compose is installed${NC}"
    exit 1
fi

# Verificar que el contenedor está corriendo
echo -e "${BLUE}Checking container status...${NC}"
if ! docker-compose -f docker-compose.ec2.yml ps | grep -q "web.*Up"; then
    echo -e "${YELLOW}⚠️  Warning: Web container doesn't seem to be running${NC}"
    echo -e "${YELLOW}Starting containers...${NC}"
    docker-compose -f docker-compose.ec2.yml up -d
    sleep 5
    echo ""
fi

# Mostrar información sobre lo que se va a hacer
echo -e "${YELLOW}This script will:${NC}"
echo "  • Delete ALL data from the database inside Docker container"
echo "  • Reset auto-increment counters"
echo "  • Preserve database structure (tables, indexes, etc.)"
echo ""

# Pedir confirmación
if [[ "$1" != "--confirm" ]]; then
    echo -e "${RED}⚠️  WARNING: This will delete ALL data!${NC}"
    echo -n "Type 'YES' to confirm: "
    read -r confirmation
    if [[ "$confirmation" != "YES" ]]; then
        echo -e "${YELLOW}❌ Operation cancelled${NC}"
        exit 0
    fi
    echo ""
fi

# Ejecutar el comando de Django dentro del contenedor
echo -e "${GREEN}🚀 Running database cleanup inside Docker container...${NC}"
docker-compose -f docker-compose.ec2.yml exec web python manage.py clean_database --confirm "$@"

# Si el comando anterior falla, intentar con -T (no TTY)
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}Retrying without TTY...${NC}"
    docker-compose -f docker-compose.ec2.yml exec -T web python manage.py clean_database --confirm "$@"
fi

echo ""
echo -e "${GREEN}✅ Database cleanup completed!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  • Populate test data: docker-compose -f docker-compose.ec2.yml exec web python manage.py populate_test_data"
echo "  • Check logs: docker-compose -f docker-compose.ec2.yml logs web"
echo "  • Restart if needed: docker-compose -f docker-compose.ec2.yml restart"
echo ""