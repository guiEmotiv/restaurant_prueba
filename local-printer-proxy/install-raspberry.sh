#!/bin/bash

# Script de instalación para Raspberry Pi 4
# Ejecutar con: bash install-raspberry.sh

echo "🥧 Instalación de Proxy de Impresión en Raspberry Pi"
echo "===================================================="

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para verificar comandos
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 no está instalado${NC}"
        return 1
    else
        echo -e "${GREEN}✅ $1 está instalado${NC}"
        return 0
    fi
}

# Paso 1: Verificar requisitos
echo -e "\n${YELLOW}Paso 1: Verificando requisitos...${NC}"
check_command node || {
    echo "Instalando Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
}

check_command npm || {
    echo "NPM no está instalado. Reinstalando Node.js..."
    sudo apt install -y npm
}

check_command pm2 || {
    echo "Instalando PM2..."
    sudo npm install -g pm2
}

# Paso 2: Crear directorio
echo -e "\n${YELLOW}Paso 2: Creando directorio de aplicación...${NC}"
APP_DIR="/home/pi/printer-proxy"
if [ -d "$APP_DIR" ]; then
    echo -e "${YELLOW}El directorio ya existe. ¿Desea eliminarlo y recrearlo? (s/n)${NC}"
    read -r response
    if [[ "$response" == "s" ]]; then
        rm -rf "$APP_DIR"
        mkdir -p "$APP_DIR"
    fi
else
    mkdir -p "$APP_DIR"
fi

cd "$APP_DIR"

# Paso 3: Descargar archivos
echo -e "\n${YELLOW}Paso 3: Descargando archivos del proxy...${NC}"

# Crear package.json
cat > package.json << 'EOF'
{
  "name": "restaurant-printer-proxy",
  "version": "1.0.0",
  "description": "Proxy local para impresoras ESC/POS del restaurante",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "pm2:start": "pm2 start server.js --name printer-proxy",
    "pm2:stop": "pm2 stop printer-proxy",
    "pm2:restart": "pm2 restart printer-proxy",
    "pm2:logs": "pm2 logs printer-proxy"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "body-parser": "^1.20.2",
    "dotenv": "^16.3.1"
  }
}
EOF

# Copiar el server.js (deberás copiar el contenido manualmente o descargarlo)
echo -e "${YELLOW}Creando server.js...${NC}"

# Paso 4: Instalar dependencias
echo -e "\n${YELLOW}Paso 4: Instalando dependencias...${NC}"
npm install

# Paso 5: Crear archivo de configuración
echo -e "\n${YELLOW}Paso 5: Creando archivo de configuración...${NC}"
cat > .env << EOF
# Configuración del Proxy de Impresión
PORT=3001

# Impresora de Cocina
PRINTER_KITCHEN_IP=192.168.1.23
PRINTER_KITCHEN_PORT=9100
PRINTER_KITCHEN_NAME=DMN-C-E-R03523 Cocina

# Impresora de Bar (opcional)
# PRINTER_BAR_IP=192.168.1.24
# PRINTER_BAR_PORT=9100

# Impresora de Caja (opcional)
# PRINTER_CASHIER_IP=192.168.1.25
# PRINTER_CASHIER_PORT=9100
EOF

echo -e "${GREEN}✅ Archivo .env creado${NC}"

# Paso 6: Configurar PM2 para inicio automático
echo -e "\n${YELLOW}Paso 6: Configurando inicio automático con PM2...${NC}"
pm2 start server.js --name printer-proxy
pm2 save
pm2 startup | tail -n 1 | sudo bash
pm2 save

# Paso 7: Verificar estado
echo -e "\n${YELLOW}Paso 7: Verificando estado...${NC}"
pm2 status printer-proxy

# Paso 8: Mostrar información de red
echo -e "\n${YELLOW}Información de Red:${NC}"
IP_ADDRESS=$(hostname -I | awk '{print $1}')
echo -e "${GREEN}IP del Raspberry Pi: $IP_ADDRESS${NC}"
echo -e "${GREEN}Puerto del proxy: 3001${NC}"
echo -e "${GREEN}URL del proxy: http://$IP_ADDRESS:3001${NC}"

echo -e "\n${GREEN}✅ INSTALACIÓN COMPLETADA${NC}"
echo "===================================================="
echo -e "${YELLOW}Próximos pasos:${NC}"
echo "1. Verificar que el proxy esté funcionando:"
echo "   curl http://localhost:3001/status"
echo ""
echo "2. Ver logs del servicio:"
echo "   pm2 logs printer-proxy"
echo ""
echo "3. Configurar el frontend para usar el proxy:"
echo "   En producción, las tablets/PCs deberán apuntar a:"
echo -e "   ${GREEN}http://$IP_ADDRESS:3001${NC}"
echo ""
echo "4. Para detener el servicio:"
echo "   pm2 stop printer-proxy"
echo ""
echo "5. Para reiniciar el servicio:"
echo "   pm2 restart printer-proxy"
echo "===================================================="