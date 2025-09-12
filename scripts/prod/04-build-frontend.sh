#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ⚛️  FRONTEND BUILD & OPTIMIZATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "⚛️  CONSTRUYENDO FRONTEND DE PRODUCCIÓN"
echo "======================================"

cd "${PROJECT_DIR}"

# Verificar estructura del proyecto
if [ ! -f "frontend/package.json" ]; then
    echo "❌ Error: frontend/package.json no encontrado"
    exit 1
fi

echo "✅ Proyecto frontend encontrado"

# Mostrar información del entorno
echo "📋 Información del entorno:"
echo "   - Node.js: $(node --version)"
echo "   - NPM: $(npm --version)"
echo "   - Directorio: ${PROJECT_DIR}"
echo ""

# Verificar variables de entorno para el build
echo "🔍 Verificando variables de entorno..."
if [ ! -f ".env.production" ]; then
    echo "❌ Error: .env.production no encontrado"
    exit 1
fi

echo "📄 Variables de entorno para build:"
grep "VITE_" .env.production | while read -r line; do
    echo "   - $line"
done
echo ""

# Cambiar al directorio frontend
cd frontend

# Limpiar instalaciones anteriores
echo "🧹 Limpiando instalación anterior..."
rm -rf node_modules
rm -rf dist
rm -rf .vite

# Verificar y actualizar npm
echo "🔄 Actualizando npm..."
npm install -g npm@latest

# Instalar dependencias
echo "📦 Instalando dependencias de producción..."
npm ci --production=false

# Verificar que las dependencias críticas están instaladas
echo "🔍 Verificando dependencias críticas..."
if ! npm list react > /dev/null 2>&1; then
    echo "❌ Error: React no está instalado correctamente"
    exit 1
fi

if ! npm list vite > /dev/null 2>&1; then
    echo "❌ Error: Vite no está instalado correctamente"
    exit 1
fi

echo "✅ Dependencias verificadas"

# Ejecutar linting antes del build
echo "🔍 Ejecutando linting..."
npm run lint || {
    echo "⚠️  Advertencia: Linting falló, continuando con el build..."
}

# Crear build de producción con variables de entorno
echo "🏗️  Creando build de producción..."
echo "📝 Usando variables de entorno desde .env.production"

# Cargar variables de entorno y ejecutar build
export $(grep -v '^#' ../.env.production | grep '^VITE_' | xargs)

# Mostrar las variables que se van a usar
echo "🔧 Variables VITE aplicadas:"
env | grep '^VITE_' | while read -r line; do
    echo "   - $line"
done
echo ""

# Ejecutar build con configuración optimizada
NODE_OPTIONS='--max-old-space-size=2048' npm run build:prod

# Verificar que el build se creó correctamente
if [ ! -d "dist" ]; then
    echo "❌ Error: Build falló - directorio dist no creado"
    exit 1
fi

if [ ! -f "dist/index.html" ]; then
    echo "❌ Error: Build falló - index.html no encontrado"
    exit 1
fi

# Mostrar información del build
echo ""
echo "📊 INFORMACIÓN DEL BUILD"
echo "======================="
echo "📁 Directorio: ${PROJECT_DIR}/frontend/dist"
echo "📏 Tamaño total: $(du -sh dist | cut -f1)"
echo "📄 Archivos principales:"
ls -lh dist/ | grep -E '\.(html|js|css)$' | head -10

# Verificar archivos críticos
echo ""
echo "🔍 Verificando archivos críticos..."
critical_files=("index.html")
for file in "${critical_files[@]}"; do
    if [ -f "dist/$file" ]; then
        echo "   ✅ $file ($(du -h dist/$file | cut -f1))"
    else
        echo "   ❌ $file - NO ENCONTRADO"
        exit 1
    fi
done

# Verificar que los assets están optimizados
echo ""
echo "🔍 Verificando optimización de assets..."
js_files=$(find dist -name "*.js" | wc -l)
css_files=$(find dist -name "*.css" | wc -l)
echo "   - Archivos JavaScript: $js_files"
echo "   - Archivos CSS: $css_files"

# Verificar configuración de la API en el build
echo ""
echo "🔍 Verificando configuración API en el build..."
if grep -r "xn--elfogndedonsoto-zrb.com" dist/ > /dev/null 2>&1; then
    echo "   ✅ URL de producción encontrada en el build"
else
    echo "   ⚠️  URL de producción no encontrada en el build"
    echo "   📋 Verificando variables de entorno en el build:"
    grep -r "VITE_API_BASE_URL" dist/ | head -3 || echo "   - No se encontraron referencias a VITE_API_BASE_URL"
fi

# Crear un resumen del build para logs
echo ""
echo "📄 Creando resumen del build..."
cat > dist/build-info.json << EOF
{
    "build_date": "$(date -Iseconds)",
    "build_directory": "${PROJECT_DIR}/frontend/dist",
    "build_size": "$(du -sh dist | cut -f1)",
    "node_version": "$(node --version)",
    "npm_version": "$(npm --version)",
    "environment": "production",
    "domain": "www.xn--elfogndedonsoto-zrb.com"
}
EOF

echo "✅ FRONTEND BUILD COMPLETADO"
echo "============================"
echo "🎯 Build listo para desplegar"
echo "📁 Ubicación: ${PROJECT_DIR}/frontend/dist"
echo "🌐 Configurado para: www.xn--elfogndedonsoto-zrb.com"
echo ""

# Volver al directorio del proyecto
cd "${PROJECT_DIR}"