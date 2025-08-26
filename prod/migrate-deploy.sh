#!/bin/bash
# Migration script to replace old deploy.sh with optimized version
# This ensures zero-downtime migration to the new deployment system

set -e

echo "🔄 MIGRANDO A SISTEMA DE DEPLOY OPTIMIZADO"
echo "=========================================="

# Backup current deploy script
if [ -f "prod/deploy.sh" ]; then
    echo "📦 Creando backup del script actual..."
    cp prod/deploy.sh prod/deploy.sh.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Backup creado"
fi

# Replace with optimized version
echo "🚀 Instalando script optimizado..."
cp prod/deploy-optimized.sh prod/deploy.sh
chmod +x prod/deploy.sh

echo "✅ Migración completada exitosamente"
echo ""
echo "🎉 NUEVAS CARACTERÍSTICAS DISPONIBLES:"
echo "  ✅ Operaciones atómicas - Sin estados inconsistentes"
echo "  ✅ Verificación de integridad - Checksums automáticos"  
echo "  ✅ Zero-downtime deployment - Intercambio atómico"
echo "  ✅ Rollback automático - En caso de fallo"
echo "  ✅ Health monitoring - Verificaciones exhaustivas"
echo "  ✅ Limpieza inteligente - Optimización automática"
echo "  ✅ Paralelización - Operaciones concurrentes"
echo "  ✅ Estado persistente - Tracking completo"
echo ""
echo "📋 USO:"
echo "  ./prod/deploy.sh deploy   # Deployment completo optimizado"
echo "  ./prod/deploy.sh check    # Verificación exhaustiva"
echo ""
echo "⚠️  NOTA: El nuevo sistema es más robusto pero puede ser ligeramente más lento"
echo "         debido a las verificaciones de integridad adicionales."
echo ""
echo "🔧 Para revertir (si es necesario):"
echo "   cp prod/deploy.sh.backup.* prod/deploy.sh"