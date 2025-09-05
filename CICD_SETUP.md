# CI/CD Setup Guide

Este documento explica cómo configurar el pipeline completo de CI/CD para el sistema de restaurante.

## Arquitectura del Pipeline

```
┌──────────────┐
│   Laptop      │
│  (docker-dev) │
└───────┬──────┘
        │ git push dev
        ▼
┌─────────────────────┐
│ GitHub Actions       │
│ Workflow: ci-dev.yml │
│  - tests             │
│  - lint              │
│  - build (no deploy) │
└─────────┬───────────┘
          │ Pull Request → main
          ▼
┌───────────────────────┐
│ GitHub Actions         │
│ Workflow: deploy-prod  │
│  - tests               │
│  - build & docker push │
│  - ssh → EC2           │
│  - docker-compose up   │
└─────────┬─────────────┘
          ▼
┌───────────────────────────┐
│   EC2 (docker-compose)    │
│   - Backend (Django/DRF)  │
│   - Frontend (React/Vite) │
│   - Nginx + SSL (Let'sEnc)│
└───────────────────────────┘
                │
                ▼
        🌍 https://tudominio.com
```

## GitHub Secrets Requeridos

Debes configurar los siguientes secrets en tu repositorio de GitHub (Settings → Secrets and variables → Actions):

### 🔐 Servidor EC2
```
EC2_PROD_HOST=tu-dominio.com o IP
EC2_USERNAME=ubuntu  
EC2_SSH_PORT=22
EC2_SSH_PRIVATE_KEY=-----BEGIN OPENSSH PRIVATE KEY-----
...tu clave privada SSH...
-----END OPENSSH PRIVATE KEY-----
```

### 🌐 Dominio 
```
DOMAIN_NAME=tudominio.com
```

### 🔑 Django
```
DJANGO_SECRET_KEY=tu-django-secret-key-muy-segura-aqui
```

### ☁️ AWS (opcional - ya tienes configurados)
```
COGNITO_USER_POOL_ID=us-west-2_xxxxxxxxx
COGNITO_APP_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_DISABLE_COGNITO=false (opcional, por defecto es false)
```

## Configuración Inicial del Servidor EC2

### 1. Preparar el servidor

```bash
# Conectar al servidor (usando tu configuración)
ssh -p 22 ubuntu@tu-dominio.com

# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
newgrp docker

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Configurar el dominio

```bash
# Asegúrate de que tu dominio apunte a la IP del EC2
# Configura los DNS A records:
# tudominio.com → IP_DE_TU_EC2
```

### 3. Inicializar SSL (primera vez)

```bash
# En el servidor EC2, ejecutar una sola vez
export DOMAIN=tudominio.com

# Crear directorios
sudo mkdir -p /opt/restaurant-web
sudo chown ubuntu:ubuntu /opt/restaurant-web
cd /opt/restaurant-web

# Copiar script de inicialización (o descargarlo del repo)
# Ejecutar inicialización SSL
./init-letsencrypt.sh
```

## Flujo de Trabajo

### Desarrollo (Rama `dev`)

1. **Desarrollo local**:
   ```bash
   git checkout dev
   # Hacer cambios
   git add .
   git commit -m "feat: nueva funcionalidad"
   git push origin dev
   ```

2. **CI Automático**:
   - ✅ Tests backend (Django)
   - ✅ Tests frontend (React)
   - ✅ Linting (ESLint)
   - ✅ Build validation (Docker)
   - ✅ Security scan

3. **Pull Request**:
   ```bash
   # Crear PR de dev → main
   gh pr create --title "Release v1.2.3" --base main --head dev
   ```

### Producción (Rama `main`)

1. **Merge a main**:
   - Al hacer merge o push directo a `main`
   - Se ejecuta automáticamente el deployment

2. **Deploy Automático**:
   - ✅ Tests completos
   - 🐳 Build & push Docker image
   - 🚀 Deploy a EC2
   - 🔍 Health checks
   - ✅ Verificación final

## Monitoreo y Logs

### Ver logs en producción

```bash
# Conectar al servidor
ssh -p 22 ubuntu@tudominio.com

# Ver logs de la aplicación
cd /opt/restaurant-web
docker-compose logs -f restaurant-web-app

# Ver logs de nginx
docker-compose logs -f nginx

# Ver logs de certificados SSL
docker-compose logs -f certbot
```

### Health checks

- **API Health**: https://tudominio.com/api/v1/health/
- **Nginx Health**: https://tudominio.com/health

## Comandos Útiles

### Desarrollo local

```bash
# Frontend
cd frontend
npm run dev          # Servidor desarrollo
npm run test:watch   # Tests en vivo
npm run lint:fix     # Fix linting

# Backend  
cd backend
python manage.py runserver    # Servidor desarrollo
python manage.py test         # Tests
python manage.py migrate      # Migraciones
```

### Producción

```bash
# Conectar y navegar al directorio
ssh -p 22 ubuntu@tu-dominio.com
cd /opt/restaurant-web

# Reiniciar servicios
docker-compose restart

# Ver estado
docker-compose ps

# Actualizar imagen (manual)
docker-compose pull restaurant-web-app
docker-compose up -d restaurant-web-app

# Backup base de datos
docker-compose exec restaurant-web-app python manage.py dumpdata > backup.json
```

## Troubleshooting

### Error de certificado SSL

```bash
# Renovar certificado manualmente
docker-compose exec certbot certbot renew

# Re-inicializar certificado
export DOMAIN=tudominio.com EMAIL=tu-email@example.com
./init-letsencrypt.sh
```

### Error en deployment

```bash
# Ver logs de GitHub Actions
# Ir a: github.com/tu-usuario/restaurant-web/actions

# Rollback manual (en EC2)
cd /opt/restaurant-web
docker-compose down
docker-compose up -d --force-recreate
```

### Problemas de permisos

```bash
# En EC2, arreglar permisos
sudo chown -R ubuntu:ubuntu /opt/restaurant-web
chmod +x /opt/restaurant-web/init-letsencrypt.sh
```

## Notas de Seguridad

- ✅ SSL/TLS con Let's Encrypt (auto-renovación)
- ✅ Rate limiting en Nginx
- ✅ Headers de seguridad
- ✅ Container non-root user
- ✅ Secrets en GitHub (no en código)
- ✅ Health checks y monitoreo

## Manual de Deployment Forzado

Si necesitas hacer un deployment aunque los tests fallen:

```bash
# En GitHub, ir a Actions → Deploy to Production
# Click en "Run workflow"
# Marcar "Force deployment even if tests fail"
# Click "Run workflow"
```

¡Tu pipeline CI/CD está listo! 🚀