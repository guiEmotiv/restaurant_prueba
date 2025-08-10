# 🚀 INSTRUCCIONES DE DEPLOYMENT PARA EC2

## ⚡ Deployment Rápido (Después de git push)

Ejecutar en el servidor EC2:

```bash
# 1. Ir al directorio del proyecto
cd /opt/restaurant-web

# 2. Hacer pull de los últimos cambios
sudo git pull origin main

# 3. Rebuild completo (SOLO FRONTEND - más rápido)
sudo ./deploy/build-deploy.sh --frontend-only

# 4. O deployment completo si hay cambios de backend
sudo ./deploy/build-deploy.sh
```

## 🔧 Cambios Realizados para Forzar Actualización

### Frontend (React/Vite):
- ✅ **Cache busting**: Filenames únicos con timestamp
- ✅ **Build time injection**: Meta tag con build time
- ✅ **Version indicator**: Visible en esquina inferior derecha
- ✅ **Headers anti-cache**: No-cache para HTML
- ✅ **Build banner**: Muestra información de actualización

### Backend (Django):
- ✅ **Paginación deshabilitada**: Todos los ViewSets críticos
- ✅ **Logs mejorados**: Debug completo de API responses

## 📱 Verificar Actualización en EC2

1. **Check version**: En la esquina inferior derecha debe aparecer timestamp actual
2. **Build banner**: Banner azul mostrando "Sistema actualizado"
3. **API Health**: Debe mostrar "Conectado" con punto verde
4. **Debug panel**: Debe mostrar conteos de registros reales

## 🐛 Troubleshooting

```bash
# Ver logs del contenedor backend
sudo docker-compose -f docker-compose.ec2.yml logs web

# Verificar estado de servicios
sudo docker-compose -f docker-compose.ec2.yml ps

# Test API health
curl -v https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/

# Restart completo si es necesario
sudo docker-compose -f docker-compose.ec2.yml down
sudo ./deploy/build-deploy.sh
```

## 🎯 Problema Resuelto

**Antes**: Paginación limitaba a 20 registros
**Después**: Todos los registros se cargan sin paginación

**Archivos modificados**:
- `backend/config/views.py`: TableViewSet, ZoneViewSet
- `backend/operation/views.py`: OrderViewSet, OrderItemViewSet  
- `backend/inventory/views.py`: GroupViewSet, RecipeViewSet
- `frontend/`: Cache busting + version indicators

## ⚠️ IMPORTANTE

Para que los cambios se vean en EC2, **DEBE ejecutar el script de deployment** después de hacer git push. Los cambios solo están en el código, no en el build de producción hasta ejecutar el deploy.