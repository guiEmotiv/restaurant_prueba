#!/bin/bash
# PHASE 4: Script de instalación para RPi4 Print Queue Worker
# Ejecutar como: ./setup_rpi4_print_worker.sh

set -e

echo "🖨️  Configurando RPi4 Print Queue Worker..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para logs
log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que estamos en RPi4
if ! grep -q "Raspberry Pi 4" /proc/device-tree/model 2>/dev/null; then
    warn "No se detectó Raspberry Pi 4. Continuando de todas formas..."
fi

# Actualizar sistema
log "Actualizando sistema..."
sudo apt update
sudo apt upgrade -y

# Instalar dependencias del sistema
log "Instalando dependencias del sistema..."
sudo apt install -y python3-pip python3-venv python3-dev libusb-1.0-0-dev udev

# Crear directorio de trabajo
WORK_DIR="/home/$USER/restaurant-print-worker"
log "Creando directorio de trabajo en $WORK_DIR"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

# Crear entorno virtual
log "Creando entorno virtual Python..."
python3 -m venv venv
source venv/bin/activate

# Instalar dependencias Python
log "Instalando dependencias Python..."
pip install --upgrade pip
pip install requests pyusb colorlog python-systemd

# Copiar worker script (asumir que se ejecuta desde repo)
if [ -f "../rpi4_print_queue_worker.py" ]; then
    log "Copiando worker script..."
    cp ../rpi4_print_queue_worker.py ./print_worker.py
    chmod +x print_worker.py
else
    warn "Worker script no encontrado. Crear manualmente."
fi

# Configurar permisos USB
log "Configurando permisos USB para impresora..."
sudo tee /etc/udev/rules.d/99-thermal-printer.rules > /dev/null << 'EOF'
# Reglas para impresoras térmicas USB
SUBSYSTEM=="usb", ATTRS{idVendor}=="04b8", ATTRS{idProduct}=="0202", MODE="0666", GROUP="lp"
SUBSYSTEM=="usb", ATTRS{idVendor}=="0416", ATTRS{idProduct}=="5011", MODE="0666", GROUP="lp"
SUBSYSTEM=="usb", ATTRS{idVendor}=="154f", MODE="0666", GROUP="lp"
EOF

# Agregar usuario a grupo lp
sudo usermod -a -G lp "$USER"

# Crear archivo de configuración
log "Creando archivo de configuración..."
cat > config.py << 'EOF'
# Configuración del Print Queue Worker
API_BASE_URL = "http://192.168.1.100:8000/api"  # Cambiar por IP del backend
POLLING_INTERVAL = 30
USERNAME = "admin"
PASSWORD = "admin123"
MAX_RETRIES = 3
RETRY_DELAY = 5
EOF

# Crear systemd service
log "Creando servicio systemd..."
sudo tee /etc/systemd/system/restaurant-print-worker.service > /dev/null << EOF
[Unit]
Description=Restaurant Print Queue Worker
After=network.target
Wants=network.target

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$WORK_DIR
ExecStart=$WORK_DIR/venv/bin/python $WORK_DIR/print_worker.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Variables de entorno
Environment=PYTHONPATH=$WORK_DIR

[Install]
WantedBy=multi-user.target
EOF

# Recargar systemd
sudo systemctl daemon-reload

# Recargar reglas udev
sudo udevadm control --reload-rules
sudo udevadm trigger

log "✅ Instalación completada!"
echo
echo "📋 Próximos pasos:"
echo "1. Editar $WORK_DIR/config.py con la IP correcta del backend"
echo "2. Conectar la impresora USB"
echo "3. Probar el worker: cd $WORK_DIR && source venv/bin/activate && python print_worker.py"
echo "4. Habilitar servicio: sudo systemctl enable restaurant-print-worker.service"
echo "5. Iniciar servicio: sudo systemctl start restaurant-print-worker.service"
echo "6. Ver logs: sudo journalctl -u restaurant-print-worker.service -f"
echo
echo "🔧 Para verificar impresora USB: lsusb | grep -E 'printer|thermal'"