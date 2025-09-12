# 🚀 Restaurant Web - Deployment Simple

**Script ligero y efectivo para tu primer deployment** 

## ⚡ USO RÁPIDO

```bash
# En tu EC2, ejecuta solo esto:
./scripts/prod/deploy-simple.sh
```

## 🎯 ¿Qué hace este script simplificado?

### ✅ **Solo lo esencial:**
1. **🧹 Limpieza mínima** - Libera espacio sin complicaciones
2. **📦 Instala solo lo necesario** - Docker, Node.js, Nginx
3. **🏗️ Build optimizado** - Frontend con menos memoria
4. **🗄️ Base de datos simple** - SQLite + migraciones
5. **🌐 Nginx básico** - HTTP primero, SSL después
6. **🚀 Servicios activos** - Todo funcionando

### 🚫 **Evita problemas comunes:**
- No instala dependencias innecesarias
- Usa menos memoria para el build
- Configuración HTTP primero (más estable)
- Manejo de errores mejorado
- Logs claros y simples

## 📋 **Proceso paso a paso**

### 1. **En tu máquina local:**
```bash
git add .
git commit -m "deploy simple ready"
git push origin main
```

### 2. **En tu EC2:**
```bash
# Conectar
ssh -i ubuntu_fds_key.pem ubuntu@44.248.47.186

# Ir al proyecto
cd /opt/restaurant-web  # o donde esté tu proyecto

# Actualizar código
git pull origin main

# Ejecutar deployment simple
./scripts/prod/deploy-simple.sh
```

## 🌐 **Resultado**

Tu aplicación funcionará en:
- **🏠 Sitio:** http://www.xn--elfogndedonsoto-zrb.com
- **🔧 Admin:** http://www.xn--elfogndedonsoto-zrb.com/admin
- **Credenciales:** admin / admin123

## 🔒 **Agregar SSL después** (Opcional)

Una vez que funcione con HTTP, agregar SSL es simple:

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d www.xn--elfogndedonsoto-zrb.com -d xn--elfogndedonsoto-zrb.com
```

## ⚡ **Ventajas del script simple:**

- ✅ **Menor uso de memoria** (build con 1GB en lugar de 4GB)
- ✅ **Menos dependencias** (solo lo esencial)
- ✅ **HTTP primero** (más estable para debugging)
- ✅ **Logs claros** (fácil de entender qué pasó)
- ✅ **Recuperación rápida** (si algo falla, se reinicia fácil)
- ✅ **SSL opcional** (agregas cuando todo funcione)

## 🔧 **Comandos útiles después del deployment:**

```bash
# Ver estado
docker-compose -f docker-compose.production.yml ps

# Ver logs
docker-compose -f docker-compose.production.yml logs -f

# Reiniciar
docker-compose -f docker-compose.production.yml restart

# Detener
docker-compose -f docker-compose.production.yml down
```

---

## 🎯 **¡Perfecto para primer deployment!**

Este script está optimizado para:
- ✅ Servidores con menos recursos
- ✅ Deployment rápido y sin complicaciones  
- ✅ Debugging fácil si algo falla
- ✅ Base sólida para agregar SSL después