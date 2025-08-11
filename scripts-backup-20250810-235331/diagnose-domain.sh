#!/bin/bash

# Script para diagnosticar configuración de dominio en EC2

echo "========================================="
echo "🔍 DIAGNÓSTICO DE CONFIGURACIÓN DE DOMINIO"
echo "========================================="

# 1. Verificar configuración actual de nginx
echo -e "\n📋 CONFIGURACIÓN ACTUAL DE NGINX:"
echo "----------------------------------------"
if [ -f /etc/nginx/sites-enabled/xn--elfogndedonsoto-zrb.com ]; then
    echo "Archivo de configuración encontrado: /etc/nginx/sites-enabled/xn--elfogndedonsoto-zrb.com"
    echo -e "\nContenido server_name:"
    grep -n "server_name" /etc/nginx/sites-enabled/xn--elfogndedonsoto-zrb.com
else
    echo "❌ No se encontró archivo de configuración nginx"
fi

# 2. Verificar certificados SSL
echo -e "\n🔐 CERTIFICADOS SSL:"
echo "----------------------------------------"
if [ -d /etc/letsencrypt/live ]; then
    echo "Certificados encontrados:"
    ls -la /etc/letsencrypt/live/
    
    # Verificar detalles del certificado
    if [ -f /etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com/cert.pem ]; then
        echo -e "\nDominios en el certificado:"
        openssl x509 -in /etc/letsencrypt/live/xn--elfogndedonsoto-zrb.com/cert.pem -text -noout | grep -A 1 "Subject Alternative Name"
    fi
else
    echo "❌ No se encontraron certificados SSL"
fi

# 3. Verificar resolución DNS
echo -e "\n🌐 RESOLUCIÓN DNS:"
echo "----------------------------------------"
echo "Resolviendo xn--elfogndedonsoto-zrb.com:"
dig +short xn--elfogndedonsoto-zrb.com A
echo -e "\nResolviendo www.xn--elfogndedonsoto-zrb.com:"
dig +short www.xn--elfogndedonsoto-zrb.com A

# 4. Verificar puertos abiertos
echo -e "\n🔌 PUERTOS ABIERTOS:"
echo "----------------------------------------"
ss -tlnp | grep -E ':80|:443' 2>/dev/null || netstat -tlnp | grep -E ':80|:443' 2>/dev/null

# 5. Verificar configuración de Django
echo -e "\n🐍 CONFIGURACIÓN DJANGO:"
echo "----------------------------------------"
if [ -f /opt/restaurant-web/backend/.env.ec2 ]; then
    echo "ALLOWED_HOSTS en .env.ec2:"
    grep "ALLOWED_HOSTS" /opt/restaurant-web/backend/.env.ec2
fi

if [ -f /opt/restaurant-web/backend/.env ]; then
    echo -e "\nALLOWED_HOSTS en .env:"
    grep "ALLOWED_HOSTS" /opt/restaurant-web/backend/.env
fi

# 6. Verificar Docker
echo -e "\n🐳 ESTADO DE DOCKER:"
echo "----------------------------------------"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo -e "\n========================================="
echo "📊 RESUMEN:"
echo "========================================="
echo "1. Para que solo funcione https://xn--elfogndedonsoto-zrb.com (sin www):"
echo "   - El certificado SSL debe ser solo para ese dominio"
echo "   - Nginx debe tener server_name solo con ese dominio"
echo "   - No debe existir registro DNS A para www"
echo "   - Django ALLOWED_HOSTS no debe incluir www"
echo ""
echo "2. Si www sigue funcionando, puede ser porque:"
echo "   - Existe un registro DNS A para www en Route 53"
echo "   - El certificado SSL incluye ambos dominios"
echo "   - Nginx está configurado para aceptar ambos"