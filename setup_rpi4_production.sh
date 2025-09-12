#!/bin/bash
#
# Script de configuración para RPi4 en producción
# Configura IP estática, servicios y conectividad para sistema de impresión
#

set -e  # Exit on any error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables de configuración
RPI4_STATIC_IP="192.168.1.100"
RPI4_GATEWAY="192.168.1.1" 
RPI4_DNS="8.8.8.8,1.1.1.1"
WIFI_INTERFACE="wlan0"
SERVICE_NAME="restaurant-printer.service"

echo -e "${BLUE}🔧 CONFIGURACIÓN RPi4 PARA PRODUCCIÓN${NC}"
echo "========================================================"

# 1. Verificar permisos de root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ Este script debe ejecutarse como root (sudo)${NC}"
   exit 1
fi

echo -e "\n${YELLOW}📋 1. VERIFICANDO SISTEMA${NC}"
echo "----------------------------------------"

# Verificar OS
if ! grep -q "Debian" /etc/os-release; then
    echo -e "${RED}❌ Este script está diseñado para Raspberry Pi OS (Debian)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Sistema compatible detectado${NC}"

# Verificar NetworkManager
if ! command -v nmcli &> /dev/null; then
    echo -e "${RED}❌ NetworkManager no encontrado${NC}"
    exit 1
fi

echo -e "${GREEN}✅ NetworkManager disponible${NC}"

# 2. Backup de configuración actual
echo -e "\n${YELLOW}💾 2. CREANDO BACKUP DE CONFIGURACIÓN${NC}"
echo "----------------------------------------------"

BACKUP_DIR="/home/$(logname)/network_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup de conexiones NetworkManager
nmcli connection show > "$BACKUP_DIR/connections_before.txt"
ip addr show > "$BACKUP_DIR/interfaces_before.txt"
ip route > "$BACKUP_DIR/routes_before.txt"

echo -e "${GREEN}✅ Backup creado en: $BACKUP_DIR${NC}"

# 3. Configurar IP estática
echo -e "\n${YELLOW}🌐 3. CONFIGURANDO IP ESTÁTICA${NC}"
echo "------------------------------------"

# Obtener nombre de conexión WiFi activa
WIFI_CONNECTION=$(nmcli -t -f NAME,DEVICE connection show --active | grep "$WIFI_INTERFACE" | cut -d: -f1)

if [[ -z "$WIFI_CONNECTION" ]]; then
    echo -e "${RED}❌ No se encontró conexión WiFi activa en $WIFI_INTERFACE${NC}"
    exit 1
fi

echo -e "🔗 Configurando conexión: ${GREEN}$WIFI_CONNECTION${NC}"
echo -e "📍 IP estática: ${GREEN}$RPI4_STATIC_IP/24${NC}"
echo -e "🚪 Gateway: ${GREEN}$RPI4_GATEWAY${NC}"
echo -e "🌐 DNS: ${GREEN}$RPI4_DNS${NC}"

# Aplicar configuración
nmcli connection modify "$WIFI_CONNECTION" \
    ipv4.method manual \
    ipv4.addresses "$RPI4_STATIC_IP/24" \
    ipv4.gateway "$RPI4_GATEWAY" \
    ipv4.dns "$RPI4_DNS"

echo -e "${GREEN}✅ Configuración de red aplicada${NC}"

# 4. Reiniciar conexión
echo -e "\n${YELLOW}🔄 4. APLICANDO CAMBIOS DE RED${NC}"
echo "----------------------------------"

nmcli connection down "$WIFI_CONNECTION"
sleep 2
nmcli connection up "$WIFI_CONNECTION"
sleep 5

# Verificar nueva IP
NEW_IP=$(ip addr show "$WIFI_INTERFACE" | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)
if [[ "$NEW_IP" == "$RPI4_STATIC_IP" ]]; then
    echo -e "${GREEN}✅ IP estática configurada correctamente: $NEW_IP${NC}"
else
    echo -e "${RED}❌ Error: IP esperada $RPI4_STATIC_IP, obtenida $NEW_IP${NC}"
    exit 1
fi

# 5. Configurar variables de entorno del servidor
echo -e "\n${YELLOW}⚙️  5. CONFIGURANDO VARIABLES DE ENTORNO${NC}"
echo "--------------------------------------------"

ENV_FILE="/home/$(logname)/restaurant-printer-server/.env"
mkdir -p "$(dirname "$ENV_FILE")"

cat > "$ENV_FILE" << EOF
# Configuración de producción RPi4
FLASK_ENV=production
FLASK_DEBUG=False

# Configuración de red
STATIC_IP=$RPI4_STATIC_IP
GATEWAY=$RPI4_GATEWAY

# Backend Django URL (será configurada en deploy)
DJANGO_BACKEND_URL=https://tu-dominio.com

# Token de seguridad (cambiar en producción)
PRINTER_SECRET=production-token-2024

# Configuración de impresora
USB_SCAN_INTERVAL=30
PRINT_TIMEOUT=15

# Logs
LOG_LEVEL=INFO
EOF

chown $(logname):$(logname) "$ENV_FILE"
echo -e "${GREEN}✅ Variables de entorno configuradas${NC}"

# 6. Verificar y configurar servicio
echo -e "\n${YELLOW}🔧 6. VERIFICANDO SERVICIO DE IMPRESIÓN${NC}"
echo "-------------------------------------------"

if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo -e "${GREEN}✅ Servicio $SERVICE_NAME está corriendo${NC}"
    
    # Reiniciar servicio para aplicar nuevas configuraciones
    echo "🔄 Reiniciando servicio..."
    systemctl restart "$SERVICE_NAME"
    sleep 3
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo -e "${GREEN}✅ Servicio reiniciado exitosamente${NC}"
    else
        echo -e "${RED}❌ Error reiniciando servicio${NC}"
        systemctl status "$SERVICE_NAME"
    fi
else
    echo -e "${YELLOW}⚠️  Servicio $SERVICE_NAME no está corriendo${NC}"
    echo "ℹ️  Instalar y configurar el servicio manualmente"
fi

# 7. Test de conectividad
echo -e "\n${YELLOW}🧪 7. PRUEBAS DE CONECTIVIDAD${NC}"
echo "--------------------------------"

# Test ping a gateway
echo -n "🚪 Ping a gateway ($RPI4_GATEWAY): "
if ping -c 1 -W 3 "$RPI4_GATEWAY" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ FALLA${NC}"
fi

# Test DNS
echo -n "🌐 Resolución DNS: "
if nslookup google.com > /dev/null 2>&1; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ FALLA${NC}"
fi

# Test puerto 3001 local
echo -n "🖨️  Servidor Flask (puerto 3001): "
if netstat -tuln | grep -q ":3001"; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${YELLOW}⚠️  No detectado${NC}"
fi

# 8. Resumen de configuración
echo -e "\n${BLUE}📊 RESUMEN DE CONFIGURACIÓN${NC}"
echo "=================================="

echo -e "🌐 Nueva IP: ${GREEN}$NEW_IP${NC}"
echo -e "🚪 Gateway: ${GREEN}$RPI4_GATEWAY${NC}"
echo -e "📁 Variables: ${GREEN}$ENV_FILE${NC}"
echo -e "🔧 Servicio: ${GREEN}$SERVICE_NAME${NC}"

# Información para configuración EC2
echo -e "\n${BLUE}🏭 CONFIGURACIÓN PARA EC2 PRODUCCIÓN${NC}"
echo "====================================="
echo "Agregar estas variables en el servidor EC2:"
echo ""
echo -e "${GREEN}RPI4_HTTP_HOST=$RPI4_STATIC_IP${NC}"
echo -e "${GREEN}RPI4_HTTP_PORT=3001${NC}"
echo ""

# 9. Próximos pasos
echo -e "\n${BLUE}📝 PRÓXIMOS PASOS${NC}"
echo "=================="
echo "1. 🌐 Configurar port forwarding en router:"
echo "   - Puerto externo: 3001"
echo "   - IP destino: $RPI4_STATIC_IP"
echo "   - Puerto interno: 3001"
echo ""
echo "2. 🔒 Obtener IP pública del restaurante"
echo ""
echo "3. ☁️  Configurar variables en EC2:"
echo "   - RPI4_HTTP_HOST=<IP_PUBLICA>"
echo "   - RPI4_HTTP_PORT=3001"
echo ""
echo "4. 🧪 Probar desde EC2:"
echo "   python manage.py test_printer_connection"

echo -e "\n${GREEN}🎉 CONFIGURACIÓN COMPLETADA${NC}"
echo -e "${GREEN}✅ RPi4 listo para producción${NC}"