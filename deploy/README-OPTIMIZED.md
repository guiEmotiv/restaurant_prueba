# 🚀 Restaurant Web - Optimized Deployment

**Ultra-optimized deployment for 7GB EC2 instances with AWS Cognito authentication.**

## 📦 Essential Scripts (Only 3 needed!)

### 1. **`master-deploy.sh`** - Complete Deployment
**Single script that does everything from scratch:**
- ✅ Ultra cleanup (frees maximum space)
- ✅ Install only essentials (nginx, no SSL complexity)
- ✅ Configure environment (.env.ec2 + frontend)
- ✅ Setup domain (HTTP) + Nginx proxy
- ✅ Build frontend (optimized)
- ✅ Deploy Docker containers
- ✅ Apply migrations + create database
- ✅ Create superuser (admin/admin123)
- ✅ Populate test data

**Usage:**
```bash
sudo ./deploy/master-deploy.sh
```

### 2. **`verify-deployment.sh`** - Health Check
**Comprehensive verification of deployment:**
- ✅ System status (disk, Docker, Nginx)
- ✅ Application endpoints (frontend, API, admin)
- ✅ Database status (tables, migrations)
- ✅ Authentication configuration
- ✅ Overall health percentage

**Usage:**
```bash
./deploy/verify-deployment.sh
```

### 3. **`reset-and-deploy.sh`** - Nuclear Reset
**Complete reset + fresh deployment:**
- ✅ Nuclear cleanup (removes everything)
- ✅ Pull latest code
- ✅ Execute master deployment
- ✅ Run verification
- ✅ Fresh start guaranteed

**Usage:**
```bash
sudo ./deploy/reset-and-deploy.sh
```

## 🎯 Quick Start

### First Time Setup
```bash
cd /opt/restaurant-web
git pull origin main
sudo ./deploy/master-deploy.sh
```

### Fresh Deployment (Reset Everything)
```bash
cd /opt/restaurant-web
sudo ./deploy/reset-and-deploy.sh
```

### Check Health
```bash
./deploy/verify-deployment.sh
```

## 📋 What You Get

### ✅ **Complete Application**
- **Frontend**: React SPA with AWS Cognito authentication
- **Backend**: Django REST API with SQLite database
- **Domain**: http://xn--elfogndedonsoto-zrb.com
- **Admin**: http://xn--elfogndedonsoto-zrb.com/api/v1/admin/

### ✅ **AWS Cognito Integration**
- **Region**: us-west-2
- **User Pool**: us-west-2_bdCwF60ZI
- **App Client**: 4i9hrd7srgbqbtun09p43ncfn0
- **Groups**: administradores, meseros

### ✅ **Production Ready**
- **Database**: SQLite with migrations applied
- **Static Files**: Nginx serving optimized
- **Security**: Proper CORS, headers, permissions
- **Monitoring**: Health checks, logging

### ✅ **Space Optimized**
- **Total Usage**: ~2-3GB (perfect for 7GB EC2)
- **No SSL complexity**: HTTP-only for maximum efficiency
- **Minimal packages**: Only nginx, Docker, Node.js essentials
- **Aggressive cleanup**: Removes docs, logs, caches

## 🔧 Configuration

### **Domain**: `xn--elfogndedonsoto-zrb.com`
### **Admin User**: `admin` / `admin123`
### **Database**: SQLite in `/opt/restaurant-web/data/`
### **Logs**: Available via `docker-compose logs`

## 💡 Key Optimizations

1. **Single Script Deployment**: Everything in one `master-deploy.sh`
2. **No SSL Complexity**: HTTP-only for maximum reliability
3. **Aggressive Cleanup**: Frees 3-4GB before deployment
4. **Minimal Dependencies**: Only nginx, no certbot/snap
5. **Smart Caching**: Preserves git, rebuilds efficiently
6. **Health Monitoring**: Built-in verification and diagnostics

## 🔍 Troubleshooting

### Application Not Loading
```bash
sudo ./deploy/reset-and-deploy.sh
```

### Check What's Wrong
```bash
./deploy/verify-deployment.sh
```

### View Logs
```bash
docker-compose -f docker-compose.ec2.yml logs --tail=50
```

## 📊 Space Usage

- **Initial EC2**: 7GB total
- **After cleanup**: ~6GB free
- **After deployment**: ~4GB free
- **Perfect balance**: Performance + space efficiency

---

**🎉 From zero to fully functional restaurant management system in one command!**