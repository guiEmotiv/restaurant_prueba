# 🚀 Deployment Inteligente - Restaurant Web

Sistema de deployment automatizado que detecta cambios y aplica solo las actualizaciones necesarias.

## ⚡ Quick Start

```bash
# Deploy automático inteligente (RECOMENDADO)
./prod/deploy.sh deploy

# Verificar estado del sistema
./prod/deploy.sh check
```

## 🤖 ¿Cómo funciona el Deploy Inteligente?

El sistema **detecta automáticamente** qué cambios existen y aplica solo las actualizaciones necesarias:

### 📱 **Cambios en Frontend**
- **Detecta:** Modificaciones en `frontend/`
- **Acción:** Build optimizado + deploy de assets
- **Tiempo:** ~30 segundos

### ⚙️ **Cambios en Backend**
- **Detecta:** Modificaciones en `backend/`
- **Acción:** Restart de servicios + aplicación de código
- **Tiempo:** ~15 segundos

### 🗄️ **Cambios en Base de Datos**
- **Detecta:** Migraciones pendientes automáticamente
- **Acción:** Backup automático + migraciones seguras
- **Tiempo:** ~45 segundos

### ✅ **Sin Cambios**
- **Detecta:** No hay modificaciones
- **Acción:** Solo verificación de salud
- **Tiempo:** ~5 segundos

## 🛡️ Seguridad y Backups

### Backup Automático
- ✅ **Siempre** se crea backup antes de cambios
- ✅ Formato: `backup_auto_YYYYMMDD_HHMMSS.sqlite3`
- ✅ Almacenado en EC2: `data/`

### Migraciones Seguras
- ✅ Sin `--run-syncdb` (evita pérdida de datos)
- ✅ Solo migraciones detectadas como pendientes
- ✅ Rollback disponible en caso de error

## 📋 Comandos Disponibles

| Comando | Descripción | Uso |
|---------|-------------|-----|
| `deploy` | 🤖 Deploy inteligente automático | Uso diario |
| `sync` | 💾 Sincronizar BD completa (dev→prod) | Solo para datos |
| `check` | 🔍 Verificar salud del sistema | Monitoreo |
| `rollback` | ⏪ Rollback a versión anterior | Emergencias |

## 🎯 Escenarios de Uso

### Desarrollo Diario
```bash
# Cambios en código → Deploy automático
git add . && git commit -m "feat: nueva funcionalidad"
./prod/deploy.sh deploy
```

### Actualización de Menú/Datos
```bash
# Solo cuando necesites sincronizar datos completos
./prod/deploy.sh sync
```

### Verificación de Salud
```bash
# Verificar que todo esté funcionando
./prod/deploy.sh check
```

### Emergencia - Rollback
```bash
# Volver a versión anterior
./prod/deploy.sh rollback
```

## 📊 Información del Sistema

### URLs de Producción
- 🏠 **Sitio Web:** https://www.elfogóndedonotto.com/
- 🔧 **API REST:** https://www.elfogóndedonotto.com/api/v1/
- 📱 **Admin:** https://www.elfogóndedonotto.com/admin/

### Arquitectura
- **Backend:** Django + Docker (puerto 8000)
- **Frontend:** React + Vite (servido por Nginx)
- **Proxy:** Nginx con SSL (puertos 80/443)
- **BD:** SQLite con backups automáticos

### Monitoreo
```bash
# Ver logs del backend
ssh -i ubuntu_fds_key.pem ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com
cd /opt/restaurant-web
docker-compose logs -f app

# Ver logs de Nginx
docker-compose logs -f nginx
```

## ⚠️ Consideraciones Importantes

### Antes del Deploy
1. ✅ Commits pusheados a `main`
2. ✅ Tests locales pasando
3. ✅ Frontend building sin errores

### Durante el Deploy
- 🕒 **No interrumpir** el proceso
- 📱 La app puede tener ~30s de downtime
- 🔄 Los servicios se reinician automáticamente

### Después del Deploy
- ✅ Verificar que el sitio responde
- ✅ Revisar logs en caso de errores
- 📊 Backup disponible para rollback

## 🔧 Solución de Problemas

### Deploy Falla
```bash
# 1. Verificar estado
./prod/deploy.sh check

# 2. Ver logs
ssh -i ubuntu_fds_key.pem ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com
cd /opt/restaurant-web && docker-compose logs --tail=50 app

# 3. Rollback si es necesario
./prod/deploy.sh rollback
```

### Migraciones con Error
- ✅ **Automático:** Rollback de BD desde backup
- ✅ **Manual:** Backups en `data/backup_auto_*.sqlite3`

### Frontend no Actualiza
```bash
# Forzar build y deploy completo
rm -rf frontend/dist
./prod/deploy.sh sync
```

---

## 💡 Tips de Productividad

1. **Usa `deploy` siempre** - Es inteligente y seguro
2. **`check` antes de deploy** - Verifica que todo esté bien
3. **`sync` solo para datos** - Cuando cambies menú/configuración
4. **Commits claros** - El sistema los usa para detectar cambios

**El sistema está optimizado para máxima eficiencia y seguridad. ¡Deploy con confianza! 🚀**