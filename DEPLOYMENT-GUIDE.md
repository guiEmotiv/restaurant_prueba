# 🚀 Guía de Despliegue en Producción - EC2

**Sistema de Gestión de Restaurante - Despliegue Simple con EC2 + SQLite + Docker**

## 📋 Procedimiento Completo de Despliegue

### 1️⃣ Preparar Instancia EC2

```bash
# Crear instancia EC2 en AWS Console
# - AMI: Ubuntu 22.04 LTS
# - Tipo: t3.micro (free tier)
# - Security Groups: 22 (SSH), 80 (HTTP), 8000 (App)
# - Key Pair: Crear o usar existente
```

### 2️⃣ Conectar y Configurar Servidor

```bash
# Conectar a la instancia
ssh -i tu-clave.pem ubuntu@tu-ec2-ip

# Clonar el repositorio
sudo mkdir -p /opt/restaurant-app
sudo chown ubuntu:ubuntu /opt/restaurant-app
cd /opt/restaurant-app
git clone https://github.com/tu-usuario/restaurant-web .

# Configurar servidor automáticamente
sudo ./deploy/ec2-setup.sh

# Cerrar sesión y volver a entrar (para aplicar grupo Docker)
exit
ssh -i tu-clave.pem ubuntu@tu-ec2-ip
cd /opt/restaurant-app
```

### 3️⃣ Configurar Variables de Entorno

```bash
# Copiar archivo de configuración
cp .env.ec2 .env

# Generar clave secreta de Django
python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'

# Obtener IP pública de EC2
curl -s http://169.254.169.254/latest/meta-data/public-ipv4

# Editar archivo .env
nano .env
```

**Configuración mínima requerida en .env:**
```bash
DJANGO_SECRET_KEY=tu-clave-secreta-generada
EC2_PUBLIC_IP=tu-ip-publica-ec2
DOMAIN_NAME=tu-dominio.com  # opcional
```

### 4️⃣ Desplegar Aplicación

```bash
# Despliegue completo
./deploy/ec2-deploy.sh deploy

# Validar despliegue
./deploy/ec2-deploy.sh validate

# Ver estado
./deploy/ec2-deploy.sh status
```

### 5️⃣ Crear Usuario Administrador

```bash
# Opción 1: Configurar en .env (recomendado)
echo "DJANGO_SUPERUSER_USERNAME=admin" >> .env
echo "DJANGO_SUPERUSER_EMAIL=admin@restaurant.com" >> .env
echo "DJANGO_SUPERUSER_PASSWORD=password_seguro" >> .env
./deploy/ec2-deploy.sh restart

# Opción 2: Crear manualmente
docker exec -it restaurant_web_ec2 python manage.py createsuperuser
```

## 🎯 Acceso a la Aplicación

```
📱 Aplicación:     http://tu-ec2-ip:8000/
🔧 Panel Admin:    http://tu-ec2-ip:8000/admin/
📖 API Docs:       http://tu-ec2-ip:8000/api/
```

## 🛠️ Comandos de Gestión

### Comandos Básicos
```bash
./deploy/ec2-deploy.sh deploy    # Desplegar aplicación
./deploy/ec2-deploy.sh status    # Ver estado
./deploy/ec2-deploy.sh logs      # Ver logs en tiempo real
./deploy/ec2-deploy.sh restart   # Reiniciar aplicación
./deploy/ec2-deploy.sh validate  # Validar configuración
./deploy/ec2-deploy.sh test      # Ejecutar tests
./deploy/ec2-deploy.sh backup    # Crear respaldo manual
./deploy/ec2-deploy.sh shell     # Abrir Django shell
./deploy/ec2-deploy.sh stop      # Detener aplicación
```

### Comandos de Mantenimiento
```bash
# Ver uso de recursos
docker stats

# Limpiar Docker
docker system prune -f

# Ver logs del sistema
journalctl -u docker -f

# Monitorear servidor
htop
df -h
free -h
```

## 🔍 Validación y Testing

### Verificar Instalación
```bash
# Validar todos los componentes
./deploy/ec2-deploy.sh validate

# Ejecutar tests de la aplicación
./deploy/ec2-deploy.sh test

# Verificar manualmente
curl http://tu-ec2-ip:8000/admin/
curl http://tu-ec2-ip:8000/api/
```

### Resolución de Problemas
```bash
# Ver logs detallados
./deploy/ec2-deploy.sh logs

# Verificar contenedores
docker ps -a

# Reiniciar desde cero
./deploy/ec2-deploy.sh stop
docker system prune -f
./deploy/ec2-deploy.sh deploy
```

## 📁 Estructura de Archivos

```
/opt/restaurant-app/
├── data/                   # Base de datos SQLite
├── logs/                   # Logs de aplicación
├── staticfiles/           # Archivos estáticos
├── media/                 # Archivos subidos
├── backups/              # Respaldos automáticos
├── .env                  # Configuración
├── docker-compose.ec2.yml # Docker Compose
└── deploy/               # Scripts de despliegue
    ├── ec2-setup.sh      # Configuración inicial
    └── ec2-deploy.sh     # Despliegue
```

## 💾 Respaldos

```bash
# Respaldo manual
./deploy/ec2-deploy.sh backup

# Los respaldos se guardan automáticamente en:
/opt/restaurant-app/backups/backup_YYYYMMDD_HHMMSS.tar.gz

# Restaurar respaldo (en caso necesario)
./deploy/ec2-deploy.sh stop
cp /opt/restaurant-app/backups/backup_YYYYMMDD_HHMMSS.tar.gz /tmp/
cd /tmp && tar -xzf backup_YYYYMMDD_HHMMSS.tar.gz
cp data/db.sqlite3 /opt/restaurant-app/data/
./deploy/ec2-deploy.sh deploy
```

## 🔒 Seguridad

### Configuración Básica
- Firewall configurado automáticamente (UFW)
- Fail2Ban para protección SSH
- Usuario no-root para aplicación
- Variables de entorno para credenciales

### Recomendaciones Adicionales
- Cambiar contraseñas por defecto
- Configurar SSL/HTTPS con Let's Encrypt
- Restringir acceso SSH a IPs conocidas
- Monitorear logs regularmente

## ⚡ Optimización

### Para Instancias Pequeñas (t3.micro)
- Swap configurado automáticamente (2GB)
- Límites de memoria para containers
- Limpieza automática de logs antiguos
- Optimizaciones de kernel aplicadas

### Escalamiento Futuro
- Migrar a RDS PostgreSQL
- Usar Application Load Balancer
- Implementar múltiples instancias
- Configurar Redis para cache

## 📊 Monitoreo

```bash
# Estado del sistema
./deploy/ec2-deploy.sh status

# Recursos del servidor
htop
df -h
free -h

# Logs en tiempo real
./deploy/ec2-deploy.sh logs

# Estado de Docker
docker stats --no-stream
```

## ⚠️ Notas Importantes

1. **Primer despliegue**: Puede tomar 5-10 minutos
2. **Reiniciar después de configuración**: Necesario para aplicar variables de entorno
3. **Respaldos automáticos**: Se crean antes de cada despliegue
4. **Logs**: Se rotan automáticamente (30 días)
5. **SSL**: No incluido por defecto, agregar nginx con Let's Encrypt si es necesario

## 🆘 Soporte

Si hay problemas durante el despliegue:

1. Revisar logs: `./deploy/ec2-deploy.sh logs`
2. Validar configuración: `./deploy/ec2-deploy.sh validate`
3. Verificar .env tiene valores correctos
4. Reiniciar: `./deploy/ec2-deploy.sh restart`
5. En caso extremo: re-desplegar completo

---
**¡Despliegue completado!** Tu aplicación de gestión de restaurante está lista en producción 🚀