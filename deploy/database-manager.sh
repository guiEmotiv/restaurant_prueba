#!/bin/bash

# ============================================================================
# ADMINISTRADOR DE BASE DE DATOS - Restaurant Management System
# Herramienta unificada para gestión completa de la base de datos
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to show main menu
show_menu() {
    clear
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                                                              ║${NC}"
    echo -e "${CYAN}║         🍽️  ADMINISTRADOR DE BASE DE DATOS 🍽️                ║${NC}"
    echo -e "${CYAN}║                Restaurant Management System                  ║${NC}"
    echo -e "${CYAN}║                                                              ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Seleccione una operación:${NC}"
    echo ""
    echo -e "${YELLOW}   1)${NC} 🗑️  Limpiar base de datos completamente"
    echo -e "${YELLOW}   2)${NC} 📥 Poblar datos desde backup"
    echo -e "${YELLOW}   3)${NC} 🧪 Poblar con datos de prueba"
    echo -e "${YELLOW}   4)${NC} 💾 Crear backup de base de datos actual"
    echo -e "${YELLOW}   5)${NC} 🔍 Ver estado actual de la base de datos"
    echo -e "${YELLOW}   6)${NC} 🔄 Limpiar + Poblar (proceso completo)"
    echo ""
    echo -e "${YELLOW}   0)${NC} ❌ Salir"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Function to check database status
check_database_status() {
    echo -e "${BLUE}🔍 ESTADO ACTUAL DE LA BASE DE DATOS${NC}"
    echo "===================================="
    echo ""
    
    # Detect environment
    if [ -d "/opt/restaurant-web" ] && [ -f "/opt/restaurant-web/.env.ec2" ]; then
        echo -e "${YELLOW}🐳 Entorno: EC2 Docker${NC}"
        cd /opt/restaurant-web
        
        if [ -f "docker-compose.ec2.yml" ]; then
            COMPOSE_FILE="docker-compose.ec2.yml"
        elif [ -f "docker-compose.yml" ]; then
            COMPOSE_FILE="docker-compose.yml"
        fi
        
        # Check containers
        echo -e "${BLUE}📦 Estado de contenedores:${NC}"
        docker-compose -f $COMPOSE_FILE ps
        echo ""
        
        # Check database
        docker-compose -f $COMPOSE_FILE exec -T web python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection
import sqlite3

try:
    with connection.cursor() as cursor:
        cursor.execute(\"\"\"
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        \"\"\")
        tables = cursor.fetchall()
        
        print('📊 TABLAS EN LA BASE DE DATOS:')
        total_records = 0
        
        for (table_name,) in tables:
            cursor.execute(f'SELECT COUNT(*) FROM \"{table_name}\"')
            count = cursor.fetchone()[0]
            total_records += count
            if count > 0:
                print(f'   📋 {table_name}: {count} registros')
        
        print(f'\\n📈 Total de registros: {total_records}')
        
        # Check if there are any users
        cursor.execute('SELECT COUNT(*) FROM auth_user')
        user_count = cursor.fetchone()[0]
        print(f'\\n👥 Usuarios de Django: {user_count}')
        
        if user_count > 0:
            cursor.execute('SELECT username, is_superuser, is_staff FROM auth_user LIMIT 5')
            users = cursor.fetchall()
            for username, is_super, is_staff in users:
                role = 'Superuser' if is_super else 'Staff' if is_staff else 'Regular'
                print(f'   👤 {username} ({role})')

except Exception as e:
    print(f'❌ Error conectando a la base de datos: {e}')
"
    else
        echo -e "${YELLOW}💻 Entorno: Desarrollo Local${NC}"
        
        # Change to backend directory
        if [ -f "backend/manage.py" ]; then
            cd backend
        elif [ ! -f "manage.py" ]; then
            echo -e "${RED}❌ Error: No se encontró manage.py${NC}"
            return 1
        fi
        
        # Check database file
        if [ -f "db.sqlite3" ]; then
            DB_SIZE=$(du -h db.sqlite3 | cut -f1)
            echo -e "${BLUE}💾 Archivo de base de datos: db.sqlite3 (${DB_SIZE})${NC}"
        else
            echo -e "${YELLOW}⚠️  Archivo de base de datos no encontrado${NC}"
            return 0
        fi
        
        # Check Python
        PYTHON_CMD="python"
        if command -v python3 >/dev/null 2>&1; then
            PYTHON_CMD="python3"
        fi
        
        # Check database content
        $PYTHON_CMD -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection

try:
    with connection.cursor() as cursor:
        cursor.execute(\"\"\"
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        \"\"\")
        tables = cursor.fetchall()
        
        print('\\n📊 TABLAS EN LA BASE DE DATOS:')
        total_records = 0
        
        for (table_name,) in tables:
            cursor.execute(f'SELECT COUNT(*) FROM \"{table_name}\"')
            count = cursor.fetchone()[0]
            total_records += count
            if count > 0:
                print(f'   📋 {table_name}: {count} registros')
        
        print(f'\\n📈 Total de registros: {total_records}')
        
        # Check if there are any users
        cursor.execute('SELECT COUNT(*) FROM auth_user')
        user_count = cursor.fetchone()[0]
        print(f'\\n👥 Usuarios de Django: {user_count}')
        
        if user_count > 0:
            cursor.execute('SELECT username, is_superuser, is_staff FROM auth_user LIMIT 5')
            users = cursor.fetchall()
            for username, is_super, is_staff in users:
                role = 'Superuser' if is_super else 'Staff' if is_staff else 'Regular'
                print(f'   👤 {username} ({role})')

except Exception as e:
    print(f'❌ Error conectando a la base de datos: {e}')
"
    fi
    
    echo ""
}

# Function to create backup
create_backup() {
    echo -e "${BLUE}💾 CREAR BACKUP DE BASE DE DATOS${NC}"
    echo "================================"
    echo ""
    
    # Detect environment and use appropriate backup script
    if [ -d "/opt/restaurant-web" ] && [ -f "/opt/restaurant-web/.env.ec2" ]; then
        echo -e "${YELLOW}🐳 Creando backup en EC2...${NC}"
        cd /opt/restaurant-web
        
        if [ -f "backend/scripts/backup_ec2.sh" ]; then
            bash backend/scripts/backup_ec2.sh --compress
        else
            echo -e "${RED}❌ Error: Script de backup EC2 no encontrado${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}💻 Creando backup local...${NC}"
        
        if [ -f "backend/manage.py" ]; then
            cd backend
        elif [ ! -f "manage.py" ]; then
            echo -e "${RED}❌ Error: No se encontró manage.py${NC}"
            return 1
        fi
        
        PYTHON_CMD="python"
        if command -v python3 >/dev/null 2>&1; then
            PYTHON_CMD="python3"
        fi
        
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        BACKUP_NAME="backup_manual_${TIMESTAMP}.json"
        
        echo -e "${YELLOW}Generando backup: $BACKUP_NAME${NC}"
        $PYTHON_CMD manage.py dumpdata --natural-foreign --natural-primary --indent=2 > "$BACKUP_NAME"
        gzip "$BACKUP_NAME"
        
        BACKUP_SIZE=$(du -h "${BACKUP_NAME}.gz" | cut -f1)
        echo -e "${GREEN}✅ Backup creado: ${BACKUP_NAME}.gz (${BACKUP_SIZE})${NC}"
    fi
    
    echo ""
}

# Function to pause and wait for user input
pause() {
    echo ""
    read -p "Presione Enter para continuar..."
}

# Main menu loop
main() {
    while true; do
        show_menu
        read -p "Seleccione una opción (0-6): " choice
        
        case $choice in
            1)
                echo ""
                if [ -f "$SCRIPT_DIR/database-clean-complete.sh" ]; then
                    bash "$SCRIPT_DIR/database-clean-complete.sh"
                else
                    echo -e "${RED}❌ Error: Script de limpieza no encontrado${NC}"
                fi
                pause
                ;;
            2)
                echo ""
                if [ -f "$SCRIPT_DIR/database-populate.sh" ]; then
                    bash "$SCRIPT_DIR/database-populate.sh" --backup-file
                else
                    echo -e "${RED}❌ Error: Script de población no encontrado${NC}"
                fi
                pause
                ;;
            3)
                echo ""
                if [ -f "$SCRIPT_DIR/database-populate.sh" ]; then
                    bash "$SCRIPT_DIR/database-populate.sh" --test-data
                else
                    echo -e "${RED}❌ Error: Script de población no encontrado${NC}"
                fi
                pause
                ;;
            4)
                echo ""
                create_backup
                pause
                ;;
            5)
                echo ""
                check_database_status
                pause
                ;;
            6)
                echo ""
                echo -e "${BLUE}🔄 PROCESO COMPLETO: LIMPIAR + POBLAR${NC}"
                echo "===================================="
                echo ""
                echo -e "${YELLOW}Este proceso:${NC}"
                echo "1. Limpiará completamente la base de datos"
                echo "2. La poblará con datos nuevos"
                echo ""
                read -p "¿Continuar? (y/N): " confirm
                
                if [[ "$confirm" =~ ^[Yy]$ ]]; then
                    # Clean database
                    if [ -f "$SCRIPT_DIR/database-clean-complete.sh" ]; then
                        bash "$SCRIPT_DIR/database-clean-complete.sh"
                    else
                        echo -e "${RED}❌ Error: Script de limpieza no encontrado${NC}"
                        pause
                        continue
                    fi
                    
                    # Populate database
                    echo -e "${BLUE}Continuando con población de datos...${NC}"
                    if [ -f "$SCRIPT_DIR/database-populate.sh" ]; then
                        bash "$SCRIPT_DIR/database-populate.sh"
                    else
                        echo -e "${RED}❌ Error: Script de población no encontrado${NC}"
                    fi
                else
                    echo -e "${YELLOW}Proceso cancelado${NC}"
                fi
                pause
                ;;
            0)
                echo ""
                echo -e "${GREEN}¡Hasta luego! 👋${NC}"
                exit 0
                ;;
            *)
                echo ""
                echo -e "${RED}❌ Opción inválida. Por favor seleccione 0-6.${NC}"
                sleep 2
                ;;
        esac
    done
}

# Check if scripts exist
if [ ! -f "$SCRIPT_DIR/database-clean-complete.sh" ] || [ ! -f "$SCRIPT_DIR/database-populate.sh" ]; then
    echo -e "${RED}❌ Error: Scripts de base de datos no encontrados en $SCRIPT_DIR${NC}"
    echo "Asegúrese de que existan:"
    echo "  - database-clean-complete.sh"
    echo "  - database-populate.sh"
    exit 1
fi

# Execute main function
main "$@"