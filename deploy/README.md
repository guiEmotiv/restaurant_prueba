# Restaurant Web - Deployment Scripts

Scripts optimizados para el despliegue completo de la aplicación web de restaurante en EC2.

## 📋 Scripts Disponibles

### 1. `setup-initial.sh` (Fases 1-4)
**Setup inicial del servidor**
- 🧹 Limpieza ultra del sistema
- 🔧 Instalación de paquetes esenciales  
- ⚙️ Configuración de variables de entorno
- 🌐 Configuración de Nginx

```bash
sudo ./deploy/setup-initial.sh
```

### 2. `build-deploy.sh` (Fases 5-7)
**Build y despliegue de la aplicación**
- 🏗️ Build del frontend con Vite
- 🐳 Despliegue de containers Docker
- 💾 Configuración de base de datos
- 🔍 Verificación final

```bash
sudo ./deploy/build-deploy.sh
```

### 3. `debug-cognito-permissions.sh`
**Debug de problemas de permisos**
- 🔍 Verifica configuración de Cognito
- 🔐 Testa autenticación JWT
- 📊 Analiza logs de permisos
- ✅ Valida grupos de usuario

```bash
sudo ./deploy/debug-cognito-permissions.sh
```

## 🚀 Uso Recomendado

### Despliegue Completo desde Cero
```bash
# 1. Setup inicial (solo una vez)
sudo ./deploy/setup-initial.sh

# 2. Build y deploy (repetible)
sudo ./deploy/build-deploy.sh
```

### Debug de Problemas de Permisos
```bash
# Si aparece "Usted no tiene permiso para realizar esta acción"
sudo ./deploy/debug-cognito-permissions.sh
```

## 🔐 Configuración AWS Cognito

Los scripts están configurados para:
- **User Pool ID**: `us-west-2_bdCwF60ZI`
- **App Client ID**: `4i9hrd7srgbqbtun09p43ncfn0`
- **Región**: `us-west-2`

### Grupos de Usuario Configurados:
- **administradores**: Acceso completo a todos los módulos
- **meseros**: Estado mesas + historial + pedidos + pagos
- **cocineros**: Vista cocina + modificar estado de pedidos

## 📁 Archivos de Entorno Generados

| Archivo | Propósito | Ubicación |
|---------|-----------|-----------|
| `.env.ec2` | Configuración principal | `/opt/restaurant-web/` |
| `backend/.env` | Variables backend | `/opt/restaurant-web/backend/` |
| `frontend/.env.production` | Variables frontend | `/opt/restaurant-web/frontend/` |

## 🌐 URLs de la Aplicación

- **Frontend**: http://xn--elfogndedonsoto-zrb.com
- **API**: http://xn--elfogndedonsoto-zrb.com/api/v1/
- **Admin**: http://xn--elfogndedonsoto-zrb.com/api/v1/admin/

## 🔧 Comandos de Mantenimiento

```bash
# Ver logs del backend
docker-compose -f docker-compose.ec2.yml logs web

# Reiniciar servicios
docker-compose -f docker-compose.ec2.yml restart

# Ver estado de containers
docker-compose -f docker-compose.ec2.yml ps

# Ver variables de entorno del container
docker-compose -f docker-compose.ec2.yml exec web env | grep COGNITO
```

## 📊 Optimizaciones Implementadas

### Espacio en Disco
- ✅ Limpieza ultra de paquetes innecesarios
- ✅ Eliminación de caches y logs antiguos
- ✅ Optimización de Docker images
- ✅ Remoción de dependencias de desarrollo post-build

### Rendimiento
- ✅ Nginx optimizado para aplicación SPA
- ✅ Configuración CORS eficiente
- ✅ Build production de Vite optimizado
- ✅ Static files caching

### Seguridad
- ✅ Archivos .env con permisos restrictivos (600)
- ✅ Headers de seguridad en Nginx
- ✅ Autenticación JWT con AWS Cognito
- ✅ Permisos granulares por grupo de usuario

## 🚨 Troubleshooting

### Error: "Usted no tiene permiso para realizar esta acción"

**Posibles causas:**
1. Usuario no está en el grupo correcto en AWS Cognito
2. JWT token no contiene el claim 'cognito:groups'
3. Configuración de permisos incorrecta

**Solución:**
```bash
# 1. Ejecutar debug
sudo ./deploy/debug-cognito-permissions.sh

# 2. Verificar grupos en AWS Cognito Console
# 3. Comprobar JWT token en browser DevTools
```

### Error: API devuelve 500 Internal Server Error

**Solución:**
```bash
# Ver logs detallados
docker-compose -f docker-compose.ec2.yml logs web --tail=100

# Verificar configuración
docker-compose -f docker-compose.ec2.yml exec web python manage.py check
```

### Error: Frontend no carga datos

**Solución:**
```bash
# Verificar variables de entorno frontend
cat /opt/restaurant-web/frontend/.env.production

# Rebuild frontend si es necesario
sudo ./deploy/build-deploy.sh
```

## 📝 Notas Importantes

- **Requiere Ubuntu 20.04+ con Docker y Docker Compose**
- **Ejecutar siempre como root (sudo)**
- **Los scripts son idempotentes (se pueden ejecutar múltiples veces)**
- **El sistema usa SQLite para simplicidad en producción**
- **No crea usuarios de prueba - usa AWS Cognito exclusivamente**