#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🧹 SYSTEM CLEANUP & OPTIMIZATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

echo "🧹 INICIANDO LIMPIEZA DEL SISTEMA EC2"
echo "====================================="

# Verificar que estamos en EC2
if [ ! -f /sys/hypervisor/uuid ] || [ "$(head -c 3 /sys/hypervisor/uuid)" != "ec2" ]; then
    echo "⚠️  Advertencia: Este script está diseñado para EC2"
fi

echo "🔍 Estado inicial del sistema:"
df -h
free -h
echo ""

# Limpiar logs del sistema
echo "📝 Limpiando logs del sistema..."
sudo journalctl --vacuum-time=1d
sudo find /var/log -name "*.log" -type f -mtime +7 -delete 2>/dev/null || true
sudo find /var/log -name "*.gz" -delete 2>/dev/null || true

# Limpiar cache de paquetes
echo "📦 Limpiando cache de paquetes..."
sudo apt-get clean
sudo apt-get autoclean
sudo apt-get autoremove -y

# Limpiar containers Docker antiguos
echo "🐳 Limpiando Docker..."
if command -v docker &> /dev/null; then
    # Detener containers relacionados al proyecto
    docker stop $(docker ps -q --filter "name=restaurant") 2>/dev/null || true
    
    # Limpiar containers, imágenes y volúmenes no utilizados
    docker system prune -af --volumes 2>/dev/null || true
    
    # Limpiar imágenes específicas del proyecto si existen
    docker rmi $(docker images | grep "restaurant" | awk '{print $3}') 2>/dev/null || true
fi

# Limpiar archivos temporales
echo "🗑️  Limpiando archivos temporales..."
sudo rm -rf /tmp/*
sudo rm -rf /var/tmp/*
sudo rm -rf ~/.cache/*

# Limpiar builds anteriores del proyecto
echo "🏗️  Limpiando builds anteriores..."
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [ -d "$PROJECT_DIR" ]; then
    cd "$PROJECT_DIR"
    
    # Limpiar frontend
    if [ -d "frontend/node_modules" ]; then
        echo "   - Limpiando node_modules..."
        rm -rf frontend/node_modules
    fi
    
    if [ -d "frontend/dist" ]; then
        echo "   - Limpiando build anterior..."
        rm -rf frontend/dist
    fi
    
    # Limpiar backend
    if [ -d "backend/__pycache__" ]; then
        echo "   - Limpiando cache Python..."
        find backend -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
        find backend -name "*.pyc" -delete 2>/dev/null || true
    fi
    
    # Limpiar logs de la aplicación
    if [ -d "logs" ]; then
        echo "   - Limpiando logs de la aplicación..."
        rm -rf logs/*
    fi
fi

# Optimizar memoria
echo "💾 Optimizando memoria..."
sudo sync
echo 3 | sudo tee /proc/sys/vm/drop_caches > /dev/null

echo ""
echo "✅ LIMPIEZA COMPLETADA"
echo "====================="
echo "🔍 Estado final del sistema:"
df -h
free -h
echo ""