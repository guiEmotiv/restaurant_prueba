# 🔐 Configuración de AWS Cognito para Autenticación

Este documento explica cómo configurar AWS Cognito para el sistema de gestión del restaurante.

## 📋 Requisitos Previos

1. **Cuenta AWS** con acceso a AWS Cognito
2. **User Pool de Cognito** configurado
3. **App Client** creado en el User Pool
4. **Grupos de usuarios** creados: `administradores` y `meseros`

## 🎯 Grupos y Permisos

### Grupo: administradores
Acceso completo a todas las funcionalidades:
- ✅ Dashboard
- ✅ Configuración (Unidades, Zonas, Mesas)
- ✅ Inventario (Grupos, Ingredientes, Recetas)
- ✅ Pedidos
- ✅ Cocina
- ✅ Estado de Mesas
- ✅ Pagos
- ✅ Historial

### Grupo: meseros
Acceso limitado a operaciones diarias:
- ❌ Dashboard
- ❌ Configuración
- ❌ Inventario
- ✅ Pedidos
- ✅ Cocina
- ✅ Estado de Mesas
- ✅ Pagos
- ❌ Historial

## 🛠️ Configuración en AWS Cognito

### 1. Crear User Pool

```bash
# Si usas AWS CLI
aws cognito-idp create-user-pool \
  --pool-name "RestaurantManagement" \
  --auto-verified-attributes email \
  --username-attributes email \
  --region us-east-1
```

### 2. Crear App Client

En la consola de AWS Cognito:
1. Ve a tu User Pool → App integration → App clients
2. Crea un nuevo App Client
3. **IMPORTANTE**: Deshabilita "Generate client secret" para aplicaciones SPA
4. Guarda el App Client ID

### 3. Crear Grupos

```bash
# Grupo administradores
aws cognito-idp create-group \
  --group-name administradores \
  --user-pool-id us-east-1_XXXXXXXXX \
  --description "Administradores del restaurante"

# Grupo meseros
aws cognito-idp create-group \
  --group-name meseros \
  --user-pool-id us-east-1_XXXXXXXXX \
  --description "Meseros del restaurante"
```

### 4. Crear Usuarios

```bash
# Crear usuario administrador
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username admin@restaurant.com \
  --user-attributes Name=email,Value=admin@restaurant.com \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS

# Agregar al grupo administradores
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username admin@restaurant.com \
  --group-name administradores

# Crear usuario mesero
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username mesero@restaurant.com \
  --user-attributes Name=email,Value=mesero@restaurant.com \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS

# Agregar al grupo meseros
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username mesero@restaurant.com \
  --group-name meseros
```

## 🔧 Configuración en EC2

### 1. Backend (.env.ec2)

```bash
# Conectar a EC2
ssh -i tu-key.pem ubuntu@tu-ec2-ip

# Editar configuración
sudo nano /opt/restaurant-web/.env.ec2
```

Agregar/actualizar estas variables:

```env
# Enable Cognito Authentication
USE_COGNITO_AUTH=True

# AWS Configuration
AWS_REGION=us-east-1

# Cognito Configuration
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_APP_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. Frontend (.env.production)

```bash
# Editar configuración del frontend
sudo nano /opt/restaurant-web/frontend/.env.production
```

Actualizar con los mismos valores:

```env
# AWS Cognito Configuration
VITE_AWS_REGION=us-east-1
VITE_AWS_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_AWS_COGNITO_APP_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Aplicar Cambios

```bash
# Reconstruir frontend
cd /opt/restaurant-web
sudo ./deploy/ec2-deploy.sh build-frontend

# Reiniciar aplicación
sudo ./deploy/ec2-deploy.sh restart

# Verificar logs
sudo ./deploy/ec2-deploy.sh logs
```

## 🧪 Probar la Configuración

1. **Acceder a la aplicación**: http://tu-ec2-ip
2. **Iniciar sesión como administrador**:
   - Usuario: admin@restaurant.com
   - Contraseña: (la que configuraste)
   - Deberías ver todas las opciones del menú

3. **Iniciar sesión como mesero**:
   - Usuario: mesero@restaurant.com
   - Contraseña: (la que configuraste)
   - Solo verás: Pedidos, Cocina, Estado de Mesas, Pagos

## 🔍 Solución de Problemas

### Error: "Authentication required"
- Verifica que `USE_COGNITO_AUTH=True` en `.env.ec2`
- Asegúrate de que el token se está enviando en los headers

### Error: "Invalid token"
- Verifica que los IDs de Cognito coinciden en backend y frontend
- Revisa que la región sea correcta
- Asegúrate de que el App Client no tiene secret

### No se ven las opciones del menú correctas
- Verifica que el usuario esté en el grupo correcto en Cognito
- Revisa los logs del backend: `sudo docker-compose -f docker-compose.ec2.yml logs web`

## 📊 Monitoreo

### Ver logs de autenticación
```bash
# En EC2
sudo docker-compose -f docker-compose.ec2.yml logs web | grep -i auth
```

### Verificar grupos de un usuario
```bash
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username admin@restaurant.com
```

## 🚀 Script de Configuración Rápida

Usa el script helper:

```bash
# En EC2
cd /opt/restaurant-web
sudo ./deploy/setup-cognito-ec2.sh
```

Este script:
1. Verifica la instalación
2. Crea backup de la configuración actual
3. Activa la autenticación con Cognito
4. Te guía en la configuración

## 📝 Notas Importantes

1. **Seguridad**: Nunca expongas las credenciales de AWS
2. **Backup**: Siempre respalda `.env.ec2` antes de cambios
3. **Testing**: Prueba primero en un ambiente de desarrollo
4. **Tokens**: Los tokens de Cognito expiran, la app debe manejar el refresh
5. **CORS**: Asegúrate de que tu dominio esté en la configuración CORS del backend