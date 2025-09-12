# ⚡ Restaurant Web - Deployment Ultra

**Script ultra-práctico, mínimo y efectivo para EC2**

## 🚀 USO (1 solo comando)

```bash
./scripts/prod/deploy-ultra.sh
```

## ✅ ¿Qué hace?

1. **🧹 Limpia espacio** (sin validaciones innecesarias)
2. **📦 Instala solo lo mínimo** (Docker, Node 18, Nginx)
3. **🏗️ Build con 512MB** (en lugar de 2GB+)
4. **🗄️ BD express** (SQLite + admin)
5. **🌐 HTTP directo** (sin SSL complicado)
6. **🚀 Inicia todo** (verificación simple)

## 💡 Optimizaciones principales

- ✅ **Instala Node 18** (más ligero que 20)
- ✅ **Build con 512MB** (vs 2-4GB del script anterior)
- ✅ **Sin dependencias opcionales** (--no-optional --no-audit)
- ✅ **Sin validaciones complejas** (directo al grano)
- ✅ **HTTP primero** (SSL después si quieres)
- ✅ **Solo 1 contenedor** (backend, nginx local)

## 📊 Resultado

- **Espacio usado:** ~500MB (vs 2GB+ anterior)
- **Tiempo:** ~3-5 minutos (vs 15-20 min)
- **RAM necesaria:** ~1GB (vs 4GB+)

## 🌐 Acceso

Después del deployment:
- **App:** http://TU_IP o http://www.xn--elfogndedonsoto-zrb.com
- **Admin:** /admin (admin/admin123)

## 🔒 SSL Opcional (después)

Si quieres HTTPS:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d www.xn--elfogndedonsoto-zrb.com
```

---

## ⚡ **ESTE SCRIPT ES PERFECTO PARA:**

- ✅ Servidores con poca RAM (1-2GB)
- ✅ Primer deployment sin complicaciones
- ✅ Desarrollo rápido → producción
- ✅ Proyectos que necesitan funcionar YA
- ✅ Sin perder tiempo en validaciones complejas

**¡Ultra-práctico, ultra-rápido, ultra-efectivo!** 🎯