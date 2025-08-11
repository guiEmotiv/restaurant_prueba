#!/bin/bash

# Audit and Analyze All Deploy Scripts
echo "🔍 AUDITORÍA DE SCRIPTS"
echo "======================"

cd /opt/restaurant-web/deploy

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. Count and categorize files
echo -e "\n1️⃣ ${BLUE}INVENTARIO DE ARCHIVOS${NC}"
echo "=============================="

TOTAL_FILES=$(ls -1 | wc -l)
SHELL_SCRIPTS=$(ls -1 *.sh 2>/dev/null | wc -l)
MD_FILES=$(ls -1 *.md 2>/dev/null | wc -l)
CONF_FILES=$(ls -1 *.conf 2>/dev/null | wc -l)

echo "Total archivos: $TOTAL_FILES"
echo "Scripts shell: $SHELL_SCRIPTS"
echo "Archivos MD: $MD_FILES"
echo "Archivos conf: $CONF_FILES"

# 2. Categorize scripts by purpose
echo -e "\n2️⃣ ${BLUE}CATEGORIZACIÓN DE SCRIPTS${NC}"
echo "================================="

echo -e "\n${YELLOW}🔧 Scripts de Fix/Repair:${NC}"
ls -1 fix-*.sh 2>/dev/null | head -20

echo -e "\n${YELLOW}🔍 Scripts de Debug/Test:${NC}"
ls -1 debug-*.sh test-*.sh diagnose-*.sh 2>/dev/null

echo -e "\n${YELLOW}🚀 Scripts de Deploy:${NC}"
ls -1 build-*.sh deploy*.sh setup-*.sh *-deploy.sh 2>/dev/null

echo -e "\n${YELLOW}🌐 Scripts de Frontend:${NC}"
ls -1 *frontend*.sh 2>/dev/null

echo -e "\n${YELLOW}🔒 Scripts de SSL:${NC}"
ls -1 *ssl*.sh *https*.sh 2>/dev/null

# 3. Find recently used scripts (based on git history or modification time)
echo -e "\n3️⃣ ${BLUE}SCRIPTS USADOS RECIENTEMENTE${NC}"
echo "======================================="

echo "Scripts modificados en los últimos commits:"
git log --oneline --name-only -10 | grep '\.sh$' | sort | uniq -c | sort -nr

# 4. Identify core/essential scripts
echo -e "\n4️⃣ ${BLUE}SCRIPTS ESENCIALES IDENTIFICADOS${NC}"
echo "========================================"

ESSENTIAL_SCRIPTS=(
    "build-deploy.sh"
    "final-fix.sh" 
    "diagnose-connection.sh"
    "enable-ssl.sh"
    "setup-initial.sh"
)

echo "Scripts que parecen esenciales:"
for script in "${ESSENTIAL_SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        SIZE=$(wc -l < "$script")
        echo "✅ $script ($SIZE líneas)"
    else
        echo "❌ $script (no encontrado)"
    fi
done

# 5. Find duplicate functionality
echo -e "\n5️⃣ ${BLUE}DETECTANDO FUNCIONALIDAD DUPLICADA${NC}"
echo "========================================="

echo -e "\n${YELLOW}Scripts que mencionan 'nginx':${NC}"
grep -l "nginx" *.sh 2>/dev/null | wc -l | xargs echo "Total:"

echo -e "\n${YELLOW}Scripts que mencionan 'docker-compose':${NC}"
grep -l "docker-compose" *.sh 2>/dev/null | wc -l | xargs echo "Total:"

echo -e "\n${YELLOW}Scripts que mencionan 'frontend':${NC}"
grep -l "frontend" *.sh 2>/dev/null | wc -l | xargs echo "Total:"

# 6. Identify scripts that are just test/debug
echo -e "\n6️⃣ ${BLUE}SCRIPTS DE SOLO PRUEBA/DEBUG${NC}"
echo "======================================"

echo "Scripts que solo hacen testing/debug (candidatos para eliminar):"
ls -1 | grep -E '^(test-|debug-|diagnose-|check-)' | while read script; do
    if [[ "$script" != "diagnose-connection.sh" ]]; then
        echo "🗑️  $script"
    fi
done

# 7. Summary and recommendations
echo -e "\n7️⃣ ${BLUE}RECOMENDACIONES${NC}"
echo "===================="

echo -e "\n${GREEN}MANTENER (Esenciales):${NC}"
echo "- build-deploy.sh (deployment principal)"
echo "- final-fix.sh (arreglos finales)"
echo "- enable-ssl.sh (configuración SSL)"
echo "- setup-initial.sh (configuración inicial)"
echo "- diagnose-connection.sh (diagnóstico completo)"

echo -e "\n${YELLOW}CONSOLIDAR (Funcionalidad similar):${NC}"
echo "- Múltiples scripts fix-* pueden consolidarse"
echo "- Scripts de frontend pueden unificarse"
echo "- Scripts de SSL pueden simplificarse"

echo -e "\n${RED}ELIMINAR (Obsoletos/Duplicados):${NC}"
echo "- Scripts de test/debug específicos"
echo "- Scripts fix-* antiguos"
echo "- Scripts experimentales"
echo "- Documentación MD redundante"

echo -e "\n${BLUE}TOTAL DE ARCHIVOS A LIMPIAR:${NC}"
CLEANUP_COUNT=$((TOTAL_FILES - 10))
echo "~$CLEANUP_COUNT archivos pueden eliminarse/consolidarse"
echo "Objetivo: Reducir de $TOTAL_FILES a ~10-15 archivos esenciales"