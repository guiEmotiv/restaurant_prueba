# Configuración de AWS Cognito para El Fogón de Don Soto

## Pasos para Configurar AWS Cognito

### 1. Crear User Pool en AWS Cognito

1. Ir a AWS Console → Cognito → User Pools
2. Crear nuevo User Pool con las siguientes configuraciones:

**Sign-in options:**
- Username
- Email (opcional)

**User attributes:**
- email (requerido)
- given_name (opcional)
- family_name (opcional)

**Password policy:**
- Mínimo 8 caracteres
- Requiere números, símbolos, mayúsculas y minúsculas

### 2. Configurar App Client

1. En el User Pool creado, ir a "App integration"
2. Crear "App client" con:
   - Client name: `restaurant-web-client`
   - Generate client secret: NO (desmarcar)
   - Authentication flows: 
     - ALLOW_USER_SRP_AUTH
     - ALLOW_REFRESH_TOKEN_AUTH

### 3. Crear Grupos de Usuarios

En el User Pool, ir a "Groups" y crear:

**Grupo Administradores:**
- Group name: `administradores`
- Description: `Administradores del sistema`
- Precedence: `1`

**Grupo Meseros:**
- Group name: `meseros`
- Description: `Personal de meseros`
- Precedence: `2`

### 4. Crear Usuarios de Prueba

#### Usuario Administrador:
```
Username: admin
Email: admin@elfogondonsoто.com
Temporary password: TempPass123!
Groups: administradores
```

#### Usuario Mesero:
```
Username: mesero01
Email: mesero01@elfogondonsoто.com  
Temporary password: TempPass123!
Groups: meseros
```

### 5. Configurar Variables de Entorno

1. Copiar `.env.example` a `.env.local` en el directorio frontend
2. Completar con los valores de AWS Cognito:

```env
REACT_APP_AWS_REGION=us-east-1
REACT_APP_COGNITO_USER_POOL_ID=[YOUR_USER_POOL_ID]
REACT_APP_COGNITO_APP_CLIENT_ID=[YOUR_APP_CLIENT_ID]
```

### 6. Comandos AWS CLI (Opcional)

Si prefieres usar AWS CLI para crear los usuarios:

```bash
# Crear usuario administrador
aws cognito-idp admin-create-user \
  --user-pool-id [YOUR_USER_POOL_ID] \
  --username admin \
  --user-attributes Name=email,Value=admin@elfogondonsoто.com \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS

# Agregar a grupo administradores
aws cognito-idp admin-add-user-to-group \
  --user-pool-id [YOUR_USER_POOL_ID] \
  --username admin \
  --group-name administradores

# Crear usuario mesero
aws cognito-idp admin-create-user \
  --user-pool-id [YOUR_USER_POOL_ID] \
  --username mesero01 \
  --user-attributes Name=email,Value=mesero01@elfogondonsoто.com \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS

# Agregar a grupo meseros
aws cognito-idp admin-add-user-to-group \
  --user-pool-id [YOUR_USER_POOL_ID] \
  --username mesero01 \
  --group-name meseros
```

## Permisos por Rol

### Administrador (administradores)
- ✅ Dashboard
- ✅ Configuración (Unidades, Zonas, Mesas)
- ✅ Inventario (Grupos, Ingredientes, Recetas)
- ✅ Pedidos
- ✅ Cocina
- ✅ Estado Mesas
- ✅ Pagos
- ✅ Historial

### Mesero (meseros)
- ❌ Dashboard
- ❌ Configuración
- ❌ Inventario
- ✅ Pedidos
- ❌ Cocina
- ✅ Estado Mesas
- ✅ Pagos
- ❌ Historial

## Verificación

1. Ejecutar `npm run dev` en el directorio frontend
2. Acceder a la aplicación
3. Probar login con usuarios creados
4. Verificar que cada rol vea solo las opciones permitidas

## Notas Importantes

- Los usuarios deben cambiar la contraseña temporal en el primer login
- Los grupos de Cognito determinan los permisos en la aplicación
- El sistema funciona sin conexión a internet una vez configurado
- Para producción, configurar el dominio personalizado de Cognito