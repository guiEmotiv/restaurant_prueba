# 🚀 Restaurant Web - Guía de Deployment en Producción

Esta guía te ayudará a hacer el deployment de tu aplicación Restaurant Web en un servidor EC2 de AWS con SSL y dominio personalizado.

## 📋 Requisitos Previos

### En tu servidor EC2:
- Ubuntu 20.04 o superior
- Mínimo 2GB RAM, 20GB almacenamiento
- Puerto 80 y 443 abiertos
- Acceso SSH configurado

### Configuración DNS:
Tu dominio `www.xn--elfogndedonsoto-zrb.com` debe apuntar a la IP de tu EC2:
```
A    xn--elfogndedonsoto-zrb.com        [IP_DE_TU_EC2]
A    www.xn--elfogndedonsoto-zrb.com    [IP_DE_TU_EC2]
```

## 🎯 Proceso de Deployment Automatizado

### 1. Preparar el Código (Local)
```bash
# En tu máquina local, confirma los cambios
git add .
git commit -m "feat: production deployment ready"
git push origin main
```

### 2. Conectar al Servidor EC2
```bash
ssh -i ubuntu_fds_key.pem ubuntu@[IP_DE_TU_EC2]
```

### 3. Descargar/Actualizar el Código
```bash
# Primera vez
cd /home/ubuntu
git clone https://github.com/tu-usuario/restaurant-web.git
cd restaurant-web

# Actualizaciones posteriores
cd /home/ubuntu/restaurant-web
git pull origin main
```

### 4. Ejecutar Deployment Completo
```bash
# Deployment completo (primera vez)
./scripts/prod/deploy-production.sh

# O con opciones específicas
./scripts/prod/deploy-production.sh --help           # Ver ayuda
./scripts/prod/deploy-production.sh --skip-cleanup  # Re-deployment rápido
./scripts/prod/deploy-production.sh --skip-ssl      # Sin SSL
```

## 📊 ¿Qué hace el Script Automático?

El script `deploy-production.sh` ejecuta estos pasos automáticamente:

### 🧹 **Paso 1: Limpieza del Sistema**
- Libera espacio en disco
- Limpia logs antiguos
- Optimiza memoria
- Elimina containers Docker antiguos

### 📦 **Paso 2: Instalación de Dependencias**
- Actualiza Ubuntu
- Instala Docker & Docker Compose
- Instala Node.js 20 y Python 3
- Configura Nginx y Certbot
- Configura firewall

### 🗄️ **Paso 3: Base de Datos**
- Configura SQLite de producción
- Ejecuta migraciones Django
- Crea usuario administrador
- Recopila archivos estáticos

### ⚛️ **Paso 4: Frontend Build**
- Instala dependencias React
- Ejecuta build optimizado para producción
- Configura variables de entorno correctas

### 🔒 **Paso 5: SSL y Dominio**
- Obtiene certificados Let's Encrypt
- Configura Nginx con SSL
- Configura redirecciones HTTPS
- Programa renovación automática

### 🚀 **Paso 6: Inicio de Servicios**
- Inicia containers Docker en producción
- Verifica salud de servicios
- Configura monitoreo

## 🌐 Acceso a la Aplicación

Una vez completado el deployment:

- **🏠 Sitio Web:** https://www.xn--elfogndedonsoto-zrb.com
- **🔧 Admin Django:** https://www.xn--elfogndedonsoto-zrb.com/admin/
- **📊 API:** https://www.xn--elfogndedonsoto-zrb.com/api/v1/

### 🔐 Credenciales de Admin
- **Usuario:** admin
- **Contraseña:** admin123
- **Email:** admin@restaurant.com

## 📊 Comandos de Monitoreo

```bash
# Estado de servicios
docker-compose -f docker-compose.production.yml ps

# Ver logs en tiempo real
docker-compose -f docker-compose.production.yml logs -f

# Monitoreo del sistema
./monitor-services.sh

# Reiniciar servicios
docker-compose -f docker-compose.production.yml restart

# Detener servicios
docker-compose -f docker-compose.production.yml down

# Iniciar servicios
docker-compose -f docker-compose.production.yml up -d
```

## 🔧 Re-Deployment (Actualizaciones)

Para actualizaciones posteriores:

```bash
# En el servidor EC2
cd /home/ubuntu/restaurant-web
git pull origin main

# Re-deployment rápido (omite limpieza y SSL)
./scripts/prod/deploy-production.sh --skip-cleanup --skip-ssl
```

## 🚨 Solución de Problemas

### Problem: "Certificado SSL falló"
```bash
# Verificar DNS
dig +short www.xn--elfogndedonsoto-zrb.com
nslookup www.xn--elfogndedonsoto-zrb.com

# Reintentar SSL manualmente
sudo certbot certonly --webroot -w /var/www/certbot -d xn--elfogndedonsoto-zrb.com -d www.xn--elfogndedonsoto-zrb.com
```

### Problema: "Servicios no responden"
```bash
# Ver logs
docker-compose -f docker-compose.production.yml logs

# Verificar recursos
free -h
df -h

# Reiniciar servicios
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d
```

### Problema: "Frontend no carga"
```bash
# Verificar build
ls -la frontend/dist/

# Reconstruir frontend
./scripts/prod/04-build-frontend.sh
```

## 📝 Logs Importantes

- **Deployment:** `/tmp/restaurant-deployment-[fecha].log`
- **Nginx:** `docker-compose logs restaurant-web-nginx`
- **Backend:** `docker-compose logs restaurant-web-backend`
- **Sistema:** `/var/log/nginx/` y `journalctl -u nginx`

## 🔄 Backup y Mantenimiento

### Backup de Base de Datos
```bash
# Backup automático (se crea antes de cada deployment)
ls -la data/restaurant.prod.sqlite3.backup.*

# Backup manual
cp data/restaurant.prod.sqlite3 data/backup-$(date +%Y%m%d).sqlite3
```

### Renovación SSL (automática)
Los certificados se renuevan automáticamente, pero puedes verificar:
```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

---

## 🎯 ¡Tu aplicación estará funcionando en pocos minutos!

El script automatizado se encarga de todo el proceso. Solo necesitas ejecutar:

```bash
./scripts/prod/deploy-production.sh
```

¡Y tu Restaurant Web estará funcionando en producción con SSL! 🚀