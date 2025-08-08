# EC2 Deployment Guide

## Quick Frontend Fix

Si el frontend no está visible en EC2, ejecuta estos comandos:

```bash
# En EC2, ir al directorio del proyecto
cd /opt/restaurant-web

# Hacer pull de los últimos cambios
git pull origin main

# Construir y desplegar el frontend
sudo ./deploy/frontend-build.sh

# O desplegar completo (backend + frontend)
sudo ./deploy/build-deploy.sh
```

## Estructura de Despliegue

El despliegue en EC2 utiliza docker-compose con dos servicios:

1. **web**: Django backend (puerto 8000 interno)
2. **nginx**: Proxy reverso y servidor de archivos estáticos (puerto 80)

### Configuración nginx

- Sirve el frontend desde `/var/www/html` (montado desde `./frontend/dist`)
- Proxy para API requests a `/api/` → `http://web:8000`
- Headers CORS configurados
- Archivos estáticos de Django servidos

### Estructura de archivos

```
/opt/restaurant-web/
├── frontend/dist/          # Build del frontend (servido por nginx)
├── backend/               # Django application
├── deploy/
│   ├── nginx.conf         # Configuración nginx
│   ├── build-deploy.sh    # Script completo de despliegue
│   └── frontend-build.sh  # Script solo para frontend
└── docker-compose.ec2.yml # Configuración docker para EC2
```

## Scripts Disponibles

### 1. Despliegue Completo
```bash
sudo ./deploy/build-deploy.sh
```
- Construye el frontend
- Despliega backend + nginx
- Configura base de datos
- Ejecuta migraciones

### 2. Solo Frontend
```bash
sudo ./deploy/frontend-build.sh
```
- Construye el frontend
- Reinicia nginx
- Verifica acceso

## Verificación

Después del despliegue, verifica:

1. **Frontend**: `http://elfogóndedonsoto.com`
2. **API**: `http://elfogóndedonsoto.com/api/v1/zones/`
3. **Containers**: `docker-compose -f docker-compose.ec2.yml ps`

## Troubleshooting

### Frontend no carga
```bash
# Ver logs de nginx
docker-compose -f docker-compose.ec2.yml logs nginx

# Verificar archivos del frontend
ls -la frontend/dist/

# Reconstruir frontend
sudo ./deploy/frontend-build.sh
```

### API no responde
```bash
# Ver logs del backend
docker-compose -f docker-compose.ec2.yml logs web

# Reiniciar backend
docker-compose -f docker-compose.ec2.yml restart web
```

### Containers no arrancan
```bash
# Ver estado
docker-compose -f docker-compose.ec2.yml ps

# Ver logs
docker-compose -f docker-compose.ec2.yml logs

# Reiniciar todo
docker-compose -f docker-compose.ec2.yml down
docker-compose -f docker-compose.ec2.yml up -d
```

## Configuración de Dominio

El dominio `elfogóndedonsoto.com` (xn--elfogndedonsoto-zrb.com) está configurado para apuntar a la IP de EC2.

### Variables de entorno importantes

**Frontend** (`.env.production`):
- `VITE_API_URL=https://www.xn--elfogndedonsoto-zrb.com`
- Configuración AWS Cognito

**Backend** (`.env.ec2`):
- Configuración Django
- Configuración AWS Cognito
- Base de datos SQLite

## Actualizaciones

Para actualizar la aplicación:

1. En el servidor de desarrollo, hacer cambios
2. Commit y push a GitHub
3. En EC2:
   ```bash
   cd /opt/restaurant-web
   git pull origin main
   sudo ./deploy/build-deploy.sh  # O solo frontend-build.sh si solo cambió frontend
   ```