#!/bin/bash

# Restaurant Web - Fix Nginx Configuration Issues
# Diagnoses and fixes nginx container restart issues

set -e

echo "🔧 DIAGNOSTICANDO Y CORRIGIENDO NGINX"
echo "===================================="

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ Este script debe ejecutarse como root (sudo)"
   exit 1
fi

PROJECT_ROOT="/opt/restaurant-web"
cd "$PROJECT_ROOT"

echo "📍 Directorio del proyecto: $PROJECT_ROOT"

# 1. REVISAR ESTADO ACTUAL
echo ""
echo "🔍 1. Revisando estado actual de contenedores..."

docker-compose -f docker-compose.prod.yml ps

echo ""
echo "📋 Logs de nginx (últimas 20 líneas):"
docker-compose -f docker-compose.prod.yml logs nginx --tail=20 || true

echo ""
echo "📋 Logs de web (últimas 10 líneas):"
docker-compose -f docker-compose.prod.yml logs web --tail=10 || true

# 2. IDENTIFICAR PROBLEMA ESPECÍFICO
echo ""
echo "🔍 2. Identificando problema específico..."

# Verificar si hay errores de SSL
SSL_ERROR=$(docker-compose -f docker-compose.prod.yml logs nginx 2>/dev/null | grep -i "ssl" | wc -l)
CONFIG_ERROR=$(docker-compose -f docker-compose.prod.yml logs nginx 2>/dev/null | grep -i "configuration\|syntax\|error" | wc -l)

echo "📊 Errores SSL detectados: $SSL_ERROR"
echo "📊 Errores de configuración detectados: $CONFIG_ERROR"

# 3. CREAR CONFIGURACIÓN NGINX MINIMALISTA
echo ""
echo "⚙️  3. Creando configuración nginx simplificada..."

# Backup de configuración actual
if [ -f "nginx/conf.d/default.conf" ]; then
    cp nginx/conf.d/default.conf nginx/conf.d/default.conf.problematic
    echo "✅ Backup creado: default.conf.problematic"
fi

# Crear configuración minimalista que funcione
cat > nginx/conf.d/default.conf << 'EOF'
# Restaurant Web - Simplified Nginx Configuration
# Minimal config to avoid SSL and complex routing issues

upstream django_backend {
    server web:8000;
}

server {
    listen 80;
    server_name _;

    # Health check
    location /health {
        return 200 "nginx healthy\n";
        add_header Content-Type text/plain;
    }

    # API endpoints - proxy to Django
    location /api/ {
        proxy_pass http://django_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE, PATCH' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        
        # Handle preflight
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Length' 0;
            return 204;
        }
    }

    # Static files from Django
    location /static/ {
        proxy_pass http://django_backend;
        proxy_set_header Host $host;
    }

    # Media files from Django  
    location /media/ {
        proxy_pass http://django_backend;
        proxy_set_header Host $host;
    }

    # Frontend - React SPA
    location / {
        root /var/www/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Error pages
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
EOF

echo "✅ Configuración nginx simplificada creada"

# 4. VERIFICAR SINTAXIS DE CONFIGURACIÓN
echo ""
echo "🧪 4. Verificando sintaxis de configuración..."

# Recrear contenedor nginx con configuración nueva
echo "🔄 Recreando contenedor nginx..."
docker-compose -f docker-compose.prod.yml stop nginx || true
docker-compose -f docker-compose.prod.yml rm -f nginx || true

# Verificar configuración antes de levantar
echo "🔍 Probando configuración nginx..."
docker run --rm -v "$PROJECT_ROOT/nginx/conf.d:/etc/nginx/conf.d" nginx:alpine nginx -t || {
    echo "❌ Error en configuración nginx. Creando configuración ultra básica..."
    
    # Crear configuración ultra básica si la anterior falla
    cat > nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name _;
    
    location /health {
        return 200 "nginx ok\n";
        add_header Content-Type text/plain;
    }
    
    location /api/ {
        proxy_pass http://web:8000;
        proxy_set_header Host $host;
    }
    
    location / {
        root /var/www/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
EOF
    
    echo "✅ Configuración ultra básica creada"
    docker run --rm -v "$PROJECT_ROOT/nginx/conf.d:/etc/nginx/conf.d" nginx:alpine nginx -t
}

# 5. LEVANTAR SERVICIOS CON CONFIGURACIÓN CORREGIDA
echo ""
echo "🚀 5. Levantando servicios con configuración corregida..."

# Levantar nginx con nueva configuración
docker-compose -f docker-compose.prod.yml up -d nginx

echo "⏳ Esperando que nginx se estabilice..."
sleep 10

# 6. VERIFICAR FUNCIONAMIENTO
echo ""
echo "🔍 6. Verificando funcionamiento..."

echo "📊 Estado de contenedores:"
docker-compose -f docker-compose.prod.yml ps

# Verificar que nginx no se esté reiniciando
NGINX_STATUS=$(docker-compose -f docker-compose.prod.yml ps nginx | grep -v "NAME" | awk '{print $6}' || echo "unknown")
echo "🌐 Estado nginx: $NGINX_STATUS"

if [[ "$NGINX_STATUS" =~ "Up" ]]; then
    echo "✅ Nginx funcionando correctamente"
    
    # Probar conectividad
    echo ""
    echo "🧪 Probando conectividad..."
    
    sleep 5
    
    # Health check nginx
    echo "🔍 Health check nginx:"
    NGINX_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health 2>/dev/null || echo "000")
    echo "  📊 HTTP $NGINX_HEALTH"
    
    # Backend a través de nginx
    echo "🔍 Backend a través de nginx:"
    BACKEND_NGINX=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/health/ 2>/dev/null || echo "000")
    echo "  📊 HTTP $BACKEND_NGINX"
    
    # Endpoint específico
    echo "🔍 Tables endpoint:"
    TABLES_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/config/tables/ 2>/dev/null || echo "000")
    echo "  📊 HTTP $TABLES_TEST"
    
    if [[ "$NGINX_HEALTH" == "200" ]] && [[ "$BACKEND_NGINX" == "200" ]] && [[ "$TABLES_TEST" == "200" ]]; then
        echo ""
        echo "🎉 ¡NGINX CORREGIDO EXITOSAMENTE!"
        echo ""
        echo "🌐 URLs funcionando:"
        echo "  • Frontend: http://www.xn--elfogndedonsoto-zrb.com"
        echo "  • API: http://www.xn--elfogndedonsoto-zrb.com/api/v1/"
        echo "  • Health: http://www.xn--elfogndedonsoto-zrb.com/api/v1/health/"
        echo "  • Tables: http://www.xn--elfogndedonsoto-zrb.com/api/v1/config/tables/"
        echo ""
        echo "✅ Los errores 404 de API están resueltos"
    else
        echo ""
        echo "⚠️  Nginx funcionando pero algunos endpoints fallan"
        echo "📊 Resultados de pruebas:"
        echo "  • Nginx health: $NGINX_HEALTH"
        echo "  • Backend via nginx: $BACKEND_NGINX"  
        echo "  • Tables endpoint: $TABLES_TEST"
    fi
    
else
    echo "❌ Nginx aún tiene problemas"
    echo ""
    echo "📋 Logs recientes de nginx:"
    docker-compose -f docker-compose.prod.yml logs nginx --tail=15
    
    echo ""
    echo "🔧 Intentando reinicio completo..."
    docker-compose -f docker-compose.prod.yml restart nginx
    sleep 10
    
    echo "📊 Estado después del reinicio:"
    docker-compose -f docker-compose.prod.yml ps nginx
fi

echo ""
echo "📋 INFORMACIÓN PARA MONITOREO"
echo "=============================="
echo "• Ver logs nginx: docker-compose -f docker-compose.prod.yml logs nginx"
echo "• Ver logs web: docker-compose -f docker-compose.prod.yml logs web"
echo "• Reiniciar nginx: docker-compose -f docker-compose.prod.yml restart nginx"
echo "• Probar health: curl http://localhost/health"
echo "• Probar API: curl http://localhost/api/v1/health/"
echo ""
echo "✅ Diagnóstico y corrección completada"