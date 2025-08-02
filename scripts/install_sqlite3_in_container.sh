#!/bin/bash
# Script para instalar SQLite3 en el contenedor de producción

echo "📦 Instalando SQLite3 en el contenedor de producción..."

# Instalar SQLite3 en el contenedor
docker exec restaurant-web-web-1 apt-get update
docker exec restaurant-web-web-1 apt-get install -y sqlite3

echo "✅ SQLite3 instalado exitosamente en el contenedor"
echo ""
echo "🔍 Verificando instalación..."
docker exec restaurant-web-web-1 sqlite3 --version

echo ""
echo "✅ Ahora puedes ejecutar los scripts de población"