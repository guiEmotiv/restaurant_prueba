# 🗄️ Database Restore - Restaurant Web

## 📋 **Descripción**
Este directorio contiene todo lo necesario para restaurar completamente la base de datos de producción desde un backup completo.

## 📁 **Archivos Incluidos**

### ✅ **Archivos Principales**
- **`full_restore_production.py`** - Script completo de restauración
- **`backup_config_prod_20250819_082211.json`** - Backup original (19 Ago 2025)
- **`README.md`** - Esta documentación

## 🚀 **Uso Rápido**

### **Restauración Completa de Producción:**

```bash
# Paso 1: Ir al directorio del proyecto
cd /Users/guillermosotozuniga/restaurant-web

# Paso 2: Copiar script al servidor
scp -o StrictHostKeyChecking=no -i ubuntu_fds_key.pem database-restore/full_restore_production.py ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com:/opt/restaurant-web/

# Paso 3: Ejecutar restauración
ssh -o StrictHostKeyChecking=no -i ubuntu_fds_key.pem ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com "cd /opt/restaurant-web && /usr/bin/docker cp full_restore_production.py restaurant-backend:/app/ && /usr/bin/docker exec restaurant-backend python /app/full_restore_production.py"
```

## 📊 **Qué Restaura**

El script `full_restore_production.py` restaura TODOS los datos del backup:

- ✅ **6 Units** (Kg, gr, Lt, mL, Unidad, Porcion)
- ✅ **2 Zones** (Primer Nivel, Terraza)  
- ✅ **21 Tables** (P01-P09, T01-T12)
- ✅ **7 Groups** (Anticuchos, Parrillas, Alitas, etc.)
- ✅ **12 Containers** (Tapers, botellas, bolsas)
- ✅ **41 Ingredients** (Carnes, acompañamientos, bebidas, ajíes)
- ✅ **25 Recipes** (Menú completo del restaurante)
- ✅ **151 Recipe Items** (Relaciones receta-ingrediente)

## ⚠️ **Advertencias**

- **ELIMINA TODOS** los datos actuales de producción
- **RESETEA** todos los contadores de ID
- **RESTAURA** desde backup del 19/08/2025
- **Requiere confirmación** antes de ejecutar

## 📈 **Resultado Esperado**

```
✅ RESTAURACIÓN COMPLETA EXITOSA
📊 VERIFICACIÓN FINAL COMPLETA:
   - Units: 6
   - Zones: 2
   - Tables: 21
   - Groups: 7
   - Containers: 12
   - Ingredients: 41
   - Recipes: 25
   - Recipe Items: 151
```

## 🎯 **Próximos IDs después de la restauración**
- Containers: ID 13
- Ingredients: ID 42
- Recipes: ID 26  
- Recipe Items: ID 186

---
**Creado:** 23 Agosto 2025  
**Última actualización:** 23 Agosto 2025  
**Estado:** ✅ Probado y funcionando en producción