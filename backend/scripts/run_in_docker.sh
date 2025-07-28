#!/bin/bash
# Script wrapper para ejecutar scripts de Python dentro del contenedor Docker en EC2

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar que se proporcione un script
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: Debe especificar el script a ejecutar${NC}"
    echo "Uso: $0 <script_name>"
    echo "Ejemplo: $0 clean_orders_data.py"
    echo "         $0 sales_report.py"
    exit 1
fi

SCRIPT_NAME=$1
SCRIPT_PATH="backend/scripts/$SCRIPT_NAME"

# Verificar que el script existe
if [ ! -f "$SCRIPT_PATH" ]; then
    echo -e "${RED}Error: El script '$SCRIPT_PATH' no existe${NC}"
    exit 1
fi

# Detectar el archivo docker-compose correcto
if [ -f "docker-compose.ec2.yml" ]; then
    COMPOSE_FILE="docker-compose.ec2.yml"
elif [ -f "docker-compose.yml" ]; then
    COMPOSE_FILE="docker-compose.yml"
else
    echo -e "${RED}Error: No se encontró archivo docker-compose${NC}"
    exit 1
fi

echo -e "${YELLOW}Ejecutando script: $SCRIPT_NAME${NC}"
echo -e "${YELLOW}Usando: $COMPOSE_FILE${NC}"
echo ""

# Ejecutar el script dentro del contenedor
docker-compose -f $COMPOSE_FILE exec -T web python manage.py shell < $SCRIPT_PATH

# Verificar el código de salida
if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}Script ejecutado exitosamente${NC}"
else
    echo -e "\n${RED}Error al ejecutar el script${NC}"
    exit 1
fi