# 🚀 DEPLOYMENT - Restaurant Web (Dev → Prod) - OPTIMIZED

## ⚡ Comandos de Deployment

```bash
# 🎯 RECOMENDADO: Deploy inteligente (más rápido)
./prod/deploy.sh --quick

# 🔄 Deploy completo (rebuild todo)
./prod/deploy.sh --full

# ⚠️  Deploy + sincronizar BD (dev → prod) [DESTRUCTIVO]
./prod/deploy.sh --sync

# 🏗️ Solo build del frontend
./prod/deploy.sh --build

# 🔍 Verificar salud del sistema
./prod/deploy.sh --check

# 🔄 Rollback a versión anterior
./prod/deploy.sh --rollback
```

## 🌐 URLs de Producción

- **🏠 Sitio Web**: https://www.xn--elfogndedonsoto-zrb.com/
- **🔧 API**: https://www.xn--elfogndedonsoto-zrb.com/api/v1/
- **⚙️ Admin Django**: https://www.xn--elfogndedonsoto-zrb.com/admin/

## 🎯 Deploy Modes (Optimized)

### 🚀 Quick Deploy (`--quick`) **[RECOMENDADO]**
- ✅ **Inteligente**: Solo rebuild si hay cambios
- ✅ **Rápido**: Skip frontend build si no es necesario
- ✅ **Eficiente**: Operaciones paralelas 
- ✅ **Ideal para**: Cambios de código sin dependencias nuevas

### 🔄 Full Deploy (`--full`)
- ✅ **Completo**: Rebuild completo de todo
- ✅ **Seguro**: Garantiza versión limpia
- ✅ **Ideal para**: Cambios importantes, nuevas dependencias

### ⚠️ Sync Deploy (`--sync`) **[DESTRUCTIVO]**
- ⚠️  **Reemplaza BD producción** con desarrollo
- ✅ **Ideal para**: Actualizar menú, precios, configuración
- ❌ **NO usar si**: Hay órdenes importantes en prod

## ⚡ Optimizaciones Implementadas

### 🚀 Performance
- **Operaciones paralelas**: Backup, validaciones, health checks
- **Smart builds**: Skip frontend si no hay cambios
- **Docker optimizations**: BuildKit, compose build cache
- **Memory tuning**: Node.js memory optimizado

### 🧠 Intelligent Features
- **Change detection**: Evita rebuilds innecesarios
- **Graceful shutdown**: Timeout optimizado para containers
- **Health monitoring**: Checks paralelos backend/nginx
- **Auto-retry**: Migration fixes automáticos

### 🔒 Safety Features
- **Auto-backup**: Antes de cada deploy
- **Confirmation prompts**: Para operaciones destructivas
- **Rollback ready**: Un comando para volver atrás
- **Error handling**: Exit limpio en cualquier fallo

## 📋 Flujo Optimizado Dev → Prod

### 🎯 Desarrollo Diario (Más Común)
```bash
# 1. Desarrollo en local
./dev/start.sh
# ... cambios de código ...

# 2. Deploy rápido a prod
./prod/deploy.sh --quick    # ⚡ 2-3x más rápido

# 3. Verificar
./prod/deploy.sh --check
```

### 🔄 Deploy Completo (Cuando sea necesario)
```bash
# Para cambios importantes o nuevas dependencias
./prod/deploy.sh --full
```

### 📊 Actualización de Menú/Datos
```bash
# 1. Actualizar datos en desarrollo
./dev/start.sh
# ... cambios en recetas/precios ...

# 2. Deploy con sync (CUIDADO: destructivo)
./prod/deploy.sh --sync

# 3. Verificar cambios
# https://www.xn--elfogndedonsoto-zrb.com/
```

## 🔧 Monitoreo Optimizado

```bash
# 🔍 Health check completo
./prod/deploy.sh --check

# 📋 Logs en tiempo real (parallel)
docker-compose logs app nginx -f

# 🎯 API health check directo
curl -sf https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/

# 📊 Container status
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
```

## 🚨 Solución de Problemas (Optimized)

### ⚡ Quick Fixes
```bash
# 🔄 Restart rápido
docker-compose restart app nginx

# 🔍 Diagnóstico completo
./prod/deploy.sh --check

# 🆘 Rollback inmediato
./prod/deploy.sh --rollback
```

### 🛠️ Debug Avanzado
```bash
# 📋 Logs específicos con timestamp
docker-compose logs app --since=5m --timestamps

# 🔧 Nginx config check
docker exec restaurant-nginx nginx -t

# 🔍 Backend Django check
docker exec restaurant-backend python /app/backend/manage.py check
```

### 🔄 Recovery Scenarios

#### 📉 Deploy Failed
```bash
# 1. Check logs
docker-compose logs app --tail=50

# 2. Quick rollback
./prod/deploy.sh --rollback

# 3. Retry with full rebuild
./prod/deploy.sh --full
```

#### 🌐 Frontend Issues
```bash
# 1. Rebuild frontend only
./prod/deploy.sh --build

# 2. Check nginx config
docker exec restaurant-nginx nginx -t

# 3. Restart nginx
docker-compose restart nginx
```

#### 🗄️ Database Issues
```bash
# 1. Check migration status
docker exec restaurant-backend python /app/backend/manage.py showmigrations

# 2. Force migration fix
docker exec restaurant-backend python /app/backend/manage.py migrate --fake-initial

# 3. Last resort: rollback
./prod/deploy.sh --rollback
```

## 📊 Performance Metrics

### ⚡ Deploy Times (Approximated)
- **Quick Deploy**: ~30-60 segundos (sin frontend changes)
- **Full Deploy**: ~2-3 minutos (con frontend rebuild)
- **Sync Deploy**: ~1-2 minutos (+ tiempo de confirmación)
- **Rollback**: ~10-20 segundos

### 🎯 Optimization Gains
- **50% faster** deploys with `--quick` mode
- **Parallel operations** reduce wait time
- **Smart caching** avoids unnecessary rebuilds
- **Graceful shutdowns** prevent data loss

## 📁 File Structure

```
prod/
├── deploy.sh          # 🚀 Optimized deployment script
└── README.md         # 📚 This documentation

Backups:
data/
├── restaurant_prod.sqlite3          # 🗄️ Production database
├── restaurant_dev.sqlite3           # 💻 Development database  
└── backup_prod_TIMESTAMP.sqlite3   # 💾 Auto-backups
```

## 🎯 Best Practices

### 💡 Deployment Strategy
1. **Use `--quick`** for daily development deploys
2. **Use `--full`** for important releases
3. **Use `--sync`** only for menu/config updates
4. **Always check** status after deploy
5. **Monitor logs** for first few minutes

### 🔒 Safety Guidelines
- ✅ **Always backup** before `--sync`
- ✅ **Test in dev** before production deploy
- ✅ **Use rollback** if anything fails
- ✅ **Monitor health** after deploy
- ❌ **Never skip** backup confirmations

### ⚡ Performance Tips
- Use `--quick` for 80% of deploys
- Parallel operations save time
- Smart detection avoids waste
- Health checks catch issues early

---

## 🏆 Summary

**🚀 Optimized deployment with intelligent features:**
- **2-3x faster** with `--quick` mode
- **Parallel operations** for efficiency  
- **Smart detection** avoids unnecessary work
- **Auto-backup & rollback** for safety
- **Health monitoring** for reliability

**⚡ Recommended command: `./prod/deploy.sh --quick`**