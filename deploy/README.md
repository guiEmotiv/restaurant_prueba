# 🚀 EC2 Deployment Guide - Restaurant Management System

Guía simplificada para desplegar el sistema de gestión de restaurante en EC2 **sin autenticación**.

## 📋 Prerequisitos

### En tu máquina local:
- Git configurado con acceso al repositorio
- SSH configurado para conectar a EC2

### En la instancia EC2:
- Ubuntu 20.04 LTS o superior
- Docker y Docker Compose instalados
- Puerto 80 y 8000 abiertos en Security Groups

## ⚙️ Configuración Inicial EC2

### 1. Preparar la instancia EC2

```bash
# Conectar a EC2
ssh ubuntu@your-ec2-ip

# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker ubuntu
sudo systemctl enable docker
sudo systemctl start docker

# Crear directorio de aplicación
sudo mkdir -p /opt/restaurant-web
sudo chown ubuntu:ubuntu /opt/restaurant-web
```

### 2. Configurar variables de entorno

```bash
# En tu máquina local, exportar la IP de EC2
export EC2_HOST=your-ec2-public-ip.amazonaws.com
```

## 🚢 Deployment

### Despliegue inicial

```bash
# Desde el directorio raíz del proyecto en tu máquina local
EC2_HOST=your-ec2-ip.amazonaws.com ./deploy/ec2-deploy.sh deploy
```

### Comandos disponibles

```bash
# Desplegar aplicación
EC2_HOST=your-ec2-ip ./deploy/ec2-deploy.sh deploy

# Ver estado de la aplicación
EC2_HOST=your-ec2-ip ./deploy/ec2-deploy.sh status

# Ver logs de la aplicación
EC2_HOST=your-ec2-ip ./deploy/ec2-deploy.sh logs

# Reiniciar aplicación
EC2_HOST=your-ec2-ip ./deploy/ec2-deploy.sh restart

# Parar aplicación
EC2_HOST=your-ec2-ip ./deploy/ec2-deploy.sh stop

# Crear backup de base de datos
EC2_HOST=your-ec2-ip ./deploy/ec2-deploy.sh backup
```

## 📦 Arquitectura de Deployment

```
┌─────────────────────────────────────────────────────────┐
│                        EC2 Instance                     │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌────────────────┐  ┌──────────────┐ │
│  │    Nginx    │  │   Django API   │  │   SQLite     │ │
│  │  (Port 80)  │  │  (Port 8000)   │  │  Database    │ │
│  │             │  │                │  │              │ │
│  │ ┌─────────┐ │  │ ┌────────────┐ │  │ ┌──────────┐ │ │
│  │ │Frontend │ │  │ │ REST API   │ │  │ │ Data     │ │ │
│  │ │ React   │ │  │ │ DRF        │ │  │ │ Volume   │ │ │
│  │ └─────────┘ │  │ └────────────┘ │  │ └──────────┘ │ │
│  └─────────────┘  └────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 🔧 Configuración

### Variables de entorno importantes:

- `EC2_HOST`: IP pública de tu instancia EC2
- `DJANGO_SECRET_KEY`: Clave secreta para Django (configurar en producción)
- `DEBUG`: False en producción

### Persistencia de datos:

- Base de datos SQLite: `/opt/restaurant-web/data/restaurant.sqlite3`
- Archivos media: `/opt/restaurant-web/data/media/`
- Logs: `/opt/restaurant-web/data/logs/`
- Backups: `/opt/restaurant-web/data/backups/`

## 🌐 Acceso

Una vez desplegado, la aplicación estará disponible en:

- **Frontend**: `http://your-ec2-ip/`
- **Backend API**: `http://your-ec2-ip/api/v1/`
- **Admin Django**: `http://your-ec2-ip/api/v1/admin/`
- **API Docs**: `http://your-ec2-ip/api/v1/docs/`

## 🛡️ Seguridad

**⚠️ IMPORTANTE**: Esta configuración **NO incluye autenticación**. La aplicación es completamente abierta.

Para uso en producción, considera:
- Configurar HTTPS con Let's Encrypt
- Restringir acceso por IP
- Implementar rate limiting
- Configurar firewall apropiado

## 🔍 Troubleshooting

### Verificar estado de contenedores:
```bash
ssh ubuntu@your-ec2-ip
cd /opt/restaurant-web
docker-compose -f docker-compose.ec2.yml ps
```

### Ver logs detallados:
```bash
ssh ubuntu@your-ec2-ip
cd /opt/restaurant-web
docker-compose -f docker-compose.ec2.yml logs --tail=100
```

### Reiniciar servicios:
```bash
ssh ubuntu@your-ec2-ip
cd /opt/restaurant-web
docker-compose -f docker-compose.ec2.yml restart
```

### Verificar conectividad:
```bash
# Desde tu máquina local
curl http://your-ec2-ip/api/v1/categories/
```

## 📊 Monitoreo

### Health checks automáticos:
- El contenedor Django incluye health checks
- Nginx sirve contenido estático eficientemente
- SQLite almacena datos persistentemente

### Backups automáticos:
```bash
# Crear backup manual
EC2_HOST=your-ec2-ip ./deploy/ec2-deploy.sh backup

# Los backups se almacenan en /opt/restaurant-web/data/backups/
```

## 🔄 Actualizaciones

Para actualizar la aplicación:

```bash
# 1. Hacer pull de cambios localmente
git pull origin main

# 2. Redesplegar
EC2_HOST=your-ec2-ip ./deploy/ec2-deploy.sh deploy
```

## 📞 Soporte

Si encuentras problemas:

1. Verifica que Docker esté corriendo en EC2
2. Confirma que los puertos estén abiertos en Security Groups
3. Revisa los logs con el comando `logs`
4. Verifica la conectividad de red

---

**🎉 ¡Tu sistema de gestión de restaurante está listo para usar!**