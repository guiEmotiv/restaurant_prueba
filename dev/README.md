# 🔧 DESARROLLO - Restaurant Web

## ⚡ Sincronización de Datos (NUEVO)

### 📋 Obtener datos de Producción para Desarrollo

```bash
# 1. Descargar BD completa de producción → desarrollo (UN COMANDO)
scp -i ubuntu_fds_key.pem ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com:/opt/restaurant-web/data/restaurant_prod.sqlite3 data/restaurant_dev.sqlite3

# 2. Iniciar desarrollo
./dev/start.sh

# ✅ ¡Listo! Desarrollo con datos exactos de producción
```

### 🎯 Resultado
- **Desarrollo = Producción** (datos idénticos)
- **Historial completo**: Órdenes, pagos, inventario
- **IDs originales**: Sin modificaciones
- **Testing real**: Con datos de usuarios reales

---

## 🚀 Comandos de Desarrollo

```bash
# Iniciar desarrollo completo
./dev/start.sh

# Parar desarrollo
./dev/stop.sh
```

## 🌐 URLs de Desarrollo

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000/api/v1/
- **API Docs**: http://localhost:8000/api/v1/docs/
- **Vista Cocina**: http://localhost:5173/operation/kitchen
- **Dashboard Financiero**: http://localhost:5173/dashboard-financiero

---

## 📊 Gestión de Base de Datos

### 🔄 Sincronizar con Producción
```bash
# Obtener datos actuales de producción
scp -i ubuntu_fds_key.pem ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com:/opt/restaurant-web/data/restaurant_prod.sqlite3 data/restaurant_dev.sqlite3

# Reiniciar desarrollo con nuevos datos
./dev/stop.sh && ./dev/start.sh
```

### 🧹 Limpiar Datos Operacionales de Producción
```bash
# Limpiar órdenes/pagos en producción (SOLO si es necesario)
./backup/clean-prod-operational-data.sh
```

### 📁 Archivos de BD
- **Desarrollo**: `data/restaurant_dev.sqlite3` (copia de prod)
- **Producción**: EC2 `/opt/restaurant-web/data/restaurant_prod.sqlite3`
- **Backups**: `data/backups/prod/`

---

## 🔧 Monitoreo

```bash
# Ver logs del frontend
tail -f /tmp/restaurant-dev.log

# Ver logs del backend
docker-compose logs app -f

# Estado de servicios
docker ps && curl -s http://localhost:8000/api/v1/health/
```

---

## ❌ Solución de Problemas

### Puerto ocupado
```bash
./dev/stop.sh
./dev/start.sh
```

### Error de dependencias npm
```bash
rm -rf frontend/node_modules frontend/.vite
./dev/start.sh
```

### BD desactualizada o corrupta
```bash
# Descargar nueva copia de producción
scp -i ubuntu_fds_key.pem ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com:/opt/restaurant-web/data/restaurant_prod.sqlite3 data/restaurant_dev.sqlite3

# Reiniciar
./dev/stop.sh && ./dev/start.sh
```

### Reset completo (emergencia)
```bash
./dev/stop.sh
docker-compose down --volumes --remove-orphans
rm -rf frontend/node_modules frontend/.vite
rm -f data/restaurant_dev.sqlite3
./dev/start.sh  # Usará BD vacía
```

---

## 🎯 Flujo de Desarrollo Recomendado

### 📅 Inicio de día
```bash
# 1. Sincronizar con producción (opcional, si necesitas datos frescos)
scp -i ubuntu_fds_key.pem ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com:/opt/restaurant-web/data/restaurant_prod.sqlite3 data/restaurant_dev.sqlite3

# 2. Iniciar desarrollo
./dev/start.sh
```

### 🔧 Durante desarrollo
- **Hot-reload automático**: Los cambios se reflejan inmediatamente
- **Datos reales**: Testea con órdenes, inventario e historial real
- **Debug efectivo**: Reproduce problemas reales de producción

### 📤 Fin de día
```bash
./dev/stop.sh
```

---

## 💡 Ventajas del Nuevo Flujo

### ✅ **Simplicidad**
- **Un comando** para sincronizar datos
- **Sin scripts complejos** que puedan fallar
- **Directo desde EC2** sin pasos intermedios

### ✅ **Confiabilidad** 
- **Copia exacta** bit por bit de producción
- **Sin modificaciones** de IDs o relaciones
- **Siempre funciona** (SCP es muy estable)

### ✅ **Eficiencia**
- **Rápido**: Descarga en segundos (BD pequeña)
- **Actualizado**: Datos de producción al momento
- **Testing real**: Detecta problemas que no aparecen con datos sintéticos

---

## 🚀 Deploy a Producción

### Estructura Optimizada
```bash
# Deploy completo con el nuevo script
./prod/deploy.sh --full

# Otras opciones disponibles
./prod/deploy.sh --sync     # Deploy + sync BD dev→prod
./prod/deploy.sh --build    # Solo build frontend
./prod/deploy.sh --check    # Verificar salud del sistema
./prod/deploy.sh --rollback # Rollback a versión anterior
```

### 📋 Flujo completo Dev → Prod
```bash
# 1. Desarrollo y testing
./dev/start.sh

# 2. Commit y push cambios
git add -A && git commit -m "feat: nueva funcionalidad" && git push

# 3. Deploy a producción (desde local)
./prod/deploy.sh --full
```

### 🎯 Ventajas del Nuevo Script
- **Optimizado**: Build automático y migraciones inteligentes
- **Backups**: Automático antes de cada deploy
- **Health checks**: Verificación post-deploy
- **Rollback**: Un comando para volver atrás
- **Clean**: Scripts organizados en carpetas `dev/` y `prod/`

---

**🚀 Desarrollo con datos reales = Testing más efectivo**