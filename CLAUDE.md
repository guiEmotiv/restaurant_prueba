# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **🎯 ÚLTIMA ACTUALIZACIÓN**: Sistema completamente optimizado (Agosto 2025) - Dashboard financiero con estados, colas secuenciales en cocina, UI responsive, scripts de limpieza de BD, y procedimientos de deploy actualizados.

## ⚠️ **CAMBIOS CRÍTICOS RECIENTES** - Agosto 2025

### **🔧 Optimizaciones Recientes Implementadas**

#### **📊 Dashboard Financiero - Completamente Renovado**
- ✅ **Filtros precisos**: Solo items PAID para cálculos financieros
- ✅ **Gráfica de estados**: Visualización CREATED/SERVED/PAID con barras de progreso
- ✅ **Excel completo**: Incluye TODOS los items (no solo PAID) para análisis detallado
- ✅ **Productos menos vendidos**: Ranking de productos con menor rendimiento
- ✅ **Porcentajes sin decimales**: UI más limpia y legible
- ✅ **Transacciones correctas**: Count real de pagos por método
- ✅ **Bug Excel corregido**: Eliminada duplicación de totales por ingredientes

#### **🍳 Vista Cocina - Sistema de Colas Secuenciales**
- ✅ **Filtros por mesa**: Botones con formato "Mesa X (Y)" mostrando items pendientes
- ✅ **Colas por estación**: Items procesados secuencialmente por grupo/estación
- ✅ **Tiempo dinámico**: Indicadores de color basados en queue position, no tiempo absoluto
- ✅ **UI simplificada**: Removido "en vivo" y filtros de tiempo innecesarios

#### **🧾 Gestión de Mesas - UX Optimizada**
- ✅ **Headers uniformes**: Tamaños de texto consistentes
- ✅ **Nuevo Pedido**: Grupos convertidos a dropdown, botones solo con iconos
- ✅ **Modal notas**: Diseño minimalista y mobile-responsive con toggle moderno
- ✅ **Order cards**: Total en negro, separator "-", incluye nombre del mesero

#### **🔧 Base de Datos - Scripts de Limpieza**
- ✅ **reset-operational-data.sh**: Preserva configuración, elimina solo datos operacionales
- ✅ **reset-production-db.sh**: Limpieza completa (existía previamente)
- ✅ **Consistencia de datos**: Corrección de discrepancias orden.total vs payments.amount

### **🔧 Correcciones Implementadas para Garantizar Funcionamiento**
1. **Vista de Cocina**: OrderItems ahora aparecen **individualmente** (no agrupados por receta)
2. **Configuración de API**: Corregida variable `VITE_API_BASE_URL` en frontend
3. **Proxy de Vite**: Agregado proxy `/api` → `http://localhost:8000` para desarrollo
4. **Troubleshooting**: Nuevas secciones de diagnóstico y verificación post-corrección

### **📋 Verificación Rápida del Sistema**
```bash
# Ejecutar SIEMPRE antes de comenzar desarrollo:
./dev-diagnostics.sh

# Deben pasar todos los checks:
✅ Frontend (5173): Activo
✅ Backend (8000): Activo  
✅ Cognito: Configurado
✅ Backend responde: Status 200

# Si algo falla, ver sección "🛠️ Troubleshooting & Mantenimiento"
```

---

## Project Architecture

This is a full-stack restaurant management system with a React frontend and Django REST API backend, designed for deployment on EC2 with AWS Cognito authentication.

### High-Level Structure
- **Frontend**: React SPA built with Vite, using TailwindCSS for styling and AWS Amplify for Cognito integration
- **Backend**: Django REST API with three main apps: `config`, `inventory`, and `operation`
- **Authentication**: AWS Cognito with JWT tokens and role-based permissions (administradores, meseros, cocineros)
- **Database**: SQLite in production for simplicity
- **Deployment**: Docker containers with Nginx reverse proxy on EC2

### Key Applications

#### Backend Apps
- **config**: Core configuration models (Tables, Units, Zones, Containers) and authentication/permissions
- **inventory**: Menu management (Groups, Ingredients, Recipes, stock tracking)
- **operation**: Restaurant operations (Orders, OrderItems, Payments, Kitchen workflow)

#### Frontend Structure
- **pages/**: Main views organized by functionality (Dashboard, config/, inventory/, operation/)
- **components/**: Reusable components with auth/, common/, and feature-specific folders
- **contexts/**: AuthContext for Cognito authentication, ToastContext for notifications
- **services/**: API client and Bluetooth printer integration

## Development Commands

### Backend (Django)
```bash
# From project root
cd backend

# Run development server
make run                    # Starts on 0.0.0.0:8000
python manage.py runserver 0.0.0.0:8000

# Database operations
make migrate               # Apply migrations
python manage.py migrate

# Create admin user
make createsuperuser
python manage.py createsuperuser

# Run tests
make test                  # Run all tests
pytest -q                 # Quick test run
pytest --cov=. --cov-report=term-missing  # With coverage
pytest -m "unit"          # Unit tests only
pytest -m "integration"   # Integration tests only

# Shell access
make shell
python manage.py shell
```

### Frontend (React + Vite) - OPTIMIZADO
```bash
# From project root
cd frontend

# Development server - MEJORADO
npm run dev                # Starts on port 5173 (auto-open browser)
npm run dev:debug          # Debug mode with verbose logging
npm run dev:force          # Force restart clearing cache

# Production build
npm run build             # Standard build
npm run build:prod        # Memory-optimized build

# Testing
npm test                  # Run tests once
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report
npm run test:ci           # CI mode (no watch)

# Linting - MEJORADO
npm run lint              # ESLint check
npm run lint:fix          # Auto-fix ESLint issues

# Maintenance - NUEVO
npm run clean             # Clean cache and dist
npm run reset             # Full reset: clean + install + dev

# Preview production build
npm run preview
```

### Docker Deployment
```bash
# Development
docker-compose up

# EC2 Production
docker-compose -f docker-compose.ec2.yml up -d

# View logs
docker-compose -f docker-compose.ec2.yml logs web
```

## 🔐 Authentication & Permissions - AWS COGNITO

### **Configuración Completa de AWS Cognito**

#### **User Pool ID**: `us-west-2_bdCwF60ZI`
#### **App Client ID**: `4i9hrd7srgbqbtun09p43ncfn0`
#### **Region**: `us-west-2`

### **👥 Usuarios Configurados**
| Usuario | Rol | Grupo | Email | Permisos |
|---------|-----|-------|-------|----------|
| **Fernando** | Administrador | `administradores` | elfogondedonsoto@gmail.com | Acceso completo |
| **Andy** | Mesero | `meseros` | josuesoto.ns17@gmail.com | Gestión de mesas/pedidos |
| **Enrique** | Mesero | `meseros` | josuesoto.ns17@gmail.com | Gestión de mesas/pedidos |
| **Brayan** | Mesero | `meseros` | josuesoto.ns17@gmail.com | Gestión de mesas/pedidos |
| **Keyla** | Mesero | `meseros` | josuesoto.ns17@gmail.com | Gestión de mesas/pedidos |
| **Rodrigo** | Cocinero | `cocineros` | josuesoto.ns17@gmail.com | Solo vista de cocina |

### **🏷️ Grupos y Permisos (Actualizado)**
- **administradores**: Acceso completo (configuración, inventario, operaciones, reportes, pagos)
- **meseros**: Solo gestión de mesas y pedidos (❌ NO pueden procesar pagos)
- **cocineros**: Solo vista de cocina (actualización de estado de items)

### **⚙️ Configuración Técnica**

#### **Frontend (.env)**
```bash
# 🔐 AWS Cognito Configuration (PRODUCTION READY)
VITE_AWS_REGION=us-west-2
VITE_AWS_COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI
VITE_AWS_COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0

# 🎯 Authentication Mode (NO USAR MockAuth en desarrollo)
VITE_DISABLE_AUTH=false
VITE_FORCE_COGNITO=true
```

#### **Backend (.env.dev)**
```bash
# 🔓 Authentication Mode - DESARROLLO CON COGNITO
USE_COGNITO_AUTH=True

# AWS Cognito
AWS_REGION=us-west-2
COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI
COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0
```

### **🚨 Problemas Comunes y Soluciones**

#### **Problem: "Mock logout" en consola**
**Causa**: Frontend usa MockAuthProvider en lugar de Cognito
**Solución**:
```bash
# 1. Verificar variables de entorno
grep -E "(VITE_AWS_|VITE_DISABLE_AUTH|VITE_FORCE_COGNITO)" frontend/.env

# 2. Asegurar configuración correcta
VITE_DISABLE_AUTH=false
VITE_FORCE_COGNITO=true

# 3. Reiniciar frontend
npm run reset
```

#### **Problem: Usuario no puede hacer login**
**Solución**:
```bash
# Verificar usuario existe en Cognito
aws cognito-idp list-users --user-pool-id us-west-2_bdCwF60ZI --region us-west-2

# Verificar grupos del usuario
aws cognito-idp admin-list-groups-for-user --user-pool-id us-west-2_bdCwF60ZI --username [USERNAME] --region us-west-2

# Agregar usuario a grupo si es necesario
aws cognito-idp admin-add-user-to-group --user-pool-id us-west-2_bdCwF60ZI --username [USERNAME] --group-name [GROUPNAME] --region us-west-2
```

### **🔧 Script de Diagnóstico**
```bash
# Ejecutar diagnóstico completo
./dev-diagnostics.sh
```

### **📱 Implementación en Código**
- **Backend**: `CognitoAuthenticationMiddleware` en Django
- **Frontend**: `AuthContext` en React con AWS Amplify
- **Tokens**: JWT con `cognito:groups` claims para verificación de roles
- **Auto-detección**: Sistema detecta automáticamente si usar Cognito o Mock basado en configuración
- **Permission Checking**: `hasPermission()` function validates user actions
- **Role-based Routing**: Automatic redirection to appropriate default route based on user role

## 🛠️ Troubleshooting & Mantenimiento

### **🚨 Problemas Comunes en Desarrollo**

#### **1. Frontend no carga (puerto 5173)**
```bash
# Diagnóstico rápido
./dev-diagnostics.sh

# Soluciones paso a paso
lsof -i :5173                    # Verificar qué usa el puerto
npm run clean                    # Limpiar cache
npm run reset                    # Reset completo
npm run dev:force               # Forzar inicio limpio
```

#### **2. Backend no responde (puerto 8000)**
```bash
# Verificar proceso Django
ps aux | grep "manage.py runserver"
lsof -i :8000

# Reiniciar backend
cd backend
python manage.py runserver 0.0.0.0:8000
```

#### **3. "Mock logout" aparece en consola**
```bash
# El sistema está usando MockAuth en lugar de Cognito
# Verificar configuración
grep -E "(VITE_.*)" frontend/.env

# Debe mostrar:
# VITE_DISABLE_AUTH=false
# VITE_FORCE_COGNITO=true
```

#### **4. Cambios en frontend no se reflejan**
```bash
# Limpiar cache de Vite
rm -rf frontend/node_modules/.vite
npm run dev:force

# O reset completo
npm run reset
```

#### **5. APIs no cargan / Error de conexión a backend** ⚠️ **CRÍTICO**
```bash
# Problema: Frontend carga pero las APIs no responden
# Causa común: Configuración incorrecta de variables de entorno o proxy

# 1. Verificar variables de entorno en frontend/.env
grep -E "VITE_API" frontend/.env

# Debe mostrar:
VITE_API_BASE_URL=http://localhost:8000/api/v1

# 2. Verificar configuración de API en frontend/src/services/api.js
# Debe usar: import.meta.env.VITE_API_BASE_URL

# 3. Verificar proxy en frontend/vite.config.js
# Debe incluir:
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
      secure: false
    }
  }
}

# 4. Reiniciar frontend después de cambios
kill $(ps aux | grep "node.*vite" | grep -v grep | awk '{print $2}')
cd frontend && npm run dev

# 5. Verificar que funciona
curl -s http://localhost:5173/api/v1/health/
# Debe responder: {"status": "ok", "message": "Restaurant API is running"}
```

#### **6. Vista de cocina: OrderItems agrupados incorrectamente**
```bash
# Problema: Items del mismo plato aparecen agrupados en lugar de individuales
# Solución: Verificar endpoint kitchen_board

# Test del endpoint:
curl -s http://localhost:8000/api/v1/orders/kitchen_board/ | jq '.[0] | {recipe_name, total_items}'

# Cada entrada debe mostrar: "total_items": 1
# Si muestra un número mayor, el backend está agrupando incorrectamente
```

### **📋 Checklist de Configuración**

#### **✅ Ambiente de Desarrollo Correcto**
- [ ] Puerto 5173 libre para frontend
- [ ] Puerto 8000 libre para backend  
- [ ] Variables de entorno configuradas correctamente
- [ ] AWS Cognito accesible desde desarrollo
- [ ] Usuarios de test configurados en Cognito

#### **✅ Variables de Entorno Requeridas** ⚠️ **ACTUALIZADO**
```bash
# Frontend (frontend/.env) - CONFIGURACIÓN CRÍTICA
VITE_API_BASE_URL=http://localhost:8000/api/v1  # ← DEBE SER EXACTAMENTE ESTA VARIABLE
VITE_AWS_REGION=us-west-2
VITE_AWS_COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI
VITE_AWS_COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0
VITE_DISABLE_AUTH=false
VITE_FORCE_COGNITO=true

# Backend (.env.dev)
USE_COGNITO_AUTH=True
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0,host.docker.internal
```

#### **✅ Configuración de Vite (frontend/vite.config.js)** ⚠️ **NUEVO REQUERIMIENTO**
```javascript
export default defineConfig({
  plugins: [react(), injectBuildTime()],
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    open: true,
    proxy: {                          // ← PROXY REQUERIDO PARA APIs
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  // ... resto de configuración
})
```

#### **✅ Configuración de API (frontend/src/services/api.js)** ⚠️ **VERIFICAR**
```javascript
// Debe usar la variable correcta:
if (import.meta.env.VITE_API_BASE_URL) {
  API_BASE_URL = import.meta.env.VITE_API_BASE_URL;  // ← NO VITE_API_URL
}
```

### **🚀 Scripts de Mantenimiento**

#### **Diagnóstico Completo**
```bash
./dev-diagnostics.sh
```

#### **Reset de Desarrollo**
```bash
# Frontend
npm run reset

# Backend
cd backend
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

#### **🔍 Verificaciones Post-Corrección** ⚠️ **NUEVA SECCIÓN**
```bash
# 1. Verificar que el diagnóstico pase completamente
./dev-diagnostics.sh
# Debe mostrar: ✅ Backend responde, ✅ Frontend responde

# 2. Test de conectividad API directa
curl -s http://localhost:8000/api/v1/health/
# Esperado: {"status": "ok", "message": "Restaurant API is running"}

# 3. Test de proxy a través de frontend
curl -s http://localhost:5173/api/v1/health/
# Esperado: {"status": "ok", "message": "Restaurant API is running"}

# 4. Test específico de kitchen_board (corrección OrderItems)
curl -s http://localhost:5173/api/v1/orders/kitchen_board/ | jq '.[0] | {recipe_name, total_items}'
# Esperado: "total_items": 1 (cada OrderItem individual)

# 5. Verificar todas las APIs críticas
curl -s http://localhost:5173/api/v1/tables/ | jq 'length'      # Debe retornar número de mesas
curl -s http://localhost:5173/api/v1/recipes/ | jq 'length'     # Debe retornar número de recetas  
curl -s http://localhost:5173/api/v1/orders/ | jq 'length'      # Debe retornar número de órdenes

# 6. Test de variables de entorno en consola del navegador
# Abrir http://localhost:5173 → F12 → Console
# Buscar: "API Configuration:" 
# Verificar: API_BASE_URL: "http://localhost:8000/api/v1"
```

#### **⚠️ Si algo falla, ejecutar en orden:**
```bash
# 1. Detener todos los servicios
kill $(ps aux | grep "manage.py runserver" | grep -v grep | awk '{print $2}')
kill $(ps aux | grep "node.*vite" | grep -v grep | awk '{print $2}')

# 2. Verificar configuraciones
grep -E "VITE_API" frontend/.env
grep -E "proxy.*api" frontend/vite.config.js
grep -E "VITE_API_BASE_URL" frontend/src/services/api.js

# 3. Reiniciar en orden correcto
cd backend && python manage.py runserver 0.0.0.0:8000 &
sleep 3
cd frontend && npm run dev &
sleep 5

# 4. Ejecutar verificaciones nuevamente
./dev-diagnostics.sh
```

### **📊 Monitoreo en Desarrollo**

#### **Logs Importantes**
```bash
# Frontend logs
tail -f frontend/frontend_server.log

# Backend logs  
tail -f backend/django_server.log

# Cognito authentication
# Verificar en browser console las configuraciones de Cognito
```

## 📊 Core Application Architecture & Data Flow

### **Primary Models & Relationships**

#### **Configuration Models** (`backend/config/models.py`)
```python
# Core restaurant configuration
Table → Zone (restaurant areas)
Unit → Ingredient measurements (kg, gramos, etc.)
Container → Takeaway containers with pricing
```

#### **Inventory Models** (`backend/inventory/models.py`)
```python
# Menu management system
Group → Recipe categories (Platos Fuertes, Bebidas, etc.)
Ingredient → Raw materials with stock tracking
Recipe → Menu items with:
  - Base price and ingredients
  - Container compatibility for takeaway
  - Group classification
```

#### **Operation Models** (`backend/operation/models.py`)
```python
# Restaurant operations workflow
Order → Table relationship with status tracking:
  - created → pending → served → paid
  
OrderItem → Recipe selections with:
  - Individual status tracking
  - Container selection for takeaway
  - Total price calculation (recipe + container)
  
Payment → Multiple payment methods:
  - efectivo, yape, transferencia
  - Split payments supported
```

### **🔄 Complete Order Workflow**

#### **1. Table Management** (`/operations`)
- **Waiter Role**: Selects table, views active orders
- **Zone Filtering**: Organizes tables by restaurant areas
- **Table Status**: Visual indicators (green=available, red=orders pending, blue=all items served)

#### **2. Order Creation**
```mermaid
Table Selection → Menu Browser → Recipe Selection → Cart Management → Order Confirmation
```
- **Menu Navigation**: Grouped by categories (Platos Fuertes, Bebidas, etc.)
- **Recipe Selection**: Price display with container options
- **Cart System**: Quantity management and real-time totals
- **Takeaway Option**: Container selection with additional pricing

#### **3. Kitchen Operations** (`/kitchen`)
- **Cook Role**: Views orders by preparation status
- **Status Updates**: created → pending → served
- **Real-time Updates**: 5-second polling for immediate status sync
- **Individual Items**: Each OrderItem appears separately (not grouped by recipe)

#### **4. Payment Processing** (Admin Only)
- **Payment Methods**: Cash, Yape, Bank transfer
- **Split Payments**: Multiple payment types per order
- **Receipt Printing**: Bluetooth thermal printer integration (58mm paper, 48 characters width)
- **Status Completion**: served → paid
- **Partial Payments**: Process only items with "served" status

### **🎯 User Roles & Permissions**

#### **Administradores** (Full Access)
```javascript
permissions: {
  canViewDashboard: true,
  canManageConfig: true,      // Tables, Zones, Units, Containers
  canManageInventory: true,   // Groups, Ingredients, Recipes
  canManageOrders: true,      // Create, edit orders
  canViewKitchen: true,       // Kitchen operations
  canManagePayments: true,    // Process payments
  canViewHistory: true        // Payment history
}
defaultRoute: '/'             // Dashboard Operativo
```

#### **Meseros** (Operations Focus)
```javascript
permissions: {
  canManageOrders: true,      // Table management only
  canViewOrders: true,
  canViewTableStatus: true,
  canManagePayments: false    // ❌ Cannot process payments
  // All other permissions: false
}
defaultRoute: '/operations'   // Redirects to table management
```

#### **Cocineros** (Kitchen Only)
```javascript
permissions: {
  canViewKitchen: true        // Kitchen view only
  // All other permissions: false
}
defaultRoute: '/kitchen'      // Direct kitchen access
```

## Database Schema

Uses Django ORM with three main model groups:
- **Config models**: Tables, Zones, Units, Containers
- **Inventory models**: Groups, Ingredients, Recipes with stock tracking
- **Operation models**: Orders, OrderItems, Payments with status management

## 🚀 Deployment & Production Architecture

### 🏗️ **Production Infrastructure**
- **Server**: AWS EC2 (44.248.47.186)
- **Domain**: https://www.xn--elfogndedonsoto-zrb.com
- **SSL**: Let's Encrypt certificates (automated)
- **Frontend**: React SPA built with Vite, served by nginx
- **Backend**: Django REST API in Docker container
- **Database**: SQLite for production simplicity
- **Auth**: AWS Cognito with JWT tokens

### 🔄 **Workflow: Development → Production**

#### **Development Environment - ACTUALIZADO**
```bash
# 🛠️ Local Development (backend + frontend separados)
# Terminal 1: Backend Django
cd backend
python manage.py runserver 0.0.0.0:8000

# Terminal 2: Frontend React + Vite  
cd frontend
npm run dev                 # Puerto 5173 (optimizado)

# 📍 URLs de desarrollo ACTUALES
- Frontend: http://localhost:5173
- API Backend: http://localhost:8000/api/v1/
- Dashboard Financiero: http://localhost:5173/dashboard-financiero
- Vista Cocina: http://localhost:5173/kitchen
- Gestión Mesas: http://localhost:5173/tables
```

#### **Production Deployment - PROCEDIMIENTO PASO A PASO**

##### **1. Preparación Local**
```bash
# ✅ Verificar que desarrollo funciona correctamente
npm run dev                    # Frontend debe iniciar en puerto 5173
cd backend && python manage.py runserver  # Backend en puerto 8000

# ✅ Ejecutar tests antes de deployment
npm test                       # Frontend tests
cd backend && pytest          # Backend tests

# ✅ Verificar no hay console.logs ni código debug
npm run lint                   # Linting frontend
```

##### **2. Commit y Push Cambios**
```bash
# ✅ Commit todos los cambios locales
git add .
git commit -m "feat: [descripción de cambios] 🚀

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# ✅ Push a main branch
git push origin main
```

##### **3. Deploy en Servidor EC2**
```bash
# 🚀 Conexión SSH al servidor
ssh -i ~/Downloads/ubuntu_fds_key.pem ubuntu@44.248.47.186

# 📁 Navegar al proyecto
cd /opt/restaurant-web

# 🔄 Pull últimos cambios
git pull origin main

# 🚀 Ejecutar deployment (elegir opción según necesidad)
sudo ./deploy/build-deploy.sh                  # Deploy completo (5 min)
sudo ./deploy/build-deploy.sh --frontend-only  # Solo frontend (2 min) 
sudo ./deploy/build-deploy.sh --backend-only   # Solo backend (30 seg)

# ✅ Verificar deployment exitoso
sudo docker-compose -f docker-compose.ssl.yml ps
curl -s https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/
```

##### **4. Verificación Post-Deploy**
```bash
# 🩺 Verificar servicios corriendo
sudo docker-compose -f docker-compose.ssl.yml ps

# 🔍 Verificar logs
sudo docker-compose -f docker-compose.ssl.yml logs -f web
sudo docker-compose -f docker-compose.ssl.yml logs -f nginx

# 🌐 Test de conectividad
curl -s https://www.xn--elfogndedonsoto-zrb.com/
curl -s https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/

# 📊 Test funcionalidades críticas
# - Login con AWS Cognito
# - Dashboard Financiero con datos
# - Vista Cocina con filtros por mesa
# - Gestión de Mesas con nuevos pedidos
```

### 📋 **Archivos Clave del Sistema**

| **Archivo** | **Entorno** | **Propósito** |
|-------------|------------|---------------|
| `docker-compose.dev.yml` | 🛠️ Desarrollo | HTTP, desarrollo local |
| `docker-compose.ssl.yml` | 🚀 Producción | HTTPS, SSL completo |
| `nginx/conf.d/dev.conf` | 🛠️ Desarrollo | Nginx para desarrollo |
| `nginx/conf.d/ssl.conf` | 🚀 Producción | Nginx con SSL y security headers |
| `.env.dev` | 🛠️ Desarrollo | Auth OFF, DB development |
| `.env.ec2` | 🚀 Producción | Auth ON, DB production |

### 🔐 **Credenciales y Seguridad**

> **⚠️ IMPORTANTE**: Las credenciales NO están en el repositorio por seguridad.

#### **SSH Access**
```bash
# Conexión al servidor
chmod 400 ~/Downloads/ubuntu_fds_key.pem
ssh -i ~/Downloads/ubuntu_fds_key.pem ubuntu@44.248.47.186
```

#### **Environment Variables**
- **Desarrollo**: `.env.dev` (Auth deshabilitado)
- **Producción**: `.env.ec2` (En servidor, NO en repo)
- **Template**: `.env.credentials.example` (Guía para configurar)

### 🎯 **Scripts de Deployment - Optimizados**

| **Script** | **Función** | **Uso** |
|------------|-------------|---------|
| `build-deploy.sh` | 🚀 **PRINCIPAL** - Deploy completo | `sudo ./deploy/build-deploy.sh` |
| `setup-initial.sh` | ⚙️ Configuración inicial | Una vez al inicio |
| `enable-ssl.sh` | 🔒 SSL/HTTPS setup | Cuando se necesite |
| `maintenance.sh` | 🔧 Mantenimiento | `./maintenance.sh --status` |
| `diagnose-connection.sh` | 🩺 Diagnóstico | Troubleshooting |

### 📊 **API Endpoints Optimizados**

#### **Core APIs**
- **Health**: `/api/v1/health/`
- **Tables**: `/api/v1/tables/`
- **Recipes**: `/api/v1/recipes/`
- **Orders**: `/api/v1/orders/`
- **Groups**: `/api/v1/groups/`

#### **Import APIs (Optimizados)**
- **Units**: `/import-units/` (Excel only)
- **Zones**: `/import-zones/` (Excel only)
- **Tables**: `/import-tables/` (Excel only)
- **Containers**: `/import-containers/` (Excel only)
- **Groups**: `/import-groups/` (Excel only)
- **Ingredients**: `/import-ingredients/` (Excel only)
- **Recipes**: `/import-recipes/` (Excel only)

#### **Excel Templates**
- Disponibles en: `/frontend/public/templates/`
- 7 plantillas optimizadas para todas las importaciones
- Solo formato Excel (.xlsx/.xls) permitido

### 🔍 **Troubleshooting & Monitoring**

#### **Estado del Sistema**
```bash
# Verificar servicios
docker-compose -f docker-compose.ssl.yml ps

# Logs en tiempo real
docker-compose -f docker-compose.ssl.yml logs -f

# Diagnóstico completo
./deploy/diagnose-connection.sh
```

#### **Tests de Conectividad**
```bash
# API Health
curl -s https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/

# Frontend
curl -s https://www.xn--elfogndedonsoto-zrb.com/

# Import endpoint example
curl -X POST https://www.xn--elfogndedonsoto-zrb.com/import-units/ \
  -F "file=@plantilla_unidades.xlsx"
```

### ⚡ **Optimizaciones Implementadas - Agosto 2025**

#### **Performance**
- ✅ **Bundle size**: 394KB (optimizado)
- ✅ **Deploy time**: 5 min vs 10 min original (50% mejora)
- ✅ **Caching**: Foreign key lookups optimizados
- ✅ **Bulk operations**: Import Excel con factory pattern
- ✅ **Component Performance**: Map-based indexing (O(1) lookups)
- ✅ **Smart Refresh**: Visibility API para pausar actualizaciones cuando no está activo
- ✅ **Memoization**: Funciones costosas memoizadas con useMemo/useCallback
- ✅ **N+1 Query Elimination**: Batch API loading optimizado

#### **Code Quality**
- ✅ **4,500+ líneas** eliminadas (código innecesario)
- ✅ **48 scripts obsoletos** removidos (84% reducción)
- ✅ **150+ console.logs** eliminados
- ✅ **Response formats** estandarizados
- ✅ **Component Architecture**: TableOrderEcommerce optimizado (1,883 lines)
- ✅ **State Management**: Centralized state updates with selective rendering

#### **Security & Authentication**
- ✅ **SSL/HTTPS** completo con Let's Encrypt
- ✅ **AWS Cognito** integración completa
- ✅ **Role-based Permissions**: Frontend permission system implemented
- ✅ **File validation** para uploads
- ✅ **CORS** configurado apropiadamente

#### **User Experience**
- ✅ **Receipt Printing**: Bluetooth thermal printer con alineación perfecta (48 characters)
- ✅ **Payment Flow**: UI states sincrónicos con backend
- ✅ **Table Management**: Filtros por zona y estado, botón flotante para nuevos pedidos
- ✅ **Kitchen Workflow**: OrderItems individuales (no agrupados)
- ✅ **Container Pricing**: Para llevar con precios de envases incluidos

## 🏗️ **Application Architecture & Patterns**

### **Frontend Architecture**

#### **Component Hierarchy**
```
├── App.jsx (Auth provider, routing setup)
├── Layout.jsx (Navigation, role-based menu filtering)
├── pages/
│   ├── operation/
│   │   ├── TableOrderEcommerce.jsx (Main operations view - 1,883 lines)
│   │   ├── Kitchen.jsx (Cook interface)
│   │   └── PaymentHistory.jsx (Admin payment records)
│   ├── config/ (Admin-only configuration)
│   └── inventory/ (Admin-only menu management)
├── components/
│   ├── auth/ (ProtectedRoute, RoleProtectedRoute)
│   ├── orders/ (PaymentModal, SplitPaymentModal)
│   └── common/ (Reusable UI components)
└── contexts/
    ├── AuthContext.jsx (AWS Cognito integration)
    └── ToastContext.jsx (User notifications)
```

#### **Key Design Patterns**

##### **API Integration Pattern**
```javascript
// Centralized API client with JWT authentication
// frontend/src/services/api.js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Authorization': `Bearer ${token}` }
});
```

##### **Permission-Based Component Pattern**
```javascript
// Role-based rendering
{hasPermission('canManagePayments') && (
  <button onClick={handleProcessPayment}>
    Procesar Pago
  </button>
)}

// Protected route pattern
<RoleProtectedRoute 
  component={Kitchen} 
  requiredPermission="canViewKitchen" 
/>
```

##### **State Management Pattern**
```javascript
// Optimized state with selective updates
const [appState, setAppState] = useState({
  orders: new Map(),     // Map for O(1) lookups
  tables: [],
  recipes: [],
  loading: false
});

// Memoized data transformations
const tablesByZone = useMemo(() => 
  groupBy(tables, 'zone_name'), [tables]
);
```

### **Backend Architecture**

#### **Django REST Framework Structure**
```
backend/
├── config/ (Core models: Table, Zone, Unit, Container)
├── inventory/ (Menu: Group, Ingredient, Recipe)
├── operation/ (Orders: Order, OrderItem, Payment)
└── restaurant_backend/
    ├── middleware.py (Cognito authentication)
    ├── permissions.py (Role-based API access)
    └── settings.py (Environment configuration)
```

#### **API Design Patterns**

##### **Optimized Query Pattern**
```python
# Prevent N+1 queries with prefetch_related
queryset = Order.objects.select_related('table__zone').prefetch_related(
    'orderitem_set__recipe__group',
    'container_sales__container',
    'payments'
).order_by('-created_at')
```

##### **Status Workflow Pattern**
```python
# Order/OrderItem status progression
STATUS_CHOICES = [
    ('created', 'Created'),    # Initial state
    ('pending', 'Pending'),    # Kitchen preparing
    ('served', 'Served'),      # Ready for payment
    ('paid', 'Paid')           # Complete
]
```

### **Performance Optimization Patterns**

#### **Frontend Optimizations**
- **Map-based Indexing**: O(1) lookups for orders and tables
- **Memoized Calculations**: Expensive totals and filters cached
- **Smart Refresh**: Polling pauses when tab is inactive
- **Component Splitting**: Large components divided into focused modules

#### **Backend Optimizations**
- **Foreign Key Prefetching**: Single queries instead of N+1
- **Bulk Operations**: Excel imports use Django bulk_create
- **Status Indexes**: Database indexes on commonly filtered fields

### **Printing & Hardware Integration**

#### **Bluetooth Thermal Printer Pattern**
```javascript
// 58mm paper (48 characters width) alignment
const formatReceiptLine = (item, price) => {
  const totalWidth = 48;
  const priceWidth = 10;
  const itemName = item.replace(/[ñáéíóú]/g, char => normalizeChar(char));
  
  return itemName.padEnd(totalWidth - priceWidth) + 
         price.toString().padStart(priceWidth);
};
```

## Testing Framework

### Backend Tests (pytest)
```bash
# Run all tests with coverage
pytest --cov=. --cov-report=term-missing

# Test categories
pytest -m "unit"           # Unit tests only
pytest -m "integration"    # Integration tests only
pytest -m "slow"           # Long-running tests

# Test fixtures available
# - admin_user, waiter_user, cook_user
# - sample_table, sample_recipe, sample_order
```

### Frontend Tests (Jest + React Testing Library)
```bash
# Run tests
npm test                   # Interactive mode
npm run test:ci           # CI mode with coverage
npm run test:watch        # Watch for changes

# Test structure
# - src/__tests__/setup.js: Global test configuration
# - src/__tests__/components/: Component tests
# - src/__tests__/contexts/: Context tests
# - src/__tests__/services/: Service tests
```

### Coverage Requirements
- Backend: 70% minimum coverage (lines, functions, branches)
- Frontend: 70% minimum coverage
- Critical components require 90%+ coverage

## CI/CD Pipeline

### GitHub Actions Workflows

#### 1. CI/CD Pipeline (`.github/workflows/ci-cd.yml`)
- Triggers: Push to main/develop, PRs to main
- Backend testing with PostgreSQL
- Frontend testing and build
- Security scanning (Bandit, Safety, npm audit)
- Automated deployment to dev/prod

#### 2. PR Checks (`.github/workflows/pr-checks.yml`)
- Fast feedback for pull requests
- Quick unit tests and linting
- Code quality checks
- Performance analysis

#### 3. Quality Gate (`.github/workflows/quality-gate.yml`)
- Comprehensive testing suite
- Integration tests
- Performance benchmarks
- Security audits
- Nightly quality checks

#### 4. Deployment (`.github/workflows/deploy.yml`)
- Production deployment to EC2
- Health checks and rollback capability
- Blue-green deployment strategy
- Database migrations

### Deployment Process
1. Code push triggers CI pipeline
2. Tests run in parallel (backend + frontend)
3. Security scans validate dependencies
4. Build artifacts created and tested
5. Deployment to staging/production
6. Health checks verify deployment
7. Rollback available if issues detected

### Environment Configuration
- **Development**: Local Docker with hot reload
- **Staging**: Automated deployment from develop branch
- **Production**: Manual/automated deployment from main branch
- **Monitoring**: Health checks, logging, error tracking

### Required Secrets (GitHub)
- `EC2_SSH_KEY`: SSH private key for EC2 access
- `EC2_HOST`: Production server hostname
- `EC2_USER`: SSH username (typically ubuntu)

### Quality Gates
- All tests must pass (70%+ coverage)
- No high-severity security vulnerabilities
- Linting and code style checks pass
- Build size within acceptable limits
- API health checks successful

---

## 🎯 **Performance Monitoring & Metrics**

### **Application Performance Indicators**
- **Bundle Size**: 394KB (optimized)
- **Initial Load Time**: ~2 seconds
- **API Response Time**: <200ms average
- **Memory Usage**: Optimized with proper cleanup
- **Render Cycles**: 60% reduction with memoization

### **Key Performance Files**
- **TableOrderEcommerce.jsx**: 1,883 lines (main performance focus)
- **Kitchen.jsx**: Real-time polling every 5 seconds
- **AuthContext.jsx**: Cognito integration with proper event cleanup
- **bluetoothPrinter.js**: Hardware integration for receipt printing

### **Development Performance Tools**
```bash
# Bundle analysis
npm run build:prod && npx vite-bundle-analyzer dist

# Performance profiling
npm run dev:debug  # Verbose logging
lighthouse http://localhost:5173  # Lighthouse audit

# Memory leak detection
Chrome DevTools → Performance → Record → Stop → Analyze
```

---

## 📚 **Quick Reference Guide**

### **Essential Commands**
```bash
# Quick start development
./dev-diagnostics.sh                 # Health check
cd frontend && npm run dev           # Start frontend
cd backend && python manage.py runserver 0.0.0.0:8000  # Start backend

# Production deployment
ssh -i ubuntu_fds_key.pem ubuntu@44.248.47.186
sudo ./deploy/build-deploy.sh        # Full deployment
```

### **Key API Endpoints**
- **Health Check**: `/api/v1/health/`
- **Table Management**: `/api/v1/tables/`
- **Order Operations**: `/api/v1/orders/`
- **Kitchen Board**: `/api/v1/orders/kitchen_board/`
- **Payment Processing**: `/api/v1/payments/`

### **User Access**
- **Admin**: Fernando (full access)
- **Waiters**: Andy, Enrique, Brayan, Keyla (table management only)
- **Cook**: Rodrigo (kitchen view only)

### **Important File Locations**
- **Main Operations View**: `frontend/src/pages/operation/TableOrderEcommerce.jsx`
- **Authentication**: `frontend/src/contexts/AuthContext.jsx`
- **API Configuration**: `frontend/src/services/api.js`
- **Printer Integration**: `frontend/src/services/bluetoothPrinter.js`
- **Backend Models**: `backend/operation/models.py`

### **Performance Optimization Opportunities**
Based on comprehensive analysis, the application is well-optimized with these completed improvements:
- Map-based indexing for O(1) lookups
- Memoized expensive calculations
- Smart refresh with visibility API
- Role-based permission system
- Bluetooth printer integration
- Container pricing for takeaway items