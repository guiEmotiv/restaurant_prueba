#!/bin/bash

# Script para inicializar SSL con Let's Encrypt
# Este script debe ejecutarse en el servidor EC2

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
DOMAIN="elfogondedonsoto.com"
EMAIL="admin@elfogondedonsoto.com"  # Cambiar por email real
COMPOSE_FILE="docker-compose.ssl.yml"

echo -e "${BLUE}🔒 Inicializando configuración SSL para ${DOMAIN}${NC}"

# Verificar que estamos en el directorio correcto
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}❌ Error: No se encontró $COMPOSE_FILE${NC}"
    echo -e "${YELLOW}Asegúrate de ejecutar este script desde el directorio del proyecto${NC}"
    exit 1
fi

# Crear directorios necesarios
echo -e "${YELLOW}📁 Creando directorios necesarios...${NC}"
mkdir -p data/certbot/conf
mkdir -p data/certbot/www
mkdir -p data/nginx/logs
mkdir -p nginx/ssl-certs

# Parar servicios existentes si están corriendo
echo -e "${YELLOW}🛑 Deteniendo servicios existentes...${NC}"
docker-compose -f docker-compose.ec2.yml down 2>/dev/null || true
docker-compose -f $COMPOSE_FILE down 2>/dev/null || true

# Construcción de imágenes
echo -e "${YELLOW}🔨 Construyendo imágenes Docker...${NC}"
docker-compose -f $COMPOSE_FILE build

# Iniciar Nginx con certificado temporal
echo -e "${YELLOW}🚀 Iniciando Nginx con certificado temporal...${NC}"
docker-compose -f $COMPOSE_FILE up -d nginx web

# Esperar a que Nginx esté listo
echo -e "${YELLOW}⏳ Esperando a que Nginx esté listo...${NC}"
sleep 10

# Verificar que Nginx responde en puerto 80
if ! curl -f http://localhost/health &>/dev/null; then
    echo -e "${RED}❌ Error: Nginx no está respondiendo en puerto 80${NC}"
    docker-compose -f $COMPOSE_FILE logs nginx
    exit 1
fi

echo -e "${GREEN}✅ Nginx iniciado correctamente${NC}"

# Obtener certificados SSL de Let's Encrypt
echo -e "${YELLOW}🔐 Obteniendo certificados SSL de Let's Encrypt...${NC}"
docker-compose -f $COMPOSE_FILE run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --staging \
    -d $DOMAIN \
    -d www.$DOMAIN

# Verificar que los certificados se crearon
if [ ! -f "data/certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
    echo -e "${RED}❌ Error: No se pudieron obtener los certificados SSL${NC}"
    echo -e "${YELLOW}Verifica que:${NC}"
    echo -e "${YELLOW}1. El dominio $DOMAIN apunta a esta IP${NC}"
    echo -e "${YELLOW}2. Los puertos 80 y 443 están abiertos${NC}"
    echo -e "${YELLOW}3. No hay otros servicios usando estos puertos${NC}"
    exit 1
fi

# Copiar certificados reales
echo -e "${YELLOW}📋 Copiando certificados SSL...${NC}"
cp data/certbot/conf/live/$DOMAIN/fullchain.pem nginx/ssl-certs/
cp data/certbot/conf/live/$DOMAIN/privkey.pem nginx/ssl-certs/
cp data/certbot/conf/live/$DOMAIN/chain.pem nginx/ssl-certs/

# Reiniciar Nginx con certificados reales
echo -e "${YELLOW}🔄 Reiniciando Nginx con certificados reales...${NC}"
docker-compose -f $COMPOSE_FILE restart nginx

# Esperar a que esté listo
sleep 5

# Verificar HTTPS
echo -e "${YELLOW}🔍 Verificando configuración HTTPS...${NC}"
if curl -f -k https://localhost/health &>/dev/null; then
    echo -e "${GREEN}✅ HTTPS configurado correctamente!${NC}"
else
    echo -e "${RED}❌ Error: HTTPS no está funcionando${NC}"
    docker-compose -f $COMPOSE_FILE logs nginx
    exit 1
fi

# Configurar renovación automática
echo -e "${YELLOW}⚙️ Configurando renovación automática...${NC}"
cat > /tmp/ssl-renewal.sh << 'EOF'
#!/bin/bash
cd /opt/restaurant-web
docker-compose -f docker-compose.ssl.yml run --rm certbot renew --quiet
if [ $? -eq 0 ]; then
    # Copiar certificados actualizados
    cp data/certbot/conf/live/elfogondedonsoto.com/fullchain.pem nginx/ssl-certs/
    cp data/certbot/conf/live/elfogondedonsoto.com/privkey.pem nginx/ssl-certs/
    cp data/certbot/conf/live/elfogondedonsoto.com/chain.pem nginx/ssl-certs/
    # Reiniciar Nginx
    docker-compose -f docker-compose.ssl.yml restart nginx
    echo "$(date): Certificados SSL renovados exitosamente" >> /var/log/ssl-renewal.log
fi
EOF

sudo cp /tmp/ssl-renewal.sh /usr/local/bin/ssl-renewal.sh
sudo chmod +x /usr/local/bin/ssl-renewal.sh

# Agregar cron job para renovación
echo -e "${YELLOW}📅 Configurando cron job para renovación automática...${NC}"
(sudo crontab -l 2>/dev/null; echo "0 3 * * * /usr/local/bin/ssl-renewal.sh") | sudo crontab -

echo -e "${GREEN}🎉 ¡Configuración SSL completada exitosamente!${NC}"
echo -e "${GREEN}✅ Tu sitio ahora está disponible en: https://$DOMAIN${NC}"
echo -e "${GREEN}✅ Renovación automática configurada${NC}"
echo -e "${YELLOW}📝 Notas importantes:${NC}"
echo -e "${YELLOW}   - Los certificados se renovarán automáticamente cada día a las 3:00 AM${NC}"
echo -e "${YELLOW}   - Los logs de renovación están en /var/log/ssl-renewal.log${NC}"
echo -e "${YELLOW}   - Para ver logs: docker-compose -f $COMPOSE_FILE logs nginx${NC}"