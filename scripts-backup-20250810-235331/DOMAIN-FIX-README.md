# 🔧 Solución: Eliminar soporte para www del dominio

## 📋 El Problema

El dominio `www.xn--elfogndedonsoto-zrb.com` sigue funcionando aunque queremos que solo funcione `https://xn--elfogndedonsoto-zrb.com` (sin www).

### Causas probables:
1. **Registro DNS A para www en Route 53**: Si existe un registro A para www apuntando a la IP de EC2
2. **Certificado SSL incluye ambos dominios**: El certificado fue generado para ambos dominios
3. **Nginx acepta cualquier server_name**: La configuración actual puede estar aceptando cualquier dominio

## 🛠️ Solución Completa

### Paso 1: Diagnosticar el estado actual

En el servidor EC2:
```bash
cd /opt/restaurant-web
sudo git pull
sudo ./deploy/diagnose-domain.sh
```

Este script mostrará:
- Configuración actual de nginx
- Dominios en el certificado SSL
- Resolución DNS actual
- Estado de los servicios

### Paso 2: Eliminar registro DNS www en Route 53

1. Ir a AWS Console → Route 53
2. Seleccionar la hosted zone `xn--elfogndedonsoto-zrb.com`
3. Si existe un registro A para `www`, **eliminarlo**
4. Solo debe quedar el registro A principal (sin www)

### Paso 3: Corregir configuración en EC2

Ejecutar el script de corrección:
```bash
cd /opt/restaurant-web
sudo ./deploy/fix-domain-no-www.sh
```

Este script:
- Hace backup de la configuración actual
- Revoca/renueva el certificado SSL (solo para dominio sin www)
- Configura nginx para:
  - Aceptar solo `xn--elfogndedonsoto-zrb.com`
  - Devolver 404 para `www.xn--elfogndedonsoto-zrb.com`
- Reinicia todos los servicios

### Paso 4: Verificar

Después de ejecutar el fix:

1. **Probar dominio principal** (debe funcionar):
   ```
   https://xn--elfogndedonsoto-zrb.com
   ```

2. **Probar www** (debe dar error 404):
   ```
   https://www.xn--elfogndedonsoto-zrb.com
   ```

3. **Verificar logs**:
   ```bash
   sudo tail -f /var/log/nginx/restaurant-error.log
   ```

## 📊 Estado Final Esperado

- ✅ `https://xn--elfogndedonsoto-zrb.com` - Funciona correctamente
- ❌ `https://www.xn--elfogndedonsoto-zrb.com` - Error 404
- ❌ `http://xn--elfogndedonsoto-zrb.com` - Redirige a HTTPS
- ❌ `http://www.xn--elfogndedonsoto-zrb.com` - Error 404

## 🚨 Si algo sale mal

1. Los backups se guardan en `/opt/backups/domain-fix-TIMESTAMP/`
2. Para restaurar nginx:
   ```bash
   sudo cp /opt/backups/domain-fix-*/nginx-*.conf /etc/nginx/sites-available/xn--elfogndedonsoto-zrb.com
   sudo systemctl reload nginx
   ```

## 🔍 Comandos útiles para debugging

```bash
# Ver certificados SSL
sudo certbot certificates

# Ver configuración nginx
sudo nginx -T | grep server_name

# Probar resolución DNS
dig xn--elfogndedonsoto-zrb.com
dig www.xn--elfogndedonsoto-zrb.com

# Ver logs en tiempo real
sudo journalctl -u nginx -f
```