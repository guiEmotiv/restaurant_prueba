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

### 2. Configurar archivo .env.ec2

**IMPORTANTE**: El sistema ahora usa un archivo `.env.ec2` en tu EC2 para las configuraciones.

```bash
# 1. Copiar template desde tu máquina local
scp .env.ec2.example ubuntu@your-ec2-ip:/opt/restaurant-web/.env.ec2

# 2. Editar configuración en EC2
ssh ubuntu@your-ec2-ip
nano /opt/restaurant-web/.env.ec2
```

**Configuración mínima requerida en .env.ec2:**
```bash
DJANGO_SECRET_KEY=tu-clave-secreta-muy-segura
DEBUG=False
ALLOWED_HOSTS=tu-dominio.com,tu-ip-ec2
EC2_PUBLIC_IP=tu-ip-ec2-publica
TIME_ZONE=America/Lima
LANGUAGE_CODE=es-pe
```

### 3. Configurar variables locales

```bash
# En tu máquina local, exportar la IP de EC2
export EC2_HOST=your-ec2-public-ip.amazonaws.com
```

## 🚢 Deployment

### **Opción 1: Desde tu máquina local (Recomendado)**

```bash
# Desde el directorio raíz del proyecto en tu máquina local
EC2_HOST=your-ec2-ip.amazonaws.com ./deploy/ec2-deploy.sh deploy
```

**Comandos disponibles desde tu máquina local:**
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

### **Opción 2: Desde dentro de EC2**

Si ya estás conectado por SSH a tu EC2, puedes usar comandos locales:

```bash
# Conectar a EC2
ssh ubuntu@your-ec2-ip
cd /opt/restaurant-web

# Comandos disponibles dentro de EC2:
./deploy/local-commands.sh start     # Construir e iniciar aplicación
./deploy/local-commands.sh status    # Ver estado
./deploy/local-commands.sh logs      # Ver logs
./deploy/local-commands.sh restart   # Reiniciar
./deploy/local-commands.sh stop      # Parar
./deploy/local-commands.sh backup    # Crear backup

# Comandos adicionales usando .env.ec2:
./deploy/local-commands.sh info      # Mostrar configuración actual del sistema
./deploy/local-commands.sh urls      # Mostrar URLs de acceso (usando EC2_PUBLIC_IP)
./deploy/local-commands.sh test      # Probar conectividad a todos los endpoints
```

### **Comandos avanzados con .env.ec2**

Los nuevos comandos `info`, `urls` y `test` aprovechan las variables configuradas en tu archivo `.env.ec2`:

```bash
# Ver configuración completa del sistema
./deploy/local-commands.sh info
# Muestra: DEBUG, ALLOWED_HOSTS, EC2_PUBLIC_IP, DOMAIN_NAME, etc.

# Obtener URLs de acceso usando tu IP configurada
./deploy/local-commands.sh urls
# Muestra: Frontend, Backend API, Admin URLs usando EC2_PUBLIC_IP

# Probar conectividad completa
./deploy/local-commands.sh test
# Prueba: Docker containers, localhost, IP pública, dominio (si está configurado)
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

- **Base de datos SQLite**: `/opt/restaurant-web/data/restaurant.sqlite3`
- **Archivos media**: `/opt/restaurant-web/data/media/`
- **Logs**: `/opt/restaurant-web/data/logs/`
- **Backups**: `/opt/restaurant-web/data/backups/`
- **Configuración**: `/opt/restaurant-web/.env.ec2` (mantenido entre deployments)

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

### Problemas con .env.ec2:
```bash
# Verificar que existe el archivo
ssh ubuntu@your-ec2-ip "ls -la /opt/restaurant-web/.env.ec2"

# Ver contenido (sin mostrar valores secretos)
ssh ubuntu@your-ec2-ip "grep -E '^[A-Z_]+=' /opt/restaurant-web/.env.ec2 | sed 's/=.*/=***/' "
```

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

### Error común: ".env.ec2 file not found"
```bash
# Crear archivo desde template
scp .env.ec2.example ubuntu@your-ec2-ip:/opt/restaurant-web/.env.ec2
ssh ubuntu@your-ec2-ip
nano /opt/restaurant-web/.env.ec2  # Editar configuración
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