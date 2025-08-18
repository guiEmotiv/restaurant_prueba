# CLAUDE.md

## 🏗️ Restaurant Management System - OPTIMIZED & EFFICIENT

**Stack**: Django 5.2 + React 19.1 + Vite + Docker + AWS Cognito  
**Deploy**: EC2 + Nginx + SSL | **Database**: SQLite

---

## ⚡ **STREAMLINED USAGE**

```bash
# Development
./deploy.sh --dev    # OR just: ./deploy.sh

# Production Deploy  
./deploy.sh --prod

# Build Only
./deploy.sh --build
```

**URLs**:
- **Dev**: http://localhost:5173 + http://localhost:8000/api/v1/
- **Prod**: https://www.xn--elfogndedonsoto-zrb.com/

---

## 🚀 **SINGLE-COMMAND PRODUCTION DEPLOYMENT**

```bash
# From local machine - deploys to EC2
ssh -i "ubuntu_fds_key.pem" ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com "
cd /opt/restaurant-web && 
git pull origin main && 
./deploy.sh --prod
"
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

### **Environment Variables** (`.env.ec2`)
```bash
# Production - No duplicates, minimal config
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
| **500 on orders** | `docker exec restaurant-backend python /app/backend/manage.py migrate` | "OK" for each migration |
| **403 Forbidden** | Logout/login (JWT expired) | New valid token |
| **502 Bad Gateway** | `docker-compose restart nginx` | nginx starts without errors |
| **Container issues** | `docker ps \| grep restaurant` | Both containers running |
| **Settings check** | `docker exec restaurant-backend printenv DJANGO_SETTINGS_MODULE` | `backend.settings_ec2` |

---

## ✅ **DEPLOYMENT CHECKLIST**

### Pre-Deploy (30 seconds)
- [ ] `git status` clean
- [ ] `./deploy.sh --build` works locally

### Deploy (90 seconds)
- [ ] `git pull origin main` successful
- [ ] `./deploy.sh --prod` completes without errors
- [ ] Both containers running: `docker ps`

### Verification (30 seconds)
- [ ] Website loads: https://www.xn--elfogndedonsoto-zrb.com/
- [ ] API responds: `curl -s "https://www.xn--elfogndedonsoto-zrb.com/api/v1/orders/kitchen_board/"`
- [ ] Kitchen view: No 500 errors, polling active, audio button visible

---

## 🗂️ **STREAMLINED FILE STRUCTURE**

```
restaurant-web/
├── deploy.sh              # SINGLE deployment script
├── docker-compose.yml     # Simplified container config
├── .env.ec2               # Clean production env (17 lines)
├── nginx/
│   ├── conf.d/ssl.conf    # Optimized nginx (50 lines vs 131)
│   └── proxy_params       # Reusable proxy config
├── backend/backend/
│   └── settings_ec2.py    # Production Django settings
└── frontend/
    └── src/pages/operation/
        └── Kitchen.jsx    # Production-ready polling
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

**🎯 RESULT: 2-minute deployment, zero configuration errors, maximum efficiency.**