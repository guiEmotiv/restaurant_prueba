# 👥 Gestión de Usuarios Nuevos en AWS Cognito

## 🔄 Flujo para Usuarios Nuevos

Cuando creas un usuario manualmente en AWS Cognito, este debe cambiar su contraseña en el primer inicio de sesión.

### 📱 Experiencia del Usuario

1. **Primer Login**: Usuario ingresa credenciales temporales
2. **Pantalla Automática**: Aparece "Cambio de Contraseña Requerido"
3. **Nueva Contraseña**: Usuario ingresa nueva contraseña
4. **Confirmación**: Usuario confirma nueva contraseña
5. **Acceso**: Automáticamente accede al sistema

### ⚙️ Configuración de Usuario en AWS Cognito

#### 1. Crear Usuario (Consola AWS)
```bash
# En AWS Cognito Console:
1. Ir a User Pool
2. Clic en "Create User"
3. Completar:
   - Username: admin (o mesero01)
   - Password: ContraseñaTemporal123!
   - ✅ Send an invitation to this new user (opcional)
   - ✅ Mark phone number as verified (si aplica)
   - ✅ Mark email as verified (si aplica)
```

#### 2. Crear Usuario (AWS CLI)
```bash
# Crear usuario admin
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username admin \
  --temporary-password "TempPassword123!" \
  --message-action SUPPRESS

# Crear usuario mesero01  
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username mesero01 \
  --temporary-password "TempPassword123!" \
  --message-action SUPPRESS
```

### 🔐 Requisitos de Contraseña

Por defecto, AWS Cognito requiere:
- **Mínimo 8 caracteres**
- **Al menos 1 mayúscula**
- **Al menos 1 minúscula** 
- **Al menos 1 número**
- **Al menos 1 símbolo especial**

### 📋 Pasos para el Administrador

#### 1. Crear Usuario
```bash
# Usando AWS CLI (recomendado)
aws cognito-idp admin-create-user \
  --user-pool-id TU_USER_POOL_ID \
  --username NOMBRE_USUARIO \
  --temporary-password "Password123!" \
  --message-action SUPPRESS
```

#### 2. Entregar Credenciales
Proporciona al usuario:
- **Usuario**: `admin` o `mesero01`
- **Contraseña temporal**: `Password123!`
- **URL del sistema**: `http://tu-ec2-ip/`

#### 3. Instrucciones para el Usuario
1. Accede a la aplicación web
2. Ingresa usuario y contraseña temporal
3. **Automáticamente** aparecerá pantalla de cambio de contraseña
4. Ingresa nueva contraseña (cumpliendo requisitos)
5. Confirma nueva contraseña
6. ¡Listo! Ya tienes acceso completo

### 🚨 Resolución de Problemas

#### Usuario no puede cambiar contraseña
```bash
# Verificar estado del usuario
aws cognito-idp admin-get-user \
  --user-pool-id TU_USER_POOL_ID \
  --username NOMBRE_USUARIO

# Si está en estado FORCE_CHANGE_PASSWORD, todo está correcto
```

#### Error de contraseña no válida
- Verificar que cumple todos los requisitos
- La contraseña temporal debe seguir las mismas reglas

#### Usuario bloqueado
```bash
# Desbloquear usuario
aws cognito-idp admin-enable-user \
  --user-pool-id TU_USER_POOL_ID \
  --username NOMBRE_USUARIO
```

### 💡 Mejores Prácticas

1. **Contraseñas temporales seguras**: Usar contraseñas complejas incluso para temporales
2. **No enviar por email**: Entregar credenciales en persona o por canal seguro
3. **Documentar usuarios**: Mantener registro de usuarios creados
4. **Políticas claras**: Informar sobre requisitos de contraseña

### 🔧 Comandos Útiles

```bash
# Listar usuarios
aws cognito-idp list-users --user-pool-id TU_USER_POOL_ID

# Resetear contraseña de usuario
aws cognito-idp admin-reset-user-password \
  --user-pool-id TU_USER_POOL_ID \
  --username NOMBRE_USUARIO

# Eliminar usuario
aws cognito-idp admin-delete-user \
  --user-pool-id TU_USER_POOL_ID \
  --username NOMBRE_USUARIO
```

---

## ✅ Flujo Completo Implementado

La aplicación ahora maneja automáticamente:
- ✅ Login normal para usuarios con contraseña cambiada
- ✅ Flujo NEW_PASSWORD_REQUIRED para usuarios nuevos
- ✅ Textos en español para todas las pantallas
- ✅ Validación automática de requisitos de contraseña
- ✅ Redirección automática después del cambio exitoso

**¡No necesitas configuración adicional!** El flujo funciona automáticamente cuando AWS Cognito detecta que un usuario debe cambiar su contraseña.