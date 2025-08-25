# 🚀 DEPLOYMENT - Restaurant Web (Dev → Prod)

## 🔒 SEGURIDAD REFORZADA

- ✅ **SECRET_KEY único** generado automáticamente
- ✅ **ALLOWED_HOSTS restringido** (sin wildcard *)  
- ✅ **USE_COGNITO_AUTH=True** por defecto en producción
- ✅ **Rate limiting** configurado en nginx (30 req/min API, 5 req/min login)
- ✅ **Headers de seguridad** (XSS, Content-Type, Frame Options)
- ✅ **SSL/TLS 1.2+** con ciphers seguros
- ✅ **Verificación automática** antes de cada deploy

## ⚡ Comandos Principales

```bash
# 🎯 RECOMENDADO: Deploy completo
./prod/deploy.sh --full

# 🔍 Verificar estado
./prod/deploy.sh --check

# 🔄 Rollback si hay problemas
./prod/deploy.sh --rollback
```

## 🌐 URLs de Producción

- **🏠 Sitio Web**: https://www.xn--elfogndedonsoto-zrb.com/
- **🔧 API**: https://www.xn--elfogndedonsoto-zrb.com/api/v1/

## 📋 Flujo de Deploy

### 🎯 Deploy Normal (Cambios de Código)
```bash
# 1. Desarrollo local
./dev/start.sh
# ... hacer cambios ...

# 2. Deploy a producción
./prod/deploy.sh --full

# 3. Verificar
./prod/deploy.sh --check
```

### 📊 Deploy con Datos (Menú/Configuración)
```bash
# 1. Actualizar datos en desarrollo
./dev/start.sh
# ... cambios en menú/configuración ...

# 2. Deploy con sincronización de BD
./prod/deploy.sh --sync

# 3. Verificar cambios
./prod/deploy.sh --check
```

### 🔄 Deploy con Solo Migraciones
```bash
# Si solo necesitas aplicar migraciones sin rebuild de frontend
ssh -i ubuntu_fds_key.pem ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com
cd /opt/restaurant-web
git pull origin main
docker-compose exec app python /app/backend/manage.py migrate --fake-initial
docker-compose exec app python /app/backend/manage.py migrate
docker-compose restart app
```

## 🔧 Comandos de Monitoreo

```bash
# Ver logs en tiempo real
docker-compose logs app nginx -f

# Estado de contenedores
docker ps

# Reiniciar servicios si es necesario
docker-compose restart app nginx

# Ver migraciones aplicadas
docker-compose exec app python /app/backend/manage.py showmigrations

# Verificar configuración de BD
docker-compose exec app python /app/backend/manage.py check --database default
```

## 🚨 Solución de Problemas

### ⚡ Problemas Comunes
```bash
# Error 500 en API (problema de migración más común)
./prod/deploy.sh --full  # Aplica migraciones automáticamente

# Si el deploy falla completamente
./prod/deploy.sh --rollback

# Si hay errores de contenedores
docker-compose restart app nginx

# Si hay problemas específicos de migraciones
docker-compose exec app python /app/backend/manage.py migrate --fake-initial
docker-compose exec app python /app/backend/manage.py migrate

# Verificar salud después de fix
./prod/deploy.sh --check
```

### 🗄️ Problemas de Migraciones
```bash
# Verificar migraciones pendientes
docker-compose exec app python /app/backend/manage.py showmigrations --plan

# Aplicar migraciones manualmente (si --full falla)
docker-compose exec app python /app/backend/manage.py migrate --fake-initial
docker-compose exec app python /app/backend/manage.py migrate

# Reset completo de migraciones (último recurso)
docker-compose exec app python /app/backend/manage.py migrate --fake-initial --run-syncdb
```

## 🎯 Lo que Hace Cada Comando

- **`--full`**: Deploy completo con rebuild de frontend, migraciones automáticas y verificaciones
- **`--sync`**: Deploy + reemplaza BD producción con desarrollo [DESTRUCTIVO]
- **`--check`**: Verifica que todo esté funcionando (contenedores, web, API)
- **`--rollback`**: Vuelve código y BD a la versión anterior

## 🔄 Nuevo Sistema de Migraciones Automáticas

### ✅ El deploy `--full` ahora incluye:
1. **Verificación previa** de migraciones locales
2. **Aplicación automática** de migraciones en producción
3. **Manejo inteligente** de migraciones problemáticas (fake cuando es necesario)
4. **Validación post-migración** de la BD
5. **Restart automático** de servicios después de migraciones

### 🛡️ Migraciones Problemáticas Manejadas:
- `config.0013` (RestaurantOperationalConfig)
- `operation.0021` (CartItem table)
- `operation.0018-0020` (Container fields)
- Aplicación de `--fake-initial` cuando es necesario

## ⚠️ Importante

- **Usar `--full`** para TODOS los cambios (código + migraciones automáticas)
- **Solo usar `--sync`** para sincronizar datos de menú completos
- **Si algo falla, usar `--rollback`** (ahora incluye rollback de código)
- **Siempre verificar con `--check`** después del deploy
- **Las migraciones se aplican automáticamente** - no requiere intervención manual