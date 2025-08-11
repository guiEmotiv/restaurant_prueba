# 🧹 PLAN DE LIMPIEZA DE SCRIPTS

## 📊 Estado Actual
- **Total archivos**: 55
- **Scripts .sh**: ~45
- **Documentos .md**: ~8
- **Archivos .conf**: 1

## 🎯 Objetivo
Reducir a **10-15 archivos esenciales** bien organizados

## ✅ SCRIPTS ESENCIALES (MANTENER)

### 🚀 Deployment Principal
- **`build-deploy.sh`** - Script principal de deployment con opciones
- **`setup-initial.sh`** - Configuración inicial del proyecto

### 🔧 Mantenimiento
- **`final-fix.sh`** - Arreglos finales y verificación
- **`diagnose-connection.sh`** - Diagnóstico completo del sistema

### 🔒 SSL/HTTPS
- **`enable-ssl.sh`** - Habilitación de SSL en producción

### 📋 Utilidades
- **`README.md`** - Documentación principal
- **Un script de backup/restore** (si existe)

## 🗑️ SCRIPTS PARA ELIMINAR

### Scripts de Debug/Test (20+ archivos)
```bash
debug-*.sh (6 archivos)
test-*.sh (8 archivos)  
diagnose-*.sh (4 archivos) # Excepto diagnose-connection.sh
check-*.sh (2 archivos)
```

### Scripts Fix Específicos/Obsoletos (15+ archivos)
```bash
fix-allowed-hosts.sh
fix-api-complete.sh
fix-backend-api-ec2.sh
fix-dashboard-auth.sh
fix-dashboard-permissions.sh
fix-django-urls.sh
fix-domain-no-www.sh
fix-ec2-complete.sh
fix-ec2-frontend.sh
fix-frontend-mime-type.sh
fix-frontend.sh
fix-nginx-*.sh (5 archivos)
fix-port-conflict.sh
fix-ssl-*.sh (3 archivos)
```

### Scripts Experimentales/Duplicados
```bash
emergency-fix-www.sh
force-fix-allowed-hosts.sh
quick-fix-domain.sh
smart-deploy.sh
update-and-deploy.sh
backend-only.sh (funcionalidad incluida en build-deploy.sh)
frontend-only.sh (funcionalidad incluida en build-deploy.sh)
```

### Documentación Redundante
```bash
DOMAIN-FIX-README.md
DOMAIN-SETUP-GUIDE.md
EC2-DEPLOYMENT.md
FRONTEND_TROUBLESHOOTING.md
# Mantener solo README.md principal
```

## 🔄 SCRIPTS PARA CONSOLIDAR

### Nuevo: `maintenance.sh` 
Consolidar funciones de:
- enable-dashboard-access.sh
- fix-all-issues.sh
- Funciones de diagnóstico básico

### Optimizar: `build-deploy.sh`
- Integrar mejores funciones de scripts fix-*
- Añadir validaciones mejoradas
- Mantener opciones --frontend-only, --backend-only

## 📁 ESTRUCTURA FINAL PROPUESTA

```
deploy/
├── build-deploy.sh       # Script principal de deployment  
├── setup-initial.sh      # Configuración inicial
├── maintenance.sh        # Tareas de mantenimiento
├── diagnose-connection.sh # Diagnóstico completo
├── enable-ssl.sh         # Configuración SSL
├── final-fix.sh          # Arreglos finales
├── backup-restore.sh     # Backup y restore (nuevo)
├── README.md             # Documentación principal
├── DEPLOYMENT.md         # Guía de deployment (consolidado)
└── nginx.conf            # Configuración nginx de ejemplo
```

**Total: 10 archivos (reducción del 82%)**

## 🎯 BENEFICIOS DE LA LIMPIEZA

1. **Simplicidad**: Fácil encontrar el script correcto
2. **Mantenibilidad**: Menos scripts que actualizar
3. **Claridad**: Cada script tiene un propósito claro
4. **Confiabilidad**: Scripts mejor probados y consolidados
5. **Documentación**: Mejor organización de la información

## ⚠️ VALIDACIÓN ANTES DE ELIMINAR

1. Verificar que la funcionalidad esencial esté en scripts mantenidos
2. Probar scripts consolidados en environment de prueba
3. Hacer backup de scripts antes de eliminar
4. Actualizar documentación con nuevos comandos