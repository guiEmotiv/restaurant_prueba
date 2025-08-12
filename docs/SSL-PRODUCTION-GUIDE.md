# 🔐 GUÍA DE CONFIGURACIÓN SSL PROFESIONAL

## 🎯 Objetivo: Solo HTTPS con Certificados SSL Válidos

Como **arquitecto de software**, esta es la configuración SSL de nivel profesional que garantiza:
- ✅ **Solo HTTPS** (HTTP redirige automáticamente)
- ✅ **Certificados SSL válidos** de Let's Encrypt
- ✅ **Grado A+** en SSL Labs
- ✅ **Headers de seguridad** profesionales
- ✅ **Renovación automática** de certificados

---

## ⚡ IMPLEMENTACIÓN EN EC2

### 1. Configuración SSL Profesional
```bash
cd /opt/restaurant-web
sudo git pull
sudo ./deploy/setup-ssl-production.sh
```

### 2. Compilar Frontend con HTTPS
```bash
sudo ./deploy/rebuild-frontend-www.sh
```

### 3. Validar Configuración SSL
```bash
sudo ./deploy/validate-ssl.sh
```

---

## 🏗️ ARQUITECTURA IMPLEMENTADA

### **Estructura de Seguridad:**
```
Internet → Route 53 → EC2 → Nginx (SSL) → Frontend/API
                              ↓
                        Let's Encrypt SSL
                        • TLS 1.2/1.3
                        • HSTS Obligatorio  
                        • OCSP Stapling
                        • CSP Headers
```

### **Configuración Nginx:**
- **Puerto 80**: Redirección 301 → HTTPS
- **Puerto 443**: SSL/TLS con certificados válidos
- **Headers**: HSTS, CSP, X-Frame-Options, etc.
- **Performance**: HTTP/2, Gzip, Cache optimizado

### **Certificados SSL:**
- **Emisor**: Let's Encrypt (Autoridad confiable)
- **Dominios**: www.xn--elfogndedonsoto-zrb.com + alternativas
- **Renovación**: Automática cada 60 días
- **Validación**: OCSP Stapling habilitado

---

## 🔒 CARACTERÍSTICAS DE SEGURIDAD

### **Headers Implementados:**
```nginx
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'; ...
Referrer-Policy: strict-origin-when-cross-origin
```

### **SSL/TLS Configuración:**
```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:...;
ssl_prefer_server_ciphers off;
ssl_stapling on;
ssl_session_cache shared:SSL:50m;
```

---

## 📊 VALIDACIÓN Y MONITOREO

### **Comandos de Verificación:**
```bash
# Verificar certificado
openssl s_client -connect www.xn--elfogndedonsoto-zrb.com:443 -servername www.xn--elfogndedonsoto-zrb.com

# Verificar headers
curl -I https://www.xn--elfogndedonsoto-zrb.com/

# Verificar API
curl https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/

# Logs en tiempo real
tail -f /var/log/nginx/restaurant-error.log
```

### **URLs de Testing:**
- **SSL Labs**: https://www.ssllabs.com/ssltest/analyze.html?d=www.xn--elfogndedonsoto-zrb.com
- **Security Headers**: https://securityheaders.com/?q=https://www.xn--elfogndedonsoto-zrb.com
- **HTTP/2 Test**: https://tools.keycdn.com/http2-test?url=https://www.xn--elfogndedonsoto-zrb.com

---

## 🔧 MANTENIMIENTO

### **Renovación Automática:**
- **Script**: `/etc/cron.daily/certbot-renewal`
- **Frecuencia**: Diaria (certbot decide si renueva)
- **Notificación**: Logs en `/var/log/letsencrypt/`

### **Archivos Importantes:**
```
/etc/nginx/sites-available/xn--elfogndedonsoto-zrb.com    # Configuración nginx
/etc/letsencrypt/live/www.xn--elfogndedonsoto-zrb.com/    # Certificados SSL
/var/log/nginx/restaurant-*                               # Logs aplicación
/var/www/restaurant/                                       # Frontend
```

### **Comandos de Mantenimiento:**
```bash
# Verificar estado nginx
systemctl status nginx

# Verificar certificados
certbot certificates

# Forzar renovación (testing)
certbot renew --dry-run

# Reload nginx (sin downtime)
systemctl reload nginx
```

---

## 🚨 TROUBLESHOOTING

### **Problema: Certificado SSL inválido**
```bash
sudo ./deploy/setup-ssl-production.sh
```

### **Problema: API devuelve 301**
- Verificar que nginx esté configurado correctamente
- Validar que el backend esté ejecutándose en puerto 8000

### **Problema: Frontend no carga**
```bash
sudo ./deploy/rebuild-frontend-www.sh
```

### **Verificación Completa:**
```bash
sudo ./deploy/validate-ssl.sh
```

---

## 📈 MÉTRICAS OBJETIVO

### **SSL Labs Grade: A+**
- ✅ Certificado válido y confiable
- ✅ Protocolo TLS 1.3 soportado
- ✅ Cifrados fuertes únicamente
- ✅ HSTS implementado
- ✅ Vulnerabilidades conocidas mitigadas

### **Performance:**
- ✅ HTTP/2 habilitado
- ✅ Gzip compresión activa
- ✅ Cache optimizado para assets
- ✅ Keep-alive connections

### **Security:**
- ✅ Solo HTTPS (HTTP bloqueado/redirigido)
- ✅ Headers de seguridad completos
- ✅ CORS configurado apropiadamente
- ✅ Rate limiting preparado

---

## ✅ RESULTADO ESPERADO

Después de ejecutar los scripts:

1. **https://www.xn--elfogndedonsoto-zrb.com** ← URL principal (HTTPS obligatorio)
2. **http://www.xn--elfogndedonsoto-zrb.com** → Redirige automáticamente a HTTPS
3. **API accesible**: `https://www.xn--elfogndedonsoto-zrb.com/api/v1/`
4. **Certificados válidos**: Let's Encrypt con renovación automática
5. **Security Grade**: A+ en todas las herramientas de análisis

**Esta es una configuración SSL de nivel empresarial, lista para producción.**