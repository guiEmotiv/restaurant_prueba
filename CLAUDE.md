# CLAUDE.md

## 🏗️ Restaurant Management System - OPTIMIZED & EFFICIENT v2.0

**Stack**: Django 5.2 + React 19.1 + Vite + Docker + AWS Cognito  
**Deploy**: EC2 + Nginx + SSL | **Database**: SQLite

---

## ⚡ **COMANDOS PRINCIPALES - ARQUITECTURA POR CARPETAS**

```bash
# 🔧 DESARROLLO (carpeta dev/)
./dev/start.sh             # Iniciar desarrollo completo
./dev/stop.sh              # Parar desarrollo
                          # Documentación: ./dev/README.md

# 🚀 DEPLOYMENT (carpeta prod/)
./prod/deploy.sh --full    # Deploy completo a producción  
./prod/deploy.sh --sync    # Deploy + sync BD dev→prod
./prod/deploy.sh --build   # Solo build frontend
./prod/deploy.sh --check   # Health check
./prod/deploy.sh --rollback # Rollback de emergencia
                          # Documentación: ./prod/README.md

# 📋 DOCUMENTACIÓN COMPLETA
./dev/README.md           # Guía desarrollo
./prod/README.md          # Guía deployment
./backup/README.md        # Guía backup/restore  
./CLAUDE.md               # Esta guía (overview)

# 💾 BACKUP Y RESTAURACIÓN
./backup/backup-dev.sh --create    # Backup desarrollo
./backup/backup-prod.sh --create   # Backup producción
./backup/reset-data.sh --operational --dev  # Reset datos dev
```

**URLs**:

- **Dev**: http://localhost:5173 + http://localhost:8000/api/v1/
- **Prod**: https://www.xn--elfogndedonsoto-zrb.com/

---

## 🏗️ **ARQUITECTURA FINAL OPTIMIZADA**

### **📁 Estructura por Carpetas (CLARA Y ORGANIZADA)**

```
restaurant-web/
├── dev/                # 🔧 DESARROLLO
│   ├── start.sh        #   Iniciar desarrollo
│   ├── stop.sh         #   Parar desarrollo  
│   └── README.md       #   Documentación desarrollo
│
├── prod/               # 🚀 DEPLOYMENT  
│   ├── deploy.sh       #   Deploy a producción
│   └── README.md       #   Documentación deployment
│
├── backup/             # 💾 BACKUP Y RESTAURACIÓN
│   ├── backup-dev.sh   #   Backup desarrollo
│   ├── backup-prod.sh  #   Backup producción
│   ├── reset-data.sh   #   Reset datos (dev/prod)
│   └── README.md       #   Documentación backup
│
├── CLAUDE.md           # 📋 Esta guía (overview)
├── frontend/           # ⚛️ React + Vite
├── backend/            # 🐍 Django API  
├── nginx/              # 🌐 Configuración web server
└── data/               # 💾 Base de datos SQLite
    └── backups/        #   Backups organizados
        ├── dev/        #     Backups desarrollo
        └── prod/       #     Backups producción
```

### **🎯 Funciones Automatizadas**

**Desarrollo (`./dev/start.sh`):**
- ✅ Validación de prerrequisitos (Docker, npm)
- ✅ Limpieza automática de procesos anteriores  
- ✅ Instalación inteligente de dependencias
- ✅ Backend con hot-reload y migraciones auto-fix
- ✅ Frontend en background (no bloquea terminal)
- ✅ Comando de parada limpia (`./dev/stop.sh`)

**Deployment (`./prod/deploy.sh --full`):**
- ✅ Backup automático de BD antes de cambios
- ✅ Build optimizado de frontend para producción
- ✅ Migraciones con manejo inteligente de errores
- ✅ Health checks completos post-deployment
- ✅ Rollback automático de emergencia
- ✅ Sync de BD dev→prod opcional (`--sync`)

---

## 🔍 **VALIDACIÓN EN TIEMPO REAL OPTIMIZADA**

### **Sistema Simple y Efectivo**

**SOLUCIÓN IMPLEMENTADA**: Validación Just-In-Time antes de acciones críticas

```javascript
// Antes de eliminar un item - verificar estado actual
const currentStatus = await checkItemCurrentStatus(itemId);
if (currentStatus !== 'CREATED') {
  showToast(`No se puede eliminar: el item ya está ${statusLabel[currentStatus]}`, 'error');
  return;
}
```

### **Problema Resuelto de Manera Eficiente**

**ANTES**: Los items se podían eliminar sin verificar su estado actual en cocina.

**AHORA**: Verificación instantánea del estado real antes de cada acción de eliminación.

### **Ventajas del Sistema Actual**:

- ✅ **Carga rápida**: No más SSE lento ni reconexiones constantes  
- ✅ **Validación precisa**: Consulta el estado real justo antes de eliminar
- ✅ **Mensajes claros**: "No se puede eliminar: el item ya está en preparación"
- ✅ **Sin complejidad**: Sistema simple que funciona de manera confiable
- ✅ **Auto-refresh inteligente**: Kitchen cada 5s, Tables cada 8s

### **Flujos de Validación**:

#### **🔸 Eliminar Item Individual**:
1. Usuario intenta eliminar item
2. Sistema verifica estado actual: `GET /api/v1/order-items/{id}/`
3. Si estado = 'CREATED' → Permitir eliminación
4. Si estado ≠ 'CREATED' → Mensaje: "No se puede eliminar: el item ya está en preparación"

#### **🔸 Eliminar Orden Completa**:
1. Usuario intenta eliminar orden
2. Sistema verifica estado actual: `GET /api/v1/orders/{id}/`
3. Analiza todos los items de la orden
4. Si TODOS están 'CREATED' → Permitir eliminación
5. Si NO → Mensaje específico: "No se puede eliminar el pedido #123: Tiene items ya procesados: 2 en preparación, 1 servido"

### **🎯 Mensajes Específicos por Estado**:

```javascript
// Items individuales
'PREPARING' → "No se puede eliminar: el item ya está en preparación"
'SERVED' → "No se puede eliminar: el item ya está servido" 
'PAID' → "No se puede eliminar: el item ya está pagado"

// Órdenes completas
"Tiene items ya procesados: 2 en preparación, 1 servido"
"Tiene items ya procesados: 3 servidos"
"Tiene items ya procesados: 1 en preparación, 2 servidos, 1 pagado"
```

**Configuración Zero** - Funciona automáticamente sin setup adicional.

---

## 🎯 **CRITICAL SUCCESS FACTORS**

### **Backend Configuration**

- **MUST use**: `DJANGO_SETTINGS_MODULE=backend.settings_ec2` in production
- **Database migrations**: Always applied automatically by deploy script
- **Container name**: `restaurant-backend` (critical for nginx proxy)

### **Kitchen View Real-time Features**

```javascript
// NOW ENABLED IN PRODUCTION - No development restrictions
notificationService.setCurrentUserRole(userRole);
orderItemPoller.setKitchenView(true);
orderItemPoller.startPolling();
```

### **Nginx Proxy**

```nginx
# Simplified - Django handles CORS
location /api/ {
    proxy_pass http://restaurant-backend:8000;
    proxy_set_header Authorization $http_authorization;
    # JWT token support
    proxy_buffer_size 128k;
}
```

---

## 🔧 **OPTIMIZED CONFIGURATION FILES**

### **Environment Variables**

**Backend Development:**

```bash
# Development settings in container
DEBUG=True
USE_COGNITO_AUTH=False
DATABASE_NAME=restaurant_dev.sqlite3
DJANGO_SETTINGS_MODULE=backend.settings
```

**Frontend Development** (`.env.development`):

```bash
# Required for Cognito to initialize properly
VITE_AWS_COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI
VITE_AWS_COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0
VITE_AWS_REGION=us-west-2
```

**Production** (`.env.ec2`):

```bash
DEBUG=False
USE_COGNITO_AUTH=True
DOMAIN_NAME=xn--elfogndedonsoto-zrb.com
DATABASE_NAME=restaurant_prod.sqlite3
AWS_REGION=us-west-2
COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI
COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0
```

### **Docker Compose** (Simplified)

```yaml
services:
  app:
    container_name: restaurant-backend
    environment:
      - DJANGO_SETTINGS_MODULE=backend.settings_ec2
      - DATABASE_NAME=restaurant_prod.sqlite3
    env_file: .env.ec2

  nginx:
    container_name: restaurant-nginx
    volumes:
      - ./nginx/conf.d/ssl.conf:/etc/nginx/conf.d/default.conf
      - ./frontend/dist:/var/www/html
```

---

## 🔍 **INSTANT PROBLEM RESOLUTION**

| Issue                | Command                                                          | Expected Result                |
| -------------------- | ---------------------------------------------------------------- | ------------------------------ |
| **500 on orders**    | `./tools/deploy/deploy.sh --migrate`                                          | Auto-fixes migration issues    |
| **403 Forbidden**    | Logout/login (JWT expired)                                       | New valid token                |
| **502 Bad Gateway**  | `docker-compose restart nginx`                                   | nginx starts without errors    |
| **Container issues** | `./deploy.sh --check`                                            | Health status report           |
| **Migration errors** | `bash scripts/migration-helper.sh`                               | Handles problematic migrations |
| **Settings check**   | `docker exec restaurant-backend printenv DJANGO_SETTINGS_MODULE` | `backend.settings_ec2`         |

### **Known Migration Fixes (Automated)**

- ✅ `config.0013`: RestaurantOperationalConfig table missing → Auto-faked
- ✅ `operation.0021`: CartItem table missing → Auto-faked
- ✅ `operation.0018-0020`: Container fields → Applied in sequence

---

## ✅ **SIMPLIFIED DEPLOYMENT WORKFLOW**

### **Option 1: Quick Deploy (Recommended)**

```bash
# From your local machine - one command!
./deploy-remote.sh deploy
```

- Automatically commits changes if needed
- Pushes to git
- Deploys to EC2
- Handles migrations
- Shows deployment status

### **Option 2: Deploy with Database Sync**

```bash
# When you want production to match development exactly
./deploy-remote.sh deploy-sync
```

- Backs up production database
- Deploys code changes
- Replaces production DB with dev DB
- Restarts services

### **Option 3: Manual Deploy Steps**

```bash
# If you prefer step-by-step control
git add -A && git commit -m "Update" && git push
ssh -i ubuntu_fds_key.pem ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com
cd /opt/restaurant-web
git pull origin main
./tools/deploy/deploy.sh --prod
```

---

## 🗂️ **ENHANCED FILE STRUCTURE**

```
restaurant-web/
├── deploy.sh              # Enhanced deployment script v2.0
├── deploy-remote.sh       # NEW: Remote deployment automation
├── docker-compose.yml     # Container configuration
├── .env.ec2               # Production environment
├── scripts/
│   └── migration-helper.sh # NEW: Automatic migration fixes
├── nginx/
│   ├── conf.d/ssl.conf    # SSL configuration
│   └── proxy_params       # Proxy configuration
├── backend/
│   ├── manage.py
│   └── backend/
│       ├── settings.py    # Development settings
│       └── settings_ec2.py # Production settings
├── frontend/
│   └── src/
│       └── pages/operation/
│           └── Kitchen.jsx # Real-time polling enabled
└── data/
    ├── restaurant_dev.sqlite3  # Development database
    └── restaurant_prod.sqlite3 # Production database
```

---

## 🛠️ **MAINTENANCE COMMANDS**

```bash
# Quick health check
docker ps --format "table {{.Names}}\t{{.Status}}"

# View logs
docker-compose logs app nginx --tail=20

# Restart services
docker-compose restart app nginx

# Database operations
docker exec restaurant-backend python /app/backend/manage.py migrate
docker exec restaurant-backend python /app/backend/manage.py createsuperuser
```

---

## 🏗️ **ARCHITECTURE FLOW**

```
User (AWS Cognito) → Frontend (React) → Nginx (SSL Proxy) → Backend (Django + SQLite)
                                    ↓
Kitchen View ← Real-time Polling ← Order Updates ← Database
```

---

## 📋 **FILES ELIMINATED/OPTIMIZED**

### **Removed Redundancy**:

- ❌ `prod.sh` (59 lines) - Merged into `deploy.sh`
- ❌ `deploy-prod.sh` (59 lines) - Merged into `deploy.sh`
- ❌ Duplicate Cognito env vars - Reduced by 50%
- ❌ Nginx CORS headers - Django handles them
- ❌ Complex nginx locations - Simplified to 3 blocks

### **Optimizations Applied**:

- ✅ Single deployment script (`deploy.sh`)
- ✅ Nginx config reduced from 131 to 50 lines
- ✅ Environment vars reduced from 55 to 17 lines
- ✅ Reusable nginx proxy configuration
- ✅ Kitchen view production-ready (no dev restrictions)

---

**🎯 RESULT: 1-click deployment, automatic error handling, zero manual intervention.**

---

## 🆕 **WHAT'S NEW IN v2.0**

### **Deployment Improvements**

1. **One-Command Remote Deploy**: `./deploy-remote.sh deploy`
2. **Automatic Migration Fixes**: Handles all known problematic migrations
3. **Database Sync Option**: Easy dev→prod database sync with backups
4. **Color-Coded Output**: Better visibility of deployment progress
5. **Health Checks**: Automatic verification after deployment
6. **NPM Cache Fix**: Handles npm permission issues automatically
7. **Port Conflict Resolution**: Auto-kills processes on port 5173

### **Error Prevention**

- ✅ Waits for containers to be ready before migrations
- ✅ Checks for uncommitted changes before deploy
- ✅ Auto-backups production database
- ✅ Validates nginx configuration
- ✅ Retries failed migrations with fixes

### **New Scripts**

- `deploy-remote.sh`: Complete remote deployment automation
- `scripts/migration-helper.sh`: Intelligent migration problem solver

### RECOMENDACIÓN PARA CADA CASO

Para Desarrollo:

# Limpiar solo órdenes/pagos (mantener configuración)

./reset-operational-data.sh

# Reset completo (empezar de cero)

./reset-database.sh

Para Producción EC2:

# Limpiar solo datos operacionales (recomendado)

./reset-operational-data.sh --prod --backup

# Reset total (cuidado - elimina TODO)

./reset-database.sh --prod --backup

Todos los scripts:

- Crean backup automático
- Detectan entorno (local/Docker)
- Tienen confirmación de seguridad
- Muestran resumen de lo que se eliminará
- Funcionan en dev y producción

  🎯 PRÓXIMO DEPLOY OPTIMIZADO

  Para tu próximo deploy de dev → prod, simplemente usa:

  # Deploy estándar (recomendado)

  ./deploy-v3.sh prod

  # Deploy zero-downtime (si tienes blue-green setup)

  ./deploy-v3.sh prod blue-green

  # Si algo falla, rollback inmediato

  ./deploy-v3.sh --rollback

  🔧 MIGRACIÓN GRADUAL

  1. Fase de Testing (ahora): Usa deploy-v3.sh dev para probar
  2. Primera Producción: Usa deploy-v3.sh prod para el próximo deploy
  3. Consolidación: Eventualmente reemplaza deploy.sh por deploy-v3.sh

  💡 BENEFICIOS INMEDIATOS

  - ✅ 1 comando en lugar de múltiples pasos
  - ✅ Backup automático antes de cada deploy
  - ✅ Rollback en 1 comando si algo falla
  - ✅ Config sync automático (no más nginx mapping errors)
  - ✅ Validación completa pre y post deploy
  - ✅ Health checks inteligentes con retry

  🚀 Nuevo Flujo de Desarrollo:

  # OPCIÓN 1 (RECOMENDADA): Script ultra-simple

  ./dev-simple.sh

  # OPCIÓN 2: Script original mejorado

  ./tools/deploy/deploy.sh --dev

  # OPCIÓN 3: Manual (si todo falla)

  docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d app
  cd frontend && npm run dev

  🛡️ Prevención de Errores:

  - ✅ Usa docker-compose up estándar (más confiable)
  - ✅ Configuración por archivos (más limpia)
  - ✅ Manejo de errores simple (menos puntos de falla)
  - ✅ Documentación completa con troubleshooting
  - ✅ Comando de reset total para emergencias
