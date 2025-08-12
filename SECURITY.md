# 🛡️ SECURITY GUIDELINES - Restaurant Web

## 🔐 **CREDENCIALES Y SECRETOS**

### ⚠️ **NUNCA COMMITS EN EL REPOSITORIO**

#### 🚫 **Archivos Prohibidos**
```bash
# SSH Keys
*.pem, *.ppk, *_key.pem, *_rsa, *id_rsa*

# Environment Files  
.env.ec2, .env.production, .env.prod

# Credentials
*credentials*, *.json (service accounts)

# Database Files
*.sqlite3, *.db, data/, restaurant_*.sqlite3

# SSL Certificates
*.crt, *.pem, *.cert, ssl/, certs/

# Logs with potential credentials
*.log, logs/, *.access.log
```

### ✅ **GESTIÓN SEGURA DE CREDENCIALES**

#### **1. SSH Keys**
```bash
# Local storage (fuera del repo)
~/Downloads/ubuntu_fds_key.pem
chmod 400 ~/Downloads/ubuntu_fds_key.pem

# Conexión segura
ssh -i ~/Downloads/ubuntu_fds_key.pem ubuntu@44.248.47.186
```

#### **2. Environment Variables**
```bash
# Desarrollo: .env.dev (en repo, sin credenciales reales)
USE_COGNITO_AUTH=False
DEBUG=True

# Producción: .env.ec2 (SOLO en servidor, NO en repo)
USE_COGNITO_AUTH=True  
DEBUG=False
DJANGO_SECRET_KEY=<SECRET_GENERATED_KEY>
```

#### **3. Template para Nuevas Instalaciones**
- Usar `.env.credentials.example` como base
- Generar nuevas secret keys: 
  ```python
  python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
  ```

---

## 🔄 **WORKFLOW SEGURO DEV → PROD**

### 📋 **Checklist Pre-Deployment**

#### **Antes de git push:**
```bash
# 1. Verificar que no hay credenciales
git status
git diff --cached

# 2. Verificar .gitignore está actualizado
grep -E "(\.pem|\.env\.ec2|credentials)" .gitignore

# 3. Limpiar archivos temporales
rm -f *.log *.temp *.cache
```

#### **Antes de deployment:**
```bash
# 1. Backup de base de datos
scp -i ~/Downloads/ubuntu_fds_key.pem ubuntu@44.248.47.186:/opt/restaurant-web/data/restaurant_prod.sqlite3 ./backup_$(date +%Y%m%d).sqlite3

# 2. Verificar servicios en producción  
ssh -i ~/Downloads/ubuntu_fds_key.pem ubuntu@44.248.47.186 "docker-compose -f /opt/restaurant-web/docker-compose.ssl.yml ps"
```

---

## 🔒 **CONFIGURACIÓN DE SEGURIDAD EN PRODUCCIÓN**

### **1. Nginx Security Headers**
```nginx
# nginx/conf.d/ssl.conf
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### **2. SSL/TLS Configuration**
```nginx
# Solo protocolos seguros
ssl_protocols TLSv1.2 TLSv1.3;

# Ciphers seguros
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
ssl_prefer_server_ciphers off;

# Session security
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
```

### **3. Django Security Settings**
```python
# settings_ec2.py
DEBUG = False
ALLOWED_HOSTS = ['44.248.47.186', 'xn--elfogndedonsoto-zrb.com', 'www.xn--elfogndedonsoto-zrb.com']

# Security middleware
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
```

---

## 🚨 **PROCEDIMIENTOS DE EMERGENCIA**

### **1. Compromiso de Credenciales**
```bash
# Rotar Secret Key inmediatamente
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# Actualizar .env.ec2 en servidor
ssh -i ~/Downloads/ubuntu_fds_key.pem ubuntu@44.248.47.186
sudo nano /opt/restaurant-web/.env.ec2

# Restart servicios
sudo docker-compose -f docker-compose.ssl.yml restart
```

### **2. Acceso SSH Comprometido**
```bash
# Generar nuevas llaves
ssh-keygen -t ed25519 -C "restaurant-web-$(date +%Y%m%d)"

# Actualizar authorized_keys en servidor
# Revocar acceso anterior
```

### **3. Certificados SSL Expirados**
```bash
# Renovar Let's Encrypt
ssh -i ~/Downloads/ubuntu_fds_key.pem ubuntu@44.248.47.186
sudo certbot renew
sudo docker-compose -f /opt/restaurant-web/docker-compose.ssl.yml restart nginx
```

---

## 📊 **MONITORING Y AUDITORÍA**

### **1. Logs de Seguridad**
```bash
# Monitoreo de intentos de acceso
sudo grep "Failed password" /var/log/auth.log

# Logs de aplicación (sin datos sensibles)
docker-compose -f docker-compose.ssl.yml logs --tail=100
```

### **2. Health Checks Regulares**
```bash
# Verificar SSL
curl -I https://www.xn--elfogndedonsoto-zrb.com

# Test API
curl -s https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/

# Verificar certificados
openssl s_client -connect xn--elfogndedonsoto-zrb.com:443 -servername xn--elfogndedonsoto-zrb.com
```

### **3. Backup Strategy**
```bash
# Backup automático (sin credenciales)
# Script para backup diario de base de datos
# Retention: 30 días
# Location: Separado del servidor principal
```

---

## 🎯 **MEJORES PRÁCTICAS RESUMIDAS**

### ✅ **DO - Hacer**
- Usar gestores de passwords para credenciales
- Rotar secretos regularmente (cada 3 meses)
- Mantener .gitignore actualizado
- Hacer backups antes de deployments
- Verificar logs regularmente
- Usar HTTPS en todas las comunicaciones

### ❌ **DON'T - No Hacer**
- Nunca commitear archivos .env.* con credenciales reales
- No usar credenciales en URLs o logs
- No almacenar passwords en código
- No usar SSH keys sin passphrase para producción
- No deshabilitar verificaciones SSL
- No exponer puertos innecesarios

---

## 📞 **CONTACTOS DE EMERGENCIA**

### **Escalation Plan**
1. **Nivel 1**: Restart servicios automático
2. **Nivel 2**: Investigación manual de logs  
3. **Nivel 3**: Rollback a versión anterior
4. **Nivel 4**: Contactar administrador del sistema

### **Recovery Procedures**
- **RTO** (Recovery Time Objective): 15 minutos
- **RPO** (Recovery Point Objective): 24 horas
- **Backup Location**: Local server + external backup
- **Documentation**: Este archivo + deploy/README.md