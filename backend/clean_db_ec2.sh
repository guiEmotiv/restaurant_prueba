#!/bin/bash
#
# Script para limpiar la base de datos en EC2 (usando Docker)
# 
# Uso:
#   ./clean_db_ec2.sh                    - Limpieza completa con confirmación
#   ./clean_db_ec2.sh --keep-superuser   - Mantener cuentas de superusuario
#   ./clean_db_ec2.sh --confirm          - Saltar confirmación (PELIGROSO)
#

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🗑️  Database Cleanup Script (EC2/Docker)${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Verificar que docker-compose está disponible
if ! command -v docker-compose >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: docker-compose not found${NC}"
    echo -e "${RED}Please make sure Docker Compose is installed${NC}"
    exit 1
fi

# Verificar que el contenedor está corriendo
if ! docker-compose ps | grep -q "web.*Up"; then
    echo -e "${YELLOW}⚠️  Warning: Web container doesn't seem to be running${NC}"
    echo -e "${YELLOW}Starting containers...${NC}"
    docker-compose up -d
    echo ""
fi

# Mostrar información sobre lo que se va a hacer
echo -e "${YELLOW}This script will:${NC}"
echo "  • Delete ALL data from the database"
echo "  • Reset auto-increment counters"
echo "  • Preserve database structure (tables, indexes, etc.)"
echo "  • Execute inside the Docker container"
echo ""

# Ejecutar el comando de Django dentro del contenedor con los argumentos pasados
echo -e "${GREEN}🚀 Running database cleanup inside Docker container...${NC}"
docker-compose exec web python manage.py clean_database "$@"

echo ""
echo -e "${GREEN}✅ Cleanup completed!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  • Run: docker-compose exec web python manage.py populate_test_data"
echo "  • Or start fresh with your own data"
echo "  • Check status: docker-compose ps"
echo ""