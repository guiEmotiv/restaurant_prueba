# 🚨 CONFIGURACIÓN URGENTE: AWS Cognito

## Estado Actual del Problema

❌ **Error actual**: "Las credenciales de autenticación no se proveyeron" (403 Forbidden)
❌ **Causa**: Variables de AWS Cognito no configuradas con valores reales
✅ **Solución**: Completar configuración de AWS Cognito

## 🔑 Variables que DEBES Configurar AHORA

### 1. Backend (.env en directorio raíz)
```bash
# Líneas 66-67 en .env
COGNITO_USER_POOL_ID=us-east-1_TU_POOL_ID_REAL_AQUI
COGNITO_APP_CLIENT_ID=TU_CLIENT_ID_REAL_AQUI
```

### 2. Frontend (frontend/.env.production)
```bash
# Líneas 5-6 en frontend/.env.production  
VITE_AWS_COGNITO_USER_POOL_ID=us-east-1_TU_POOL_ID_REAL_AQUI
VITE_AWS_COGNITO_APP_CLIENT_ID=TU_CLIENT_ID_REAL_AQUI
```

## 📋 Cómo Obtener los Valores Reales

### Opción A: Si YA tienes AWS Cognito configurado
1. Ve a AWS Console → Cognito → User Pools
2. Selecciona tu User Pool
3. Copia el **User Pool ID** (formato: us-east-1_XXXXXXXXX)
4. Ve a "App integration" → tu App Client  
5. Copia el **Client ID** (formato: 26 caracteres alfanuméricos)

### Opción B: Si AÚN NO tienes AWS Cognito
1. Sigue la guía completa en `COGNITO-SETUP.md`
2. Crea User Pool, App Client, grupos y usuarios
3. Obtén los valores como en Opción A

## ⚡ Pasos Inmediatos (5 minutos)

```bash
# 1. Editar backend
nano .env
# Cambiar líneas 66-67 con tus valores reales

# 2. Editar frontend  
nano frontend/.env.production
# Cambiar líneas 5-6 con tus valores reales

# 3. Commit y push
git add -A
git commit -m "🔐 Configurar variables reales de AWS Cognito"
git push origin main

# 4. Rebuild y deploy en EC2
# (En tu servidor EC2)
git pull origin main
sudo ./deploy/ec2-deploy.sh deploy
```

## 🎯 Resultado Esperado

Después de la configuración:
✅ Login de AWS Cognito aparece
✅ Usuarios pueden autenticarse
✅ Datos se cargan según roles (admin/mesero)
✅ No más errores 403

## 📞 Si Necesitas Ayuda

Si no tienes los valores de Cognito:
1. Compárteme que necesitas crear AWS Cognito desde cero
2. Te guío paso a paso para crear User Pool
3. Configuramos usuarios admin/mesero

**IMPORTANTE**: Sin estos valores reales, la aplicación no funcionará en producción.