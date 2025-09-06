#!/bin/bash

# Script para configurar IP estática en Raspberry Pi
echo "🔧 Configurando IP estática para Raspberry Pi"

# Backup de configuración actual
sudo cp /etc/dhcpcd.conf /etc/dhcpcd.conf.backup

# Configurar IP estática
cat << EOF | sudo tee -a /etc/dhcpcd.conf

# Configuración IP estática para printer proxy
interface eth0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=8.8.8.8 8.8.4.4
EOF

echo "✅ Configuración aplicada. Reiniciar con: sudo reboot"
echo "📍 IP estática configurada: 192.168.1.100"