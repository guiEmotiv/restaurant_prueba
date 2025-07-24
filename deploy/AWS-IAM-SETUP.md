# AWS IAM User Setup Guide

Esta guía explica cómo configurar usuarios AWS IAM para el sistema de restaurante con control de acceso basado en roles.

## 📋 Prerrequisitos

1. **AWS CLI configurado** con credenciales que tengan permisos para:
   - Crear usuarios IAM
   - Crear políticas IAM
   - Adjuntar políticas a usuarios
   - Crear access keys

2. **jq instalado** para procesamiento de JSON:
   ```bash
   # macOS
   brew install jq
   
   # Ubuntu/Debian
   sudo apt-get install jq
   ```

## 🔧 Configuración Inicial

### 1. Configurar AWS CLI

```bash
aws configure
```

Proporcione:
- AWS Access Key ID
- AWS Secret Access Key
- Default region (ej: us-east-1)
- Default output format (json)

### 2. Verificar configuración

```bash
aws sts get-caller-identity
```

## 👥 Roles y Permisos

### 🏛️ Arquitectura de Roles

| Rol | Usuario IAM | Permisos | Recursos AWS |
|-----|-------------|----------|-------------|
| **Admin** | `restaurant-admin-system` | Acceso completo | Todos los recursos |
| **Mesero** | `restaurant-mesero-carlos`<br>`restaurant-mesero-ana` | Órdenes y cocina | DynamoDB: orders*, kitchen* |
| **Cajero** | `restaurant-cajero-luis`<br>`restaurant-cajero-maria` | Pagos e historial | DynamoDB: payments* |

### 🔐 Políticas IAM

#### Admin Policy
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "*",
            "Resource": "*"
        }
    ]
}
```

#### Mesero Policy
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:PutItem", 
                "dynamodb:UpdateItem",
                "dynamodb:Query",
                "dynamodb:Scan"
            ],
            "Resource": [
                "arn:aws:dynamodb:*:*:table/restaurant-orders*",
                "arn:aws:dynamodb:*:*:table/restaurant-kitchen*"
            ]
        }
    ]
}
```

#### Cajero Policy
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem", 
                "dynamodb:Query",
                "dynamodb:Scan"
            ],
            "Resource": [
                "arn:aws:dynamodb:*:*:table/restaurant-payments*"
            ]
        }
    ]
}
```

## 🚀 Crear Usuarios IAM

### Ejecutar el script de creación

```bash
./deploy/create-aws-iam-users.sh
```

### Lo que hace el script:

1. **Verifica** configuración de AWS CLI
2. **Crea usuarios IAM** con path `/restaurant/`
3. **Genera access keys** para cada usuario
4. **Crea políticas personalizadas** por rol
5. **Adjunta políticas** a usuarios correspondientes
6. **Agrega tags** para identificación

### Salida esperada:

```
🔐 Creating AWS IAM Users for Restaurant System
==============================================
✅ AWS CLI configurado correctamente

🏪 Creando usuarios del restaurante...

📝 Creando usuario IAM: restaurant-admin-system (admin)
✅ Usuario restaurant-admin-system creado exitosamente
   Access Key: AKIA****************
   Secret Key: ****************************************
   Política: RestaurantPolicy-Admin

📝 Creando usuario IAM: restaurant-mesero-carlos (mesero)
✅ Usuario restaurant-mesero-carlos creado exitosamente
   Access Key: AKIA****************
   Secret Key: ****************************************
   Política: RestaurantPolicy-Mesero

...
```

## 🗑️ Eliminar Usuarios IAM

Si necesita eliminar todos los usuarios creados:

```bash
./deploy/delete-aws-iam-users.sh
```

## 🔍 Verificar Usuarios Creados

### Listar usuarios creados

```bash
aws iam list-users --path-prefix "/restaurant/"
```

### Ver políticas adjuntas a un usuario

```bash
aws iam list-attached-user-policies --user-name restaurant-mesero-carlos
```

### Ver detalles de una política

```bash
aws iam get-policy --policy-arn arn:aws:iam::ACCOUNT-ID:policy/restaurant/RestaurantPolicy-Mesero
```

## 📝 Integración con la Aplicación

### 1. Variables de entorno

Agregue las credenciales AWS a su `.env`:

```bash
# AWS IAM Credentials - Admin
AWS_ACCESS_KEY_ID_ADMIN=AKIA****************
AWS_SECRET_ACCESS_KEY_ADMIN=****************************************

# AWS IAM Credentials - Mesero
AWS_ACCESS_KEY_ID_MESERO=AKIA****************  
AWS_SECRET_ACCESS_KEY_MESERO=****************************************

# AWS IAM Credentials - Cajero
AWS_ACCESS_KEY_ID_CAJERO=AKIA****************
AWS_SECRET_ACCESS_KEY_CAJERO=****************************************
```

### 2. Configuración en Django

```python
# settings.py
import boto3

# Configurar clientes AWS por rol
def get_aws_client(service, role):
    credentials = {
        'admin': {
            'aws_access_key_id': os.getenv('AWS_ACCESS_KEY_ID_ADMIN'),
            'aws_secret_access_key': os.getenv('AWS_SECRET_ACCESS_KEY_ADMIN'),
        },
        'mesero': {
            'aws_access_key_id': os.getenv('AWS_ACCESS_KEY_ID_MESERO'), 
            'aws_secret_access_key': os.getenv('AWS_SECRET_ACCESS_KEY_MESERO'),
        },
        'cajero': {
            'aws_access_key_id': os.getenv('AWS_ACCESS_KEY_ID_CAJERO'),
            'aws_secret_access_key': os.getenv('AWS_SECRET_ACCESS_KEY_CAJERO'),
        }
    }
    
    return boto3.client(
        service,
        **credentials[role],
        region_name='us-east-1'
    )
```

## 🛡️ Mejores Prácticas de Seguridad

### ✅ Recomendaciones

1. **Rotación de credenciales**: Rote access keys cada 90 días
2. **Principio de menor privilegio**: Solo otorgue permisos necesarios
3. **Monitoreo**: Configure CloudTrail para auditar acciones
4. **MFA**: Habilite MFA para usuarios administrativos
5. **Cifrado**: Use AWS KMS para cifrar datos sensibles

### 🔒 Comandos de seguridad

```bash
# Rotar access key
aws iam create-access-key --user-name restaurant-mesero-carlos
aws iam update-access-key --access-key-id OLD_KEY --status Inactive --user-name restaurant-mesero-carlos
aws iam delete-access-key --access-key-id OLD_KEY --user-name restaurant-mesero-carlos

# Habilitar MFA (opcional)
aws iam enable-mfa-device --user-name restaurant-admin-system --serial-number arn:aws:iam::ACCOUNT:mfa/admin --authentication-code1 123456 --authentication-code2 654321
```

## 🚨 Troubleshooting

### Error: "InvalidClientTokenId"
- Verificar que AWS CLI esté configurado correctamente
- Verificar que las credenciales no hayan expirado

### Error: "AccessDenied" 
- Verificar que el usuario que ejecuta el script tenga permisos IAM
- Verificar que la política del usuario incluya las acciones necesarias

### Error: "EntityAlreadyExists"
- Los usuarios ya existen, ejecute el script de eliminación primero

## 📞 Soporte

Para problemas con la configuración de AWS IAM:

1. Revisar logs de AWS CLI: `aws logs describe-log-groups`
2. Verificar políticas: `aws iam simulate-principal-policy`
3. Contactar al administrador de AWS de su organización