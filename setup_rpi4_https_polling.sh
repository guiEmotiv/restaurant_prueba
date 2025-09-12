#!/bin/bash
#
# Script para instalar y configurar HTTPS Polling Worker en RPi4
# Reemplaza completamente el sistema HTTP Push con HTTPS Polling
#

set -e  # Exit on any error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables de configuración
DJANGO_BACKEND_URL="https://xn--elfogndedonsoto-zrb.com"
PRINTER_SECRET="production-token-2024"  # CAMBIAR EN PRODUCCIÓN
SERVICE_NAME="restaurant-https-print-worker.service"

echo -e "${BLUE}🚀 CONFIGURACIÓN HTTPS POLLING WORKER${NC}"
echo "=================================================="

# 1. Verificar permisos de root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ Este script debe ejecutarse como root (sudo)${NC}"
   exit 1
fi

echo -e "\n${YELLOW}📋 1. VERIFICANDO SISTEMA${NC}"
echo "----------------------------------------"

# Verificar Python 3
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 no encontrado${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Python 3 disponible: $(python3 --version)${NC}"

# Verificar requests module
if ! python3 -c "import requests" 2>/dev/null; then
    echo -e "${YELLOW}📦 Instalando módulo requests...${NC}"
    pip3 install requests
fi

echo -e "${GREEN}✅ Módulo requests disponible${NC}"

# 2. Copiar archivos del worker
echo -e "\n${YELLOW}📁 2. INSTALANDO ARCHIVOS${NC}"
echo "------------------------------"

# Copiar worker script
if [[ -f "rpi4_https_polling_worker.py" ]]; then
    cp rpi4_https_polling_worker.py /home/pi/
    chmod +x /home/pi/rpi4_https_polling_worker.py
    chown pi:pi /home/pi/rpi4_https_polling_worker.py
    echo -e "${GREEN}✅ Worker script instalado${NC}"
else
    echo -e "${RED}❌ Archivo rpi4_https_polling_worker.py no encontrado${NC}"
    exit 1
fi

# Copiar service file
if [[ -f "rpi4_https_polling_worker.service" ]]; then
    cp rpi4_https_polling_worker.service /etc/systemd/system/$SERVICE_NAME
    echo -e "${GREEN}✅ Service file instalado${NC}"
else
    echo -e "${RED}❌ Archivo rpi4_https_polling_worker.service no encontrado${NC}"
    exit 1
fi

# 3. Configurar variables de entorno en service
echo -e "\n${YELLOW}⚙️ 3. CONFIGURANDO VARIABLES DE ENTORNO${NC}"
echo "-------------------------------------------"

# Actualizar variables en el service file
sed -i "s|DJANGO_BACKEND_URL=.*|DJANGO_BACKEND_URL=$DJANGO_BACKEND_URL|g" /etc/systemd/system/$SERVICE_NAME
sed -i "s|PRINTER_SECRET=.*|PRINTER_SECRET=$PRINTER_SECRET|g" /etc/systemd/system/$SERVICE_NAME

echo -e "${GREEN}✅ Backend URL: $DJANGO_BACKEND_URL${NC}"
echo -e "${GREEN}✅ Token configurado${NC}"

# 4. Configurar permisos USB
echo -e "\n${YELLOW}🔌 4. CONFIGURANDO PERMISOS USB${NC}"
echo "-----------------------------------"

# Agregar usuario pi al grupo lp (line printer)
usermod -a -G lp pi

# Crear udev rule para permisos automáticos
cat > /etc/udev/rules.d/99-usb-printer.rules << EOF
# Permisos automáticos para impresoras USB
SUBSYSTEM=="usb", ATTRS{bDeviceClass}=="07", GROUP="lp", MODE="0666"
KERNEL=="lp*", GROUP="lp", MODE="0666"
EOF

# Recargar udev rules
udevadm control --reload-rules
udevadm trigger

echo -e "${GREEN}✅ Permisos USB configurados${NC}"

# 5. Configurar systemd service
echo -e "\n${YELLOW}🔧 5. CONFIGURANDO SERVICIO SYSTEMD${NC}"
echo "------------------------------------"

# Reload systemd
systemctl daemon-reload

# Habilitar servicio
systemctl enable $SERVICE_NAME

echo -e "${GREEN}✅ Servicio habilitado para inicio automático${NC}"

# 6. Crear directorio de logs
echo -e "\n${YELLOW}📝 6. CONFIGURANDO LOGS${NC}"
echo "-------------------------"

# Crear archivo de log con permisos correctos
touch /var/log/restaurant-print-worker.log
chown pi:pi /var/log/restaurant-print-worker.log
chmod 644 /var/log/restaurant-print-worker.log

# Crear logrotate config
cat > /etc/logrotate.d/restaurant-print-worker << EOF
/var/log/restaurant-print-worker.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    copytruncate
    su pi pi
}
EOF

echo -e "${GREEN}✅ Sistema de logs configurado${NC}"

# 7. Test de conectividad
echo -e "\n${YELLOW}🧪 7. PRUEBA DE CONECTIVIDAD${NC}"
echo "-------------------------------"

echo -n "🌐 Conectividad HTTPS: "
if curl -s --connect-timeout 10 "$DJANGO_BACKEND_URL" > /dev/null; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ FALLA${NC}"
    echo -e "${YELLOW}⚠️ Verificar conexión a internet y URL${NC}"
fi

# 8. Iniciar servicio
echo -e "\n${YELLOW}🚀 8. INICIANDO SERVICIO${NC}"
echo "-------------------------"

# Parar servicio anterior si existe
if systemctl is-active --quiet restaurant-printer.service 2>/dev/null; then
    echo -e "${YELLOW}⚠️ Parando servicio HTTP anterior...${NC}"
    systemctl stop restaurant-printer.service
    systemctl disable restaurant-printer.service 2>/dev/null || true
fi

# Iniciar nuevo servicio
systemctl start $SERVICE_NAME

# Verificar estado
sleep 3
if systemctl is-active --quiet $SERVICE_NAME; then
    echo -e "${GREEN}✅ Servicio iniciado exitosamente${NC}"
else
    echo -e "${RED}❌ Error iniciando servicio${NC}"
    systemctl status $SERVICE_NAME
    exit 1
fi

# 9. Verificar impresoras USB
echo -e "\n${YELLOW}🖨️ 9. VERIFICANDO IMPRESORAS USB${NC}"
echo "----------------------------------"

USB_PRINTERS=$(ls /dev/usb/lp* 2>/dev/null || echo "")
if [[ -n "$USB_PRINTERS" ]]; then
    echo -e "${GREEN}✅ Impresoras USB detectadas:${NC}"
    for printer in $USB_PRINTERS; do
        echo "    • $printer"
    done
else
    echo -e "${YELLOW}⚠️ No se detectaron impresoras USB${NC}"
    echo "   Verificar que la impresora esté conectada"
fi

# 10. Resumen final
echo -e "\n${BLUE}📊 CONFIGURACIÓN COMPLETADA${NC}"
echo "============================="

echo -e "🔗 Backend URL: ${GREEN}$DJANGO_BACKEND_URL${NC}"
echo -e "🔧 Servicio: ${GREEN}$SERVICE_NAME${NC}"
echo -e "📝 Logs: ${GREEN}/var/log/restaurant-print-worker.log${NC}"
echo -e "👤 Usuario: ${GREEN}pi${NC}"

# 11. Comandos útiles
echo -e "\n${BLUE}📝 COMANDOS ÚTILES${NC}"
echo "=================="
echo "• Ver estado:     systemctl status $SERVICE_NAME"
echo "• Ver logs:       tail -f /var/log/restaurant-print-worker.log"
echo "• Reiniciar:      systemctl restart $SERVICE_NAME"
echo "• Parar:          systemctl stop $SERVICE_NAME"
echo "• Ver logs live:  journalctl -u $SERVICE_NAME -f"

# 12. Test del endpoint
echo -e "\n${BLUE}🧪 TESTING ENDPOINT${NC}"
echo "==================="
echo "Para probar desde Django:"
echo ""
echo "python manage.py shell"
echo ">>> from operation.views_printer_queue import *"
echo ">>> # Crear algunos PrintQueue jobs para probar"
echo ""
echo "El worker debería recogerlos automáticamente cada 5 segundos."

echo -e "\n${GREEN}🎉 INSTALACIÓN COMPLETADA${NC}"
echo -e "${GREEN}✅ HTTPS Polling Worker listo para producción${NC}"

# Mostrar últimas líneas del log
echo -e "\n${BLUE}📋 ÚLTIMAS LÍNEAS DEL LOG:${NC}"
echo "========================="
tail -10 /var/log/restaurant-print-worker.log 2>/dev/null || echo "Log aún vacío - el worker recién se inició"