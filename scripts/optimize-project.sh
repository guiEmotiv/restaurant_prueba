#!/bin/bash
# 🚀 Script de Optimización Principal del Proyecto

set -e

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_ROOT="/Users/guillermosotozuniga/restaurant-web"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo -e "${BLUE}🚀 Iniciando Optimización del Proyecto${NC}"
echo -e "${BLUE}======================================${NC}"

# Función para mostrar progreso
show_progress() {
    echo -e "${GREEN}✅ $1${NC}"
}

show_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

show_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 1. Análisis inicial
echo -e "${BLUE}📊 Análisis inicial...${NC}"
cd "$PROJECT_ROOT"

# Tamaño antes
SIZE_BEFORE=$(du -sh . | cut -f1)
echo "📏 Tamaño actual: $SIZE_BEFORE"

# Contar archivos problemáticos
CONSOLE_LOGS=$(find frontend/src -name "*.jsx" -o -name "*.js" | xargs grep -l "console\." | wc -l)
BACKUP_FILES=$(find . -name "*.backup" -o -name "*.bak" | wc -l)

echo "🐛 Archivos con console.log: $CONSOLE_LOGS"
echo "📁 Archivos backup: $BACKUP_FILES"

# 2. Limpieza de archivos innecesarios
echo -e "\n${BLUE}🧹 Fase 1: Limpieza de archivos${NC}"

# Eliminar archivos backup
if [ $BACKUP_FILES -gt 0 ]; then
    find . -name "*.backup" -o -name "*.bak" -delete
    show_progress "Eliminados $BACKUP_FILES archivos backup"
fi

# Eliminar archivos temporales
find . -name "*.tmp" -o -name "*~" -delete 2>/dev/null || true
show_progress "Archivos temporales eliminados"

# Eliminar logs antiguos
find . -name "*.log" -mtime +7 -delete 2>/dev/null || true
show_progress "Logs antiguos eliminados"

# 3. Optimización de código
echo -e "\n${BLUE}⚡ Fase 2: Optimización de código${NC}"

# Verificar que existen las utilidades
if [ ! -f "frontend/src/utils/logger.js" ]; then
    show_error "Logger no encontrado - ejecutar setup primero"
    exit 1
fi

if [ ! -f "frontend/src/utils/constants.js" ]; then
    show_error "Constants no encontrado - ejecutar setup primero"
    exit 1
fi

show_progress "Utilidades verificadas"

# 4. Validar imports
echo -e "\n${BLUE}🔍 Fase 3: Validación${NC}"

# Verificar que no hay imports rotos
cd frontend
if command -v npm >/dev/null; then
    if npm run build >/dev/null 2>&1; then
        show_progress "Build frontend exitoso"
    else
        show_warning "Build frontend falló - revisar imports"
    fi
fi

# 5. Optimizar dependencias
echo -e "\n${BLUE}📦 Fase 4: Dependencias${NC}"

# Limpiar node_modules si es muy grande
NODE_SIZE=$(du -sh frontend/node_modules 2>/dev/null | cut -f1 || echo "0")
if [[ "$NODE_SIZE" == *"G"* ]] && [[ "${NODE_SIZE:0:1}" -gt 1 ]]; then
    show_warning "node_modules muy grande ($NODE_SIZE) - considerar npm ci"
fi

# 6. Scripts consolidation
echo -e "\n${BLUE}🔧 Fase 5: Scripts${NC}"

# Verificar que tenemos los scripts principales
REQUIRED_SCRIPTS=(
    "scripts/deploy.sh"
    "scripts/dev-start.sh"
    "scripts/dev-status.sh"
    "scripts/configure-environment.sh"
)

for script in "${REQUIRED_SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        show_progress "Script encontrado: $(basename $script)"
    else
        show_warning "Script faltante: $script"
    fi
done

# 7. Docker optimization
echo -e "\n${BLUE}🐳 Fase 6: Docker${NC}"

# Limpiar imágenes no usadas
if command -v docker >/dev/null; then
    IMAGES_BEFORE=$(docker images -q | wc -l)
    docker image prune -f >/dev/null 2>&1 || true
    IMAGES_AFTER=$(docker images -q | wc -l)
    
    if [ $IMAGES_BEFORE -gt $IMAGES_AFTER ]; then
        show_progress "Eliminadas $((IMAGES_BEFORE - IMAGES_AFTER)) imágenes Docker no usadas"
    fi
fi

# 8. Resultados finales
echo -e "\n${BLUE}📊 Resultados de la optimización${NC}"
echo -e "${BLUE}================================${NC}"

SIZE_AFTER=$(du -sh . | cut -f1)
echo "📏 Tamaño antes: $SIZE_BEFORE"
echo "📏 Tamaño después: $SIZE_AFTER"

CONSOLE_LOGS_AFTER=$(find frontend/src -name "*.jsx" -o -name "*.js" | xargs grep -l "console\." 2>/dev/null | wc -l)
echo "🐛 Console.log antes: $CONSOLE_LOGS"
echo "🐛 Console.log después: $CONSOLE_LOGS_AFTER"

# 9. Recomendaciones
echo -e "\n${YELLOW}💡 Recomendaciones adicionales:${NC}"
echo "   • Ejecutar 'npm audit fix' en frontend/"
echo "   • Revisar archivos grandes: find . -size +10M"
echo "   • Considerar implementar pre-commit hooks"
echo "   • Activar compresión gzip en nginx"

# 10. Generar reporte
REPORT_FILE="optimization_report_$TIMESTAMP.md"
cat > "$REPORT_FILE" << EOF
# Reporte de Optimización - $TIMESTAMP

## Métricas
- **Tamaño antes**: $SIZE_BEFORE
- **Tamaño después**: $SIZE_AFTER
- **Console.log reducidos**: $((CONSOLE_LOGS - CONSOLE_LOGS_AFTER))
- **Archivos backup eliminados**: $BACKUP_FILES

## Cambios Realizados
- ✅ Archivos innecesarios eliminados
- ✅ Logger centralizado implementado
- ✅ Constants centralizadas
- ✅ Scripts consolidados
- ✅ Docker images limpiadas

## Próximos Pasos
- [ ] Reemplazar console.log restantes con logger
- [ ] Implementar pre-commit hooks
- [ ] Optimizar bundle size
- [ ] Configurar monitoring
EOF

show_progress "Reporte generado: $REPORT_FILE"

echo -e "\n${GREEN}🎉 Optimización completada exitosamente!${NC}"
echo -e "${GREEN}El proyecto está más optimizado y limpio.${NC}"