# AWS Setup Guide - Restaurant Management System

## Arquitectura de Producción (Económica)

- **EC2 t3.micro**: Backend Django (Capa gratuita)
- **RDS db.t3.micro PostgreSQL**: Base de datos (Capa gratuita)
- **S3**: Archivos estáticos y frontend
- **CloudFront**: CDN para el frontend

**Costo estimado mensual**: $15-25 USD (después de la capa gratuita)

## 1. Configuración de RDS PostgreSQL

### Crear base de datos RDS

```bash
# 1. Ir a RDS en la consola de AWS
# 2. Crear base de datos -> PostgreSQL
# 3. Configuración:
#    - Engine: PostgreSQL 15
#    - Templates: Free tier
#    - DB instance class: db.t3.micro
#    - Storage: 20 GB gp2
#    - DB instance identifier: restaurant-db
#    - Master username: postgres
#    - Master password: [tu-password-seguro]
#    - VPC: Default
#    - Public access: Yes (para desarrollo, No para producción estricta)
#    - Security group: Crear nuevo o usar existente con puerto 5432
```

### Configurar Security Group para RDS

```bash
# Security Group Rules para RDS:
# Type: PostgreSQL
# Protocol: TCP
# Port Range: 5432
# Source: Security Group del EC2 o tu IP específica
```

## 2. Configuración de S3

### Crear bucket S3

```bash
# 1. Ir a S3 en la consola de AWS
# 2. Crear bucket:
#    - Bucket name: restaurant-app-[tu-nombre-unico]
#    - Region: us-east-1 (o tu región preferida)
#    - Block all public access: DESMARCAR
#    - Versioning: Disabled (para ahorrar costos)

# 3. Configurar política del bucket (reemplazar YOUR-BUCKET-NAME):
```

### Política del bucket S3

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
        }
    ]
}
```

### Configurar CORS en S3

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": []
    }
]
```

## 3. Configuración de EC2

### Lanzar instancia EC2

```bash
# 1. Ir a EC2 en la consola de AWS
# 2. Launch Instance:
#    - AMI: Amazon Linux 2 AMI
#    - Instance type: t3.micro (capa gratuita)
#    - Key pair: Crear o usar existente
#    - Security Group: Crear nuevo con reglas:
#      - SSH (22): Tu IP
#      - HTTP (80): 0.0.0.0/0
#      - HTTPS (443): 0.0.0.0/0
#      - Custom TCP (8000): 0.0.0.0/0 (para desarrollo)
#    - Storage: 8 GB gp2 (incluido en capa gratuita)
#    - User Data: Copiar contenido de user-data.sh
```

### Crear usuario IAM para la aplicación

```bash
# 1. Ir a IAM -> Users -> Add user
# 2. User name: restaurant-app-user
# 3. Access type: Programmatic access
# 4. Attach existing policies:
#    - AmazonS3FullAccess (o crear política más restrictiva)
# 5. Guardar Access Key ID y Secret Access Key
```

## 4. Configuración de CloudFront

### Crear distribución CloudFront

```bash
# 1. Ir a CloudFront -> Distributions -> Create Distribution
# 2. Origin Settings:
#    - Origin Domain Name: tu-bucket-s3.s3.amazonaws.com
#    - Origin Path: /static (para archivos estáticos del frontend)
# 3. Default Cache Behavior:
#    - Viewer Protocol Policy: Redirect HTTP to HTTPS
#    - Allowed HTTP Methods: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
# 4. Distribution Settings:
#    - Price Class: Use U.S., Canada and Europe (más económico)
#    - Default Root Object: index.html
```

## 5. Variables de Entorno

Actualizar el archivo `.env` en el servidor EC2:

```bash
# Conectar al EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# Editar variables de entorno
sudo nano /opt/restaurant-app/.env

# Actualizar con los valores reales:
DJANGO_SECRET_KEY=tu-secret-key-super-seguro
RDS_HOSTNAME=tu-rds-endpoint.amazonaws.com
RDS_PASSWORD=tu-password-rds
AWS_ACCESS_KEY_ID=tu-access-key
AWS_SECRET_ACCESS_KEY=tu-secret-key
AWS_S3_BUCKET_NAME=tu-bucket-name
FRONTEND_DOMAIN=tu-cloudfront-domain.cloudfront.net
```

## 6. Despliegue

### Subir código al EC2

```bash
# Opción 1: Git (recomendado)
cd /opt/restaurant-app
git clone https://github.com/tu-usuario/restaurant-web.git .

# Opción 2: SCP
scp -i your-key.pem -r /path/to/local/project/* ec2-user@your-ec2-ip:/opt/restaurant-app/

# Cambiar permisos
sudo chown -R ec2-user:ec2-user /opt/restaurant-app
```

### Iniciar aplicación

```bash
# En el servidor EC2
cd /opt/restaurant-app

# Construir y ejecutar
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Ejecutar migraciones
docker-compose -f docker-compose.prod.yml exec web python manage.py migrate

# Crear superusuario
docker-compose -f docker-compose.prod.yml exec web python manage.py createsuperuser

# Verificar que funciona
curl http://localhost:8000/admin/
```

## 7. Configuración del Frontend

### Build y upload del frontend

```bash
# En tu máquina local
cd frontend
npm run build

# Subir a S3
aws s3 sync dist/ s3://your-bucket-name/ --delete

# O usar AWS CLI en EC2
# aws s3 cp /path/to/frontend/dist s3://your-bucket-name/ --recursive
```

## 8. Monitoreo y Logs

### Ver logs de la aplicación

```bash
# Logs de Docker
docker-compose -f docker-compose.prod.yml logs -f

# Logs de Django
sudo tail -f /opt/restaurant-app/logs/django.log
```

### Configurar alarmas CloudWatch (opcional)

- CPU utilization > 80%
- Memory utilization > 80%
- HTTP 5xx errors > 10

## Costos Estimados (después de capa gratuita)

- **EC2 t3.micro**: ~$8.50/mes
- **RDS db.t3.micro**: ~$12/mes
- **S3**: ~$1-3/mes (dependiendo del tráfico)
- **CloudFront**: Primeros 1TB gratis, luego ~$0.085/GB
- **Data Transfer**: ~$2-5/mes

**Total estimado**: $15-25/mes para un negocio pequeño