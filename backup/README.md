# 💾 BACKUP Y LIMPIEZA - Restaurant Web

## 🎯 Funcionalidades Principales

### 📥 **Sincronizar datos de Producción → Desarrollo**

```bash
# Método simple y directo (RECOMENDADO)
scp -i ubuntu_fds_key.pem ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com:/opt/restaurant-web/data/restaurant_prod.sqlite3 data/restaurant_dev.sqlite3
```

### 🧹 **Limpiar datos operacionales en Producción**

```bash
# Limpia órdenes, pagos, historial operacional en EC2
./backup/clean-prod-operational-data.sh
```

## ✅ Ventajas del Método SCP

1. **Un solo comando** - Sin scripts complejos
2. **Copia exacta** - Bit por bit de producción
3. **IDs originales** - Sin modificaciones
4. **Siempre funciona** - SCP es muy estable
5. **Rápido** - Descarga en segundos

---

## 🚀 Flujo de Trabajo

```bash
# 1. Sincronizar datos prod → dev
scp -i ubuntu_fds_key.pem ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com:/opt/restaurant-web/data/restaurant_prod.sqlite3 data/restaurant_dev.sqlite3

# 2. Iniciar desarrollo
./dev/start.sh

# 3. Trabajar con datos reales de producción
# 4. Testear cambios con datos reales

# OPCIONAL: Limpiar datos operacionales en producción
./backup/clean-prod-operational-data.sh
```

---

## 📁 Estructura de Archivos

```
data/
├── restaurant_dev.sqlite3      # 📊 Base de datos desarrollo (local)
└── backups/                    # 📁 Backups automáticos

# En producción EC2:
/opt/restaurant-web/data/
├── restaurant_prod.sqlite3     # 📊 Base de datos producción
└── backups/                    # 📁 Backups de producción
```

---

## 🧹 Script de Limpieza de Producción

### `clean-prod-operational-data.sh`

```bash
# ¿Qué hace?
1. ✅ Conecta a EC2 via SSH
2. ✅ Crea backup automático
3. ❌ Elimina órdenes, pagos, historial
4. ✅ Conserva menú, inventario, configuración
5. 🔍 Verifica integridad
```

### ⚠️ Confirmación de Seguridad
- Requiere escribir `LIMPIAR_PROD` para confirmar
- Crea backup automático antes de limpiar
- Opera directamente en el servidor EC2

---

## 🔄 Comandos Disponibles

```bash
# Sincronizar prod → dev (SIMPLE)
scp -i ubuntu_fds_key.pem ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com:/opt/restaurant-web/data/restaurant_prod.sqlite3 data/restaurant_dev.sqlite3

# Limpiar datos operacionales en producción
./backup/clean-prod-operational-data.sh

# Iniciar desarrollo
./dev/start.sh
```

---

## 📋 Ejemplos de Uso

### 🚀 **Sync Simple (Recomendado)**

```bash
# Descargar datos de producción
$ scp -i ubuntu_fds_key.pem ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com:/opt/restaurant-web/data/restaurant_prod.sqlite3 data/restaurant_dev.sqlite3

restaurant_prod.sqlite3          100%  328KB   1.2MB/s   00:00

# Iniciar desarrollo
$ ./dev/start.sh
✅ Desarrollo iniciado con datos de producción
```

### 🧹 **Limpiar Producción (Ocasional)**

```bash
$ ./backup/clean-prod-operational-data.sh

🧹 LIMPIAR DATOS OPERACIONALES PRODUCCIÓN - RESTAURANT WEB
=========================================================

⚠️  ATENCIÓN: Esta operación va a limpiar PRODUCCIÓN

🖥️  Servidor: EC2 ec2-44-248-47-186.us-west-2.compute.amazonaws.com
📋 Se eliminará:
   ❌ Todas las órdenes/pedidos de producción
   ❌ Historial de pagos de producción

✅ Se conservará:
   ✅ Menú completo (recetas, ingredientes)
   ✅ Configuración (mesas, zonas, containers)

¿Confirmar limpieza de datos operacionales en PRODUCCIÓN? (escribir 'LIMPIAR_PROD'): LIMPIAR_PROD

ℹ️  🧹 LIMPIEZA DE DATOS OPERACIONALES EN PRODUCCIÓN
✅ 🎉 Limpieza de producción completada exitosamente
```

---

**💡 Filosofía**: Simplicidad máxima - Un comando SCP para sync, un script para limpieza.