# 🔧 Solución de Problemas de AWS Cognito en EC2

## 🚨 Problema Actual

1. **Frontend**: Amplify no puede inicializarse porque no encuentra configuración válida de Cognito
2. **Backend**: Los endpoints están protegidos y devuelven "Forbidden" 

## 🛠️ Solución Rápida (Desactivar Auth Temporalmente)

```bash
# En EC2
cd /opt/restaurant-web

# Desactivar autenticación
sudo ./deploy/toggle-auth-ec2.sh
# Seleccionar opción 2

# Reiniciar aplicación
sudo ./deploy/ec2-deploy.sh restart
```

## 🔐 Configurar Cognito Correctamente

### 1. Verificar Credenciales de Cognito

```bash
# En EC2
sudo nano /opt/restaurant-web/.env.ec2
```

Asegúrate de tener estos valores REALES (no los de ejemplo):
```env
USE_COGNITO_AUTH=True
AWS_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_TuPoolID
COGNITO_APP_CLIENT_ID=tuappclienidreal123456
```

### 2. Actualizar Frontend

```bash
# Crear/editar archivo de producción
sudo nano /opt/restaurant-web/frontend/.env.production
```

Agregar las MISMAS credenciales:
```env
VITE_AWS_REGION=us-east-1
VITE_AWS_COGNITO_USER_POOL_ID=us-east-1_TuPoolID
VITE_AWS_COGNITO_APP_CLIENT_ID=tuappclienidreal123456
```

### 3. Reconstruir Frontend

```bash
# Reconstruir con las nuevas variables
cd /opt/restaurant-web
sudo ./deploy/ec2-deploy.sh build-frontend

# Reiniciar todo
sudo ./deploy/ec2-deploy.sh restart
```

## 🧪 Verificar Configuración

### 1. Verificar Variables en el Container

```bash
# Ver variables del backend
sudo docker-compose -f docker-compose.ec2.yml exec web env | grep COGNITO

# Ver logs del backend
sudo docker-compose -f docker-compose.ec2.yml logs web | tail -50
```

### 2. Verificar Frontend Build

```bash
# Buscar las variables en el bundle
sudo grep -r "VITE_AWS_COGNITO" /opt/restaurant-web/frontend/dist/
```

## 📋 Checklist de Configuración

- [ ] User Pool creado en AWS Cognito
- [ ] App Client creado SIN secret
- [ ] Grupos creados: `administradores` y `meseros`
- [ ] Usuarios creados y asignados a grupos
- [ ] Variables en `.env.ec2` con valores reales
- [ ] Variables en `frontend/.env.production` coinciden
- [ ] Frontend reconstruido después de cambiar variables
- [ ] No hay espacios extras en las variables

## 🔍 Debugging Avanzado

### 1. Probar Token de Cognito

```bash
# Obtener token (necesitas AWS CLI configurado)
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id TU_APP_CLIENT_ID \
  --auth-parameters USERNAME=admin@restaurant.com,PASSWORD=TuPassword \
  --region us-east-1
```

### 2. Verificar JWKS Endpoint

```bash
# Debe devolver las claves públicas
curl https://cognito-idp.us-east-1.amazonaws.com/TU_USER_POOL_ID/.well-known/jwks.json
```

### 3. Test Manual del API

```bash
# Sin token (debe fallar)
curl http://44.248.47.186/api/v1/units/

# Con token (reemplazar con token real)
curl -H "Authorization: Bearer TU_TOKEN_AQUI" http://44.248.47.186/api/v1/units/
```

## 💡 Tips

1. **Siempre hacer backup** antes de cambiar configuración:
   ```bash
   sudo cp .env.ec2 .env.ec2.backup.$(date +%Y%m%d_%H%M%S)
   ```

2. **Si algo sale mal**, restaurar backup:
   ```bash
   sudo cp .env.ec2.backup.TIMESTAMP .env.ec2
   sudo ./deploy/ec2-deploy.sh restart
   ```

3. **Para desarrollo**, es OK desactivar auth temporalmente

4. **Variables comunes incorrectas**:
   - Espacios extras al copiar/pegar
   - Usar el ARN en lugar del ID
   - Mezclar región incorrecta
   - Client con secret habilitado

## 🆘 Si Nada Funciona

1. Desactiva autenticación temporalmente:
   ```bash
   sudo ./deploy/toggle-auth-ec2.sh
   # Opción 2
   ```

2. Verifica que la app funciona sin auth

3. Revisa configuración de Cognito paso a paso

4. Considera usar los logs para debugging:
   ```bash
   # Logs en tiempo real
   sudo docker-compose -f docker-compose.ec2.yml logs -f web
   ```