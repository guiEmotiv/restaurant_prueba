# Configuración Manual de AWS Cognito

## Opción 1: Usar la Aplicación Sin Autenticación (RECOMENDADO PARA INICIO)

La aplicación está configurada para funcionar sin AWS Cognito. Simplemente deploy sin configurar variables de entorno de Cognito y tendrás acceso completo como administrador.

**Ventajas:**
- ✅ Funciona inmediatamente
- ✅ No requiere configuración de AWS
- ✅ Sin costos adicionales
- ✅ Acceso completo a todas las funciones

## Opción 2: Configurar AWS Cognito (PARA AUTENTICACIÓN COMPLETA)

### Paso 1: Crear User Pool

1. Ve a AWS Console → Cognito → User Pools
2. Click "Create user pool"
3. Configuraciones:
   - **Sign-in options**: Username
   - **User attribute**: email (opcional)
   - **Password policy**: Mínimo 8 caracteres, requiere números y símbolos
   - **Nombre del pool**: `restaurant-user-pool`

### Paso 2: Crear App Client

1. En el User Pool creado, ve a "App integration"
2. Create "App client":
   - **App client name**: `restaurant-web-client`
   - **Generate client secret**: NO (desmarcar)
   - **Authentication flows**: 
     - ✅ ALLOW_USER_SRP_AUTH
     - ✅ ALLOW_REFRESH_TOKEN_AUTH

### Paso 3: Crear Grupos

En "User groups", crear:

1. **Grupo Administradores:**
   - Group name: `administradores`
   - Description: `Administradores del sistema`
   - Precedence: `1`

2. **Grupo Meseros:**
   - Group name: `meseros`
   - Description: `Personal de meseros`
   - Precedence: `2`

### Paso 4: Obtener Credenciales

Después de crear todo, obtendrás:

- **User Pool ID**: `us-east-1_XXXXXXXXX` (ejemplo)
- **App Client ID**: `xxxxxxxxxxxxxxxxxxxxxxxxxx` (ejemplo)

### Paso 5: Crear Usuarios

En "Users", crear:

#### Usuario Administrador:
```
Username: admin
Email: admin@elfogondonsoто.com
Temporary password: Admin123!
Groups: administradores
```

#### Usuario Mesero:
```
Username: mesero01
Email: mesero01@elfogondonsoто.com
Temporary password: Mesero123!
Groups: meseros
```

### Paso 6: Configurar Variables de Entorno

En tu archivo `.env.ec2`, agregar:

```bash
# AWS Cognito (opcional)
AWS_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_APP_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Paso 7: Variables Frontend

Crear `.env.local` en frontend/:

```bash
REACT_APP_AWS_REGION=us-east-1
REACT_APP_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
REACT_APP_COGNITO_APP_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Comandos AWS CLI (Alternativo)

Si prefieres usar AWS CLI:

```bash
# Crear User Pool
aws cognito-idp create-user-pool \
  --pool-name restaurant-user-pool \
  --username-configuration CaseSensitive=false

# Crear App Client  
aws cognito-idp create-user-pool-client \
  --user-pool-id [USER_POOL_ID] \
  --client-name restaurant-web-client \
  --generate-secret false \
  --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH

# Crear grupos
aws cognito-idp create-group \
  --user-pool-id [USER_POOL_ID] \
  --group-name administradores \
  --description "Administradores del sistema" \
  --precedence 1

aws cognito-idp create-group \
  --user-pool-id [USER_POOL_ID] \
  --group-name meseros \
  --description "Personal de meseros" \
  --precedence 2

# Crear usuarios
aws cognito-idp admin-create-user \
  --user-pool-id [USER_POOL_ID] \
  --username admin \
  --user-attributes Name=email,Value=admin@elfogondonsoто.com \
  --temporary-password "Admin123!" \
  --message-action SUPPRESS

aws cognito-idp admin-add-user-to-group \
  --user-pool-id [USER_POOL_ID] \
  --username admin \
  --group-name administradores
```

## Costos Estimados

- **Sin Cognito**: $0
- **Con Cognito**: ~$0.55/mes por 1000 usuarios activos mensuales
- **Primeros 50,000 MAU**: Gratis

## Recomendación

**Para empezar**: Usa sin autenticación (Opción 1)
**Para producción**: Configura Cognito (Opción 2) cuando tengas más usuarios

## Notas Importantes

- Los usuarios deben cambiar la contraseña temporal en el primer login
- El pool debe estar en la misma región que tu EC2 (us-east-1)
- Mantén las credenciales seguras y no las subas al repositorio