# 🚨 SOLUCIÓN URGENTE: Frontend apunta a URL incorrecta

## El Problema
El frontend compilado está intentando conectar a:
```
❌ https://xn--elfogndedonsoto-zrb.com/api/v1/
```

Pero el DNS solo existe para:
```
✅ https://www.xn--elfogndedonsoto-zrb.com/api/v1/
```

Resultado: `ERR_NAME_NOT_RESOLVED` - No se pueden cargar los datos

## Solución Inmediata

### En EC2, ejecutar:
```bash
cd /opt/restaurant-web
sudo git pull
sudo ./deploy/rebuild-frontend-www.sh
```

### O comando de una línea:
```bash
cd /opt/restaurant-web && sudo git pull && sudo ./deploy/rebuild-frontend-www.sh
```

## ¿Qué hace el script?
1. ✅ Crea `.env.production` con `VITE_API_URL=https://www.xn--elfogndedonsoto-zrb.com`
2. ✅ Limpia cache y build anterior
3. ✅ Recompila frontend con URL correcta
4. ✅ Despliega archivos a `/var/www/restaurant`
5. ✅ Reinicia nginx
6. ✅ Verifica que la URL correcta esté en los archivos compilados

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
**Tiempo estimado:** 3-5 minutos
**Requiere:** Acceso sudo en EC2