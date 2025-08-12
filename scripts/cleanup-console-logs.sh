#!/bin/bash
# Script para limpiar console.log críticos del código

set -e

echo "🧹 Limpiando console.log en archivos críticos..."

FRONTEND_DIR="/Users/guillermosotozuniga/restaurant-web/frontend/src"

# Función para reemplazar console.log por logger
replace_console_logs() {
    local file=$1
    local backup="${file}.backup"
    
    # Crear backup
    cp "$file" "$backup"
    
    # Reemplazar console.log por logger.debug
    sed -i '' 's/console\.log(/logger.debug(/g' "$file"
    
    # Reemplazar console.error por logger.error  
    sed -i '' 's/console\.error(/logger.error(/g' "$file"
    
    # Reemplazar console.warn por logger.warn
    sed -i '' 's/console\.warn(/logger.warn(/g' "$file"
    
    # Reemplazar console.info por logger.info
    sed -i '' 's/console\.info(/logger.info(/g' "$file"
    
    echo "✅ Procesado: $(basename $file)"
}

# Archivos críticos a procesar (solo los más importantes)
CRITICAL_FILES=(
    "$FRONTEND_DIR/contexts/AuthContext.jsx"
    "$FRONTEND_DIR/services/api.js"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        # Verificar si ya tiene import del logger
        if ! grep -q "import.*logger" "$file"; then
            echo "⚠️  $file necesita import del logger - procesando manualmente"
        else
            replace_console_logs "$file"
        fi
    else
        echo "⚠️  Archivo no encontrado: $file"
    fi
done

echo ""
echo "✅ Limpieza completada"
echo "💡 Revisa los cambios y elimina los .backup si están correctos"
echo "💡 Recuerda agregar 'import { logger } from \"../utils/logger\"' donde sea necesario"