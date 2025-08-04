#!/bin/bash

# Script completo para configurar HTTPS en producción EC2
# Ejecutar como: sudo ./setup-ssl-production.sh

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuración
PROJECT_DIR="/opt/restaurant-web"
DOMAIN="elfogondedonsoto.com"
EMAIL="admin@elfogondedonsoto.com"  # ⚠️ CAMBIAR POR EMAIL REAL

echo -e "${BLUE}🚀 Configurando HTTPS para Restaurant Web${NC}"
echo -e "${BLUE}Domain: $DOMAIN${NC}"
echo -e "${BLUE}Project Directory: $PROJECT_DIR${NC}"

# Verificar que somos root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ Este script debe ejecutarse como root (sudo)${NC}"
   exit 1
fi

# Parar servicios existentes
echo -e "${YELLOW}🛑 Deteniendo servicios existentes...${NC}"
cd $PROJECT_DIR
docker-compose -f docker-compose.ec2.yml down 2>/dev/null || true
docker-compose -f docker-compose.ssl.yml down 2>/dev/null || true

# Actualizar código desde git
echo -e "${YELLOW}📥 Actualizando código desde repositorio...${NC}"
git pull origin main

# Crear directorios necesarios
echo -e "${YELLOW}📁 Creando estructura de directorios...${NC}"
mkdir -p data/certbot/conf
mkdir -p data/certbot/www
mkdir -p data/nginx/logs
mkdir -p nginx/ssl-certs
chown -R 1000:1000 data/

# Construir frontend
echo -e "${YELLOW}🔨 Construyendo frontend...${NC}"
cd frontend
npm install --production
npm run build
cd ..

# Verificar que el build del frontend existe
if [ ! -d "frontend/dist" ]; then
    echo -e "${RED}❌ Error: No se encontró el build del frontend${NC}"
    exit 1
fi

# Construir imágenes Docker
echo -e "${YELLOW}🐳 Construyendo imágenes Docker...${NC}"
docker-compose -f docker-compose.ssl.yml build --no-cache

# Verificar configuración de DNS
echo -e "${YELLOW}🔍 Verificando configuración DNS...${NC}"
if ! nslookup $DOMAIN | grep -q $(curl -s http://checkip.amazonaws.com/); then
    echo -e "${YELLOW}⚠️  Advertencia: El dominio $DOMAIN podría no apuntar a esta IP${NC}"
    echo -e "${YELLOW}    Continúa solo si estás seguro de la configuración DNS${NC}"
    read -p "¿Continuar? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Iniciar servicios con certificado temporal
echo -e "${YELLOW}🚀 Iniciando servicios con certificado temporal...${NC}"
docker-compose -f docker-compose.ssl.yml up -d nginx web

# Esperar a que los servicios estén listos
echo -e "${YELLOW}⏳ Esperando a que los servicios estén listos...${NC}"
sleep 15

# Verificar que Nginx responde
if ! curl -f http://localhost/health &>/dev/null; then
    echo -e "${RED}❌ Error: Nginx no está respondiendo${NC}"
    docker-compose -f docker-compose.ssl.yml logs nginx
    exit 1
fi

echo -e "${GREEN}✅ Nginx iniciado correctamente${NC}"

# Obtener certificados SSL (primero staging para probar)
echo -e "${YELLOW}🔐 Obteniendo certificados SSL de Let's Encrypt (staging)...${NC}"
docker-compose -f docker-compose.ssl.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --staging \
    -d $DOMAIN \
    -d www.$DOMAIN

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error obteniendo certificados staging${NC}"
    echo -e "${YELLOW}Verifica:${NC}"
    echo -e "${YELLOW}1. DNS: $DOMAIN -> $(curl -s http://checkip.amazonaws.com/)${NC}"
    echo -e "${YELLOW}2. Puertos 80 y 443 abiertos${NC}"
    echo -e "${YELLOW}3. No hay otros servicios en estos puertos${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Certificados staging obtenidos${NC}"

# Obtener certificados de producción
echo -e "${YELLOW}🔐 Obteniendo certificados SSL de producción...${NC}"
docker-compose -f docker-compose.ssl.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d $DOMAIN \
    -d www.$DOMAIN

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error obteniendo certificados de producción${NC}"
    exit 1
fi

# Copiar certificados a ubicación de Nginx
echo -e "${YELLOW}📋 Copiando certificados SSL...${NC}"
cp data/certbot/conf/live/$DOMAIN/fullchain.pem nginx/ssl-certs/
cp data/certbot/conf/live/$DOMAIN/privkey.pem nginx/ssl-certs/
cp data/certbot/conf/live/$DOMAIN/chain.pem nginx/ssl-certs/

# Reiniciar Nginx con certificados reales
echo -e "${YELLOW}🔄 Reiniciando Nginx con certificados de producción...${NC}"
docker-compose -f docker-compose.ssl.yml restart nginx

sleep 10

# Verificar HTTPS
echo -e "${YELLOW}🔍 Verificando configuración HTTPS...${NC}"
if curl -f https://localhost/health &>/dev/null; then
    echo -e "${GREEN}✅ HTTPS configurado correctamente!${NC}"
else
    echo -e "${RED}❌ Error: HTTPS no está funcionando${NC}"
    docker-compose -f docker-compose.ssl.yml logs nginx
    exit 1
fi

# Configurar renovación automática
echo -e "${YELLOW}⚙️ Configurando renovación automática de certificados...${NC}"
cat > /usr/local/bin/ssl-renewal.sh << EOF
#!/bin/bash
cd $PROJECT_DIR
docker-compose -f docker-compose.ssl.yml run --rm certbot renew --quiet
if [ \$? -eq 0 ]; then
    # Copiar certificados actualizados
    cp data/certbot/conf/live/$DOMAIN/fullchain.pem nginx/ssl-certs/
    cp data/certbot/conf/live/$DOMAIN/privkey.pem nginx/ssl-certs/
    cp data/certbot/conf/live/$DOMAIN/chain.pem nginx/ssl-certs/
    # Reiniciar Nginx
    docker-compose -f docker-compose.ssl.yml restart nginx
    echo "\$(date): Certificados SSL renovados exitosamente" >> /var/log/ssl-renewal.log
else
    echo "\$(date): Error renovando certificados SSL" >> /var/log/ssl-renewal.log
fi
EOF

chmod +x /usr/local/bin/ssl-renewal.sh

# Configurar cron job para renovación (cada día a las 3:00 AM)
echo -e "${YELLOW}📅 Configurando renovación automática...${NC}"
(crontab -l 2>/dev/null; echo "0 3 * * * /usr/local/bin/ssl-renewal.sh") | crontab -

# Configurar rotación de logs
cat > /etc/logrotate.d/restaurant-ssl << EOF
/var/log/ssl-renewal.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
}
EOF

# Configurar firewall si ufw está instalado
if command -v ufw &> /dev/null; then
    echo -e "${YELLOW}🔥 Configurando firewall...${NC}"
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
fi

# Verificación final
echo -e "${YELLOW}🔍 Realizando verificación final...${NC}"

# Test HTTP redirect
if curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN | grep -q "301"; then
    echo -e "${GREEN}✅ HTTP redirect to HTTPS working${NC}"
else
    echo -e "${YELLOW}⚠️  HTTP redirect might not be working${NC}"
fi

# Test HTTPS
if curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN | grep -q "200"; then
    echo -e "${GREEN}✅ HTTPS working correctly${NC}"
else
    echo -e "${RED}❌ HTTPS not responding correctly${NC}"
fi

# Mostrar información de SSL
echo -e "${YELLOW}🔍 Información del certificado SSL:${NC}"
echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -dates

echo -e "${GREEN}🎉 ¡Configuración HTTPS completada exitosamente!${NC}"
echo -e "${GREEN}✅ Tu sitio web está disponible en: https://$DOMAIN${NC}"
echo -e "${GREEN}✅ Los certificados se renovarán automáticamente${NC}"
echo -e "${GREEN}✅ Logs de renovación en: /var/log/ssl-renewal.log${NC}"
echo ""
echo -e "${BLUE}📋 Comandos útiles:${NC}"
echo -e "${YELLOW}  Ver logs de Nginx: docker-compose -f docker-compose.ssl.yml logs nginx${NC}"
echo -e "${YELLOW}  Ver estado: docker-compose -f docker-compose.ssl.yml ps${NC}"
echo -e "${YELLOW}  Reiniciar: docker-compose -f docker-compose.ssl.yml restart${NC}"
echo -e "${YELLOW}  Ver certificado: openssl x509 -in nginx/ssl-certs/fullchain.pem -text -noout${NC}"