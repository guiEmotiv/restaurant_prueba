# 🔐 Configuración de AWS Cognito para Autenticación

## ✅ Configuración Completada

La aplicación ya está configurada para usar AWS Cognito. Solo necesitas completar la configuración con tus credenciales reales.

## 🔄 Modo Sin Autenticación (Temporal)

Por defecto, la aplicación está configurada para funcionar **SIN autenticación** para facilitar las pruebas. Para activar AWS Cognito, cambia `USE_COGNITO_AUTH=True` en `.env.ec2`.

## 📋 Pasos para Activar la Autenticación

### 1. Configurar Variables de Entorno en EC2

Edita el archivo `.env.ec2` con tus credenciales reales de AWS Cognito:

```bash
# En tu servidor EC2
nano /path/to/your/project/.env.ec2

# Actualiza estos valores:
USE_COGNITO_AUTH=True  # Activar autenticación
AWS_REGION=us-east-1
COGNITO_USER_POOL_ID=tu-user-pool-id-real
COGNITO_APP_CLIENT_ID=tu-app-client-id-real
```

### 2. Configurar Variables de Frontend

Edita el archivo `frontend/.env.production` con las mismas credenciales:

```bash
VITE_AWS_REGION=us-east-1
VITE_AWS_COGNITO_USER_POOL_ID=tu-user-pool-id-real
VITE_AWS_COGNITO_APP_CLIENT_ID=tu-app-client-id-real
```

### 3. Verificar Configuración de User Pool

Asegúrate de que tu User Pool tenga:

**Grupos:**
- `administradores` (para usuarios admin)
- `meseros` (para usuarios meseros)

**Usuarios:**
- `admin` (miembro del grupo `administradores`)
- `mesero01` (miembro del grupo `meseros`)

### 4. Rebuild y Deploy

```bash
# Rebuild del frontend con nuevas variables
cd frontend
npm run build

# Redeploy en EC2
./deploy/ec2-deploy.sh
```

## 🛡️ Funcionalidades de Seguridad

### Backend
- ✅ Middleware de autenticación AWS Cognito
- ✅ Verificación de tokens JWT
- ✅ Validación de grupos de usuario
- ✅ Endpoints protegidos por defecto

### Frontend
- ✅ Integración con AWS Amplify
- ✅ Context de autenticación
- ✅ Rutas protegidas
- ✅ Manejo de roles y permisos

## 🔍 Permisos por Rol

### Administradores
- ✅ Dashboard completo
- ✅ Gestión de configuración
- ✅ Gestión de inventario
- ✅ Gestión de órdenes
- ✅ Vista de cocina
- ✅ Estado de mesas
- ✅ Gestión de pagos
- ✅ Historial completo

### Meseros
- ❌ Dashboard (sin acceso)
- ❌ Configuración (sin acceso)
- ❌ Inventario (sin acceso)
- ✅ Gestión de órdenes
- ❌ Vista de cocina (sin acceso)
- ✅ Estado de mesas
- ✅ Gestión de pagos
- ❌ Historial (sin acceso)

## 🚀 Próximos Pasos

1. **Actualizar credenciales**: Reemplaza los valores de ejemplo con tus credenciales reales
2. **Desplegar**: Ejecuta el script de deploy para aplicar los cambios
3. **Probar**: Verifica que la autenticación funcione con usuarios `admin` y `mesero01`

## 🔧 Troubleshooting

Si encuentras problemas:

1. **Verificar logs del backend**: `docker-compose logs web`
2. **Verificar console del navegador**: Errores de autenticación
3. **Verificar configuración**: User Pool, grupos y usuarios en AWS Console
4. **Verificar variables**: `.env.ec2` y `.env.production` coinciden

La aplicación ahora está completamente configurada para usar AWS Cognito! 🎉