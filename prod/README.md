# 🚀 DEPLOYMENT - Restaurant Web (Dev → Prod)

## ⚡ Comandos de Deployment

```bash
# Deploy completo a producción
./prod/deploy.sh --full

# Deploy + sincronizar BD (dev → prod)  
./prod/deploy.sh --sync

# Solo build del frontend
./prod/deploy.sh --build

# Verificar salud del sistema
./prod/deploy.sh --check

# Rollback a versión anterior
./prod/deploy.sh --rollback
```

## 🌐 URLs de Producción

- **Sitio Web**: https://www.xn--elfogndedonsoto-zrb.com/
- **API**: https://www.xn--elfogndedonsoto-zrb.com/api/v1/
- **Admin Django**: https://www.xn--elfogndedonsoto-zrb.com/admin/

## 🔄 Proceso de Deploy

### Deploy Normal (`--full`)
1. ✅ Validación de prerrequisitos
2. ✅ Verificación de cambios git
3. ✅ Backup automático de BD producción
4. ✅ Build optimizado del frontend
5. ✅ Deploy de containers (app + nginx)
6. ✅ Migraciones con auto-fix
7. ✅ Health check completo
8. ✅ URLs de verificación

### Deploy con Sync (`--sync`)
- **Incluye todo lo anterior +**
- ⚠️  Copia `restaurant_dev.sqlite3` → `restaurant_prod.sqlite3`
- ⚠️  **REEMPLAZA datos de producción con datos de desarrollo**
- ✅ Útil para: actualizar menú, precios, configuración
- ❌ **NO usar** si hay órdenes importantes en producción

## 🛠️ Monitoreo Post-Deploy

```bash
# Verificar estado
./prod/deploy.sh --check

# Ver logs en tiempo real
docker-compose logs app nginx -f

# Verificar URLs manualmente
curl https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/
```

## 📋 Checklist de Deploy

### Pre-Deploy
- [ ] Código funciona en desarrollo
- [ ] Tests pasando
- [ ] Cambios commiteados
- [ ] BD de desarrollo actualizada (si usando --sync)

### Durante Deploy
- [ ] Backup automático creado
- [ ] Build sin errores
- [ ] Containers iniciados correctamente
- [ ] Migraciones aplicadas
- [ ] Health check exitoso

### Post-Deploy
- [ ] Sitio web carga
- [ ] API responde
- [ ] Login funciona
- [ ] Vista de cocina operativa
- [ ] Dashboards muestran datos correctos

## 🚨 Solución de Problemas

### Error en Deploy
```bash
# Ver logs detallados
docker-compose logs app --tail=50

# Restart servicios
docker-compose restart app nginx

# Si persiste, rollback
./prod/deploy.sh --rollback
```

### Error de SSL/Nginx
```bash
# Verificar configuración
docker exec restaurant-nginx nginx -t

# Renovar certificados SSL (en servidor)
sudo certbot renew
docker-compose restart nginx
```

### Error de Migraciones
```bash
# El script maneja automáticamente, pero si falla:
docker exec restaurant-backend python /app/backend/manage.py migrate config 0013 --fake
docker exec restaurant-backend python /app/backend/manage.py migrate operation 0021 --fake
docker exec restaurant-backend python /app/backend/manage.py migrate
```

### Rollback de Emergencia
```bash
# Rollback automático (usa último backup)
./prod/deploy.sh --rollback

# Rollback manual
ls data/backup_prod_*  # Ver backups
cp data/backup_prod_TIMESTAMP.sqlite3 data/restaurant_prod.sqlite3
docker-compose restart app
```

## 📊 Base de Datos

- **Producción**: `data/restaurant_prod.sqlite3`
- **Desarrollo**: `data/restaurant_dev.sqlite3` 
- **Backups**: `data/backup_prod_TIMESTAMP.sqlite3`
- **Auto-backup**: Antes de cada deploy
- **Sync**: `--sync` copia dev → prod (con confirmación)

## ⚠️ IMPORTANTE - Sync de BD

El comando `--sync` es **DESTRUCTIVO**:
- ✅ **Usar para**: Actualizar menú, recetas, precios, configuración
- ❌ **NO usar si**: Hay órdenes/pagos importantes en producción
- 🔒 **Seguridad**: Siempre crea backup antes de sync
- 🔄 **Recuperación**: Usar `--rollback` si algo sale mal

## 🎯 Flujo Recomendado

### Deploy de Funcionalidades
```bash
# 1. Desarrollo completo en local
./dev/start.sh
# ... desarrollo y testing ...

# 2. Deploy a producción  
./prod/deploy.sh --full

# 3. Verificar
./prod/deploy.sh --check
```

### Actualización de Menú/Precios
```bash
# 1. Actualizar en desarrollo
./dev/start.sh
# ... cambios en recetas/precios ...

# 2. Deploy con sync de BD
./prod/deploy.sh --sync

# 3. Verificar menú actualizado
# https://www.xn--elfogndedonsoto-zrb.com/
```

---

**🔒 Deploy seguro con backup automático y rollback de emergencia**