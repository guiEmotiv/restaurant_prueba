#!/bin/bash
# Script para POBLAR la base de datos con datos de prueba
# Funciona tanto en desarrollo como en producción

echo "🌱 POBLACION DE BASE DE DATOS"
echo "=========================="
echo ""

# Detectar entorno
if [ -f "/.dockerenv" ] || [ -n "${DOCKER_CONTAINER}" ]; then
    echo "🐳 Detectado: Contenedor Docker (Producción)"
    ENV_TYPE="production"
    MANAGE_CMD="python manage.py"
else
    echo "💻 Detectado: Desarrollo local"
    ENV_TYPE="development"
    MANAGE_CMD="cd backend && python manage.py"
fi

echo "📊 Se poblarán datos de prueba para El Fogón de Don Soto"
echo ""

# Confirmación
read -p "¿Continuar con la población de datos? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Operación cancelada"
    exit 1
fi

echo ""
echo "🔄 Poblando base de datos..."

# Usar el comando Django correcto según el entorno
if [ "$ENV_TYPE" = "production" ]; then
    python manage.py populate_production
else
    cd backend && python manage.py populate_production
fi

# Verificar resultado
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ¡Base de datos poblada exitosamente!"
    echo ""
    echo "📊 Datos insertados:"
    echo "   • 5 zonas del restaurante"
    echo "   • 15 mesas distribuidas"
    echo "   • 10+ ingredientes con stock"
    echo "   • 10 recetas (parrillas, bebidas, etc.)"
    echo "   • Órdenes y pagos de ejemplo"
    echo ""
    
    if [ "$ENV_TYPE" = "production" ]; then
        echo "🌐 Datos disponibles en: http://xn--elfogndedonsoto-zrb.com"
    else
        echo "🌐 Inicia el servidor: cd backend && python manage.py runserver"
    fi
else
    echo ""
    echo "❌ Error al poblar la base de datos"
    echo "💡 Revisa que el comando populate_production exista"
    exit 1
fi