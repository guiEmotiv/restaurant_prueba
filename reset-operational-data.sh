#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# 🧹 SCRIPT DE LIMPIEZA DE DATOS OPERACIONALES
# ═══════════════════════════════════════════════════════════════════════════════
#
# Este script elimina SOLO los datos operacionales, manteniendo la configuración:
# 
# ✅ SE CONSERVAN:
#   • Unidades (config_unit)
#   • Zonas (config_zone) 
#   • Mesas (config_table)
#   • Envases/Contenedores (config_container)
#   • Grupos (inventory_group)
#   • Ingredientes (inventory_ingredient)
#   • Recetas (inventory_recipe)
#
# ❌ SE ELIMINAN:
#   • Órdenes (operation_order)
#   • Items de órdenes (operation_orderitem)
#   • Pagos (operation_payment)
#   • Ventas de contenedores (operation_containersale)
#   • Historial de migraciones (django_migrations - se reinicia)
#
# Uso:
#   ./reset-operational-data.sh
#   ./reset-operational-data.sh --backup
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e  # Salir si cualquier comando falla

echo "🧹 === SCRIPT DE LIMPIEZA DE DATOS OPERACIONALES ==="
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

echo "📋 LIMPIEZA SELECTIVA DE DATOS:"
echo ""
echo "✅ SE CONSERVARÁN:"
echo "   • Unidades de medida"
echo "   • Zonas del restaurante"  
echo "   • Configuración de mesas"
echo "   • Envases/contenedores"
echo "   • Grupos de recetas"
echo "   • Ingredientes"
echo "   • Recetas del menú"
echo ""
echo "❌ SE ELIMINARÁN:"
echo "   • Todas las órdenes/pedidos"
echo "   • Items de pedidos"
echo "   • Historial de pagos"
echo "   • Ventas de contenedores"
echo "   • Sesiones de usuarios"
echo ""

# Confirmación de seguridad
read -p "¿Continuar con la limpieza operacional? (s/N): " confirmation
if [[ ! "$confirmation" =~ ^[sS]$ ]]; then
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

echo "🔄 Ejecutando comando de limpieza operacional..."
echo ""

# Ejecutar el comando de Django personalizado
python manage.py reset_operational_data --confirm $BACKUP_FLAG

echo ""
echo "✅ === LIMPIEZA OPERACIONAL COMPLETADA ==="
echo ""
echo "📋 RESULTADO:"
echo "   ✅ Configuración del restaurante preservada"
echo "   ✅ Menú y recetas intactas"
echo "   ✅ Datos operacionales eliminados"
echo "   ✅ Sistema listo para nuevas órdenes"
echo ""
echo "🚀 PASOS SIGUIENTES OPCIONALES:"
echo "   1. Verificar que la aplicación funcione correctamente"
echo "   2. Reiniciar la aplicación si es necesario:"
echo "      # Para desarrollo:"
echo "      cd frontend && npm run dev"
echo "      cd backend && python manage.py runserver"
echo "      # Para producción:"
echo "      docker-compose -f docker-compose.ssl.yml restart"
echo ""
echo "ℹ️  La configuración del restaurante se ha mantenido intacta"