FROM nginx:1.24-alpine

# Instalar certificados SSL y herramientas
RUN apk add --no-cache openssl

# Copiar configuraciones de Nginx
COPY nginx.conf /etc/nginx/nginx.conf
COPY conf.d/ /etc/nginx/conf.d/

# Crear directorios necesarios
RUN mkdir -p /var/www/html \
    && mkdir -p /var/www/certbot \
    && mkdir -p /etc/nginx/ssl \
    && mkdir -p /var/log/nginx

# Generar parámetros DH (para mayor seguridad SSL)
RUN openssl dhparam -out /etc/nginx/ssl/dhparam.pem 2048

# Crear un certificado SSL temporal para el inicio inicial
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/privkey.pem \
    -out /etc/nginx/ssl/fullchain.pem \
    -subj "/C=PE/ST=Lima/L=Lima/O=Restaurant/OU=IT/CN=xn--elfogndedonsoto-zrb.com" \
    && cp /etc/nginx/ssl/fullchain.pem /etc/nginx/ssl/chain.pem

# Exponer puertos
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Comando de inicio
CMD ["nginx", "-g", "daemon off;"]