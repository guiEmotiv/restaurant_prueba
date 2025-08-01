# 🍽️ Scripts de Administración de Base de Datos

Esta carpeta contiene scripts para la administración completa de la base de datos del sistema de restaurante.

## 📋 Scripts Disponibles

### 🎯 Script Principal
- **`database-manager.sh`** - Interfaz interactiva con menú para todas las operaciones

### 🛠️ Scripts Específicos
- **`database-clean-complete.sh`** - Limpiar completamente la base de datos
- **`database-populate.sh`** - Poblar datos desde backup o datos de prueba

## 🚀 Uso Rápido

### Interfaz Interactiva (Recomendado)
```bash
./deploy/database-manager.sh
```

### Comandos Directos

#### Limpiar Base de Datos
```bash
# Limpieza completa con confirmación
./deploy/database-clean-complete.sh

# Desde EC2
sudo /opt/restaurant-web/deploy/database-clean-complete.sh
```

#### Poblar Datos
```bash
# Datos de prueba
./deploy/database-populate.sh --test-data

# Desde backup específico
./deploy/database-populate.sh --backup-file archivo.json.gz

# Sin confirmación
./deploy/database-populate.sh --test-data --force
```

## 🔧 Funcionalidades

### ✨ database-manager.sh
- **Menú interactivo** con 6 opciones principales
- **Auto-detección** de entorno (Local vs EC2)
- **Verificación de estado** de base de datos en tiempo real
- **Proceso completo** limpiar + poblar en una operación

### 🗑️ database-clean-complete.sh
- **Eliminación completa** de todos los datos
- **Reinicio de contadores** (auto-increment IDs)
- **Preservación de estructura** (tablas, índices, constraints)
- **Backup automático** antes de limpiar (opcional)
- **Confirmación requerida** para evitar errores accidentales

### 📥 database-populate.sh
- **Múltiples fuentes** de datos:
  - Datos de prueba (populate_test_data)
  - Archivos de backup JSON
  - Archivos SQLite
- **Auto-detección** de tipo de archivo
- **Soporte para compresión** (.gz)
- **Verificación post-población**

## 🌍 Compatibilidad

### 💻 Desarrollo Local
- Ejecuta comandos Django directamente
- Usa `python` o `python3` automáticamente
- Trabaja desde directorio `backend/` o raíz del proyecto

### 🐳 EC2 Docker
- Auto-detección de archivos docker-compose
- Ejecución dentro de contenedores
- Manejo de servicios Docker automático

## 📊 Operaciones Detalladas

### 🧹 Limpieza Completa
```
🗑️  ELIMINACIÓN:
   • Todas las tablas de la aplicación
   • Datos de configuración (unidades, zonas, mesas)
   • Inventario (grupos, ingredientes, recetas)
   • Operaciones (órdenes, pagos, historial)
   • Usuarios de Django (admin, staff)

🔄 REINICIO:
   • Auto-increment IDs → 1
   • Secuencias SQLite reiniciadas

✅ PRESERVA:
   • Estructura de tablas
   • Índices y constraints
   • Migraciones de Django
```

### 📥 Población de Datos
```
🧪 DATOS DE PRUEBA:
   • Configuración básica del restaurante
   • Unidades, zonas, mesas
   • Ingredientes y recetas de ejemplo
   • Usuarios demo

📁 DESDE BACKUP:
   • Archivos JSON de Django (.json, .json.gz)
   • Bases de datos SQLite (.sqlite3)
   • Auto-detección de formato
   • Descompresión automática
```

## 📁 Archivos de Backup

### 🔍 Ubicaciones Buscadas
- Directorio actual
- `../data/`
- `data/`
- `backup/`
- `scripts/`

### 📋 Formatos Soportados
- **JSON Django**: `.json`, `.json.gz`
- **SQLite**: `.sqlite3`
- **Archivos comprimidos**: `.gz`

## 🛡️ Seguridad

### ⚠️ Confirmaciones Requeridas
- **Limpieza completa**: `"CONFIRMAR LIMPIEZA"`
- **Población**: Confirmación Y/N
- **Backup automático**: Opción antes de limpiar

### 🔒 Protecciones
- **No ejecución accidental** - Confirmaciones explícitas
- **Backup preventivo** - Opcional antes de operaciones destructivas
- **Verificación post-operación** - Confirmación de éxito

## 🚨 Casos de Uso Comunes

### 🔄 Desarrollo - Reset Completo
```bash
./deploy/database-manager.sh
# Opción 6: Limpiar + Poblar
```

### 🏗️ Setup Inicial
```bash
./deploy/database-populate.sh --test-data
python backend/manage.py createsuperuser
```

### 📦 Migración de Datos
```bash
# 1. Crear backup en servidor viejo
./deploy/database-manager.sh # → Opción 4

# 2. Limpiar en servidor nuevo
./deploy/database-clean-complete.sh

# 3. Restaurar backup
./deploy/database-populate.sh --backup-file backup_20240128_140530.json.gz
```

### 🐳 EC2 Production
```bash
# Acceder al servidor
ssh ubuntu@tu-servidor

# Cambiar al directorio de la aplicación
cd /opt/restaurant-web

# Ejecutar administrador
sudo ./deploy/database-manager.sh
```

## 🔍 Troubleshooting

### ❌ "manage.py not found"
- Ejecutar desde raíz del proyecto o directorio `backend/`
- Verificar que existe `backend/manage.py`

### ❌ "Python not found" 
- Los scripts auto-detectan `python3` o `python`
- En EC2 se ejecuta dentro del contenedor Docker

### ❌ "docker-compose file not found"
- EC2 busca `docker-compose.ec2.yml` luego `docker-compose.yml`
- Verificar que el archivo existe

### ❌ "backup file not found"
- Usar rutas absolutas o relativas correctas
- Verificar permisos de lectura del archivo

## 📝 Logs y Debug

### 🔍 Verificar Estado
```bash
./deploy/database-manager.sh
# Opción 5: Ver estado actual
```

### 📊 Información Mostrada
- **Tablas y registros** por tabla
- **Total de registros** en la BD
- **Usuarios Django** existentes
- **Tamaño de archivos** de backup
- **Estado de contenedores** (EC2)

## 🎯 Mejores Prácticas

1. **Siempre crear backup** antes de operaciones destructivas
2. **Usar el administrador interactivo** para operaciones complejas
3. **Verificar estado** después de cada operación
4. **Probar en desarrollo** antes de aplicar en producción
5. **Usar `--force`** solo en scripts automatizados

---

**Creado para Restaurant Management System** 🍽️  
**Compatible con desarrollo local y EC2 Docker** 🐳