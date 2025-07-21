# 🚀 Guía de Deployment - Restaurant Management System

## Pasos Exactos para Producción en EC2 Ubuntu

### 📋 PREPARACIÓN PREVIA

**Requisitos:**
- Instancia EC2 Ubuntu (t2.micro o superior)
- Clave SSH (.pem file)
- Security Group configurado

---

## 🎯 PASO 1: CONFIGURAR INSTANCIA EC2

### 1.1 Lanzar instancia EC2 (AWS Console)
```
- AMI: Ubuntu 22.04 LTS
- Tipo: t2.micro (free tier)
- Key Pair: tu-clave.pem
- Security Group: Crear nuevo con las reglas de abajo
```

### 1.2 Configurar Security Group
```
Inbound Rules:
- SSH (22): Tu IP solamente
- HTTP (80): 0.0.0.0/0
- Custom TCP (8000): 0.0.0.0/0
```

### 1.3 Conectar a la instancia
```bash
chmod 400 ~/Downloads/tu-clave.pem
ssh -i ~/Downloads/tu-clave.pem ubuntu@TU_IP_EC2
```

---

## 🔧 PASO 2: PREPARAR SERVIDOR

### 2.1 Actualizar sistema
```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2 Instalar Docker
```bash
# Dependencias
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Repositorio Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"

# Instalar Docker
sudo apt update
sudo apt install -y docker-ce

# Agregar usuario al grupo docker
sudo usermod -aG docker ubuntu
```

### 2.3 Instalar Docker Compose
```bash
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2.4 Reiniciar sesión
```bash
exit
# Volver a conectar
ssh -i ~/Downloads/tu-clave.pem ubuntu@TU_IP_EC2
```

---

## 📦 PASO 3: OBTENER CÓDIGO

### Opción A: Git Clone (Recomendado)
```bash
git clone https://github.com/tu-usuario/restaurant-web.git
cd restaurant-web
```

### Opción B: Upload directo (Desde tu máquina local)
```bash
# Desde tu computadora local
scp -i ~/Downloads/tu-clave.pem -r /ruta/a/restaurant-web ubuntu@TU_IP_EC2:~/
# Luego en EC2
ssh -i ~/Downloads/tu-clave.pem ubuntu@TU_IP_EC2
cd restaurant-web
```

---

## ⚙️ PASO 4: CONFIGURAR VARIABLES DE ENTORNO

### 4.1 Crear archivo .env.prod
```bash
cp .env.prod .env.prod.backup  # backup del template
nano .env.prod
```

### 4.2 Configurar variables OBLIGATORIAS:

#### A) Generar SECRET_KEY:
```bash
python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

#### B) Obtener IP pública:
```bash
curl http://169.254.169.254/latest/meta-data/public-ipv4
```

#### C) Editar .env.prod con los valores reales:
```bash
# Cambiar estas líneas en .env.prod:
DJANGO_SECRET_KEY=tu_secret_key_generado_aqui
EC2_PUBLIC_IP=tu_ip_publica_aqui
DJANGO_SUPERUSER_PASSWORD=tu_password_seguro_aqui
```

---

## 🚀 PASO 5: DEPLOYMENT

### 5.1 Ejecutar deployment
```bash
chmod +x deploy.sh
./deploy.sh
```

### 5.2 Verificar deployment
```bash
docker ps
docker logs -f restaurant_web_prod
```

---

## 🔍 PASO 6: VERIFICACIÓN

### 6.1 Probar endpoints:
```bash
# Obtener tu IP
IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

# Probar aplicación
curl -I http://$IP
curl -I http://$IP/admin/
curl -I http://$IP/api/
```

### 6.2 Acceso desde navegador:
```
🌐 Aplicación: http://TU_IP_EC2
🔧 Admin: http://TU_IP_EC2/admin/
📖 API Docs: http://TU_IP_EC2/api/docs/
```

---

## 🛠️ COMANDOS ÚTILES POST-DEPLOYMENT

### Ver logs
```bash
docker logs -f restaurant_web_prod
```

### Reiniciar aplicación
```bash
docker-compose -f docker-compose.prod.yml restart
```

### Parar aplicación
```bash
docker-compose -f docker-compose.prod.yml down
```

### Crear superuser manualmente
```bash
docker exec -it restaurant_web_prod python manage.py createsuperuser
```

### Acceder al shell de Django
```bash
docker exec -it restaurant_web_prod python manage.py shell
```

### Ver estado del sistema
```bash
htop
df -h
docker stats
```

---

## 🚨 TROUBLESHOOTING

### Si el container no inicia:
```bash
# Ver logs detallados
docker logs restaurant_web_prod

# Reconstruir imagen
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### Si hay problemas de permisos:
```bash
# Verificar que estés en el grupo docker
groups $USER

# Si no aparece 'docker', hacer logout y login
exit
ssh -i tu-clave.pem ubuntu@TU_IP_EC2
```

### Si el puerto está ocupado:
```bash
# Ver qué usa el puerto 80
sudo netstat -tlnp | grep :80

# Matar proceso si es necesario
sudo kill -9 $(sudo lsof -t -i:80)
```

---

## 📊 ESTIMACIÓN DE COSTOS

### AWS Free Tier (12 meses)
- **EC2 t2.micro**: 750 horas/mes (Gratis)
- **Storage**: 8GB EBS (Gratis)
- **Transferencia**: 1GB salida (Gratis)

**Costo mensual**: $0 (Free tier)

### Después del Free Tier
- **EC2 t2.micro**: ~$8.50/mes
- **Storage**: ~$0.80/mes
- **Transferencia**: ~$0.09/GB

**Costo estimado**: $10-15/mes

---

## ✅ CHECKLIST FINAL

- [ ] Instancia EC2 creada y configurada
- [ ] Security Group configurado (puertos 22, 80, 8000)
- [ ] Docker y Docker Compose instalados
- [ ] Código descargado en servidor
- [ ] Variables de entorno configuradas (.env.prod)
- [ ] Deployment ejecutado exitosamente
- [ ] Aplicación accesible desde navegador
- [ ] Admin panel funcionando
- [ ] Logs sin errores críticos

---

## 📞 SOPORTE

Si encuentras problemas:
1. Revisar logs: `docker logs restaurant_web_prod`
2. Verificar configuración: `cat .env.prod`
3. Revisar esta guía paso a paso
4. Crear issue en GitHub

**¡Tu aplicación estará en línea en http://TU_IP_EC2!** 🎉