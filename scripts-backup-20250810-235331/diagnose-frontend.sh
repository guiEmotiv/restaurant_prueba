#!/bin/bash

# Script para diagnosticar problemas del frontend

echo "========================================="
echo "🔍 DIAGNÓSTICO DEL FRONTEND"
echo "========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Verificar archivos del frontend
echo -e "\n${BLUE}1. VERIFICANDO ARCHIVOS DEL FRONTEND:${NC}"
echo "----------------------------------------"
if [ -d /var/www/restaurant ]; then
    echo "✅ Directorio frontend existe: /var/www/restaurant"
    echo "Contenido:"
    ls -la /var/www/restaurant/ | head -10
    echo "Total archivos: $(find /var/www/restaurant -type f | wc -l)"
    
    # Verificar index.html
    if [ -f /var/www/restaurant/index.html ]; then
        echo "✅ index.html existe"
        echo "Tamaño: $(ls -lh /var/www/restaurant/index.html | awk '{print $5}')"
    else
        echo "❌ index.html NO existe"
    fi
    
    # Verificar assets
    if [ -d /var/www/restaurant/assets ]; then
        echo "✅ Directorio assets existe"
        echo "Archivos JS: $(find /var/www/restaurant/assets -name "*.js" | wc -l)"
        echo "Archivos CSS: $(find /var/www/restaurant/assets -name "*.css" | wc -l)"
    else
        echo "❌ Directorio assets NO existe"
    fi
else
    echo "❌ Directorio frontend NO existe: /var/www/restaurant"
fi

# 2. Verificar configuración nginx
echo -e "\n${BLUE}2. CONFIGURACIÓN NGINX:${NC}"
echo "----------------------------------------"
echo "Archivo de configuración activo:"
ls -la /etc/nginx/sites-enabled/

echo -e "\nDirectiva root en nginx:"
grep -n "root" /etc/nginx/sites-enabled/* 2>/dev/null

echo -e "\nDirectiva try_files:"
grep -n "try_files" /etc/nginx/sites-enabled/* 2>/dev/null

# 3. Verificar logs de nginx
echo -e "\n${BLUE}3. LOGS DE NGINX (últimos errores):${NC}"
echo "----------------------------------------"
if [ -f /var/log/nginx/restaurant-error.log ]; then
    tail -20 /var/log/nginx/restaurant-error.log
else
    tail -20 /var/log/nginx/error.log
fi

# 4. Verificar respuesta HTTP
echo -e "\n${BLUE}4. PRUEBA DE RESPUESTA HTTP:${NC}"
echo "----------------------------------------"
echo "Probando localhost:"
curl -I http://localhost 2>/dev/null | head -5

echo -e "\nProbando https://www.xn--elfogndedonsoto-zrb.com:"
curl -I https://www.xn--elfogndedonsoto-zrb.com 2>/dev/null | head -5

# 5. Verificar API
echo -e "\n${BLUE}5. PRUEBA DE API:${NC}"
echo "----------------------------------------"
echo "Health check API:"
curl -s http://localhost:8000/api/v1/health/ | head -50

# 6. Verificar permisos
echo -e "\n${BLUE}6. PERMISOS DE ARCHIVOS:${NC}"
echo "----------------------------------------"
ls -la /var/www/ | grep restaurant
echo -e "\nPropietario de archivos:"
ls -la /var/www/restaurant/ | head -5

# 7. Verificar build del frontend
echo -e "\n${BLUE}7. VERIFICAR BUILD DEL FRONTEND:${NC}"
echo "----------------------------------------"
if [ -f /opt/restaurant-web/frontend/.env.production ]; then
    echo "Contenido de .env.production:"
    cat /opt/restaurant-web/frontend/.env.production
else
    echo "❌ No se encontró .env.production"
fi

if [ -f /opt/restaurant-web/frontend/dist/index.html ]; then
    echo -e "\n✅ Build existe en frontend/dist/"
    echo "Tamaño dist: $(du -sh /opt/restaurant-web/frontend/dist/ | awk '{print $1}')"
else
    echo -e "\n❌ No existe build en frontend/dist/"
fi

# 8. Verificar proceso de build
echo -e "\n${BLUE}8. HISTORIAL DE BUILD:${NC}"
echo "----------------------------------------"
if [ -f /opt/restaurant-web/frontend/package.json ]; then
    echo "✅ package.json existe"
    grep -A2 -B2 '"build"' /opt/restaurant-web/frontend/package.json
else
    echo "❌ No se encontró package.json"
fi

# 9. Verificar Docker
echo -e "\n${BLUE}9. ESTADO DE DOCKER:${NC}"
echo "----------------------------------------"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 10. Resumen
echo -e "\n${BLUE}10. RESUMEN DE PROBLEMAS:${NC}"
echo "========================================="
PROBLEMS=0

# Verificar problemas comunes
if [ ! -f /var/www/restaurant/index.html ]; then
    echo "❌ PROBLEMA: No existe index.html en /var/www/restaurant"
    echo "  SOLUCIÓN: Ejecutar build del frontend"
    PROBLEMS=$((PROBLEMS+1))
fi

if [ ! -d /var/www/restaurant/assets ]; then
    echo "❌ PROBLEMA: No existen assets compilados"
    echo "  SOLUCIÓN: Verificar que el build se completó correctamente"
    PROBLEMS=$((PROBLEMS+1))
fi

if ! nginx -t 2>/dev/null; then
    echo "❌ PROBLEMA: Configuración de nginx inválida"
    echo "  SOLUCIÓN: Revisar sintaxis de nginx"
    PROBLEMS=$((PROBLEMS+1))
fi

if [ $PROBLEMS -eq 0 ]; then
    echo "✅ No se detectaron problemas obvios"
    echo "Verificar:"
    echo "1. Consola del navegador para errores JavaScript"
    echo "2. Network tab para verificar que los assets se cargan"
    echo "3. Que el dominio DNS esté propagado"
fi

echo -e "\n${YELLOW}COMANDOS ÚTILES:${NC}"
echo "- Ver logs en tiempo real: tail -f /var/log/nginx/restaurant-error.log"
echo "- Reconstruir frontend: cd /opt/restaurant-web && sudo ./deploy/build-deploy.sh"
echo "- Verificar DNS: dig www.xn--elfogndedonsoto-zrb.com"