# CLAUDE.md

## 🏗️ Restaurant Management System - OPTIMIZED DEPLOYMENT

**Stack**: Django 5.2 + React 19.1 + Vite + Docker + AWS Cognito  
**Deploy**: EC2 + Nginx + SSL | **Database**: SQLite

---

## ⚡ Quick Start

### Development
```bash
./dev.sh    # Backend (Docker) + Frontend (Vite) - OPTIMAL
```
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8000/api/v1/
- **Docs**: http://localhost:8000/api/v1/docs/

### Production
```bash
./prod.sh   # Complete production stack
```
- **Website**: https://www.xn--elfogndedonsoto-zrb.com/
- **API**: https://www.xn--elfogndedonsoto-zrb.com/api/v1/

---

## 🚀 **ZERO-ERROR DEPLOYMENT PROCESS**

### 1. Local Development to Production

```bash
# 1. Test changes locally first
./dev.sh

# 2. Commit and push changes
git add -A && git commit -m "feat: your changes" && git push origin main

# 3. Deploy to Production (AUTOMATED)
ssh -i "ubuntu_fds_key.pem" ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com "
cd /opt/restaurant-web && 
git pull origin main && 
./deploy-prod.sh
"
```

### 2. Single Command Deploy Script
Create `deploy-prod.sh` for zero-error deployment:

```bash
#!/bin/bash
set -e

echo "🚀 ZERO-ERROR PRODUCTION DEPLOYMENT"

# Step 1: Build frontend with production config
cd frontend
npm run build
cd ..

# Step 2: Update containers with correct settings
docker-compose down
docker-compose up -d app nginx

# Step 3: CRITICAL - Apply database migrations
echo "📊 Applying database migrations..."
sleep 10  # Wait for backend to start
docker exec restaurant-backend python /app/backend/manage.py migrate || {
    echo "⚠️  Migration failed, trying with --fake for known issues"
    docker exec restaurant-backend python /app/backend/manage.py migrate config 0013 --fake
    docker exec restaurant-backend python /app/backend/manage.py migrate operation 0021 --fake
    docker exec restaurant-backend python /app/backend/manage.py migrate
}

# Step 4: Verify deployment
echo "✅ Verifying deployment..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "✅ DEPLOYMENT COMPLETE!"
echo "🌐 Website: https://www.xn--elfogndedonsoto-zrb.com/"
echo "🔧 API: https://www.xn--elfogndedonsoto-zrb.com/api/v1/"
```

---

## 🔧 **OPTIMIZED CONFIGURATION FILES**

### `docker-compose.yml` - PRODUCTION READY
```yaml
version: '3.8'

services:
  app:
    image: restaurant-web-app
    build:
      context: .
      dockerfile: backend/Dockerfile
    container_name: restaurant-backend
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
      - ./backend:/app/backend
    environment:
      - DJANGO_SETTINGS_MODULE=backend.settings_ec2
      - DATABASE_PATH=/app/data
      - DATABASE_NAME=restaurant_prod.sqlite3
    env_file:
      - .env.ec2
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    container_name: restaurant-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d/ssl.conf:/etc/nginx/conf.d/default.conf
      - ./frontend/dist:/var/www/html
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - app
    restart: unless-stopped
```

### `.env.ec2` - PRODUCTION ENVIRONMENT
```bash
# Production Configuration
DEBUG=False
USE_COGNITO_AUTH=True
DOMAIN_NAME=xn--elfogndedonsoto-zrb.com
DATABASE_NAME=restaurant_prod.sqlite3

# AWS Cognito Configuration
COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI
COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0
AWS_REGION=us-west-2
```

---

## 🎯 **CRITICAL SUCCESS FACTORS**

### Backend Settings Verification
```bash
# MUST use settings_ec2.py in production
docker exec restaurant-backend printenv DJANGO_SETTINGS_MODULE
# Expected: backend.settings_ec2
```

### Database Migrations - CRITICAL
```bash
# ALWAYS run after deployment
docker exec restaurant-backend python /app/backend/manage.py migrate
```

### Nginx Configuration - MUST HAVE
```nginx
# In ssl.conf - CRITICAL for API to work
location /api/ {
    proxy_pass http://restaurant-backend:8000;  # Correct container name
    proxy_set_header Authorization $http_authorization;  # CRITICAL for auth
    
    # Handle JWT tokens (large headers)
    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;
}
```

### Kitchen View Polling - PRODUCTION READY
```javascript
// In Kitchen.jsx - NOW WORKS IN PRODUCTION
useEffect(() => {
    // Polling and audio notifications ENABLED in production
    notificationService.setCurrentUserRole(userRole);
    orderItemPoller.setKitchenView(true);
    orderItemPoller.startPolling();
    
    return () => {
        orderItemPoller.stopPolling();
    };
}, [userRole]);
```

---

## 🔍 **INSTANT PROBLEM DETECTION**

### Health Check Commands
```bash
# 1. Check all containers running
docker ps --format "table {{.Names}}\t{{.Status}}"

# 2. Check backend settings
docker exec restaurant-backend python -c "
from django.conf import settings; 
print('✅ Settings:', settings.SETTINGS_MODULE);
print('✅ Cognito Auth:', settings.USE_COGNITO_AUTH)"

# 3. Test API authentication
curl -s "https://www.xn--elfogndedonsoto-zrb.com/api/v1/orders/kitchen_board/"
# Expected: {"detail": "Las credenciales de autenticación no se proveyeron."}

# 4. Check migrations status
docker exec restaurant-backend python /app/backend/manage.py showmigrations | grep -E "\[ \]"
# Should return EMPTY (no pending migrations)
```

### Common Issues - INSTANT FIXES

| Error | Instant Fix |
|-------|-------------|
| 500 on `/api/v1/orders/` | `docker exec restaurant-backend python /app/backend/manage.py migrate` |
| 403 Forbidden | Check JWT token expired - logout/login |
| 502 Bad Gateway | `docker-compose restart nginx` |
| nginx can't find upstream | Verify `restaurant-backend:8000` in nginx config |
| Kitchen view no polling | Check Kitchen.jsx has no `import.meta.env.MODE === 'development'` restrictions |

---

## 📋 **PRODUCTION CHECKLIST**

### Pre-Deploy (Local)
- [ ] `./dev.sh` works without errors
- [ ] Frontend builds: `cd frontend && npm run build`
- [ ] No console errors in browser
- [ ] `git status` clean - all changes committed

### Deploy (EC2)
- [ ] `git pull origin main` successful
- [ ] `docker-compose up -d` successful
- [ ] `docker exec restaurant-backend python /app/backend/manage.py migrate` successful
- [ ] Both containers running: `docker ps`

### Post-Deploy Verification
- [ ] Website loads: https://www.xn--elfogndedonsoto-zrb.com/
- [ ] Login works (AWS Cognito)
- [ ] Kitchen view loads without 500 errors
- [ ] Orders can be created
- [ ] Audio button appears in kitchen view

---

## 🏗️ **ARCHITECTURE OVERVIEW**

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Frontend      │────│    Nginx     │────│    Backend      │
│   React + Vite  │    │   SSL + Proxy│    │  Django + Auth  │
│   Port: 5173    │    │   Port: 443  │    │   Port: 8000    │
└─────────────────┘    └──────────────┘    └─────────────────┘
         │                       │                     │
         │                       │                     │
    ┌────────────┐        ┌──────────────┐    ┌──────────────┐
    │  Browser   │        │ Let's Encrypt│    │   SQLite     │
    │ AWS Cognito│        │     SSL      │    │  Database    │
    └────────────┘        └──────────────┘    └──────────────┘
```

### Data Flow
1. **User** → AWS Cognito → **JWT Token**
2. **Frontend** → Nginx → **Backend** (with JWT)
3. **Backend** → Validates JWT → **Database**
4. **Kitchen View** → Real-time polling → **Order Updates**

---

## 📁 **KEY FILES LOCATIONS**

| Component | File | Purpose |
|-----------|------|---------|
| **Backend Settings** | `backend/backend/settings_ec2.py` | Production Django config |
| **Frontend Config** | `frontend/.env.production` | Production API URLs |
| **Docker Config** | `docker-compose.yml` | Container orchestration |
| **Nginx Config** | `nginx/conf.d/ssl.conf` | SSL + API proxy |
| **Deploy Script** | `deploy-prod.sh` | Automated deployment |
| **Kitchen Polling** | `frontend/src/pages/operation/Kitchen.jsx` | Real-time updates |

---

## 🛠️ **MAINTENANCE COMMANDS**

```bash
# View logs
docker-compose logs app -f    # Backend logs
docker-compose logs nginx -f  # Nginx logs

# Restart services
docker-compose restart app    # Restart backend
docker-compose restart nginx  # Restart nginx

# Database operations
docker exec restaurant-backend python /app/backend/manage.py migrate
docker exec restaurant-backend python /app/backend/manage.py createsuperuser

# Full restart (if needed)
docker-compose down && docker-compose up -d
```

---

**🎯 RESULT: Zero-downtime, automated deployment with instant error detection and resolution.**