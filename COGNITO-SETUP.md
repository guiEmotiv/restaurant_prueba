# Configuración de AWS Cognito para El Fogón de Don Soto

Esta guía te ayudará a configurar AWS Cognito para habilitar la autenticación en tu aplicación web.

## Paso 1: Crear User Pool en AWS Cognito

### 1.1 Acceder a AWS Cognito
1. Ve a la [Consola de AWS](https://console.aws.amazon.com/)
2. Busca "Cognito" en el buscador de servicios
3. Click en "Amazon Cognito"

### 1.2 Crear nuevo User Pool
1. Click en "Create user pool"
2. **Configuración de inicio de sesión:**
   - Selecciona "Username" como método de inicio de sesión
   - NO selecciones Email ni Phone number
   - Click "Next"

### 1.3 Configurar política de contraseñas
1. **Password policy:**
   - Minimum length: 8 characters
   - ✅ Contains at least 1 number
   - ✅ Contains at least 1 special character
   - ✅ Contains at least 1 uppercase letter
   - ✅ Contains at least 1 lowercase letter
2. **Multi-factor authentication:** `No MFA` (para simplificar)
3. **User account recovery:** `Enable self-service account recovery`
4. Click "Next"

### 1.4 Configurar registro de usuarios
1. **Self-service sign-up:** `Disable self-registration` (solo admin puede crear usuarios)
2. **Cognito-assisted verification:** No selections needed
3. **Required attributes:** Selecciona `email`
4. Click "Next"

### 1.5 Configurar mensajes
1. **Email delivery:** `Send email with Cognito` (por defecto está bien)
2. **SMS settings:** Déjalo por defecto
3. Click "Next"

### 1.6 Integrar aplicación
1. **User pool name:** `restaurant-users` (o el nombre que prefieras)
2. **App client name:** `restaurant-web-client`
3. **Client secret:** `Don't generate a client secret`
4. Click "Next"

### 1.7 Revisar y crear
1. Revisa toda la configuración
2. Click "Create user pool"

## Paso 2: Configurar App Client

### 2.1 Acceder a configuración del App Client
1. En tu User Pool recién creado, ve a la pestaña "App integration"
2. Busca la sección "App clients and analytics"
3. Click en tu app client (`restaurant-web-client`)

### 2.2 Configurar Callback URLs (Opcional - para Hosted UI)
Si planeas usar Hosted UI de Cognito:
1. **Allowed callback URLs:**
   - `https://xn--elfogndedonsoto-zrb.com`
   - `http://localhost:5173` (para desarrollo)
2. **Allowed sign-out URLs:**
   - `https://xn--elfogndedonsoto-zrb.com`
   - `http://localhost:5173` (para desarrollo)

## Paso 3: Crear Grupos de Usuario

### 3.1 Crear grupo "administradores"
1. En tu User Pool, ve a la pestaña "Groups"
2. Click "Create group"
3. **Group name:** `administradores`
4. **Description:** `Administradores del restaurante - acceso completo`
5. **Precedence:** `1`
6. Click "Create group"

### 3.2 Crear grupo "meseros"
1. Click "Create group" nuevamente
2. **Group name:** `meseros`
3. **Description:** `Meseros del restaurante - acceso limitado`
4. **Precedence:** `2`
5. Click "Create group"

## Paso 4: Crear Usuarios

### 4.1 Crear usuario administrador
1. Ve a la pestaña "Users" en tu User Pool
2. Click "Create user"
3. **Username:** `admin`
4. **Temporary password:** `TempPass123!` (el usuario deberá cambiarla)
5. **Email address:** `admin@turestaurante.com`
6. ✅ Mark email as verified
7. ✅ Send an invitation to this new user (opcional)
8. Click "Create user"

### 4.2 Asignar usuario a grupo
1. Click en el usuario `admin` que acabas de crear
2. Ve a la pestaña "Group memberships"
3. Click "Add user to group"
4. Selecciona `administradores`
5. Click "Add"

### 4.3 Crear usuario mesero (Opcional)
1. Repite el proceso para crear un usuario `mesero01`
2. **Username:** `mesero01`
3. **Temporary password:** `TempPass123!`
4. **Email:** `mesero01@turestaurante.com`
5. Asígnalo al grupo `meseros`

## Paso 5: Obtener Configuración

### 5.1 Copiar User Pool ID
1. En la pestaña "General settings" de tu User Pool
2. Copia el **User Pool ID** (formato: `us-east-1_XXXXXXXXX`)

### 5.2 Copiar App Client ID
1. Ve a "App integration" > "App clients and analytics"
2. Click en tu app client
3. Copia el **Client ID** (formato: `xxxxxxxxxxxxxxxxxxxxxxxxxx`)

## Paso 6: Configurar Variables de Entorno

### 6.1 Backend (.env.ec2)
Actualiza los valores en tu archivo `.env.ec2`:

```bash
# AWS Cognito Configuration
AWS_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_TU_POOL_ID_AQUI
COGNITO_APP_CLIENT_ID=TU_CLIENT_ID_AQUI
USE_COGNITO_AUTH=True
```

### 6.2 Frontend (.env.production)
Actualiza los valores en tu archivo `frontend/.env.production`:

```bash
# AWS Cognito Configuration
VITE_AWS_REGION=us-east-1
VITE_AWS_COGNITO_USER_POOL_ID=us-east-1_TU_POOL_ID_AQUI
VITE_AWS_COGNITO_APP_CLIENT_ID=TU_CLIENT_ID_AQUI
```

## Paso 7: Desplegar Aplicación

### 7.1 Reconstruir y desplegar
En tu servidor EC2, ejecuta:

```bash
cd /opt/restaurant-web
sudo git pull origin main
sudo ./deploy/ec2-deploy.sh deploy
```

## Paso 8: Probar Autenticación

### 8.1 Acceder a la aplicación
1. Ve a `https://xn--elfogndedonsoto-zrb.com`
2. Deberías ver la pantalla de login de AWS Cognito
3. Usa las credenciales:
   - **Usuario:** `admin`
   - **Contraseña:** `TempPass123!`
4. Te pedirá cambiar la contraseña en el primer login

### 8.2 Verificar permisos
- **Usuario admin:** Debe tener acceso a todas las secciones
- **Usuario mesero:** Solo debe ver Kitchen, Table Status, Orders y Payments

## Troubleshooting

### Error: "User does not exist"
- Verifica que hayas creado el usuario en el User Pool
- Asegúrate de que el username sea exacto (case-sensitive)

### Error: "Incorrect username or password"
- Verifica las credenciales
- Asegúrate de usar la contraseña temporal o la nueva después del cambio

### Error: "Unable to verify secret hash"
- Asegúrate de que el App Client NO tenga "Client secret" habilitado
- Regenera el App Client si es necesario

### Usuario sin permisos
- Verifica que el usuario esté asignado al grupo correcto
- Revisa que los nombres de grupos sean exactos: `administradores` y `meseros`

## Seguridad

### Recomendaciones importantes:
1. **Nunca compartas las credenciales** de usuarios administrativos
2. **Cambia las contraseñas temporales** inmediatamente
3. **Usa contraseñas fuertes** que cumplan la política configurada
4. **Revisa regularmente** los usuarios y permisos
5. **Habilita CloudTrail** para auditar accesos (opcional)

## Usuarios de Ejemplo Configurados

Una vez configurado correctamente, tendrás:

### Administrador
- **Usuario:** `admin`
- **Grupo:** `administradores`
- **Permisos:** Acceso completo al sistema

### Mesero
- **Usuario:** `mesero01`
- **Grupo:** `meseros`
- **Permisos:** Solo Kitchen, Table Status, Orders y Payments

¡Tu aplicación ahora tiene autenticación segura con AWS Cognito! 🔐