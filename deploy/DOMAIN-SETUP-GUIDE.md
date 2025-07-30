# Guía de Configuración de Dominio para Restaurant App

Esta guía te ayudará a configurar tu dominio de AWS Route53 con tu aplicación en EC2.

## Prerrequisitos

1. **Dominio registrado en Route53** o cualquier otro registrador
2. **Instancia EC2 funcionando** con la aplicación desplegada
3. **IP pública de EC2** (elástica recomendada)
4. **Acceso SSH a tu servidor EC2**

## Paso 1: Configurar Route53

### 1.1 Crear Hosted Zone (si no existe)

1. Ve a la consola de AWS Route53
2. Click en "Hosted zones"
3. Click en "Create hosted zone"
4. Ingresa tu nombre de dominio (ej: `restaurant.example.com`)
5. Tipo: Public hosted zone
6. Click en "Create hosted zone"

### 1.2 Crear registros DNS

Necesitas crear dos registros A:

#### Registro A para dominio principal:
- **Record name**: (dejar vacío)
- **Record type**: A
- **Value**: Tu IP pública de EC2
- **TTL**: 300
- **Routing policy**: Simple routing

#### Registro A para www:
- **Record name**: www
- **Record type**: A
- **Value**: Tu IP pública de EC2
- **TTL**: 300
- **Routing policy**: Simple routing

## Paso 2: Configurar el servidor EC2

### 2.1 Conectarse al servidor

```bash
ssh -i tu-key.pem ubuntu@tu-ec2-ip
```

### 2.2 Descargar el script de configuración

```bash
cd /opt/restaurant-web
git pull origin main
```

### 2.3 Ejecutar el script de configuración

```bash
sudo ./deploy/configure-domain.sh tu-dominio.com tu-email@example.com
```

Por ejemplo:
```bash
sudo ./deploy/configure-domain.sh restaurant.example.com admin@example.com
```

El script automáticamente:
- ✅ Configurará Nginx con tu dominio
- ✅ Obtendrá un certificado SSL de Let's Encrypt
- ✅ Configurará la renovación automática del SSL
- ✅ Actualizará las variables de entorno
- ✅ Reconstruirá el frontend con la nueva URL
- ✅ Reiniciará la aplicación

## Paso 3: Verificar la configuración

### 3.1 Verificar DNS (desde tu computadora local)

```bash
# Verificar que el DNS esté resolviendo correctamente
nslookup tu-dominio.com
dig tu-dominio.com
```

### 3.2 Verificar HTTPS

Abre tu navegador y visita:
- `https://tu-dominio.com`
- `https://www.tu-dominio.com`

Deberías ver tu aplicación con un candado verde indicando SSL válido.

### 3.3 Verificar certificado SSL

```bash
# En el servidor EC2
sudo certbot certificates
```

## Paso 4: Actualizar configuración de la aplicación

### 4.1 Variables de entorno

El script ya actualizó `.env.ec2`, pero verifica que contenga:

```bash
DOMAIN_NAME=tu-dominio.com
ALLOWED_HOSTS=localhost,127.0.0.1,tu-ip-ec2,tu-dominio.com,www.tu-dominio.com
```

### 4.2 CORS en Django (si es necesario)

Si tienes problemas de CORS, edita `backend/backend/settings.py`:

```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    f"https://{os.getenv('DOMAIN_NAME', 'localhost')}",
    f"https://www.{os.getenv('DOMAIN_NAME', 'localhost')}",
]
```

## Troubleshooting

### Problema: El dominio no resuelve

1. **Verifica los nameservers**: Si compraste el dominio fuera de AWS, asegúrate de que los nameservers apunten a los de Route53
2. **Espera propagación DNS**: Puede tomar hasta 48 horas, aunque generalmente es mucho más rápido
3. **Verifica registros**: En Route53, verifica que los registros A estén correctos

### Problema: Error de SSL

1. **Verifica puertos**: Asegúrate de que los puertos 80 y 443 estén abiertos en el Security Group de EC2
2. **Revisa logs de Nginx**: `sudo tail -f /var/log/nginx/error.log`
3. **Reintenta certificado**: `sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com`

### Problema: La aplicación no carga

1. **Verifica Docker**: `docker-compose -f docker-compose.ec2.yml ps`
2. **Revisa logs**: `docker-compose -f docker-compose.ec2.yml logs`
3. **Reinicia servicios**: `docker-compose -f docker-compose.ec2.yml restart`

## Mantenimiento

### Renovación de SSL

El certificado se renueva automáticamente cada 12 horas. Para verificar:

```bash
sudo systemctl status certbot-renewal.timer
```

Para renovar manualmente:

```bash
sudo certbot renew --dry-run  # Test
sudo certbot renew             # Renovar realmente
```

### Actualizar la aplicación

Después de configurar el dominio, usa el script normal de deploy:

```bash
cd /opt/restaurant-web
./deploy/ec2-deploy.sh deploy
```

## Seguridad adicional

### Configurar firewall

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### Configurar fail2ban

```bash
sudo apt-get install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## Resumen de URLs

Después de la configuración, tu aplicación estará disponible en:

- 🌐 **Aplicación principal**: `https://tu-dominio.com`
- 🌐 **Con www**: `https://www.tu-dominio.com`
- 🛠️ **Admin Django**: `https://tu-dominio.com/admin/`
- 🔧 **API**: `https://tu-dominio.com/api/`

## Soporte

Si encuentras problemas:

1. Revisa los logs del sistema
2. Verifica la configuración de DNS
3. Asegúrate de que los puertos estén abiertos
4. Revisa los logs de Docker y Nginx

¡Tu aplicación ahora está disponible con tu propio dominio y SSL! 🎉