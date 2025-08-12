# 🏗️ GUÍA DE DESARROLLO PROFESIONAL

## 📋 DESCRIPCIÓN

Este proyecto está configurado para mantener **paridad completa** entre desarrollo y producción, siguiendo las mejores prácticas de DevOps.

## 🎯 ARQUITECTURA DE AMBIENTES

### DESARROLLO LOCAL
- **Frontend**: React + Vite con Hot Reload
- **Backend**: Django en Docker (idéntico a prod)
- **Database**: SQLite en volumen Docker
- **Proxy**: Nginx (misma config que prod)
- **Auth**: AWS Cognito (mismas credenciales)

### PRODUCCIÓN EC2
- **Frontend**: React build estático
- **Backend**: Django en Docker
- **Database**: SQLite en volumen persistente  
- **Proxy**: Nginx con SSL/HTTPS
- **Auth**: AWS Cognito

## 🚀 SETUP INICIAL

### 1. Configurar Desarrollo
```bash
# Una sola vez - configura todo automáticamente
./scripts/dev-setup.sh
```

### 2. URLs de Desarrollo
- **Frontend**: http://localhost:3000 (idéntico a prod)
- **Backend API**: http://localhost:8000
- **Hot Reload**: http://localhost:5173 (opcional)

## 🔄 WORKFLOW DIARIO

### 1. Desarrollo Normal
```bash
# Iniciar ambiente
docker-compose -f docker-compose.dev.yml up -d

# Ver logs
docker-compose -f docker-compose.dev.yml logs -f

# Detener
docker-compose -f docker-compose.dev.yml down
```

### 2. Desarrollo con Hot Reload
```bash
# Para cambios frecuentes de frontend
docker-compose -f docker-compose.dev.yml --profile dev-hot-reload up -d

# Frontend estará en http://localhost:5173 con hot reload
# Backend sigue en http://localhost:8000
```

### 3. Testing
```bash
# El ambiente de desarrollo ES idéntico a producción
# Lo que funciona en dev, funciona en prod

# Test backend
curl http://localhost:8000/api/v1/health/

# Test frontend  
curl http://localhost:3000/health
```

## 🚢 DEPLOY A PRODUCCIÓN

### Deploy Automatizado
```bash
# Script profesional que hace TODO automáticamente
./scripts/deploy.sh
```

### Deploy Manual (si necesario)
```bash
# 1. Build frontend
cd frontend && npm run build && cd ..

# 2. Commit y push
git add -A
git commit -m "feat: nueva funcionalidad"
git push origin main

# 3. Deploy en EC2
ssh ec2-user@44.248.47.186
cd /opt/restaurant-web
git pull origin main
cd frontend && npm run build && cd ..
sudo docker-compose -f docker-compose.prod.yml down
sudo docker-compose -f docker-compose.prod.yml up -d --build
```

## 🔧 CONFIGURACIÓN DE VARIABLES

### Desarrollo (.env.dev)
```env
DEBUG=False  # ✅ Mismo que producción
USE_COGNITO_AUTH=True
AWS_REGION=us-west-2
COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI
COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0
```

### Producción (.env.ec2) 
```env
DEBUG=False
USE_COGNITO_AUTH=True
AWS_REGION=us-west-2
COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI
COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0
```

**✅ Las variables son IDÉNTICAS = Paridad garantizada**

## 🏷️ GESTIÓN DE VERSIONES

### Branching Strategy
```
main (producción)
  ├── develop (desarrollo)
  └── feature/nueva-funcionalidad
```

### Commits Profesionales
```bash
# Formato: tipo(scope): descripción
git commit -m "feat(orders): add item to existing order"
git commit -m "fix(auth): resolve cognito token refresh"
git commit -m "refactor(api): optimize table queries"
```

## 🧪 TESTING STRATEGY

### 1. Desarrollo
- Test en ambiente Docker idéntico a prod
- Mismo `DEBUG=False`, misma auth, mismo setup

### 2. Pre-Deploy  
- `./scripts/deploy.sh` ejecuta tests automáticamente
- Verifica que dev environment funcione antes de deploy

### 3. Post-Deploy
- Health checks automáticos
- Verificación de APIs en producción

## 📊 MONITORING

### Logs en Desarrollo
```bash
# Ver todos los logs
docker-compose -f docker-compose.dev.yml logs -f

# Solo backend
docker-compose -f docker-compose.dev.yml logs -f web

# Solo nginx
docker-compose -f docker-compose.dev.yml logs -f nginx
```

### Logs en Producción
```bash
ssh ec2-user@44.248.47.186
cd /opt/restaurant-web
sudo docker-compose -f docker-compose.prod.yml logs -f
```

## 🚨 TROUBLESHOOTING

### Problema: "Los datos no aparecen"
```bash
# Verificar backend
curl http://localhost:8000/api/v1/health/

# Verificar auth
docker-compose -f docker-compose.dev.yml logs web | grep -i cognito
```

### Problema: "Frontend no carga"
```bash
# Rebuild frontend
cd frontend && npm run build && cd ..
docker-compose -f docker-compose.dev.yml restart nginx
```

### Problema: "Deploy falla"
```bash
# Verificar que dev funcione primero
./scripts/dev-setup.sh

# Luego intentar deploy
./scripts/deploy.sh
```

## ✅ BENEFICIOS DE ESTA ARQUITECTURA

1. **Paridad Dev/Prod**: Lo que funciona en dev, funciona en prod
2. **Deploy Seguro**: Tests automáticos antes de deploy  
3. **Rollback Rápido**: Docker permite rollback instantáneo
4. **Escalabilidad**: Fácil agregar más servicios
5. **Profesional**: Siguiendo best practices de DevOps

---

**💡 TIP**: Siempre desarrolla en el ambiente Docker para garantizar que tu código funcionará en producción.