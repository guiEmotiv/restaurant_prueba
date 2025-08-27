# 🏗️ ARQUITECTURA DE DESARROLLO Y PRODUCCIÓN

## 📋 FLUJOS DE TRABAJO RECOMENDADOS

### **DESARROLLO LOCAL**

#### **Opción 1: Frontend + Backend Separados (RECOMENDADO)**
```bash
# Terminal 1: Backend Django
docker-compose -f docker-compose.dev.yml up app

# Terminal 2: Frontend React
cd frontend
npm run dev
```
- **Backend:** http://localhost:8000 (Django + API)
- **Frontend:** http://localhost:5173 (Vite hot-reload)
- **Base de datos:** SQLite desarrollo

#### **Opción 2: Stack Completo con Docker**
```bash
# Todo junto con nginx
docker-compose -f docker-compose.dev.yml --profile with-nginx up
```
- **Acceso:** http://localhost:8080
- **API:** http://localhost:8080/api/
- **Simulación de producción**

---

## 🚀 DEPLOYMENT A PRODUCCIÓN

### **1. Automatic Deploy (Push a main)**
```bash
git push origin main
```
- ✅ Se ejecuta automáticamente el workflow
- ✅ Build de frontend + backend
- ✅ Push a ECR
- ✅ Deploy en EC2
- ✅ Health checks

### **2. Manual Deploy**
```bash
# Deployment normal
gh workflow run deploy.yml

# Deploy con tipo específico
gh workflow run deploy.yml -f action=deploy
gh workflow run deploy.yml -f action=check
gh workflow run deploy.yml -f action=fix
```

### **3. Actions Disponibles**
- `deploy` - Deployment completo
- `check` - Solo health check
- `backup` - Backup de base de datos
- `ssl` - Setup certificados SSL
- `fix` - Arreglar problemas
- `debug` - Información de debugging
- `emergency` - Build local en EC2
- `activate-ssl` - Activar SSL para dominio

---

## 🔒 CONFIGURACIÓN SSL Y DOMINIO

### **Estado Actual:**
- **Dominio:** `xn--elfogndedonsoto-zrb.com`
- **Certificados SSL:** Let's Encrypt (automático)
- **Acceso HTTP:** Redirige a HTTPS
- **Acceso HTTPS:** Puerto 443

### **Para Activar SSL Completo:**
```bash
# 1. Verificar DNS apunta a tu EC2
dig xn--elfogndedonsoto-zrb.com

# 2. Activar SSL
gh workflow run deploy.yml -f action=activate-ssl

# 3. Verificar funcionamiento
curl -I https://xn--elfogndedonsoto-zrb.com
```

---

## 🛠️ COMANDOS ÚTILES

### **Desarrollo Local**
```bash
# Setup inicial
./scripts/dev-setup.sh

# Solo backend
docker-compose -f docker-compose.dev.yml up app

# Backend + frontend
docker-compose -f docker-compose.dev.yml --profile with-nginx up

# Frontend desarrollo
cd frontend && npm run dev

# Tests
docker-compose -f docker-compose.dev.yml exec app python manage.py test
cd frontend && npm test

# Django shell
docker-compose -f docker-compose.dev.yml exec app python manage.py shell
```

### **Producción**
```bash
# Deployment
gh workflow run deploy.yml

# Check status
gh run list --workflow="Restaurant Web Deploy"

# Ver logs
gh run view [RUN_ID] --log

# Health check
gh workflow run deploy.yml -f action=check

# Emergency fix
gh workflow run deploy.yml -f action=fix
```

---

## 📊 ARQUITECTURA DE DATOS

### **Desarrollo**
- **DB:** SQLite (`data/restaurant_dev.sqlite3`)
- **Migraciones:** Automáticas
- **Seed data:** Manual o fixtures

### **Producción**
- **DB:** SQLite (`data/restaurant_prod.sqlite3`)
- **Backups:** Automáticos antes de deploy
- **Migraciones:** Automáticas en entrypoint

---

## 🔄 WORKFLOW DE DESARROLLO

### **1. Feature Development**
```bash
# 1. Desarrollo local
git checkout -b feature/nueva-funcionalidad
./scripts/dev-setup.sh
# ... desarrollar ...

# 2. Test local
docker-compose -f docker-compose.dev.yml up app
cd frontend && npm run dev

# 3. Commit y push
git add .
git commit -m "feat: nueva funcionalidad"
git push origin feature/nueva-funcionalidad
```

### **2. Deploy to Production**
```bash
# 1. Merge a main
git checkout main
git merge feature/nueva-funcionalidad
git push origin main  # ← Esto dispara deploy automático

# 2. Verificar deploy
gh run list --workflow="Restaurant Web Deploy"

# 3. Verificar funcionamiento
curl -f https://xn--elfogndedonsoto-zrb.com/api/v1/health/
```

### **3. Troubleshooting**
```bash
# Si algo falla:
gh workflow run deploy.yml -f action=debug  # Ver qué pasa
gh workflow run deploy.yml -f action=fix    # Arreglar automático
gh workflow run deploy.yml -f action=emergency  # Plan B
```

---

## 🎯 PRÓXIMOS PASOS

1. **Activar SSL:** `gh workflow run deploy.yml -f action=activate-ssl`
2. **Verificar dominio:** `https://xn--elfogndedonsoto-zrb.com`
3. **Setup DNS:** Apuntar dominio a IP de EC2
4. **Monitoreo:** Configurar alerts de health check

¿Con qué parte quieres que empecemos?