#!/bin/bash
# Script wrapper para ejecutar management commands dentro del contenedor Docker en EC2

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verificar que se proporcione un comando
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: Debe especificar el comando a ejecutar${NC}"
    echo -e "${BLUE}Uso: $0 <command> [argumentos]${NC}"
    echo ""
    echo "Comandos disponibles:"
    echo "  clean_orders_data [--force]        - Elimina todos los datos de órdenes"
    echo "  sales_report [opciones]            - Genera reportes de ventas"
    echo ""
    echo "Ejemplos:"
    echo "  $0 clean_orders_data"
    echo "  $0 clean_orders_data --force"
    echo "  $0 sales_report --today"
    echo "  $0 sales_report --month"
    echo "  $0 sales_report --export-csv"
    exit 1
fi

COMMAND_NAME=$1
shift  # Remover el primer argumento para pasar el resto

# Detectar el archivo docker-compose correcto
if [ -f "docker-compose.ec2.yml" ]; then
    COMPOSE_FILE="docker-compose.ec2.yml"
elif [ -f "docker-compose.yml" ]; then
    COMPOSE_FILE="docker-compose.yml"
else
    echo -e "${RED}Error: No se encontró archivo docker-compose${NC}"
    exit 1
fi

echo -e "${YELLOW}Ejecutando comando: $COMMAND_NAME${NC}"
echo -e "${YELLOW}Usando: $COMPOSE_FILE${NC}"
echo ""

# Ejecutar el management command dentro del contenedor
docker-compose -f $COMPOSE_FILE exec web python manage.py $COMMAND_NAME "$@"

# Verificar el código de salida
if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}Comando ejecutado exitosamente${NC}"
else
    echo -e "\n${RED}Error al ejecutar el comando${NC}"
    exit 1
fi