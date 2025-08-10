# 🚀 INSTRUCCIONES DE DEPLOYMENT PARA EC2

## ⚡ Deployment Rápido (Después de git push)

Ejecutar en el servidor EC2:

```bash
# 1. Ir al directorio del proyecto
cd /opt/restaurant-web

# 2. Hacer pull de los últimos cambios
sudo git pull origin main

# 3. DEPLOYMENT COMPLETO (limpia datos antiguos + puebla nuevos)
sudo ./deploy/build-deploy.sh

# 4. Solo frontend (si solo hay cambios de UI)
sudo ./deploy/build-deploy.sh --frontend-only

# 5. Forzar limpieza completa de datos (si hay problemas)
sudo docker-compose -f docker-compose.ec2.yml exec web python manage.py clean_database --confirm
sudo docker-compose -f docker-compose.ec2.yml exec web python manage.py populate_production_data
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
- ✅ **Comandos management**: `check_database` y `populate_production_data`
- ✅ **Endpoints debug**: `/api/v1/debug/database/` y `/api/v1/debug/api/`
- ✅ **Auto-population**: Script deployment puebla datos automáticamente

## 📱 Verificar Actualización en EC2

1. **Check version**: En la esquina inferior derecha debe aparecer timestamp actual
2. **Build banner**: Banner azul mostrando "Sistema actualizado"
3. **API Health**: Debe mostrar "Conectado" con punto verde  
4. **Datos visibles**: Mesas organizadas por zonas (Salón Principal, Terraza, Bar, VIP)
5. **Si NO hay datos**: Panel amarillo de debug con diagnóstico y soluciones

## 🐛 Troubleshooting

```bash
# Ver logs del contenedor backend
sudo docker-compose -f docker-compose.ec2.yml logs web

# Verificar estado de servicios
sudo docker-compose -f docker-compose.ec2.yml ps

# Test API health
curl -v https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/

# Debug base de datos
curl -v https://www.xn--elfogndedonsoto-zrb.com/api/v1/debug/database/

# Poblar datos manualmente si es necesario
sudo docker-compose -f docker-compose.ec2.yml exec web python manage.py populate_production_data --force

# Restart completo si es necesario
sudo docker-compose -f docker-compose.ec2.yml down
sudo ./deploy/build-deploy.sh
```

## 🎯 Problema Resuelto

### Problema Original:
1. **Paginación**: API limitaba a 20 registros por página
2. **Base de datos vacía**: Sin datos de producción en EC2
3. **Cache**: Frontend no se actualizaba por cache del navegador

### Solución Implementada:
1. **Paginación deshabilitada**: `pagination_class = None` en todos los ViewSets
2. **Auto-population**: Script deployment puebla datos automáticamente
3. **Cache busting**: Archivos únicos en cada build
4. **Debug tools**: Comandos y endpoints para diagnosticar problemas

**Archivos modificados**:
- `backend/config/views.py`: TableViewSet, ZoneViewSet sin paginación
- `backend/operation/views.py`: OrderViewSet, OrderItemViewSet sin paginación
- `backend/inventory/views.py`: GroupViewSet, RecipeViewSet sin paginación
- `backend/config/management/commands/`: Nuevos comandos de debug y población
- `frontend/`: Cache busting + version indicators + debug panel
- `deploy/build-deploy.sh`: Auto-población de datos

## ⚠️ IMPORTANTE

Para que los cambios se vean en EC2, **DEBE ejecutar el script de deployment** después de hacer git push. Los cambios solo están en el código, no en el build de producción hasta ejecutar el deploy.