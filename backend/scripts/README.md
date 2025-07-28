# Scripts de Administración - Restaurant Management System

Este directorio contiene scripts útiles para la administración y mantenimiento del sistema.

## 📋 Scripts Disponibles

### 1. clean_orders_data.py - Limpieza de Datos de Órdenes

**Propósito**: Elimina todos los datos de pedidos (órdenes) de la base de datos. Útil cuando necesitas modificar recetas que tienen restricciones de integridad referencial.

**⚠️ ADVERTENCIA**: Este script elimina PERMANENTEMENTE:
- Todas las órdenes (Order)
- Todos los items de órdenes (OrderItem)
- Todos los ingredientes personalizados (OrderItemIngredient)
- Todos los pagos (Payment)
- Todos los items de pagos (PaymentItem)

**Uso**:
```bash
# Desde el directorio backend/
python manage.py shell < scripts/clean_orders_data.py

# O ejecutar directamente
cd backend/
python scripts/clean_orders_data.py
```

**Características**:
- Muestra un resumen de los datos actuales antes de eliminar
- Requiere confirmación explícita (escribir "SI ELIMINAR")
- Usa transacciones para asegurar integridad
- Muestra un reporte detallado de lo eliminado

### 2. sales_report.py - Reportes de Ventas Detallados

**Propósito**: Genera reportes completos y detallados de ventas (pedidos pagados) con toda la información consolidada.

**Uso**:
```bash
# Desde el directorio backend/
python manage.py shell < scripts/sales_report.py

# O ejecutar directamente
cd backend/
python scripts/sales_report.py
```

**Opciones de Reporte**:
1. **Reporte del día de hoy**: Ventas del día actual
2. **Reporte del mes actual**: Ventas desde el inicio del mes
3. **Reporte por rango de fechas**: Especificar fechas inicio y fin
4. **Reporte completo**: Todas las ventas históricas

**Información Incluida**:
- 📊 **Estadísticas Generales**:
  - Total de órdenes pagadas
  - Ingresos totales
  - Ticket promedio

- 💳 **Ventas por Método de Pago**:
  - Efectivo, Tarjeta, Transferencia, Yape/Plin
  - Montos y porcentajes

- 📍 **Ventas por Zona**:
  - Desglose por zona del restaurante
  - Cantidad de órdenes y montos

- 🏆 **Top 10 Items Más Vendidos**:
  - Productos más populares
  - Cantidad vendida e ingresos

- 📂 **Ventas por Grupo de Recetas**:
  - Bebidas, Platos principales, etc.
  - Desglose detallado por receta

**Exportación a CSV**:
- Opción de exportar reporte detallado a archivo CSV
- Incluye toda la información de cada orden:
  - Datos de la orden (ID, fechas, mesa)
  - Items con precios y personalizaciones
  - Información de pagos y pagadores

**Formato del CSV**:
```
Orden ID, Fecha Creación, Fecha Servido, Fecha Pagado, Mesa, Zona, Item, Grupo, Precio Unit., Precio Total, Notas, Personalizaciones, Método Pago, Monto Pago, Pagador
```

## 🚀 Requisitos

- Python 3.8+
- Django configurado correctamente
- Acceso a la base de datos
- Permisos de escritura para exportar CSV (para sales_report.py)

## 💡 Consejos de Uso

### Para Limpieza de Datos:
1. **Hacer backup primero**: Siempre respalda tu base de datos antes de ejecutar clean_orders_data.py
2. **Verificar dependencias**: Asegúrate de que no hay procesos activos usando las órdenes
3. **Horario adecuado**: Ejecutar fuera del horario de operación

### Para Reportes de Ventas:
1. **Frecuencia recomendada**: 
   - Diario: Al final del día operativo
   - Mensual: Para análisis de tendencias
2. **Almacenamiento de CSV**: Guardar en carpeta organizada por fecha
3. **Análisis adicional**: Los CSV pueden importarse a Excel o herramientas de BI

## 🔒 Seguridad

- Estos scripts requieren acceso administrativo
- No deben ser accesibles desde la web
- Mantener logs de ejecución para auditoría
- Considerar agregar autenticación adicional para producción

## 📝 Logs

Los scripts generan salidas detalladas en consola. Se recomienda redirigir la salida a archivos de log:

```bash
# Ejemplo de ejecución con log
python scripts/clean_orders_data.py > logs/clean_$(date +%Y%m%d_%H%M%S).log 2>&1
python scripts/sales_report.py > logs/report_$(date +%Y%m%d_%H%M%S).log 2>&1
```

## 🆘 Soporte

Si encuentras problemas:
1. Verificar que Django esté correctamente configurado
2. Revisar permisos de base de datos
3. Comprobar que los modelos existan y estén actualizados
4. Revisar los logs de error para más detalles