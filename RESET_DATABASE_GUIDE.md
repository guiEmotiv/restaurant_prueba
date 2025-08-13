# 🗑️ Guía de Limpieza Total de Base de Datos

Esta guía explica cómo eliminar **TODOS** los datos de la base de datos de producción y reiniciar los contadores de ID.

## ⚠️ ADVERTENCIAS IMPORTANTES

- **ESTO ELIMINA TODOS LOS DATOS** de la base de datos
- **NO HAY FORMA DE DESHACER** esta operación sin un backup
- Solo usar en casos extremos o para inicializar un ambiente limpio
- **SIEMPRE** crear un backup antes de proceder

## 🚀 Métodos de Ejecución

### Método 1: Script Automatizado (Recomendado)

```bash
# Desde el directorio raíz del proyecto
./reset-production-db.sh

# Con backup automático
./reset-production-db.sh --backup
```

### Método 2: Comando Django Directo

```bash
# Desde el directorio backend
cd backend

# Con backup
python manage.py reset_production_db --confirm --backup

# Sin backup (NO recomendado)
python manage.py reset_production_db --confirm
```

## 📋 Proceso Paso a Paso

### 1. Preparación
```bash
# Detener la aplicación en producción
docker-compose -f docker-compose.prod.yml stop

# O si usas systemd
sudo systemctl stop restaurant-app
```

### 2. Backup Manual (Altamente Recomendado)
```bash
# Crear backup manual de la base de datos
cp backend/restaurant_prod.sqlite3 backup_$(date +%Y%m%d_%H%M%S).sqlite3
```

### 3. Ejecutar Limpieza
```bash
# Ejecutar el script de limpieza
./reset-production-db.sh --backup
```

### 4. Verificación
```bash
# Verificar que la base de datos está vacía
cd backend
python manage.py verify_empty_db
```

### 5. Reinicialización (Opcional)
```bash
# Poblar con datos básicos
python manage.py populate_production

# Crear usuario administrador
python manage.py createsuperuser
```

### 6. Reiniciar Aplicación
```bash
# Reiniciar la aplicación en producción
docker-compose -f docker-compose.prod.yml start

# O con systemd
sudo systemctl start restaurant-app
```

## 🛡️ Medidas de Seguridad

### Confirmaciones Requeridas
1. **Flag `--confirm`**: Obligatorio para ejecutar el comando
2. **Verificación de entorno**: Detecta si DEBUG=True
3. **Confirmación manual**: Requiere escribir texto específico
4. **Confirmación final**: Última oportunidad para cancelar

### Backup Automático
- Use siempre `--backup` para crear backup automático
- El backup se nombra con timestamp: `backup_before_reset_YYYYMMDD_HHMMSS.sqlite3`
- Se guarda en el mismo directorio que la base de datos original

## 📊 Lo Que Se Elimina

### Datos de Configuración
- ✗ Todas las mesas y zonas
- ✗ Todas las unidades de medida
- ✗ Todos los contenedores
- ✗ Configuración operacional del restaurante

### Datos de Inventario
- ✗ Todos los grupos de productos
- ✗ Todos los ingredientes y stock
- ✗ Todas las recetas y precios
- ✗ Todas las relaciones receta-ingrediente

### Datos de Operación
- ✗ Todas las órdenes (activas e históricas)
- ✗ Todos los items de órdenes
- ✗ Todos los pagos y transacciones
- ✗ Todo el historial de ventas

### Contadores de ID
- ✗ Todos los contadores se reinician a 0
- ✗ Los nuevos registros empezarán con ID = 1

## 🔧 Comandos de Verificación

### Verificar Estado de la Base de Datos
```bash
python manage.py verify_empty_db
```

### Verificar Contadores
```bash
# Entrar a la base de datos SQLite
sqlite3 backend/restaurant_prod.sqlite3

# Verificar contadores
.schema sqlite_sequence
SELECT * FROM sqlite_sequence;

# Salir
.quit
```

### Verificar Tamaño de BD
```bash
ls -lh backend/restaurant_prod.sqlite3
```

## 🆘 Recuperación de Emergencia

### Si Algo Sale Mal
1. **Detener la aplicación inmediatamente**
2. **Restaurar desde backup**:
   ```bash
   cp backup_YYYYMMDD_HHMMSS.sqlite3 backend/restaurant_prod.sqlite3
   ```
3. **Reiniciar la aplicación**
4. **Verificar que todo funcione**

### Si No Hay Backup
- Los datos están **PERMANENTEMENTE PERDIDOS**
- Tendrás que reconstruir todo desde cero
- Considera usar `python manage.py populate_production` para datos básicos

## 📝 Logs y Monitoreo

### Archivos de Log a Revisar
- Logs de Django: Verificar errores durante la limpieza
- Logs de Docker: Si usas contenedores
- Logs del sistema: Para verificar que la aplicación se reinicie correctamente

### Verificaciones Post-Limpieza
1. ✅ Base de datos completamente vacía
2. ✅ Contadores reiniciados
3. ✅ Aplicación inicia sin errores
4. ✅ API responde correctamente
5. ✅ Frontend se conecta sin problemas

## 🔗 Scripts Relacionados

- `reset-production-db.sh`: Script principal de limpieza
- `backend/config/management/commands/reset_production_db.py`: Comando Django
- `backend/config/management/commands/verify_empty_db.py`: Verificación
- `backend/config/management/commands/populate_production.py`: Repoblación

---

## ⚠️ RECORDATORIO FINAL

**ESTE PROCESO ES IRREVERSIBLE SIN BACKUP**

Asegúrate de:
- [ ] Tener un backup completo y verificado
- [ ] Entender las consecuencias de eliminar todos los datos
- [ ] Tener un plan para repoblar la base de datos
- [ ] Coordinar con el equipo antes de ejecutar en producción