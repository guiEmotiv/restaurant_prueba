#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# 🗑️  SCRIPT DE LIMPIEZA TOTAL DE BASE DE DATOS DE PRODUCCIÓN
# ═══════════════════════════════════════════════════════════════════════════════
#
# ADVERTENCIA: Este script elimina TODOS los datos de la base de datos de producción
# y reinicia todos los contadores de ID. Solo usar con extrema precaución.
#
# Uso:
#   ./reset-production-db.sh
#   ./reset-production-db.sh --backup
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e  # Salir si cualquier comando falla

echo "🗑️  === SCRIPT DE LIMPIEZA TOTAL DE BASE DE DATOS ==="
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "backend/manage.py" ]; then
    echo "❌ Error: No se encuentra backend/manage.py"
    echo "   Ejecuta este script desde el directorio raíz del proyecto"
    exit 1
fi

# Verificar argumentos
BACKUP_FLAG=""
if [ "$1" = "--backup" ]; then
    BACKUP_FLAG="--backup"
    echo "💾 Se creará un backup antes de limpiar"
fi

echo "⚠️  ADVERTENCIA: Este script eliminará TODOS los datos de producción:"
echo "   • Todas las mesas, zonas, unidades"
echo "   • Todos los ingredientes, recetas, grupos"
echo "   • Todas las órdenes, pagos, items"
echo "   • Toda la configuración del restaurante"
echo "   • TODOS los datos históricos"
echo ""

# Confirmación de seguridad
read -p "¿Estás seguro de que quieres continuar? Escribe 'SI ESTOY SEGURO': " confirmation
if [ "$confirmation" != "SI ESTOY SEGURO" ]; then
    echo "❌ Operación cancelada"
    exit 1
fi

echo ""
echo "🔄 Cambiando al directorio backend..."
cd backend

# Verificar que el entorno virtual esté activado (opcional)
if [ -z "$VIRTUAL_ENV" ]; then
    echo "⚠️  No se detectó entorno virtual activado"
    echo "   Asegúrate de que las dependencias de Django estén instaladas"
fi

echo "🔄 Ejecutando comando de limpieza..."
echo ""

# Ejecutar el comando de Django con confirmación automática
python manage.py reset_production_db --confirm $BACKUP_FLAG

echo ""
echo "✅ === LIMPIEZA COMPLETADA ==="
echo ""
echo "📋 PASOS SIGUIENTES RECOMENDADOS:"
echo "   1. Verificar que la aplicación funcione correctamente"
echo "   2. Poblar con datos básicos si es necesario:"
echo "      python manage.py populate_production"
echo "   3. Crear usuario administrador si es necesario:"
echo "      python manage.py createsuperuser"
echo "   4. Reiniciar la aplicación en producción:"
echo "      docker-compose -f docker-compose.prod.yml restart"
echo ""
echo "⚠️  IMPORTANTE: La base de datos está ahora completamente vacía"