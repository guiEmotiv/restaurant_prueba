# 🚀 Guía Paso a Paso - Despliegue a Producción AWS

## Requisitos Previos

1. ✅ Cuenta AWS activa
2. ✅ Par de llaves EC2 (.pem)
3. ✅ Acceso SSH al EC2

---

## PASO 1: Configurar RDS (Base de Datos)

### 1.1 Crear RDS PostgreSQL

```bash
# En la consola AWS -> RDS -> Create Database
# 1. Engine: PostgreSQL
# 2. Template: Free tier
# 3. DB instance class: db.t3.micro
# 4. Storage: 20 GB
# 5. DB instance identifier: restaurant-db
# 6. Master username: postgres
# 7. Master password: [ANOTA ESTE PASSWORD]
# 8. VPC: Default VPC
# 9. Public access: Yes
# 10. Security group: Crear nuevo con nombre "restaurant-rds-sg"
```

### 1.2 Configurar Security Group de RDS

```bash
# En EC2 -> Security Groups -> restaurant-rds-sg
# Agregar regla:
# Type: PostgreSQL
# Port: 5432
# Source: 0.0.0.0/0 (solo para testing, luego restringir a EC2)
```

---

## PASO 2: Crear S3 Bucket

### 2.1 Crear Bucket

```bash
# En S3 -> Create bucket
# 1. Bucket name: restaurant-app-[tu-nombre-unico]
# 2. Region: us-east-1
# 3. DESMARCAR "Block all public access"
# 4. Crear bucket
```

### 2.2 Configurar Bucket Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::TU-BUCKET-NAME/*"
    }
  ]
}
```

---

## PASO 3: Crear Usuario IAM

### 3.1 Crear Usuario

```bash
# En IAM -> Users -> Add user
# 1. User name: restaurant-app-user
# 2. Access type: Programmatic access
# 3. Attach policy: AmazonS3FullAccess
# 4. GUARDAR Access Key ID y Secret Access Key
```

---

## PASO 4: Configurar EC2

### 4.1 Lanzar Instancia EC2

```bash
# En EC2 -> Launch Instance
# 1. AMI: Amazon Linux 2 AMI
# 2. Instance type: t3.micro
# 3. Key pair: Tu par de llaves
# 4. Security group: Crear nuevo con reglas:
#    - SSH (22): Tu IP
#    - HTTP (80): 0.0.0.0/0
#    - Custom TCP (8000): 0.0.0.0/0
```

### 4.2 Conectar a EC2

```bash
# Conectar vía SSH
ssh -i tu-key.pem ec2-user@tu-ec2-ip
```

---

## PASO 5: Configurar Servidor

### 5.1 Actualizar sistema e instalar Git

```bash
sudo yum update -y
sudo yum install git -y
```

### 5.2 Clonar repositorio

```bash
cd /opt
sudo mkdir restaurant-app
sudo chown ec2-user:ec2-user restaurant-app
cd restaurant-app
git clone https://github.com/guiEmotiv/restaurant-web.git .
```

### 5.3 Instalar Docker

```bash
# Usar script automatizado
sudo ./deploy/setup-docker.sh

# IMPORTANTE: Después del script, hacer logout y login
exit
ssh -i tu-key.pem ec2-user@tu-ec2-ip
ssh -i clave_ec2_fds.pem ec2-user@ec2-35-92-76-174.us-west-2.compute.amazonaws.com

cd /opt/restaurant-app
```

---

## PASO 6: Configurar Variables de Entorno

### 6.1 Crear archivo .env

```bash
# Copiar template
cp .env.safe-template .env

# Editar con tus valores reales
nano .env
```

### 6.2 Completar .env con tus valores:

```bash
# Copiar y pegar esto, reemplazando los valores:

DJANGO_SECRET_KEY="Ntj_jvD_qPpjX5Zc7JVZRqet9Mdjiz97ZvrZxYbaMcx4hQE8JQ"
DEBUG=0

# Tu IP pública de EC2 (encontrarla en AWS console)
DOMAIN_NAME="tu-ip-publica-ec2"
EC2_PUBLIC_IP="tu-ip-publica-ec2"

# Datos de tu RDS (encontrar en AWS RDS console)
RDS_DB_NAME="restaurant_db"
RDS_USERNAME="postgres"
RDS_PASSWORD="tu-password-rds-que-anotaste"
RDS_HOSTNAME="restaurant-db.xxxxxxxxx.us-east-1.rds.amazonaws.com"
RDS_PORT="5432"

# Datos IAM que guardaste
AWS_ACCESS_KEY_ID="tu-access-key-id"
AWS_SECRET_ACCESS_KEY="tu-secret-access-key"
AWS_DEFAULT_REGION="us-east-1"
AWS_S3_BUCKET_NAME="tu-bucket-name"

FRONTEND_DOMAIN="localhost"
USE_SSL="false"
TIME_ZONE="America/Lima"
```

DJANGO_SECRET_KEY=Ntj_jvD_qPpjX5Zc7JVZRqet9Mdjiz97ZvrZxYbaMcx4hQE8JQ
DEBUG=0
DOMAIN_NAME=localhost
RDS_DB_NAME=restaurant_db
RDS_USERNAME=postgres
RDS_PASSWORD=postgres123
RDS_HOSTNAME=restaurant-db.c96ukge6aq9c.us-west-2.rds.amazonaws.com
RDS_PORT=5432
AWS_ACCESS_KEY_ID=your-access-key-here
AWS_SECRET_ACCESS_KEY=your-secret-key-here
AWS_DEFAULT_REGION=us-west-2
AWS_S3_BUCKET_NAME=restaurant-app-s3
FRONTEND_DOMAIN=d2d6pb5m6rj7o9.cloudfront.net
USE_SSL=true
TIME_ZONE=America/Lima

---

## PASO 7: Desplegar Aplicación

### 7.1 Verificar estructura

```bash
./deploy/check-structure.sh
```

### 7.2 Validar configuración

```bash
docker-compose -f docker-compose.prod.yml config
```

### 7.3 Construir imagen

```bash
docker-compose -f docker-compose.prod.yml build --no-cache
```

### 7.4 Levantar servicios

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 7.5 Ejecutar migraciones

```bash
# Esperar 30 segundos a que el contenedor esté listo
sleep 30

# Ejecutar migraciones
docker-compose -f docker-compose.prod.yml exec web python manage.py migrate
```

### 7.6 Crear superusuario

```bash
docker-compose -f docker-compose.prod.yml exec web python manage.py createsuperuser
```

### 7.7 Verificar funcionamiento

```bash
# Ver logs
docker-compose -f docker-compose.prod.yml logs -f

# En otra terminal, probar
curl http://localhost:8000/admin/
```

---

## PASO 8: Acceder a la Aplicación

### 8.1 URLs de acceso:

```bash
# Backend API
http://tu-ip-publica-ec2:8000/

# Admin Panel
http://tu-ip-publica-ec2:8000/admin/

# API Documentation
http://tu-ip-publica-ec2:8000/api/docs/
```

---

## 🔧 Solución de Problemas Comunes

### Error: "yxr1 variable is not set"

```bash
# El .env tiene caracteres especiales sin quotes
# Solución: Usar .env.safe-template que tiene quotes
```

### Error: "Cannot connect to database"

```bash
# Verificar RDS Security Group
# Verificar valores en .env
# Probar conexión:
docker-compose -f docker-compose.prod.yml exec web python manage.py check --deploy
```

### Error: "exec web failed"

```bash
# El contenedor no está corriendo
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs web
```

---

## 🎯 Lista de Verificación Final

- [ ] RDS creado y accesible
- [ ] S3 bucket creado con policy pública
- [ ] Usuario IAM con keys guardadas
- [ ] EC2 con Docker instalado
- [ ] Código clonado en `/opt/restaurant-app`
- [ ] Archivo `.env` configurado correctamente
- [ ] Contenedor construido sin errores
- [ ] Migraciones ejecutadas exitosamente
- [ ] Superusuario creado
- [ ] Aplicación accesible desde internet

## 🆘 Si algo sale mal:

1. Ver logs: `docker-compose -f docker-compose.prod.yml logs -f`
2. Consultar: `deploy/troubleshooting.md`
3. Verificar estructura: `./deploy/check-structure.sh`
