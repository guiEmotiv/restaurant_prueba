#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📦 DEPENDENCY INSTALLATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

echo "📦 INSTALANDO DEPENDENCIAS DE PRODUCCIÓN"
echo "========================================"

# Actualizar sistema
echo "🔄 Actualizando sistema Ubuntu..."
sudo apt-get update -y
sudo apt-get upgrade -y

# Instalar dependencias del sistema
echo "🛠️  Instalando herramientas esenciales..."
sudo apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    unzip \
    htop \
    tree \
    vim \
    certbot \
    python3-certbot-nginx

# Verificar/Instalar Docker
echo "🐳 Configurando Docker..."
if ! command -v docker &> /dev/null; then
    echo "   - Instalando Docker..."
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Agregar usuario a grupo docker
    sudo usermod -aG docker ubuntu
    sudo systemctl enable docker
    sudo systemctl start docker
else
    echo "   - Docker ya está instalado"
    docker --version
fi

# Verificar/Instalar Docker Compose (standalone)
echo "🔧 Configurando Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    echo "   - Instalando Docker Compose..."
    DOCKER_COMPOSE_VERSION="v2.24.0"
    sudo curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
else
    echo "   - Docker Compose ya está instalado"
    docker-compose --version
fi

# Verificar/Instalar Node.js (para builds)
echo "📱 Configurando Node.js..."
if ! command -v node &> /dev/null; then
    echo "   - Instalando Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "   - Node.js ya está instalado"
    node --version
    npm --version
fi

# Verificar/Instalar Python y pip
echo "🐍 Configurando Python..."
if ! command -v python3 &> /dev/null; then
    echo "   - Instalando Python 3..."
    sudo apt-get install -y python3 python3-pip python3-venv
else
    echo "   - Python ya está instalado"
    python3 --version
fi

# Instalar/Actualizar pip
echo "   - Actualizando pip..."
python3 -m pip install --upgrade pip

# Verificar Nginx
echo "🌐 Configurando Nginx..."
if ! command -v nginx &> /dev/null; then
    echo "   - Instalando Nginx..."
    sudo apt-get install -y nginx
    sudo systemctl enable nginx
    sudo systemctl start nginx
else
    echo "   - Nginx ya está instalado"
    nginx -v
fi

# Configurar firewall básico
echo "🔥 Configurando firewall..."
sudo ufw --force enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8000/tcp  # Backend directo para testing
sudo ufw status

# Crear directorios necesarios
echo "📁 Creando estructura de directorios..."
sudo mkdir -p /var/www/certbot
sudo mkdir -p /home/ubuntu/restaurant-web/logs
sudo chown -R ubuntu:ubuntu /home/ubuntu/restaurant-web

# Verificar instalaciones
echo ""
echo "✅ VERIFICACIÓN DE INSTALACIONES"
echo "================================"
echo "Docker: $(docker --version 2>/dev/null || echo 'No instalado')"
echo "Docker Compose: $(docker-compose --version 2>/dev/null || echo 'No instalado')"
echo "Node.js: $(node --version 2>/dev/null || echo 'No instalado')"
echo "NPM: $(npm --version 2>/dev/null || echo 'No instalado')"
echo "Python: $(python3 --version 2>/dev/null || echo 'No instalado')"
echo "Pip: $(python3 -m pip --version 2>/dev/null || echo 'No instalado')"
echo "Nginx: $(nginx -v 2>&1 | head -1 || echo 'No instalado')"
echo ""

# Reiniciar servicios esenciales
echo "🔄 Reiniciando servicios..."
sudo systemctl restart docker
sudo systemctl restart nginx

echo "✅ DEPENDENCIAS INSTALADAS CORRECTAMENTE"
echo "======================================="