# 🔐 Guía para Habilitar Login en la Aplicación

Esta guía te ayudará a configurar AWS Cognito y habilitar el sistema de login en tu aplicación de restaurant.

## 📋 Prerrequisitos

1. **Acceso a tu instancia EC2**
2. **AWS CLI instalado y configurado**
3. **Permisos de AWS para crear recursos de Cognito**

## 🚀 Paso 1: Configurar AWS CLI (Si no está configurado)

Conecta a tu EC2 y ejecuta:

```bash
# Instalar AWS CLI si no está instalado
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configurar AWS CLI con tus credenciales
aws configure
```

Proporciona:
- **AWS Access Key ID**: Tu clave de acceso
- **AWS Secret Access Key**: Tu clave secreta
- **Default region name**: `us-east-1`
- **Default output format**: `json`

## 🔧 Paso 2: Configurar AWS Cognito Automáticamente

En tu EC2, ejecuta el script de configuración:

```bash
cd /opt/restaurant-web

# Hacer el script ejecutable
chmod +x setup-cognito-complete.sh

# Ejecutar la configuración completa de Cognito
./setup-cognito-complete.sh
```

Este script:
- ✅ Crea un User Pool en AWS Cognito
- ✅ Configura los grupos "administradores" y "meseros"
- ✅ Crea usuarios "admin" y "mesero01"
- ✅ Genera archivos de configuración

## 📁 Paso 3: Aplicar las Configuraciones Generadas

Después de ejecutar el script anterior:

```bash
# Aplicar la configuración del backend
mv .env.ec2.new .env.ec2

# Aplicar la configuración del frontend
mv frontend/.env.production.new frontend/.env.production

# Verificar las configuraciones
echo "🔍 Backend configuration:"
grep "COGNITO" .env.ec2

echo "🔍 Frontend configuration:"
grep "COGNITO" frontend/.env.production
```

## 🔐 Paso 4: Habilitar Autenticación

Ejecuta el script para habilitar el login:

```bash
# Hacer el script ejecutable
chmod +x enable-auth-ec2.sh

# Habilitar autenticación
sudo ./enable-auth-ec2.sh
```

Este script:
- ✅ Habilita `USE_COGNITO_AUTH=True`
- ✅ Actualiza el frontend para requerir login
- ✅ Reconstruye la aplicación con autenticación
- ✅ Reinicia los contenedores Docker

## 👥 Paso 5: Probar el Login

Accede a tu aplicación:
- **URL**: `http://TU-IP-EC2/`
- **Usuarios disponibles**:

### Usuario Administrador
- **Username**: `admin`
- **Password**: `AdminPass123!`
- **Acceso**: Completo al sistema

### Usuario Mesero
- **Username**: `mesero01`
- **Password**: `MeseroPass123!`
- **Acceso**: Vista de mesas y pedidos

## 🔧 Configuración Manual (Si los scripts fallan)

### Configurar .env.ec2 manualmente:

```bash
nano .env.ec2
```

Actualizar con:
```
USE_COGNITO_AUTH=True
AWS_REGION=us-east-1
COGNITO_USER_POOL_ID=tu-user-pool-id
COGNITO_APP_CLIENT_ID=tu-app-client-id
```

### Configurar frontend/.env.production:

```bash
nano frontend/.env.production
```

Actualizar con:
```
VITE_AWS_REGION=us-east-1
VITE_AWS_COGNITO_USER_POOL_ID=tu-user-pool-id
VITE_AWS_COGNITO_APP_CLIENT_ID=tu-app-client-id
```

### Habilitar autenticación en App.jsx:

```bash
nano frontend/src/App.jsx
```

Cambiar:
```javascript
const isCognitoConfigured = false;
```

Por:
```javascript
const isCognitoConfigured = true;
```

## 🔍 Verificar que Funciona

1. **Acceder a la aplicación** - Debe mostrar pantalla de login
2. **Login como admin** - Debe redirigir al dashboard
3. **Login como mesero01** - Debe redirigir a vista de mesas
4. **Logout** - Debe regresar al login

## 🆘 Solución de Problemas

### Error: "Las credenciales de autenticación no se proveyeron"
- Verificar que `USE_COGNITO_AUTH=True` en .env.ec2
- Verificar que los valores de Cognito sean reales (no placeholders)
- Reiniciar contenedores: `sudo ./enable-auth-ec2.sh`

### Error: "Invalid username or password"  
- Verificar que los usuarios existan en AWS Cognito Console
- Verificar las contraseñas: `AdminPass123!` y `MeseroPass123!`

### Error: "Token expired"
- Los usuarios pueden estar en estado FORCE_CHANGE_PASSWORD
- Cambiar contraseña en primer login

## 📞 Comandos Útiles

```bash
# Ver estado de la aplicación
sudo ./deploy/ec2-deploy.sh status

# Ver logs si hay problemas  
sudo ./deploy/ec2-deploy.sh logs

# Reiniciar aplicación
sudo ./deploy/ec2-deploy.sh restart

# Verificar configuración de Cognito
aws cognito-idp list-user-pools --max-items 10

# Verificar usuarios
aws cognito-idp list-users --user-pool-id TU-USER-POOL-ID
```

## ✅ Resultado Final

Después de seguir esta guía:
- ✅ **Login funcional** con AWS Cognito
- ✅ **Usuario admin** con acceso completo
- ✅ **Usuario mesero01** con acceso limitado
- ✅ **Seguridad habilitada** para todas las rutas
- ✅ **Tokens JWT** validados por el backend

¡Tu aplicación ahora tiene un sistema de login completo y seguro! 🎉