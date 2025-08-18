# CLAUDE.md

## 🏗️ Restaurant Management System - OPTIMIZED & EFFICIENT v2.0

**Stack**: Django 5.2 + React 19.1 + Vite + Docker + AWS Cognito  
**Deploy**: EC2 + Nginx + SSL | **Database**: SQLite

---

## ⚡ **ENHANCED DEPLOYMENT COMMANDS**

```bash
# Development
./deploy.sh --dev      # Start dev environment (handles migrations automatically)
./deploy.sh --check    # Health check
./deploy.sh --migrate  # Run migrations with auto-fixes

# Production Deploy
./deploy.sh --prod     # Deploy to production
./deploy.sh --sync     # Sync dev DB to prod (with backup)

# Remote Deployment (NEW!)
./deploy-remote.sh deploy       # Standard deployment
./deploy-remote.sh deploy-sync  # Deploy with DB sync
./deploy-remote.sh status      # Check remote status
./deploy-remote.sh backup      # Backup production DB
./deploy-remote.sh logs        # View remote logs
```

**URLs**:
- **Dev**: http://localhost:5173 + http://localhost:8000/api/v1/
- **Prod**: https://www.xn--elfogndedonsoto-zrb.com/

---

## 🚀 **AUTOMATED DEPLOYMENT FEATURES**

### **Local Development** (`./deploy.sh --dev`)
- ✅ Auto-installs npm dependencies if missing
- ✅ Kills existing processes on port 5173
- ✅ Handles problematic migrations automatically
- ✅ Waits for containers to be ready
- ✅ Color-coded output for better visibility

### **Production Deployment** (`./deploy.sh --prod`)
- ✅ Checks for uncommitted changes
- ✅ Auto-backups database before deployment
- ✅ Smart migration handling with fallbacks
- ✅ Health checks after deployment
- ✅ Validates nginx configuration

### **Remote Deployment** (`./deploy-remote.sh`)
```bash
# Quick deploy from local to production
./deploy-remote.sh deploy

# Deploy with database sync (replaces prod with dev data)
./deploy-remote.sh deploy-sync

# Check production status
./deploy-remote.sh status
```

**What it does automatically**:
1. ✅ Builds frontend with production config
2. ✅ Updates Docker containers with correct settings  
3. ✅ Applies database migrations (handles known issues)
4. ✅ Performs health check verification

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

| Issue | Command | Expected Result |
|-------|---------|-----------------|
| **500 on orders** | `./deploy.sh --migrate` | Auto-fixes migration issues |
| **403 Forbidden** | Logout/login (JWT expired) | New valid token |
| **502 Bad Gateway** | `docker-compose restart nginx` | nginx starts without errors |
| **Container issues** | `./deploy.sh --check` | Health status report |
| **Migration errors** | `bash scripts/migration-helper.sh` | Handles problematic migrations |
| **Settings check** | `docker exec restaurant-backend printenv DJANGO_SETTINGS_MODULE` | `backend.settings_ec2` |

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
./deploy.sh --prod
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