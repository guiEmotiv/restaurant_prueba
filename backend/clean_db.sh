#!/bin/bash
#
# Script para limpiar la base de datos y reiniciar contadores
# 
# Uso:
#   ./clean_db.sh                    - Limpieza completa con confirmación
#   ./clean_db.sh --keep-superuser   - Mantener cuentas de superusuario
#   ./clean_db.sh --confirm          - Saltar confirmación (PELIGROSO)
#

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🗑️  Database Cleanup Script${NC}"
echo -e "${BLUE}===========================${NC}"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "manage.py" ]; then
    echo -e "${RED}❌ Error: manage.py not found${NC}"
    echo -e "${RED}Please run this script from the Django project root${NC}"
    exit 1
fi

# Verificar que la base de datos existe
if [ ! -f "db.sqlite3" ]; then
    echo -e "${YELLOW}⚠️  Warning: db.sqlite3 not found${NC}"
    echo -e "${YELLOW}Database may already be clean or using different backend${NC}"
    echo ""
fi

# Mostrar información sobre lo que se va a hacer
echo -e "${YELLOW}This script will:${NC}"
echo "  • Delete ALL data from the database"
echo "  • Reset auto-increment counters"
echo "  • Preserve database structure (tables, indexes, etc.)"
echo ""

# Detectar comando Python disponible
PYTHON_CMD="python"
if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
else
    echo -e "${RED}❌ Error: Neither python nor python3 found${NC}"
    exit 1
fi

# Ejecutar el comando de Django con los argumentos pasados
echo -e "${GREEN}🚀 Running database cleanup...${NC}"
$PYTHON_CMD manage.py clean_database "$@"

echo ""
echo -e "${GREEN}✅ Cleanup completed!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  • Run: $PYTHON_CMD manage.py populate_test_data (to add sample data)"
echo "  • Or start fresh with your own data"
echo ""