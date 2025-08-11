# 🚀 Restaurant Web - Deployment Scripts

## 📁 Scripts Esenciales

| Script | Descripción | Uso |
|--------|-------------|-----|
| `setup-initial.sh` | Configuración inicial del proyecto | Una vez al inicio |
| `build-deploy.sh` | **Script principal de deployment** | Deployment regular |
| `enable-ssl.sh` | Configuración SSL/HTTPS | Cuando se necesite HTTPS |
| `maintenance.sh` | Tareas de mantenimiento del sistema | Mantenimiento |
| `final-fix.sh` | Arreglos finales y validación | Cuando hay problemas |
| `diagnose-connection.sh` | Diagnóstico completo del sistema | Troubleshooting |

## 🎯 Comandos Principales

### Configuración Inicial (Solo una vez)
```bash
sudo ./setup-initial.sh
```

### Deployment Principal
```bash
# Deployment completo
sudo ./build-deploy.sh

# Solo frontend (más rápido)
sudo ./build-deploy.sh --frontend-only

# Solo backend
sudo ./build-deploy.sh --backend-only

# Ver opciones
sudo ./build-deploy.sh --help
```

### SSL/HTTPS
```bash
sudo ./enable-ssl.sh
```

### Mantenimiento
```bash
# Ver estado del sistema
./maintenance.sh --status

# Reiniciar servicios
./maintenance.sh --restart

# Arreglar problemas comunes
./maintenance.sh --fix-all

# Ver todas las opciones
./maintenance.sh --help
```

### Diagnóstico y Solución de Problemas
```bash
# Diagnóstico completo
./diagnose-connection.sh

# Arreglos finales si hay problemas
sudo ./final-fix.sh
```

## 🔧 Flujo de Trabajo Típico

### 1. Primera Instalación
```bash
sudo ./setup-initial.sh
sudo ./build-deploy.sh
sudo ./enable-ssl.sh
```

### 2. Actualizaciones Regulares
```bash
git pull
sudo ./build-deploy.sh --frontend-only  # Si solo cambió frontend
# o
sudo ./build-deploy.sh                   # Si cambió backend también
```

### 3. Solución de Problemas
```bash
./diagnose-connection.sh                 # Ver qué está fallando
sudo ./final-fix.sh                      # Aplicar arreglos
./maintenance.sh --status                # Verificar estado
```

## 🌐 URLs del Sistema

- **Sitio Web**: https://www.xn--elfogndedonsoto-zrb.com/
- **API**: https://www.xn--elfogndedonsoto-zrb.com/api/v1/
- **Admin Django**: https://www.xn--elfogndedonsoto-zrb.com/admin/

## 📋 Información de Estado

### Verificar que todo funciona:
```bash
# Estado rápido
./maintenance.sh --status

# Logs en tiempo real
docker-compose -f docker-compose.ssl.yml logs -f

# Estado de contenedores
docker-compose -f docker-compose.ssl.yml ps
```

## 🆘 Troubleshooting

| Problema | Solución |
|----------|----------|
| Site no carga | `./diagnose-connection.sh` |
| API devuelve errores | `./maintenance.sh --fix-all` |
| SSL no funciona | `sudo ./enable-ssl.sh` |
| Dashboard vacío | Usuario debe loguearse con AWS Cognito |
| Cambios no se ven | `sudo ./build-deploy.sh --frontend-only` |

## 📚 Documentación Adicional

- **Guía Completa**: Ver `DEPLOYMENT.md` para guía detallada
- **Configuración**: Variables en `.env.ec2`
- **Logs**: `docker-compose logs` para debugging
- **Backup**: Scripts automáticamente crean backups antes de cambios importantes

## 🎉 Scripts Eliminados

Durante la optimización se eliminaron **48 scripts obsoletos** incluyendo:
- Scripts de debug específicos
- Scripts fix duplicados  
- Scripts experimentales
- Documentación redundante

**Resultado**: De 55 archivos → 9 archivos esenciales (reducción del 84%)