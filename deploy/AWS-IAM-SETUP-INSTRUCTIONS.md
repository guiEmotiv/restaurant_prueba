# 🏪 AWS IAM Setup Instructions - Sistema de Restaurante

## 📋 Descripción General

Este documento describe cómo configurar AWS IAM para el sistema de restaurante de manera **completamente dinámica**. No hay usuarios hardcodeados en el código - todo se configura a través de AWS IAM.

## 🚀 Configuración Automática

### Paso 1: Configurar AWS CLI
```bash
# Instalar AWS CLI si no lo tienes
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configurar credenciales
aws configure
```

### Paso 2: Ejecutar Script de Configuración
```bash
# Desde el directorio root del proyecto
./deploy/setup-aws-iam.sh
```

Este script:
- ✅ Crea grupos AWS IAM automáticamente
- ✅ Crea usuarios con credenciales simples
- ✅ Asigna políticas apropiadas
- ✅ Genera credenciales AWS para cada usuario
- ✅ Muestra instrucciones claras

### Paso 3: Actualizar Archivos .env
```bash
# Actualizar archivos .env con credenciales dinámicas
./deploy/update-env-with-aws-credentials.sh
```

## 🏗️ Estructura de Grupos IAM Creados

| Grupo IAM | Rol en Aplicación | Usuarios Sugeridos |
|-----------|------------------|-------------------|
| `restaurant-administrators` | admin | admin |
| `restaurant-cocineros` | cocinero | cocinero1, cocinero2 |
| `restaurant-cajeros` | cajero | cajero1, cajero2 |
| `restaurant-meseros` | mesero | mesero1, mesero2 |

## 👥 Gestión de Usuarios

### Agregar Nuevos Usuarios
Para agregar un nuevo mesero, por ejemplo:

1. **Crear usuario en AWS IAM:**
```bash
aws iam create-user --user-name mesero3 --path "/restaurant/"
```

2. **Agregar al grupo correspondiente:**
```bash
aws iam add-user-to-group --group-name restaurant-meseros --user-name mesero3
```

3. **Crear access key:**
```bash
aws iam create-access-key --user-name mesero3
```

4. **Agregar credenciales al .env:**
```bash
AWS_ACCESS_KEY_ID_MESERO3=AKIA...
AWS_SECRET_ACCESS_KEY_MESERO3=...
```

### Eliminar Usuarios
```bash
# Eliminar access keys
aws iam delete-access-key --user-name mesero3 --access-key-id AKIA...

# Remover del grupo
aws iam remove-user-from-group --group-name restaurant-meseros --user-name mesero3

# Eliminar usuario
aws iam delete-user --user-name mesero3
```

## 🔐 Credenciales por Defecto

Los usuarios creados automáticamente tendrán:

- **Username:** admin, cocinero1, cajero1
- **Password:** Contraseñas seguras generadas automáticamente
- **Access Method:** Both username/password y AWS Access Key/Secret Key

## 🔄 Sistema Dinámico

### Backend Dinámico
El backend detecta automáticamente:
- ✅ Usuarios desde grupos IAM
- ✅ Roles basados en nombres de grupos
- ✅ Permisos según el rol
- ✅ Credenciales desde variables de entorno

### Frontend Dinámico
El frontend:
- ✅ Carga usuarios disponibles desde API
- ✅ Muestra roles automáticamente
- ✅ Se actualiza cuando se agregan/eliminan usuarios
- ✅ No tiene usuarios hardcodeados

## 🛠️ Configuración Manual (Alternativa)

Si prefieres configurar manualmente:

### 1. Crear Grupos
```bash
aws iam create-group --group-name restaurant-administrators --path "/restaurant/"
aws iam create-group --group-name restaurant-cocineros --path "/restaurant/"
aws iam create-group --group-name restaurant-cajeros --path "/restaurant/"
```

### 2. Crear Política Base
```bash
cat > restaurant-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "iam:GetUser",
                "iam:ListGroupsForUser"
            ],
            "Resource": "*"
        }
    ]
}
EOF

aws iam create-policy --policy-name RestaurantBasePolicy --policy-document file://restaurant-policy.json
```

### 3. Asignar Política a Grupos
```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/RestaurantBasePolicy"

aws iam attach-group-policy --group-name restaurant-administrators --policy-arn $POLICY_ARN
aws iam attach-group-policy --group-name restaurant-cocineros --policy-arn $POLICY_ARN
aws iam attach-group-policy --group-name restaurant-cajeros --policy-arn $POLICY_ARN
```

### 4. Crear Usuario de Ejemplo
```bash
# Crear usuario admin
aws iam create-user --user-name admin --path "/restaurant/"
aws iam add-user-to-group --group-name restaurant-administrators --user-name admin

# Crear access key
aws iam create-access-key --user-name admin
```

## 🔧 Verificación

### Verificar Grupos
```bash
aws iam list-groups --path-prefix "/restaurant/"
```

### Verificar Usuarios en Grupo
```bash
aws iam get-group --group-name restaurant-administrators
```

### Verificar Políticas
```bash
aws iam list-attached-group-policies --group-name restaurant-administrators
```

## 🚨 Troubleshooting

### Error: "No se encontraron usuarios"
- Verificar que los grupos existan: `aws iam list-groups`
- Verificar que los usuarios estén en los grupos: `aws iam get-group --group-name restaurant-administrators`

### Error: "Credenciales inválidas"
- Verificar que las access keys estén en el .env
- Verificar que las access keys sean válidas: `aws sts get-caller-identity`

### Error: "Cannot get AWS account ID"
- Configurar AWS CLI: `aws configure`
- Verificar credenciales: `aws sts get-caller-identity`

## 📈 Escalabilidad

Este sistema es **completamente escalable**:

- ➕ **Agregar usuarios**: Solo crearlos en IAM y agregarlos al grupo
- ➕ **Nuevos roles**: Crear nuevos grupos con prefijo `restaurant-`
- ➕ **Múltiples proyectos**: Usar diferentes prefijos de grupo
- ➕ **Multi-región**: Configurar en diferentes regiones AWS

## 🔒 Seguridad

- ✅ **Sin hardcoding**: No hay credenciales en el código
- ✅ **IAM nativo**: Usa permisos y políticas AWS IAM
- ✅ **Principio de menor privilegio**: Cada rol solo tiene los permisos necesarios
- ✅ **Auditoría**: Todas las acciones se registran en CloudTrail
- ✅ **Rotación**: Las access keys se pueden rotar fácilmente

## 📞 Soporte

Para problemas o dudas:
1. Revisar logs de Django: `docker logs restaurant_web_ec2`
2. Verificar configuración AWS: `aws sts get-caller-identity`
3. Revisar grupos IAM: `aws iam list-groups --path-prefix "/restaurant/"`

---

✨ **¡El sistema está completamente dinamizado! No hay usuarios hardcodeados en ninguna parte del código.**