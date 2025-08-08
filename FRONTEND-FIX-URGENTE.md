# 🚨 SOLUCIÓN URGENTE: Múltiples problemas detectados

## Los Problemas
1. **Nginx falló al iniciar** - "Job for nginx.service failed"
2. **Base de datos vacía** - "no such table: unit"
3. **Frontend URL incorrecta** - Apunta a `xn--elfogndedonsoto-zrb.com` pero DNS solo tiene `www.xn--elfogndedonsoto-zrb.com`
4. **Frontend no visible** - No se puede acceder a la aplicación web

Resultado: `ERR_NAME_NOT_RESOLVED` + aplicación no funcional

## Solución Inmediata

### En EC2, ejecutar (SOLUCIÓN COMPLETA):
```bash
cd /opt/restaurant-web
sudo git pull
sudo ./deploy/fix-all-problems.sh
```

### O comando de una línea:
```bash
cd /opt/restaurant-web && sudo git pull && sudo ./deploy/fix-all-problems.sh
```

### Solo para recompilar frontend:
```bash
cd /opt/restaurant-web && sudo ./deploy/rebuild-frontend-www.sh
```

## ¿Qué hace fix-all-problems.sh?
1. ✅ **Corrige nginx** - Recrea configuración válida y reinicia servicio
2. ✅ **Arregla base de datos** - Ejecuta migraciones y pobla datos iniciales
3. ✅ **Recompila frontend** - Con `VITE_API_URL=https://www.xn--elfogndedonsoto-zrb.com`
4. ✅ **Despliega archivos** - Copia build a `/var/www/restaurant`
5. ✅ **Verifica todo** - Confirma que nginx, API y frontend funcionen
6. ✅ **Reporta estado** - Muestra qué está funcionando y qué no

## Verificación
Después de ejecutar el script, abrir la consola del navegador y verificar que las llamadas API vayan a:
```
✅ https://www.xn--elfogndedonsoto-zrb.com/api/v1/
```

## Si persiste el problema
1. Limpiar cache del navegador (Ctrl+F5)
2. Ejecutar: `sudo ./deploy/diagnose-frontend.sh`
3. Verificar DNS: `dig www.xn--elfogndedonsoto-zrb.com`

---
**Tiempo estimado:** 5-8 minutos (solución completa) | 3-5 minutos (solo frontend)
**Requiere:** Acceso sudo en EC2