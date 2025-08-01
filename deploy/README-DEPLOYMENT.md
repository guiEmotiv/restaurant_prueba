# 🚀 Restaurant Web - Deployment Guide

## Scripts de Deployment Optimizados

Hemos separado el deployment en diferentes scripts según el tipo de cambios que hagas:

## 📋 **Guía de Uso Rápida**

### 1. 🎨 **Solo cambios de Frontend** (Dashboard, UI, estilos)
```bash
sudo ./deploy/frontend-only.sh
```
- ⏱️ **Tiempo**: 2-3 minutos
- 🔧 **Usa para**: Cambios en React, Dashboard, CSS, componentes
- 📦 **Hace**: Build frontend + restart nginx
- ✅ **Ventaja**: Backend sigue funcionando (cero downtime)

### 2. 🔧 **Solo cambios de Backend** (API, modelos, lógica)
```bash
sudo ./deploy/backend-only.sh
```
- ⏱️ **Tiempo**: 1-2 minutos  
- 🔧 **Usa para**: Cambios en Django, API endpoints, modelos
- 📦 **Hace**: Migraciones + restart backend
- ✅ **Ventaja**: Frontend sigue funcionando

### 3. ⚡ **Restart rápido** (Sin cambios, solo reiniciar)
```bash
sudo ./deploy/quick-restart.sh
```
- ⏱️ **Tiempo**: 30 segundos
- 🔧 **Usa para**: Contenedores colgados, variables de entorno
- 📦 **Hace**: Solo restart containers
- ✅ **Ventaja**: Super rápido, no rebuild

### 4. 🏗️ **Deploy completo** (Cambios grandes o primera vez)
```bash
sudo ./deploy/build-deploy.sh
```
- ⏱️ **Tiempo**: 10+ minutos
- 🔧 **Usa para**: Cambios mayores, dependencias, configuración
- 📦 **Hace**: Build completo + deploy
- ✅ **Ventaja**: Deploy desde cero, más seguro

---

## 🎯 **Para tu Dashboard (caso actual)**

Como solo cambiaste el **Dashboard.jsx** (frontend), usa:

```bash
sudo ./deploy/frontend-only.sh
```

**¿Por qué?**
- ✅ Solo necesitas rebuild del React app
- ✅ 2-3 minutos vs 10+ minutos del script completo
- ✅ Backend sigue funcionando (cero downtime para API)
- ✅ Base de datos no se toca

---

## 📊 **Matrix de Decisión**

| Tipo de Cambio | Script Recomendado | Tiempo | Downtime |
|---|---|---|---|
| Dashboard, UI, CSS | `frontend-only.sh` | 2-3 min | Solo frontend |
| API, modelos Django | `backend-only.sh` | 1-2 min | Solo backend |
| Variables de entorno | `quick-restart.sh` | 30 seg | Mínimo |
| Dependencias nuevas | `build-deploy.sh` | 10+ min | Completo |
| Primera instalación | `setup-initial.sh` + `build-deploy.sh` | 15+ min | N/A |

---

## 🔍 **Debugging y Logs**

### Ver logs en tiempo real:
```bash
# Backend logs
docker-compose -f docker-compose.ec2.yml logs -f web

# Frontend/Nginx logs  
docker-compose -f docker-compose.ec2.yml logs -f nginx

# Todos los logs
docker-compose -f docker-compose.ec2.yml logs -f
```

### Verificar estado:
```bash
# Status de containers
docker-compose -f docker-compose.ec2.yml ps

# Test manual de API
curl -v http://xn--elfogndedonsoto-zrb.com/api/v1/zones/

# Test manual de frontend
curl -v http://xn--elfogndedonsoto-zrb.com/
```

---

## 🚨 **Troubleshooting**

### ❌ Si algo sale mal:

1. **Frontend no carga**:
   ```bash
   sudo ./deploy/frontend-only.sh
   ```

2. **API no responde**:
   ```bash
   sudo ./deploy/backend-only.sh
   ```

3. **Todo está roto**:
   ```bash
   sudo ./deploy/quick-restart.sh
   ```

4. **Nada funciona**:
   ```bash
   sudo ./deploy/build-deploy.sh
   ```

---

## 💡 **Consejos de Optimización**

### Para desarrollo activo:
1. Haz cambios pequeños e incrementales
2. Usa `frontend-only.sh` para cambios de UI
3. Usa `backend-only.sh` para cambios de API
4. Solo usa `build-deploy.sh` cuando cambies dependencias

### Para producción:
1. Siempre testea en local primero
2. Usa `build-deploy.sh` para releases importantes
3. Mantén backups de la base de datos
4. Monitorea logs después del deploy

---

## 🎉 **Para tu Dashboard actual**

```bash
# Ejecuta esto para aplicar tus cambios del dashboard:
sudo ./deploy/frontend-only.sh
```

¡Listo en 2-3 minutos! 🚀