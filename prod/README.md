# 🚀 DEPLOYMENT - Restaurant Web (Dev → Prod)

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

## 🔧 Comandos de Monitoreo

```bash
# Ver logs en tiempo real
docker-compose logs app nginx -f

# Estado de contenedores
docker ps

# Reiniciar servicios si es necesario
docker-compose restart app nginx
```

## 🚨 Solución de Problemas

### ⚡ Problemas Comunes
```bash
# Si el deploy falla
./prod/deploy.sh --rollback

# Si hay errores de contenedores
docker-compose restart app nginx

# Si hay problemas de base de datos
./prod/deploy.sh --check
```

## 🎯 Lo que Hace Cada Comando

- **`--full`**: Deploy completo con rebuild de frontend y backend
- **`--sync`**: Deploy + reemplaza BD producción con desarrollo [CUIDADO]
- **`--check`**: Verifica que todo esté funcionando
- **`--rollback`**: Vuelve a la versión anterior

## ⚠️ Importante

- Siempre usar `--full` para cambios de código
- Solo usar `--sync` para actualizar menú/configuración
- Si algo falla, usar `--rollback` inmediatamente
- Siempre verificar con `--check` después del deploy