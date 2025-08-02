# 🍽️ Scripts de El Fogón de Don Soto

## Script Principal

### `setup_database.sh` - Configuración Completa de Base de Datos
**Script único para gestión completa de la base de datos**

```bash
# En EC2 (Producción)
sudo ./scripts/setup_database.sh

# En desarrollo local
./scripts/setup_database.sh
```

**Funciones:**
- 🗑️ Limpia completamente la base de datos
- 🌱 Pobla con datos del restaurante (zonas, mesas, ingredientes, recetas)
- ✅ Verifica que todo funcione correctamente
- 🔒 Confirmación de seguridad en producción
- 📊 Muestra resumen de datos creados

## Scripts de Análisis (Para Desarrollo)

### `analyze_database_schema.sh` - Análisis de Esquema
Analiza el esquema real de la base de datos en producción.

### `analyze_django_models.py` - Análisis de Modelos Django
Analiza los modelos Django y sus campos.

### `compare_databases.py` - Comparación de Bases de Datos
Compara esquemas entre desarrollo y producción.

## Uso Recomendado

**Para configurar el restaurante:**
```bash
sudo ./scripts/setup_database.sh
```

**Para análisis técnico:**
```bash
sudo ./scripts/analyze_database_schema.sh
python ./scripts/analyze_django_models.py
```

## Datos Incluidos

- **5 zonas**: Terraza Principal, Salón Interior, Área VIP, Barra, Jardín
- **15 mesas**: Distribuidas por zonas (T01-T05, S01-S04, V01-V02, B01-B02, J01-J02)
- **16 ingredientes**: Carnes, verduras, bebidas, condimentos
- **10 recetas**: Parrilladas, lomo saltado, bebidas, acompañamientos
- **Órdenes de ejemplo**: Para probar el sistema

## Arquitectura

El sistema sigue una arquitectura robusta:
- Limpieza en orden de dependencias inversas
- Población con transacciones atómicas
- Verificación de integridad de datos
- Compatible con desarrollo y producción